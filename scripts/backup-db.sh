#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  MotiPaper — PostgreSQL backup to MinIO
#  Add to crontab:  0 2 * * * /home/ubuntu/motipaper/scripts/backup-db.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

source "$(dirname "$0")/../.env"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/motipaper_${TIMESTAMP}.sql.gz"

echo "==> Dumping database..."
docker compose exec -T postgres pg_dump \
  -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"

echo "==> Uploading to MinIO..."
docker compose exec -T minio mc alias set local http://localhost:9000 \
  "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" 2>/dev/null || true

docker cp "$BACKUP_FILE" "$(docker compose ps -q minio)":/tmp/
docker compose exec -T minio mc cp \
  "/tmp/motipaper_${TIMESTAMP}.sql.gz" \
  "local/motipaper-backups/motipaper_${TIMESTAMP}.sql.gz"

rm -f "$BACKUP_FILE"
echo "✅ Backup complete: motipaper_${TIMESTAMP}.sql.gz"

# Prune backups older than 30 days
docker compose exec -T minio mc rm --recursive --force \
  --older-than 720h "local/motipaper-backups/" 2>/dev/null || true
