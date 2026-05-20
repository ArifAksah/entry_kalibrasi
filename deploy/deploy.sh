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
#   - Docker & Docker Compose installed
#   - Nginx installed and configured
#
# ═══════════════════════════════════════════════════════════════════════════════

# Configuration
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$APP_DIR/deploy"
LOG_DIR="$APP_DIR/logs"
WA_LOG_DIR="$APP_DIR/wa-service/logs"

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

# ─── Step 4: Start/Restart PDF Template Service (Docker) ──────────────────────
log_info "Starting PDF Template Service (Docker)..."
cd "$DEPLOY_DIR"

if docker compose -f docker-compose.prod.yml ps --quiet pdf-template-service 2>/dev/null | grep -q .; then
    docker compose -f docker-compose.prod.yml up -d --build pdf-template-service 2>&1 | tail -5
else
    docker compose -f docker-compose.prod.yml up -d --build 2>&1 | tail -5
fi

cd "$APP_DIR"

# Wait for PDF service to be healthy
log_info "Waiting for PDF service health check..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        log_success "PDF Template Service is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        log_warn "PDF service health check timed out (may still be starting)"
    fi
    sleep 2
done

# ─── Step 5: Start/Restart PM2 services ──────────────────────────────────────
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

# ─── Step 6: Verify services ─────────────────────────────────────────────────
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

check_service "Next.js App (port 3000)" "http://localhost:3000"
check_service "WA Service (port 3001)" "http://localhost:3001"
check_service "PDF Service (port 8000)" "http://localhost:8000/health"

# ─── Step 7: Show status ─────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Deployment Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
pm2 list
echo ""
docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" ps 2>/dev/null || true
echo ""
log_info "Logs: pm2 logs | docker compose -f deploy/docker-compose.prod.yml logs -f"
echo ""
