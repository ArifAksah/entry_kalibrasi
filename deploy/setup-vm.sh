#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# BMKG Calibration Dashboard — VM Initial Setup Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Run this ONCE on a fresh Ubuntu 22.04+ VM to install all prerequisites.
#
# Usage:
#   sudo ./deploy/setup-vm.sh
#
# After running this script:
#   1. Copy .env.production to .env (adjust values)
#   2. Run ./deploy/deploy.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo $0"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  VM Initial Setup — BMKG Calibration Dashboard"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── System updates ──────────────────────────────────────────────────────────
echo "[1/7] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ─── Node.js 20 LTS ──────────────────────────────────────────────────────────
echo "[2/7] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "  Node.js $(node -v) installed"

# ─── PM2 ─────────────────────────────────────────────────────────────────────
echo "[3/7] Installing PM2..."
npm install -g pm2
pm2 startup systemd -u $(logname) --hp /home/$(logname) 2>/dev/null || true
echo "  PM2 installed"

# ─── Docker ──────────────────────────────────────────────────────────────────
echo "[4/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker $(logname)
fi
echo "  Docker $(docker --version | cut -d' ' -f3) installed"

# ─── Nginx ───────────────────────────────────────────────────────────────────
echo "[5/7] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
echo "  Nginx installed"

# ─── Playwright dependencies ─────────────────────────────────────────────────
echo "[6/7] Installing Playwright browser dependencies..."
npx playwright install-deps chromium 2>/dev/null || apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2
echo "  Playwright deps installed"

# ─── Firewall ────────────────────────────────────────────────────────────────
echo "[7/7] Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable 2>/dev/null || true
echo "  Firewall configured (ports 22, 80, 443 open)"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Setup Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "  1. Copy nginx config:  sudo cp deploy/nginx.conf /etc/nginx/sites-available/kalibrasi"
echo "  2. Enable site:        sudo ln -sf /etc/nginx/sites-available/kalibrasi /etc/nginx/sites-enabled/"
echo "  3. Remove default:     sudo rm -f /etc/nginx/sites-enabled/default"
echo "  4. Test nginx:         sudo nginx -t"
echo "  5. Reload nginx:       sudo systemctl reload nginx"
echo "  6. Configure .env:     cp .env.example .env && nano .env"
echo "  7. Deploy:             ./deploy/deploy.sh"
echo ""
echo "  For HTTPS (recommended):"
echo "  sudo apt install certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d yourdomain.com"
echo ""
