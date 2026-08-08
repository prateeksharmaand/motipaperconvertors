#!/usr/bin/env bash
# =============================================================================
#  MotiPaper — deploy.sh
#  Run this on the VPS to pull latest code, rebuild, migrate and restart.
#
#  Usage:
#    chmod +x scripts/deploy.sh
#    ./scripts/deploy.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"
info "Deploying from: $APP_DIR (branch: $BRANCH)"

# ── 1. Pull latest code ───────────────────────────────────
info "[1/5] Pulling latest code…"
git pull origin "$BRANCH"
success "Code updated"

# ── 2. Rebuild images ─────────────────────────────────────
info "[2/5] Building Docker images…"
docker compose up -d --build --remove-orphans postgres redis minio
info "Waiting for Postgres to be healthy…"
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-motipaper}" &>/dev/null; do
  printf '.'
  sleep 2
done
echo ""
success "Postgres ready"

docker compose up -d --build backend admin-panel
success "Backend and admin panel built"

# ── 3. Run migrations ─────────────────────────────────────
info "[3/5] Running database migrations…"
docker compose run --rm backend npm run migrate:latest
success "Migrations complete"

# ── 4. Restart nginx ──────────────────────────────────────
info "[4/5] Reloading nginx…"
docker compose up -d nginx
docker compose exec nginx nginx -s reload 2>/dev/null || true
success "Nginx reloaded"

# ── 5. Status ─────────────────────────────────────────────
info "[5/5] Current container status:"
docker compose ps

echo ""
success "Deploy complete!"
