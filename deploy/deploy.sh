#!/usr/bin/env bash
# ==================================================================
# HugoW 单机部署脚本（Ubuntu 22.04/24.04）
#
# 用法：
#   sudo DOMAIN=hugogoodidea.com ACME_EMAIL=hello@example.com \
#        ./deploy.sh /tmp/hugow-release
#
# 发布包由 make-release.ps1 / make-release.sh 生成，包含：
#   dist/  dist-admin/  src/  package.json  deploy/
#
# 脚本做六件事：
#   1. 装 Nginx / certbot / rsync / Node 22（可 SKIP_PACKAGES=1 跳过）
#   2. 建 hugow 用户与 /srv/hugow 目录
#   3. 备份上一版并同步双产物 + 网关源码
#   4. 安装 systemd 单元并先只开 80 端口签证书
#   5. 切最终 www/admin Nginx 配置，启动网关，做健康检查
#   6. 打印验收命令
#
# 不会覆盖 /etc/hugow/gateway.env；首次缺失时只生成模板并以非 0 退出，
# 填好真实值后再执行一次即可。
# ==================================================================
set -Eeuo pipefail

DOMAIN="${DOMAIN:-hugogoodidea.com}"
WWW_HOST="${WWW_HOST:-www.${DOMAIN}}"
ADMIN_HOST="${ADMIN_HOST:-admin.${DOMAIN}}"
APP_ROOT="${APP_ROOT:-/srv/hugow}"
CONF_DIR="${CONF_DIR:-/etc/hugow}"
DATA_DIR="${DATA_DIR:-${APP_ROOT}/data}"
ACME_EMAIL="${ACME_EMAIL:-hello@${DOMAIN}}"
RELEASE_DIR="${1:-}"
SKIP_PACKAGES="${SKIP_PACKAGES:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"

log()  { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
fail() { printf '\n部署失败（第 %s 行）：%s\n' "$1" "$2" >&2; exit 1; }
trap 'fail "$LINENO" "$BASH_COMMAND"' ERR

[[ "$(id -u)" -eq 0 ]] || { echo "请用 sudo/root 执行" >&2; exit 1; }
[[ -n "$RELEASE_DIR" && -d "$RELEASE_DIR" ]] || { echo "用法：sudo ./deploy.sh <发布包目录>" >&2; exit 1; }
[[ -f "$RELEASE_DIR/dist/index.html" ]] || { echo "发布包缺少 dist/index.html" >&2; exit 1; }
[[ -f "$RELEASE_DIR/dist-admin/admin.html" ]] || { echo "发布包缺少 dist-admin/admin.html" >&2; exit 1; }
[[ -f "$RELEASE_DIR/src/server/main.ts" ]] || { echo "发布包缺少 src/server/main.ts" >&2; exit 1; }

# ---------------------------------------------------------------- 1. 系统依赖
if [[ "$SKIP_PACKAGES" != "1" ]]; then
  log "安装系统依赖"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq nginx certbot rsync curl ca-certificates tar >/dev/null

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]]; then
    log "安装 Node.js 22（NodeSource）"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  fi
fi

NODE_BIN="$(command -v node)"
NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" -ge 22 ]] || { echo "需要 Node.js >= 22，当前：$("$NODE_BIN" -v)" >&2; exit 1; }
log "Node：$("$NODE_BIN" -v)  发布包：$RELEASE_DIR"

# ---------------------------------------------------------------- 2. 用户与目录
if ! id -u hugow >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin hugow
fi

install -d -m 755 "$APP_ROOT" "$APP_ROOT/www" "$APP_ROOT/admin" "$APP_ROOT/gateway" "$APP_ROOT/data"
install -d -m 755 "$APP_ROOT/deploy" "$CONF_DIR"
install -d -m 755 /var/www/html /var/backups/hugow/releases

# ---------------------------------------------------------------- 3. 备份上一版
if [[ -d "$APP_ROOT/www/assets" || -d "$APP_ROOT/gateway/src" ]]; then
  log "备份上一版到 /var/backups/hugow/releases/$STAMP.tar.gz"
  tar -czf "/var/backups/hugow/releases/$STAMP.tar.gz" \
    -C "$APP_ROOT" www admin gateway 2>/dev/null || true
fi

# ---------------------------------------------------------------- 4. 同步代码与产物
log "同步双产物与网关源码"
rsync -a --delete "$RELEASE_DIR/dist/" "$APP_ROOT/www/"
rsync -a --delete "$RELEASE_DIR/dist-admin/" "$APP_ROOT/admin/"
rsync -a --delete "$RELEASE_DIR/src/server/" "$APP_ROOT/gateway/src/server/"
install -d -m 755 "$APP_ROOT/gateway/src/site/admin"
rsync -a --delete "$RELEASE_DIR/src/site/admin/data/" "$APP_ROOT/gateway/src/site/admin/data/"
install -m 644 "$RELEASE_DIR/package.json" "$APP_ROOT/gateway/package.json"

# 部署脚本也留在机器上，便于回滚后复跑
for f in deploy.sh backup.sh health-check.sh nginx-www.conf nginx-admin.conf nginx-bootstrap.conf nginx-limits.conf hugow-gateway.service gateway.env.example; do
  if [[ -f "$SCRIPT_DIR/$f" ]]; then
    install -m 755 "$SCRIPT_DIR/$f" "$APP_ROOT/deploy/$f"
  fi
done
chown -R hugow:hugow "$APP_ROOT"
chmod 755 "$APP_ROOT/data"

# ---------------------------------------------------------------- 5. 环境变量
if [[ ! -f "$CONF_DIR/gateway.env" ]]; then
  install -m 600 "$SCRIPT_DIR/gateway.env.example" "$CONF_DIR/gateway.env"
  cat >&2 <<EOF

已生成环境变量模板：$CONF_DIR/gateway.env
请填入真实的 FEISHU_APP_ID / FEISHU_APP_SECRET / BITABLE_APP_TOKEN /
ADMIN_OPEN_IDS / SESSION_SECRET，并把域名改成实际域名，然后重新执行本脚本。

EOF
  exit 1
fi
chmod 600 "$CONF_DIR/gateway.env"
if grep -Eq 'CHANGE_ME|cli_{8,}|ou_{8,}' "$CONF_DIR/gateway.env"; then
  echo "环境变量里仍有占位符，请先填完：$CONF_DIR/gateway.env" >&2
  exit 1
fi

# ---------------------------------------------------------------- 6. systemd
log "安装 systemd 单元"
sed "s|__APP_ROOT__|$APP_ROOT|g" "$SCRIPT_DIR/hugow-gateway.service" > /etc/systemd/system/hugow-gateway.service
systemctl daemon-reload
systemctl enable hugow-gateway >/dev/null

# ---------------------------------------------------------------- 7. 证书
if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  log "签发证书（首次）：$WWW_HOST / $ADMIN_HOST"
  install -m 755 "$SCRIPT_DIR/nginx-bootstrap.conf" /etc/nginx/sites-available/hugow-bootstrap.conf
  sed -e "s|__WWW_HOST__|$WWW_HOST|g" -e "s|__ADMIN_HOST__|$ADMIN_HOST|g" \
    /etc/nginx/sites-available/hugow-bootstrap.conf > /etc/nginx/sites-available/hugow-bootstrap.runtime.conf
  rm -f /etc/nginx/sites-enabled/default
  ln -sf /etc/nginx/sites-available/hugow-bootstrap.runtime.conf /etc/nginx/sites-enabled/hugow-bootstrap.conf
  nginx -t
  systemctl reload nginx

  certbot certonly --webroot -w /var/www/html \
    --cert-name "$DOMAIN" \
    -d "$WWW_HOST" -d "$ADMIN_HOST" \
    --agree-tos -m "$ACME_EMAIL" --non-interactive
else
  log "证书已存在，跳过签发：/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
fi

install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/usr/bin/env bash
nginx -t && systemctl reload nginx
EOF
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# ---------------------------------------------------------------- 8. 最终 Nginx
log "安装最终 Nginx 配置"
install -m 644 "$SCRIPT_DIR/nginx-limits.conf" /etc/nginx/conf.d/hugow-limits.conf

for name in www admin; do
  sed -e "s|__WWW_HOST__|$WWW_HOST|g" \
      -e "s|__ADMIN_HOST__|$ADMIN_HOST|g" \
      -e "s|__APP_ROOT__|$APP_ROOT|g" \
      -e "s|__CERT_DOMAIN__|$DOMAIN|g" \
      "$SCRIPT_DIR/nginx-${name}.conf" > "/etc/nginx/sites-available/hugow-${name}.conf"
  ln -sf "/etc/nginx/sites-available/hugow-${name}.conf" "/etc/nginx/sites-enabled/hugow-${name}.conf"
done

rm -f /etc/nginx/sites-enabled/hugow-bootstrap.conf /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ---------------------------------------------------------------- 9. 启动网关
log "启动 hugow-gateway"
systemctl restart hugow-gateway

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8787/api/health >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:8787/api/health >/dev/null || {
  echo "网关未通过 /api/health，查看：journalctl -u hugow-gateway -n 80 --no-pager" >&2
  exit 1
}

# ---------------------------------------------------------------- 10. 防火墙
if [[ "${ENABLE_UFW:-0}" == "1" ]] && command -v ufw >/dev/null 2>&1; then
  log "配置 ufw：只放行 22/80/443"
  ufw allow 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
fi

# ---------------------------------------------------------------- 11. 输出
log "部署完成"
cat <<EOF

站点：
  https://$WWW_HOST/
  https://$ADMIN_HOST/admin.html#/admin/

服务：
  systemctl status hugow-gateway --no-pager
  journalctl -u hugow-gateway -f

验收：
  curl -fsS https://$ADMIN_HOST/api/health
  curl -fsS https://$ADMIN_HOST/api/setup
  curl -I https://$WWW_HOST/
  curl -I https://$ADMIN_HOST/admin.html

备份：
  sudo $APP_ROOT/deploy/backup.sh
  (crontab) 20 3 * * * $APP_ROOT/deploy/backup.sh >> /var/log/hugow-backup.log 2>&1

EOF
