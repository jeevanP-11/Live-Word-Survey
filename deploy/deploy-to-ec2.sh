#!/usr/bin/env bash
#
# Builds and ships the same docker-compose stack used locally to a single
# EC2 instance reachable via an Elastic IP. No image registry needed — the
# source is synced to the instance and the images are built there, so
# `docker compose up -d` behaves identically to a laptop run.
#
# Required environment variables (export them or put them in deploy/.env.deploy):
#   EC2_HOST      Elastic IP or public DNS of the instance
#   EC2_SSH_KEY   Path to the .pem private key used to SSH in
#
# Optional:
#   EC2_USER      SSH user (default: ec2-user, i.e. Amazon Linux; use "ubuntu" for Ubuntu AMIs)
#   APP_DIR       Remote deploy directory (default: /opt/survey-app)
#   ENV_FILE      Local .env file to ship (default: ./.env)
#
# Usage:
#   EC2_HOST=1.2.3.4 EC2_SSH_KEY=~/.ssh/survey-app.pem ./deploy/deploy-to-ec2.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Allow a local, untracked file to hold deploy-specific config.
if [ -f "$ROOT_DIR/deploy/.env.deploy" ]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/deploy/.env.deploy"
fi

EC2_USER="${EC2_USER:-ec2-user}"
APP_DIR="${APP_DIR:-/opt/survey-app}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

: "${EC2_HOST:?Set EC2_HOST to the instance Elastic IP}"
: "${EC2_SSH_KEY:?Set EC2_SSH_KEY to the path of the .pem key}"

SSH_OPTS=(-i "$EC2_SSH_KEY" -o StrictHostKeyChecking=accept-new)
REMOTE="$EC2_USER@$EC2_HOST"

log() { echo -e "\033[1m▸ $1\033[0m"; }
ok()  { echo -e "\033[0;32m✔ $1\033[0m"; }
fail(){ echo -e "\033[0;31m✘ $1\033[0m"; }

if [ ! -f "$ENV_FILE" ]; then
  fail "$ENV_FILE not found. Copy .env.example to .env and fill in real values before deploying."
  exit 1
fi

# ---------------------------------------------------------------------------
log "Step 1/5 — Running local tests before shipping anything..."
if ! "$ROOT_DIR/scripts/run-tests.sh"; then
  fail "Local tests failed. Aborting deploy — fix the failures first."
  exit 1
fi
ok "Local tests passed"

# ---------------------------------------------------------------------------
log "Step 2/5 — One-time EC2 setup (Docker + Compose plugin, deploy dir)..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "sudo mkdir -p $APP_DIR && sudo chown \$USER:\$USER $APP_DIR"
scp "${SSH_OPTS[@]}" "$ROOT_DIR/deploy/ec2-setup.sh" "$REMOTE:/tmp/ec2-setup.sh"
ssh "${SSH_OPTS[@]}" "$REMOTE" "APP_DIR=$APP_DIR bash /tmp/ec2-setup.sh"
ok "EC2 instance ready"

# ---------------------------------------------------------------------------
log "Step 3/5 — Syncing source to $REMOTE:$APP_DIR ..."
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'coverage' \
  --exclude 'test-results' \
  --exclude '.git' \
  --exclude '.env' \
  -e "ssh ${SSH_OPTS[*]}" \
  "$ROOT_DIR/" "$REMOTE:$APP_DIR/"
ok "Source synced"

log "Step 4/5 — Shipping $ENV_FILE ..."
scp "${SSH_OPTS[@]}" "$ENV_FILE" "$REMOTE:$APP_DIR/.env"
ok ".env in place on the instance"

# ---------------------------------------------------------------------------
log "Step 5/5 — Building images and starting the stack on the instance..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "cd $APP_DIR && docker compose --env-file .env build && docker compose --env-file .env up -d"
ok "Containers built and started"

# ---------------------------------------------------------------------------
log "Health-checking http://$EC2_HOST/api/health ..."
for i in $(seq 1 15); do
  if curl -sf "http://$EC2_HOST/api/health" >/dev/null; then
    ok "API is healthy"
    echo
    echo "Deployed. Visit: http://$EC2_HOST/admin"
    exit 0
  fi
  sleep 2
done

fail "API did not become healthy in time. Check logs with:"
echo "  ssh -i $EC2_SSH_KEY $REMOTE 'cd $APP_DIR && docker compose logs -f'"
exit 1
