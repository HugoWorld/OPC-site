#!/bin/bash
set -euo pipefail

# ------------------------------------------------------------------
# OPC 个人站 · 一键安装
# 目标：一台干净的 Linux 云主机，执行 bash install.sh 即可。
# 会做：检查/安装 Docker → 生成 .env → 构建并启动容器 → 健康检查
#
# 参数：
#   --demo               演示模式，不询问飞书配置；访客站可看
#   --image              使用 GHCR 预构建镜像，不在本机构建
#   --no-docker-install   不自动安装 Docker（需已手动安装）
#   --non-interactive     不交互，全部用演示模式
# ------------------------------------------------------------------

cd "$(dirname "$0")"

DEMO=0
INSTALL_DOCKER=1
NON_INTERACTIVE=0
USE_IMAGE=0
for arg in "$@"; do
  case "$arg" in
    --demo) DEMO=1 ;;
    --no-docker-install) INSTALL_DOCKER=0 ;;
    --non-interactive) NON_INTERACTIVE=1 ;;
    --image) USE_IMAGE=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "未知参数：$arg" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*" >&2; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || fail "需要 root 或 sudo 权限来安装 Docker/启动服务。"
  sudo -n true >/dev/null 2>&1 || fail "当前 sudo 需要输入密码；请用 root 执行，或先配置免密 sudo。"
  SUDO="sudo"
fi

say "1/5 检查 Docker"
if ! $SUDO docker info >/dev/null 2>&1; then
  if [ "$INSTALL_DOCKER" -eq 0 ]; then
    fail "未检测到 Docker。请先安装 Docker Engine + Compose，再重新执行。"
  fi
  command -v curl >/dev/null 2>&1 || fail "未检测到 curl，请先安装 curl。"
  warn "未检测到 Docker，正在使用官方脚本安装（https://get.docker.com）。"
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  $SUDO sh /tmp/get-docker.sh
  if [ -n "$SUDO" ]; then
    $SUDO systemctl enable --now docker >/dev/null 2>&1 || true
  fi
fi
$SUDO docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 不可用；请升级 Docker。"
COMPOSE="$SUDO docker compose"

say "2/5 生成配置"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已创建 .env"
fi
# .env 里有 App Secret 与会话密钥，只允许当前用户读写。
chmod 600 .env 2>/dev/null || true

secret="$(openssl rand -hex 32 2>/dev/null || true)"
if [ -z "$secret" ]; then
  secret="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi
sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${secret}|" .env

# 部署令牌：OAuth 不可用时的管理员应急入口；已存在非空值则保留。
bootstrap="$(openssl rand -hex 24 2>/dev/null || true)"
if [ -z "$bootstrap" ]; then
  bootstrap="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi
if ! grep -q '^ADMIN_BOOTSTRAP_TOKEN=.\+' .env; then
  if grep -q '^ADMIN_BOOTSTRAP_TOKEN=' .env; then
    sed -i "s|^ADMIN_BOOTSTRAP_TOKEN=.*|ADMIN_BOOTSTRAP_TOKEN=${bootstrap}|" .env
  else
    printf 'ADMIN_BOOTSTRAP_TOKEN=%s\n' "$bootstrap" >> .env
  fi
fi

# 管理员账号密码：飞书扫码不可用时的备用入口；已存在非空值则保留。
login_password="$(openssl rand -hex 8 2>/dev/null || true)"
if [ -z "$login_password" ]; then
  login_password="$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi
if ! grep -q '^ADMIN_LOGIN_PASSWORD=.\+' .env; then
  if grep -q '^ADMIN_LOGIN_PASSWORD=' .env; then
    sed -i "s|^ADMIN_LOGIN_PASSWORD=.*|ADMIN_LOGIN_PASSWORD=${login_password}|" .env
  else
    printf 'ADMIN_LOGIN_PASSWORD=%s\n' "$login_password" >> .env
  fi
fi

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

if [ "$DEMO" -eq 1 ] || [ "$NON_INTERACTIVE" -eq 1 ]; then
  set_env HUGOW_DEMO 1
else
  say "填写飞书配置（直接回车 = 跳过，先用演示模式）"
  read -r -p "飞书 App ID: " app_id || true
  read -r -s -p "飞书 App Secret: " app_secret || true; echo
  read -r -p "多维表格 Base app_token: " base_token || true
  read -r -p "管理员 open_id（可逗号分隔）: " admin_ids || true

  if [ -n "${app_id:-}" ] && [ -n "${app_secret:-}" ] && [ -n "${base_token:-}" ] && [ -n "${admin_ids:-}" ]; then
    set_env FEISHU_APP_ID "$app_id"
    set_env FEISHU_APP_SECRET "$app_secret"
    set_env BITABLE_APP_TOKEN "$base_token"
    set_env ADMIN_OPEN_IDS "$admin_ids"
    set_env HUGOW_DEMO 0
    echo "已写入飞书配置，启用真实登录。"
  else
    set_env HUGOW_DEMO 1
    warn "配置不完整，已进入演示模式：访客站可用，工作台登录暂不可用。"
  fi
fi

# 真实登录必须让飞书回调到「浏览器能访问的地址」，不能是服务器自己的 127.0.0.1。
if grep -q '^HUGOW_DEMO=0' .env; then
  admin_port="$(grep '^HUGOW_ADMIN_PORT=' .env | cut -d= -f2)"
  admin_port="${admin_port:-8081}"
  public_ip="$(curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)"
  if [ -z "$public_ip" ]; then
    public_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  public_ip="${public_ip:-127.0.0.1}"
  origin="http://${public_ip}:${admin_port}"
  set_env PUBLIC_GATEWAY_ORIGIN "$origin"
  set_env PUBLIC_ADMIN_ORIGIN "$origin"
  set_env FEISHU_REDIRECT_URI "${origin}/api/auth/callback"
  echo "访问地址按 ${origin} 生成；绑定 HTTPS 域名后请改 .env 的 PUBLIC_* 与 FEISHU_REDIRECT_URI。"
fi

say "3/5 构建并启动（首次约 3~8 分钟）"
if [ "$USE_IMAGE" -eq 1 ]; then
  set_env HUGOW_IMAGE ghcr.io/hugoworld/opc-site:latest
  $COMPOSE pull
  $COMPOSE up -d --no-build
else
  set_env HUGOW_IMAGE ghcr.io/hugoworld/opc-site:local
  $COMPOSE up -d --build
fi

say "4/5 等待服务就绪"
www_port="$(grep '^HUGOW_WWW_PORT=' .env | cut -d= -f2)"
admin_port="$(grep '^HUGOW_ADMIN_PORT=' .env | cut -d= -f2)"
www_port="${www_port:-8080}"
admin_port="${admin_port:-8081}"
ready=0
for _ in $(seq 1 60); do
  health="$($SUDO docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' hugow-opc 2>/dev/null || true)"
  if [ "$health" = "healthy" ]; then
    ready=1
    break
  fi
  sleep 2
done
if [ "$ready" -ne 1 ]; then
  warn "健康检查未通过，最近日志："
  $COMPOSE logs --tail=60 || true
  fail "启动失败。请把上面的日志发到项目 Issue。"
fi

say "5/5 完成"
login_password="$(grep '^ADMIN_LOGIN_PASSWORD=' .env | cut -d= -f2- || true)"
bootstrap="$(grep '^ADMIN_BOOTSTRAP_TOKEN=' .env | cut -d= -f2- || true)"
cat <<EOF

访客站：   http://127.0.0.1:${www_port}
工作台：   http://127.0.0.1:${admin_port}
健康检查： http://127.0.0.1:${admin_port}/api/health
管理员账号： $(grep '^ADMIN_LOGIN_USER=' .env | cut -d= -f2- || echo admin)
管理员密码： ${login_password}   （飞书扫码不可用时的备用入口，可改 .env 后重启）
部署令牌： ${bootstrap}   （仅应急运维用；OAuth 可用后可在 .env 中置空）

常用命令：
  ./hugow status     查看状态
  ./hugow logs       看日志
  ./hugow restart    重启
  ./hugow backup     备份已发布数据
  ./hugow upgrade    拉取新版本并重建

如果是演示模式（HUGOW_DEMO=1），访客站已经可看；
填好 .env 里的飞书 4 项并改成 HUGOW_DEMO=0，再执行 ./hugow restart 即可启用真实登录。

EOF
