#!/usr/bin/env bash
# =============================================================================
#  MotiPaper — setup.sh
#  Full first-time server setup on a fresh Ubuntu 22.04 VPS.
#
#  Usage (run as root):
#    chmod +x scripts/setup.sh
#    ./scripts/setup.sh
#
#  Or pipe directly:
#    curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/motipaper/main/scripts/setup.sh | bash
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Detect app directory (script lives in APP_DIR/scripts/) ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BRANCH="${BRANCH:-main}"

# ── Prompt helper ─────────────────────────────────────────
prompt() {
  local var="$1" label="$2" default="$3"
  if [[ -z "${!var:-}" ]]; then
    read -rp "$(echo -e "${YELLOW}${label}${NC} [${default}]: ")" _input
    printf -v "$var" '%s' "${_input:-$default}"
  fi
}

echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}   MotiPaper — Full Server Setup${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""

prompt DOMAIN        "Primary domain (e.g. motipaper.in)"   "motipaper.in"
prompt CERTBOT_EMAIL "Email for Let's Encrypt"               "admin@${DOMAIN}"

echo ""
info "App directory : $APP_DIR"
info "Domain        : $DOMAIN"
info "TLS email     : $CERTBOT_EMAIL"
echo ""

# ═══════════════════════════════════════════════════════════
# STEP 1 — System packages
# ═══════════════════════════════════════════════════════════
info "[1/9] Installing system packages…"
apt-get update -qq
apt-get install -y -qq curl wget git ufw ca-certificates gnupg lsb-release
success "System packages ready"

# ── Firewall ─────────────────────────────────────────────
ufw --force enable
ufw allow ssh
ufw allow http
ufw allow https
success "UFW firewall configured"

# ═══════════════════════════════════════════════════════════
# STEP 2 — Docker
# ═══════════════════════════════════════════════════════════
info "[2/9] Installing Docker…"
if command -v docker &>/dev/null; then
  warn "Docker already installed: $(docker --version)"
else
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi
success "Docker ready: $(docker --version)"

# ═══════════════════════════════════════════════════════════
# STEP 3 — .env file
# ═══════════════════════════════════════════════════════════
info "[3/9] Configuring .env…"
ENV_FILE="$APP_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists — skipping (edit manually if needed)"
else
  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  PG_PASSWORD=$(openssl rand -hex 16)
  MINIO_SECRET=$(openssl rand -hex 16)

  cat > "$ENV_FILE" <<EOF
# ── Postgres ──────────────────────────────────────────────
POSTGRES_USER=motipaper
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=motipaper
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# ── Backend ───────────────────────────────────────────────
NODE_ENV=production
PORT=3000
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d
CORS_ORIGINS=https://${DOMAIN},https://admin.${DOMAIN}

# ── MinIO ─────────────────────────────────────────────────
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=motipaper
MINIO_SECRET_KEY=${MINIO_SECRET}
MINIO_BUCKET=motipaper

# ── Firebase (fill in after setup) ────────────────────────
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# ── Redis ─────────────────────────────────────────────────
REDIS_URL=redis://redis:6379
EOF
  chmod 600 "$ENV_FILE"
  success ".env created with auto-generated secrets"
  warn "Fill in FIREBASE_* values in $ENV_FILE to enable push notifications"
fi

# Load env vars for use in this script
set -a; source "$ENV_FILE"; set +a

# ═══════════════════════════════════════════════════════════
# STEP 4 — Remove obsolete version key from docker-compose.yml
# ═══════════════════════════════════════════════════════════
info "[4/9] Patching docker-compose.yml…"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
if grep -q "^version:" "$COMPOSE_FILE" 2>/dev/null; then
  sed -i '/^version:/d' "$COMPOSE_FILE"
  success "Removed obsolete 'version:' key from docker-compose.yml"
else
  success "docker-compose.yml already clean"
fi

# ═══════════════════════════════════════════════════════════
# STEP 5 — Start infrastructure services
# ═══════════════════════════════════════════════════════════
info "[5/9] Starting infrastructure (postgres, redis, minio)…"
cd "$APP_DIR"
docker compose up -d postgres redis minio

info "Waiting for Postgres to be healthy…"
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER}" &>/dev/null; do
  printf '.'; sleep 2
done
echo ""
success "Postgres is ready"

# ═══════════════════════════════════════════════════════════
# STEP 6 — Build and start app services
# ═══════════════════════════════════════════════════════════
info "[6/9] Building and starting backend and admin panel…"
docker compose up -d --build backend admin-panel
success "Backend and admin panel started"

# ═══════════════════════════════════════════════════════════
# STEP 7 — Migrations + seed
# ═══════════════════════════════════════════════════════════
info "[7/9] Running database migrations…"
docker compose run --rm backend npm run migrate:latest
success "Migrations complete"

info "Seeding super admin account…"
docker compose run --rm backend npm run seed
success "Super admin seeded (admin@motipaper.in / ChangeMe123!)"

# ═══════════════════════════════════════════════════════════
# STEP 8 — TLS via Certbot
# ═══════════════════════════════════════════════════════════
info "[8/9] Setting up TLS certificates…"

# Write temporary HTTP-only nginx config for ACME challenge
mkdir -p "$APP_DIR/nginx/conf.d"
cat > "$APP_DIR/nginx/conf.d/motipaper-tmp.conf" <<'NGINX_TMP'
server {
  listen 80;
  server_name _;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 200 'MotiPaper — TLS provisioning'; add_header Content-Type text/plain; }
}
NGINX_TMP

# Backup real TLS config if it exists
[[ -f "$APP_DIR/nginx/conf.d/motipaper.conf" ]] && \
  mv "$APP_DIR/nginx/conf.d/motipaper.conf" "$APP_DIR/nginx/conf.d/motipaper.conf.bak"

docker compose up -d nginx certbot
sleep 3

for SUBDOMAIN in "" "www." "api." "admin."; do
  CERT_DOMAIN="${SUBDOMAIN}${DOMAIN}"
  info "Requesting certificate for ${CERT_DOMAIN}…"
  docker compose run --rm certbot certonly \
    --webroot --webroot-path=/var/www/certbot \
    --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email \
    --non-interactive \
    -d "$CERT_DOMAIN" \
    && success "Certificate issued for ${CERT_DOMAIN}" \
    || warn "Could not get cert for ${CERT_DOMAIN} — DNS may not be pointed yet"
done

# Restore real nginx config
rm -f "$APP_DIR/nginx/conf.d/motipaper-tmp.conf"
[[ -f "$APP_DIR/nginx/conf.d/motipaper.conf.bak" ]] && \
  mv "$APP_DIR/nginx/conf.d/motipaper.conf.bak" "$APP_DIR/nginx/conf.d/motipaper.conf"

docker compose exec nginx nginx -s reload 2>/dev/null \
  || docker compose restart nginx
success "Nginx reloaded with TLS config"

# ═══════════════════════════════════════════════════════════
# STEP 9 — Cron for daily DB backups
# ═══════════════════════════════════════════════════════════
info "[9/9] Installing daily DB backup cron…"
BACKUP_SCRIPT="$APP_DIR/scripts/backup-db.sh"
chmod +x "$BACKUP_SCRIPT" 2>/dev/null || true
CRON_LINE="0 2 * * * $BACKUP_SCRIPT >> /var/log/motipaper-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v backup-db; echo "$CRON_LINE" ) | crontab -
success "Backup cron installed (runs daily at 02:00)"

# ═══════════════════════════════════════════════════════════
# Done
# ═══════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}═════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   MotiPaper setup complete!${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐  Website   : https://${DOMAIN}"
echo -e "  🔧  Admin     : https://admin.${DOMAIN}"
echo -e "  🔌  API health: https://api.${DOMAIN}/health"
echo -e "  🗄️   MinIO     : http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_VPS_IP'):9001"
echo ""
echo -e "  Super admin login : admin@motipaper.in"
echo -e "  Default password  : ChangeMe123!"
echo ""
echo -e "${YELLOW}  IMPORTANT next steps:${NC}"
echo -e "  1. Change the super admin password immediately"
echo -e "  2. Fill in FIREBASE_* in $ENV_FILE"
echo -e "  3. Run: docker compose restart backend"
echo ""
echo "  Running containers:"
docker compose ps
