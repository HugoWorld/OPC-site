#!/usr/bin/env bash
# ------------------------------------------------------------------
# 上线后健康检查；可放进 cron 每 5 分钟跑一次，非 0 退出触发告警。
#   sudo /srv/hugow/deploy/health-check.sh
# ------------------------------------------------------------------
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/srv/hugow}"
DATA_DIR="${DATA_DIR:-$APP_ROOT/data}"
WWW_HOST="${WWW_HOST:-www.hugogoodidea.com}"
ADMIN_HOST="${ADMIN_HOST:-admin.hugogoodidea.com}"

ok=0

check() {
  local name="$1" url="$2" expect="$3"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)"
  if [[ "$code" == "$expect" ]]; then
    echo "PASS  $name  HTTP $code"
  else
    echo "FAIL  $name  HTTP $code（期望 $expect）  $url"
    ok=1
  fi
}

echo "== 服务 =="
systemctl is-active --quiet hugow-gateway && echo "PASS  systemd hugow-gateway active" || { echo "FAIL  systemd 未运行"; ok=1; }
systemctl is-active --quiet nginx && echo "PASS  nginx active" || { echo "FAIL  nginx 未运行"; ok=1; }

echo "== 本机与公网 =="
check "网关 health（本机）" "http://127.0.0.1:8787/api/health" "200"
check "网关 setup（公网）" "https://$ADMIN_HOST/api/setup" "200"
check "admin 入口" "https://$ADMIN_HOST/admin.html" "200"
check "www 首页" "https://$WWW_HOST/" "200"

echo "== 快照 =="
if [[ -f "$DATA_DIR/current.json" ]]; then
  echo "PASS  快照指针存在：$DATA_DIR/current.json"
  age=$(( ( $(date +%s) - $(stat -c %Y "$DATA_DIR/current.json") ) / 86400 ))
  echo "      指针更新于 ${age} 天前"
else
  echo "WARN  尚无发布快照（首次发布前属正常）"
fi

echo "== 磁盘 =="
df -h "$APP_ROOT" | tail -n 1

echo "== TLS =="
if command -v openssl >/dev/null 2>&1; then
  end="$(echo | openssl s_client -servername "$ADMIN_HOST" -connect "$ADMIN_HOST:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)"
  [[ -n "$end" ]] && echo "PASS  admin 证书到期：$end" || { echo "FAIL  无法读取证书"; ok=1; }
fi

exit "$ok"
