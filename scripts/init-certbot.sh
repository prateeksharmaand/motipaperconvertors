#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  MotiPaper — First-time TLS provisioning via Certbot
#
#  Run this ONCE on the VPS after DNS has propagated:
#    chmod +x scripts/init-certbot.sh
#    ./scripts/init-certbot.sh
#
#  What it does:
#   1. Starts nginx + certbot containers with a temporary HTTP-only config
#   2. Obtains certificates for all three domains via HTTP-01 challenge
#   3. Swaps back to the full TLS nginx config
#   4. Restarts nginx so it serves HTTPS
# ─────────────────────────────────────────────────────────────
set -euo pipefail

DOMAINS=("motipaper.in" "www.motipaper.in" "api.motipaper.in" "admin.motipaper.in")
EMAIL="${CERTBOT_EMAIL:-admin@motipaper.in}"
STAGING="${CERTBOT_STAGING:-0}"   # set to 1 to test without rate-limits

echo "==> [1/4] Writing temporary HTTP-only nginx config for ACME challenge..."

mkdir -p nginx/conf.d

cat > nginx/conf.d/motipaper-tmp.conf << 'EOF'
server {
  listen 80;
  server_name motipaper.in www.motipaper.in api.motipaper.in admin.motipaper.in;
  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }
  location / {
    return 200 'MotiPaper — TLS provisioning in progress';
    add_header Content-Type text/plain;
  }
}
EOF

# Temporarily rename full TLS config so nginx doesn't choke on missing certs
if [ -f nginx/conf.d/motipaper.conf ]; then
  mv nginx/conf.d/motipaper.conf nginx/conf.d/motipaper.conf.bak
fi

echo "==> [2/4] Starting nginx (HTTP-only) and certbot containers..."
docker compose up -d nginx certbot

# Wait for nginx to be ready
sleep 3

echo "==> [3/4] Requesting certificates..."

STAGING_FLAG=""
if [ "$STAGING" = "1" ]; then
  STAGING_FLAG="--staging"
  echo "     (staging mode — certificates won't be trusted by browsers)"
fi

for DOMAIN in "${DOMAINS[@]}"; do
  docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    $STAGING_FLAG \
    -d "$DOMAIN" \
    || echo "WARN: could not obtain cert for $DOMAIN (DNS may not be pointed yet)"
done

# motipaper.in and www.motipaper.in as a SAN cert
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  $STAGING_FLAG \
  -d "motipaper.in" -d "www.motipaper.in" \
  || true

echo "==> [4/4] Swapping back to full TLS nginx config..."

rm -f nginx/conf.d/motipaper-tmp.conf

if [ -f nginx/conf.d/motipaper.conf.bak ]; then
  mv nginx/conf.d/motipaper.conf.bak nginx/conf.d/motipaper.conf
fi

docker compose exec nginx nginx -s reload

echo ""
echo "✅ Done! Certificates issued. Nginx is now serving HTTPS."
echo "   Auto-renewal is handled by the certbot service in docker-compose.yml."
echo "   Verify: https://motipaper.in"
