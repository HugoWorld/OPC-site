#!/bin/bash
set -eu

DATA_DIR="${DATA_DIR:-/srv/hugow/data}"
mkdir -p "$DATA_DIR"
chown -R hugow:hugow "$DATA_DIR"

echo "[hugow] starting gateway on 127.0.0.1:${PORT:-8787}"
gosu hugow node --experimental-strip-types /srv/hugow/server/main.ts &
GATEWAY_PID=$!

echo "[hugow] starting nginx on 8080/8081"
nginx -g "daemon off;" &
NGINX_PID=$!

cleanup() {
  kill "$GATEWAY_PID" "$NGINX_PID" 2>/dev/null || true
  wait "$GATEWAY_PID" "$NGINX_PID" 2>/dev/null || true
}
trap cleanup INT TERM

# 任一进程退出就结束容器，交给 restart 策略恢复。
wait -n "$GATEWAY_PID" "$NGINX_PID"
STATUS=$?
cleanup
exit "$STATUS"
