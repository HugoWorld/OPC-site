#!/usr/bin/env bash
# ------------------------------------------------------------------
# 每日备份：快照数据 + Nginx/systemd 配置（不含 gateway.env 密钥）
#
# 安装后执行一次：
#   sudo /srv/hugow/deploy/backup.sh
# cron：
#   20 3 * * * /srv/hugow/deploy/backup.sh >> /var/log/hugow-backup.log 2>&1
# ------------------------------------------------------------------
set -Eeuo pipefail

DATA_DIR="${DATA_DIR:-/srv/hugow/data}"
BACKUP_ROOT="${BACKUP_ROOT:-/mnt/backup/hugow}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_ROOT/data" "$BACKUP_ROOT/config"

if command -v flock >/dev/null 2>&1; then
  exec 9>"$BACKUP_ROOT/.backup.lock"
  flock -n 9 || { echo "上一次备份仍在运行，跳过"; exit 0; }
fi

if mountpoint -q "$BACKUP_ROOT" 2>/dev/null; then
  echo "[backup] 备份盘已挂载：$BACKUP_ROOT"
else
  echo "[backup] 警告：$BACKUP_ROOT 不是独立挂载点，请确认不是本机系统盘" >&2
fi

echo "[backup] 同步数据目录"
rsync -a --delete "$DATA_DIR/" "$BACKUP_ROOT/data/"

echo "[backup] 打包 Nginx/systemd 配置（不包含 gateway.env）"
tar -czf "$BACKUP_ROOT/config/config-$DATE.tar.gz" \
  /etc/nginx/sites-available/hugow-www.conf \
  /etc/nginx/sites-available/hugow-admin.conf \
  /etc/nginx/conf.d/hugow-limits.conf \
  /etc/systemd/system/hugow-gateway.service 2>/dev/null || true

echo "[backup] 清理超过 ${RETENTION_DAYS} 天的配置备份"
find "$BACKUP_ROOT/config" -type f -name 'config-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "[backup] 完成：$(du -sh "$BACKUP_ROOT/data" | awk '{print $1}') / $(date)"
