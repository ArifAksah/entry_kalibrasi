#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# BMKG Calibration Dashboard — Production Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./deploy/deploy.sh              # Full deploy (build + restart all)
#   ./deploy/deploy.sh --quick      # Skip npm install, just rebuild & restart
#   ./deploy/deploy.sh --services   # Only restart services (no build)
#
# Prerequisites:
#   - Node.js 20+ installed
#   - PM2 installed globally: npm install -g pm2
#   - Caddy installed and configured (lihat deploy/Caddyfile.production)
#
# Catatan topologi:
#   - Next.js listen 127.0.0.1:3001 (di belakang Caddy :80).
#   - WA service listen :3002.
#   - Supabase (Kong 8000/8443, Studio 3000) dikelola compose terpisah.
#   - PDF Template Service tidak dipakai.
#
# ═══════════════════════════════════════════════════════════════════════════════

# Configuration
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$APP_DIR/deploy"
LOG_DIR="$APP_DIR/logs"
WA_LOG_DIR="$APP_DIR/wa-service/logs"
NEXT_PORT=3001
WA_PORT=3002

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
QUICK=false
SERVICES_ONLY=false
for arg in "$@"; do
    case $arg in
        --quick) QUICK=true ;;
        --services) SERVICES_ONLY=true ;;
    esac
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  BMKG Calibration Dashboard — Production Deploy"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════════"
echo ""

cd "$APP_DIR"

# ─── Step 0: Create log directories ──────────────────────────────────────────
mkdir -p "$LOG_DIR" "$WA_LOG_DIR"

# ─── Step 1: Pull latest code ─────────────────────────────────────────────────
if [ "$SERVICES_ONLY" = false ]; then
    log_info "Pulling latest code from git..."
    git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || log_warn "Git pull skipped (not a git repo or no remote)"
    log_success "Code updated"
fi

# ─── Step 2: Install dependencies ────────────────────────────────────────────
if [ "$QUICK" = false ] && [ "$SERVICES_ONLY" = false ]; then
    log_info "Installing Node.js dependencies..."
    npm ci --legacy-peer-deps --production=false 2>&1 | tail -5
    log_success "Dependencies installed"

    # Install WA service dependencies
    if [ -d "$APP_DIR/wa-service" ]; then
        log_info "Installing WA service dependencies..."
        cd "$APP_DIR/wa-service"
        npm ci 2>&1 | tail -3
        cd "$APP_DIR"
        log_success "WA service dependencies installed"
    fi
fi

# ─── Step 3: Build Next.js app ────────────────────────────────────────────────
if [ "$SERVICES_ONLY" = false ]; then
    log_info "Building Next.js application..."
    npm run build 2>&1 | tail -10
    log_success "Next.js build complete"
fi

# ─── Step 4: Start/Restart PM2 services ──────────────────────────────────────
log_info "Starting PM2 services..."

if pm2 list 2>/dev/null | grep -q "next-app"; then
    # Services already registered, restart them
    pm2 restart ecosystem.config.cjs --cwd "$DEPLOY_DIR" 2>&1 | tail -5
else
    # First time: start from ecosystem config
    pm2 start "$DEPLOY_DIR/ecosystem.config.cjs" 2>&1 | tail -10
fi

# Save PM2 process list for auto-start on reboot
pm2 save 2>/dev/null
log_success "PM2 services started"

# ─── Step 5: Verify services ─────────────────────────────────────────────────
echo ""
log_info "Verifying services..."
sleep 3

check_service() {
    local name=$1
    local url=$2
    if curl -sf "$url" > /dev/null 2>&1; then
        log_success "$name is running"
    else
        log_warn "$name may not be ready yet (check logs)"
    fi
}

check_service "Next.js App (port ${NEXT_PORT})" "http://localhost:${NEXT_PORT}"
check_service "WA Service (port ${WA_PORT})" "http://localhost:${WA_PORT}"
# Verifikasi same-origin Supabase lewat Caddy (harus menjawab, bukan langsung ke Kong).
check_service "Caddy /supabase (same-origin)" "http://localhost/supabase/auth/v1/health"

# ─── Step 6: Show status ─────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Deployment Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
pm2 list
echo ""
log_info "Logs: pm2 logs next-app | pm2 logs wa-service"
echo ""
