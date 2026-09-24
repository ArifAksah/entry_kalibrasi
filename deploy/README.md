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

## Hardening Keamanan (WAJIB pasca temuan pentest Sept 2026)

Aplikasi sudah diperkeras di sisi kode (middleware `/api/*`, RLS, endpoint
registrasi admin-only). Sisa perbaikan berada di level VM/infra:

### 1. Kunci akses langsung ke Supabase/Kong (temuan H5 & C3)

Semua trafik browser harus lewat nginx (`https://<domain>/supabase/…),
bukan ke port Kong. Backend tidak boleh terjangkau dari jaringan user:

```bash
# docker-compose Supabase self-hosted: bind mapping ke loopback saja
#   ports:
#     - "127.0.0.1:7000:8000"   # Kong (HTTP)
#     - "127.0.0.1:7443:8443"   # Kong (HTTPS)

# Docker melewati ufw — kunci lewat iptables DOCKER-USER juga:
sudo iptables -I DOCKER-USER -p tcp --dport 7000 -j DROP    # atau batasi IP
sudo iptables -I DOCKER-USER -p tcp --dport 8000 -j DROP    # Kong/PDF publik
sudo netfilter-persistent save 2>/dev/null || true
```

Set di `.env` produksi:
`NEXT_PUBLIC_SUPABASE_URL=https://<domain-nginx>/supabase`

### 2. Membuka registrasi publik & autoconfirm (temuan H4)

Di `.env` stack Supabase self-hosted (docker):
`GOTRUE_MAILER_AUTOCONFIRM=false` dan
`GOTRUE_DISABLE_SIGNUP="true"`
— admin tetap bisa membuat akun via `auth.admin`/service role, yang
merupakan satu-satunya jalur registrasi yang tersisa di aplikasi.

### 3. CORS backend (temuan H5)

Self-hosted Supabase men-set `Access-Control-Allow-Origin: *` secara default.
Matikan wildcard di Kong (`KONG_CORS_ENABLE=false` karena akses kini lewat
proxy nginx domain yang sama = same-origin, tidak butuh CORS sama sekali),
dan pastikan origin aplikasi tidak pernah memakai `*`.

### 3b. Same-origin via Caddy (temuan C3/H5) — wajib

Production memakai Caddy. Gunakan template `deploy/Caddyfile.production`:
browser hanya memakai `/supabase/*` (auth, rest, storage, realtime); seluruh
management plane Supabase (`pg/meta`, `metrics`, `api/mgmt`, `graphql admin`)
dibalas 404. Detail lengkap ada di komentar file tersebut.

```bash
sudo cp deploy/Caddyfile.production /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

### 3c. Containment jaringan (temuan C3/H5)

Jalankan di server sebagai root:

```bash
sudo bash deploy/harden-network.sh
```

Script memblokir port backend dari jaringan user melalui `DOCKER-USER`:
`3000 4000 5432 6543 8000 8443 9000 9001 9999`. Sesuaikan
`ADMIN_ALLOW_CIDRS` di dalam script bila akses admin tetap dibutuhkan.
Kontrol utama tetap: bind `ports:` Compose ke `127.0.0.1`.

### 3d. GoTrue & Kong (temuan H4/H5/H6/M7/M8)

Terapkan nilai di `deploy/supabase-hardening.env` ke `.env` stack Supabase:
`GOTRUE_DISABLE_SIGNUP=true`, `GOTRUE_MAILER_AUTOCONFIRM=false`, captcha,
rate limit, `KONG_CORS_ENABLE=false`, dan URL `/supabase`. Lalu:

```bash
docker compose up -d --no-deps --force-recreate auth kong
```

Studio & Postgres hanya lewat SSH tunnel (mis. `-L 13000:127.0.0.1:3000`).

### 4. RLS menyeluruh (temuan C1/C2) — wajib sebelum go-live

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/security_migration_01_preflight.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/security_migration_02_lockdown.sql
npm run check:anon-exposure   # harus 52 denied, 0 exposed
```

Migration memakai preflight ketat: berhenti tanpa perubahan bila daftar tabel
public berbeda dari 52 yang dikenal, atau bila `service_role` tidak BYPASSRLS.

### 5. Rotasi kredensial yang pernah ter-commit

`.env.keys` (NIK RSA private key, AES key, HMAC salt) dan `.env.example`
lama berisi JWT nyata dan ternasuk riwayat git. `git rm --cached .env.keys`
saja tidak cukup — kredensial harus dirotasi:
1. Supabase: ganti `JWT_SECRET`, lalu regenerate ANON + SERVICE_ROLE key;
   jalankan `database/harden_pii_and_masterdata_rls.sql`.
2. `node scripts/generate-keys.js` untuk NIK keys; migrasi-enkripsi ulang
   data `nik` yang tersimpan.
3. Hapus file dari index & force-clean history (git filter-repo) bila repo
   pernah push ke remote publik.
