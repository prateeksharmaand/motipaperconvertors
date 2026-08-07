#!/usr/bin/env bash
# =============================================================================
#  MotiPaper — Full Server Setup Script
#  Tested on Ubuntu 22.04 LTS
#
#  Run as root (or with sudo) on a fresh VPS:
#    curl -fsSL https://raw.githubusercontent.com/your-org/motipaper/main/scripts/server-setup.sh | bash
#  OR copy to the server and run:
#    chmod +x server-setup.sh && sudo ./server-setup.sh
#
#  What this does (in order):
#   1. System updates + essential packages
#   2. Docker + Docker Compose plugin
#   3. Create app user + directory
#   4. Clone repo (or pull if already cloned)
#   5. Write .env from prompts
#   6. Docker Compose build + first run
#   7. Run DB migrations + seeds
#   8. Obtain TLS certificates (Certbot / Let's Encrypt)
#   9. Set up automatic DB backups (cron)
#  10. Set up automatic certificate renewal (already handled by certbot container)
#  11. Print final status
# =============================================================================
set -euo pipefail

# ── Colours ───────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Config (edit these or export before running) ──────────
APP_USER="${APP_USER:-motipaper}"
APP_DIR="${APP_DIR:-/home/${APP_USER}/motipaper}"
REPO_URL="${REPO_URL:-}"          # set to your git repo URL
BRANCH="${BRANCH:-main}"

DOMAIN="${DOMAIN:-}"              # e.g. motipaper.in
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}" # e.g. admin@motipaper.in

# ── Root check ────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then error "Run this script as root or with sudo."; fi

# ── Interactive prompts if vars not set ───────────────────
prompt() {
  local var="$1" prompt_text="$2" default="$3"
  if [[ -z "${!var:-}" ]]; then
    read -rp "$(echo -e "${YELLOW}${prompt_text}${NC} [${default}]: ")" input
    eval "$var=\"${input:-$default}\""
  fi
}

prompt DOMAIN        "Primary domain (e.g. motipaper.in)"        "motipaper.in"
prompt CERTBOT_EMAIL "Email for Let's Encrypt notifications"       "admin@${DOMAIN}"
prompt REPO_URL      "Git repository URL (leave blank to skip clone)" ""

echo ""
info "==================================================================="
info "  MotiPaper Server Setup"
info "  Domain:   ${DOMAIN}"
info "  App dir:  ${APP_DIR}"
info "  App user: ${APP_USER}"
info "==================================================================="
echo ""

# ════════════════════════════════════════════════════════
# STEP 1 — System updates
# ════════════════════════════════════════════════════════
info "[1/10] Updating system packages…"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git unzip ufw \
  ca-certificates gnupg lsb-release \
  htop fail2ban logrotate
success "System packages updated"

# ── Firewall ─────────────────────────────────────────────
info "Configuring UFW firewall…"
ufw --force enable
ufw allow ssh
ufw allow http
ufw allow https
success "Firewall configured (ssh, http, https allowed)"

# ════════════════════════════════════════════════════════
# STEP 2 — Docker
# ════════════════════════════════════════════════════════
info "[2/10] Installing Docker…"
if command -v docker &>/dev/null; then
  warn "Docker already installed: $(docker --version)"
else
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  success "Docker installed: $(docker --version)"
fi

# ════════════════════════════════════════════════════════
# STEP 3 — App user + directory
# ════════════════════════════════════════════════════════
info "[3/10] Creating app user '${APP_USER}'…"
if id "$APP_USER" &>/dev/null; then
  warn "User '${APP_USER}' already exists"
else
  useradd -m -s /bin/bash "$APP_USER"
  success "User '${APP_USER}' created"
fi
usermod -aG docker "$APP_USER"
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# ════════════════════════════════════════════════════════
# STEP 4 — Clone / pull repo
# ════════════════════════════════════════════════════════
info "[4/10] Setting up application code…"
if [[ -n "$REPO_URL" ]]; then
  if [[ -d "$APP_DIR/.git" ]]; then
    info "Repo exists — pulling latest from ${BRANCH}…"
    sudo -u "$APP_USER" git -C "$APP_DIR" pull origin "$BRANCH"
  else
    sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  success "Code ready at ${APP_DIR}"
else
  warn "REPO_URL not set — skipping git clone. Copy your code to ${APP_DIR} manually."
fi

# ════════════════════════════════════════════════════════
# STEP 5 — Write .env
# ════════════════════════════════════════════════════════
info "[5/10] Configuring environment…"
ENV_FILE="${APP_DIR}/.env"

if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists at ${ENV_FILE} — skipping (edit manually if needed)"
else
  # Generate secrets
  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  PG_PASSWORD=$(openssl rand -hex 16)
  MINIO_SECRET=$(openssl rand -hex 16)

  cat > "$ENV_FILE" << EOF
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

# ── Firebase (FCM) — fill these in ───────────────────────
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# ── Redis ─────────────────────────────────────────────────
REDIS_URL=redis://redis:6379
EOF

  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  success ".env written with auto-generated secrets"
  echo ""
  warn "IMPORTANT: Fill in FIREBASE_* values in ${ENV_FILE} before the app can send push notifications."
  echo ""
fi

# ════════════════════════════════════════════════════════
# STEP 6 — Build + start containers
# ════════════════════════════════════════════════════════
info "[6/10] Building and starting Docker containers…"
cd "$APP_DIR"
sudo -u "$APP_USER" docker compose up -d --build postgres redis minio
info "Waiting for Postgres to be healthy…"
until sudo -u "$APP_USER" docker compose exec -T postgres pg_isready -U motipaper &>/dev/null; do
  sleep 2
done
success "Postgres is ready"

sudo -u "$APP_USER" docker compose up -d --build backend admin-panel
success "All containers started"

# ════════════════════════════════════════════════════════
# STEP 7 — DB migrations + seed
# ════════════════════════════════════════════════════════
info "[7/10] Running database migrations…"
sudo -u "$APP_USER" docker compose run --rm backend npm run migrate:latest
success "Migrations complete"

info "Seeding super admin account…"
sudo -u "$APP_USER" docker compose run --rm backend npm run seed
success "Seed complete (admin@motipaper.in / ChangeMe123!)"
warn "IMPORTANT: Change the super admin password immediately after first login!"

# ════════════════════════════════════════════════════════
# STEP 8 — TLS / Certbot
# ════════════════════════════════════════════════════════
info "[8/10] Obtaining TLS certificates via Let's Encrypt…"
cd "$APP_DIR"

# Start nginx with temp HTTP-only config first
cat > "${APP_DIR}/nginx/conf.d/motipaper-tmp.conf" << 'NGINX_TMP'
server {
  listen 80;
  server_name _;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 200 'MotiPaper TLS provisioning'; add_header Content-Type text/plain; }
}
NGINX_TMP

# Back up production TLS config
[[ -f "${APP_DIR}/nginx/conf.d/motipaper.conf" ]] && \
  mv "${APP_DIR}/nginx/conf.d/motipaper.conf" "${APP_DIR}/nginx/conf.d/motipaper.conf.bak"

sudo -u "$APP_USER" docker compose up -d nginx certbot
sleep 3

for SUBDOMAIN in "" "www." "api." "admin."; do
  CERT_DOMAIN="${SUBDOMAIN}${DOMAIN}"
  info "Requesting cert for ${CERT_DOMAIN}…"
  sudo -u "$APP_USER" docker compose run --rm certbot certonly \
    --webroot --webroot-path=/var/www/certbot \
    --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email \
    -d "$CERT_DOMAIN" 2>&1 | tail -5 || warn "Could not get cert for ${CERT_DOMAIN} (check DNS)"
done

# Restore TLS config
rm -f "${APP_DIR}/nginx/conf.d/motipaper-tmp.conf"
[[ -f "${APP_DIR}/nginx/conf.d/motipaper.conf.bak" ]] && \
  mv "${APP_DIR}/nginx/conf.d/motipaper.conf.bak" "${APP_DIR}/nginx/conf.d/motipaper.conf"

sudo -u "$APP_USER" docker compose exec nginx nginx -s reload 2>/dev/null || \
  sudo -u "$APP_USER" docker compose restart nginx
success "TLS certificates issued and nginx reloaded"

# ════════════════════════════════════════════════════════
# STEP 9 — Cron: daily DB backup
# ════════════════════════════════════════════════════════
info "[9/10] Setting up automated database backups (daily 2 AM)…"
BACKUP_SCRIPT="${APP_DIR}/scripts/backup-db.sh"
chmod +x "$BACKUP_SCRIPT" 2>/dev/null || true

CRON_LINE="0 2 * * * ${BACKUP_SCRIPT} >> /var/log/motipaper-backup.log 2>&1"
( crontab -u "$APP_USER" -l 2>/dev/null | grep -v backup-db.sh; echo "$CRON_LINE" ) | \
  crontab -u "$APP_USER" -
success "DB backup cron job installed (daily at 02:00)"

# ════════════════════════════════════════════════════════
# STEP 10 — Logrotate for backup log
# ════════════════════════════════════════════════════════
info "[10/10] Setting up log rotation…"
cat > /etc/logrotate.d/motipaper << 'LOGROTATE'
/var/log/motipaper-backup.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
LOGROTATE
success "Log rotation configured"

# ════════════════════════════════════════════════════════
# Done
# ════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  MotiPaper setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐  Marketing site:  https://${DOMAIN}"
echo -e "  🔧  Admin panel:     https://admin.${DOMAIN}"
echo -e "  🔌  API:             https://api.${DOMAIN}/health"
echo -e "  🗄️   MinIO console:   http://$(curl -s ifconfig.me):9001"
echo ""
echo -e "  Super admin login:  admin@motipaper.in"
echo -e "  Default password:   ChangeMe123!"
echo ""
echo -e "${YELLOW}  Next steps:${NC}"
echo -e "  1. Change the super admin password immediately"
echo -e "  2. Fill in FIREBASE_* values in ${ENV_FILE}"
echo -e "  3. Run: docker compose restart backend"
echo -e "  4. Register your first press at https://${DOMAIN}"
echo ""
echo -e "  To redeploy after a code push:"
echo -e "  ${BLUE}cd ${APP_DIR} && ./scripts/deploy.sh${NC}"
echo ""
cd "$APP_DIR"
sudo -u "$APP_USER" docker compose ps
