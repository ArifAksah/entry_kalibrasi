# Production Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VM (Ubuntu)                           │
│                                                             │
│  ┌─────────┐    ┌──────────────────────────────────────┐   │
│  │  Nginx  │───▶│  Next.js App (PM2, port 3000)        │   │
│  │  :80    │    └──────────────────────────────────────┘   │
│  │  :443   │    ┌──────────────────────────────────────┐   │
│  │         │───▶│  WA Service (PM2, port 3001)         │   │
│  └─────────┘    └──────────────────────────────────────┘   │
│                 ┌──────────────────────────────────────┐   │
│                 │  PDF Template Service (Docker, :8000) │   │
│                 └──────────────────────────────────────┘   │
│                 ┌──────────────────────────────────────┐   │
│                 │  Supabase (Docker, :7000)             │   │
│                 └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `ecosystem.config.cjs` | PM2 process manager config (Next.js + WA service) |
| `docker-compose.prod.yml` | Docker Compose for PDF Template Service |
| `nginx.conf` | Nginx reverse proxy configuration |
| `deploy.sh` | Automated deployment script |
| `setup-vm.sh` | One-time VM setup (Node.js, Docker, Nginx, PM2) |
| `.env.production` | Template for production environment variables |

## Quick Start (Fresh VM)

```bash
# 1. Clone the repo
git clone <repo-url> /opt/kalibrasi
cd /opt/kalibrasi

# 2. Run initial setup (installs Node.js, Docker, Nginx, PM2)
sudo ./deploy/setup-vm.sh

# 3. Configure environment
cp deploy/.env.production .env
nano .env  # Fill in actual values

# 4. Setup Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/kalibrasi
sudo ln -sf /etc/nginx/sites-available/kalibrasi /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 5. Deploy
./deploy/deploy.sh
```

## Subsequent Deployments

```bash
# Full deploy (git pull + npm install + build + restart)
./deploy/deploy.sh

# Quick deploy (skip npm install, just rebuild)
./deploy/deploy.sh --quick

# Only restart services (no build)
./deploy/deploy.sh --services
```

## Service Management

```bash
# PM2 commands
pm2 list                    # Show all processes
pm2 logs                    # View all logs
pm2 logs next-app           # View Next.js logs only
pm2 restart next-app        # Restart Next.js
pm2 restart all             # Restart all PM2 services

# Docker (PDF service)
docker compose -f deploy/docker-compose.prod.yml logs -f
docker compose -f deploy/docker-compose.prod.yml restart pdf-template-service
docker compose -f deploy/docker-compose.prod.yml down
docker compose -f deploy/docker-compose.prod.yml up -d --build

# Nginx
sudo nginx -t               # Test config
sudo systemctl reload nginx # Reload without downtime
sudo systemctl restart nginx
```

## Monitoring

```bash
# Check all services
curl http://localhost:3000          # Next.js
curl http://localhost:3001          # WA Service
curl http://localhost:8000/health   # PDF Service
curl http://localhost:7000/rest/v1/ # Supabase

# PM2 monitoring dashboard
pm2 monit

# System resources
htop
```

## Auto-Start on Reboot

PM2 handles auto-start for Next.js and WA service:
```bash
pm2 save
pm2 startup  # Follow the instructions it prints
```

Docker services auto-start via `restart: unless-stopped` policy.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Next.js 502 | `pm2 logs next-app` — check for build errors |
| PDF service 503 | `docker compose -f deploy/docker-compose.prod.yml logs` |
| WA service down | `pm2 restart wa-service` |
| Port conflict | `lsof -i :3000` to find conflicting process |
| Out of memory | Check `pm2 monit`, increase VM RAM |
| Playwright error | `npx playwright install chromium` |
