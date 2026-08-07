#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  MotiPaper — VPS deploy script
#
#  Set up on the VPS:
#    git remote add vps ssh://user@<vps-ip>/home/user/motipaper.git
#    git push vps main
#
#  Or call directly:  ./scripts/deploy.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/motipaper}"
BRANCH="${BRANCH:-main}"

echo "==> Pulling latest from $BRANCH..."
cd "$APP_DIR"
git pull origin "$BRANCH"

echo "==> Running DB migrations..."
docker compose run --rm backend npm run migrate:latest

echo "==> Rebuilding and restarting containers..."
docker compose up -d --build --remove-orphans

echo "==> Pruning unused Docker images..."
docker image prune -f

echo ""
echo "✅ Deploy complete. Running services:"
docker compose ps
