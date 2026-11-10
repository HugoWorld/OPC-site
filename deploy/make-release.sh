#!/usr/bin/env bash
# ------------------------------------------------------------------
# 本地/CI 打包发布物（Linux 或 WSL）
# 产物：_release/hugow-release-<timestamp>.tar.gz + .sha256
# ------------------------------------------------------------------
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROTO="$ROOT/prototype"
OUT="${OUT_DIR:-$ROOT/_release}"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGING="$OUT/staging-$STAMP"
TAR="$OUT/hugow-release-$STAMP.tar.gz"

command -v node >/dev/null || { echo "需要 node" >&2; exit 1; }
command -v tar >/dev/null || { echo "需要 tar" >&2; exit 1; }

echo "[1/5] 构建双入口"
(cd "$PROTO" && npm run build:all)

[[ -f "$PROTO/dist/index.html" ]] || { echo "缺少 dist/index.html" >&2; exit 1; }
[[ -f "$PROTO/dist-admin/admin.html" ]] || { echo "缺少 dist-admin/admin.html" >&2; exit 1; }

echo "[2/5] 组装发布目录"
rm -rf "$STAGING"
mkdir -p "$STAGING/src/site/admin"
cp -a "$PROTO/dist" "$STAGING/dist"
cp -a "$PROTO/dist-admin" "$STAGING/dist-admin"
cp -a "$PROTO/src/server" "$STAGING/src/server"
cp -a "$PROTO/src/site/admin/data" "$STAGING/src/site/admin/data"
cp -a "$PROTO/package.json" "$STAGING/package.json"
cp -a "$SCRIPT_DIR" "$STAGING/deploy"

echo "[3/5] 打 tar.gz"
mkdir -p "$OUT"
tar -czf "$TAR" -C "$STAGING" .

echo "[4/5] 计算 SHA256"
sha256sum "$TAR" > "$TAR.sha256"

echo "[5/5] 完成"
ls -lh "$TAR" "$TAR.sha256"
