#!/usr/bin/env bash
#
# Run ONCE on a fresh EC2 instance (Amazon Linux 2023 or Ubuntu 22.04/24.04)
# to install Docker + the Compose plugin and prepare the deploy directory.
# Usually invoked automatically over SSH by deploy/deploy-to-ec2.sh, but can
# be run by hand too:
#
#   ssh -i mykey.pem ec2-user@<elastic-ip> 'bash -s' < deploy/ec2-setup.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/survey-app}"

echo "▸ Detecting OS..."
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID="$ID"
else
  echo "Cannot detect OS (missing /etc/os-release)." >&2
  exit 1
fi

install_docker_amazon_linux() {
  echo "▸ Installing Docker on Amazon Linux..."
  sudo dnf install -y docker
  sudo systemctl enable --now docker

  # Amazon Linux 2023's dnf docker package doesn't ship the compose plugin;
  # install it directly from Docker's GitHub releases.
  DOCKER_CONFIG="${DOCKER_CONFIG:-/usr/local/lib/docker}"
  sudo mkdir -p "$DOCKER_CONFIG/cli-plugins"
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) COMPOSE_ARCH="x86_64" ;;
    aarch64) COMPOSE_ARCH="aarch64" ;;
    *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
  esac
  COMPOSE_VERSION="v2.29.7"
  sudo curl -sSL \
    "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}" \
    -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
  sudo chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
}

install_docker_ubuntu() {
  echo "▸ Installing Docker on Ubuntu..."
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo systemctl enable --now docker
}

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "▸ Docker + Compose plugin already installed, skipping install."
else
  case "$OS_ID" in
    amzn) install_docker_amazon_linux ;;
    ubuntu | debian) install_docker_ubuntu ;;
    *)
      echo "Unsupported OS: $OS_ID. Install Docker + Compose plugin manually." >&2
      exit 1
      ;;
  esac
fi

CURRENT_USER="${SUDO_USER:-$USER}"
if ! groups "$CURRENT_USER" | grep -q docker; then
  echo "▸ Adding $CURRENT_USER to the docker group (re-login required to take effect)..."
  sudo usermod -aG docker "$CURRENT_USER"
fi

echo "▸ Preparing $APP_DIR ..."
sudo mkdir -p "$APP_DIR"
sudo chown "$CURRENT_USER":"$CURRENT_USER" "$APP_DIR"

echo "✔ EC2 instance is ready. Deploy directory: $APP_DIR"
echo "  Note: if this was the first time adding you to the docker group,"
echo "  log out and back in (or run 'newgrp docker') before running docker commands directly."
