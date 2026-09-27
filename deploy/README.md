# Production Deployment Guide

## Architecture (topologi NYATA di server)

```
┌──────────────────────────────────────────────────────────────┐
│                        VM (Ubuntu)                            │
│                                                              │
│  ┌─────────┐   ┌──────────────────────────────────────┐     │
│  │  Caddy  │──▶│  Next.js App (PM2, 127.0.0.1:3001)   │     │
│  │  :80    │   └──────────────────────────────────────┘     │
│  │         │   ┌──────────────────────────────────────┐     │
│  │         │──▶│  WA Service (PM2, :3002)             │     │
│  │         │   └──────────────────────────────────────┘     │
│  │         │   ┌──────────────────────────────────────┐     │
│  │         │──▶│  Kong / Supabase (Docker, :8000/8443)│     │
│  └─────────┘   │   prefix /supabase -> Kong           │     │
│                └──────────────────────────────────────┘     │
│                Supabase lain (Docker): Studio :3000,         │
│                Postgres :5432, pooler :6543, GoTrue :9999,   │
│                MinIO :9000/9001, Analytics :4000             │
└──────────────────────────────────────────────────────────────┘
```

| Layanan | Port host | Akses |
|---------|-----------|-------|
| Caddy (proxy publik) | **80** | publik |
| Next.js app | **3001** | via Caddy |
| WA service | **3002** | via Caddy (opsional) |
| Kong (Supabase gateway) | **8000 / 8443** | hanya via Caddy `/supabase` |
| Studio | 3000 | SSH tunnel saja |
| Postgres / pooler | 5432 / 6543 | SSH tunnel saja |
| GoTrue | 9999 | internal |
| MinIO | 9000 / 9001 | internal |
| Analytics | 4000 | internal |

> Tidak ada port 7000 di server (nilai itu hanya di template lama).
> PDF Template Service tidak dipakai.

## Files

| File | Purpose |
|------|---------|
| `ecosystem.config.cjs` | PM2 process manager config (Next.js 3001 + WA service 3002) |
| `Caddyfile.production` | **Reverse proxy produksi (Caddy)** — app + `/supabase` |
| `harden-network.sh` | Containment firewall (block Kong/Studio/Postgres dari jaringan user) |
| `simkal-network-containment.service` | Terapkan ulang containment setelah Docker siap/restart |
| `deploy.sh` | Automated deployment script |
| `setup-vm.sh` | One-time VM setup (Node.js, Docker, Caddy, PM2) |
| `.env.production` | Template for production environment variables |
| `supabase-hardening.env` | Overlay hardening Supabase (signup, CORS, dll) |
| `nginx.conf` | ⚠️ usang — tidak dipakai (produksi pakai Caddy) |
| `docker-compose.prod.yml` | ⚠️ usang — PDF service dibatalkan (bentrok port 8000) |

## Quick Start (Fresh VM)

```bash
# 1. Clone the repo
git clone <repo-url> /opt/kalibrasi
cd /opt/kalibrasi

# 2. Run initial setup (installs Node.js, Docker, Caddy, PM2)
sudo ./deploy/setup-vm.sh

# 3. Configure environment
cp deploy/.env.production .env
nano .env  # Fill in actual values (NEXT_PUBLIC_SUPABASE_URL=http://<host>/supabase)
# 4. Setup Caddy (reverse proxy + /supabase)
sudo cp deploy/Caddyfile.production /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy

# 5. Deploy
./deploy/deploy.sh
```

> **WAJIB (temuan V1):** `.env` **harus** mendefinisikan `NEXT_PUBLIC_SUPABASE_ANON_KEY`
> dengan anon key (JWT ber-`role: anon`). Build sekarang di-gate: `npm run build`
> akan **gagal** bila variabel ini kosong atau rolenya bukan `anon`. Alias
> `ANON_KEY` tidak lagi diteruskan ke bundle browser, jadi jangan mengandalkannya.

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

# Caddy (reverse proxy produksi)
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy   # Reload tanpa downtime
sudo systemctl restart caddy

# Supabase (docker-compose terpisah, di folder stack Supabase)
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml restart kong
```

## Monitoring

```bash
# Check all services
curl http://localhost:3001         # Next.js App (via lokal)
curl http://localhost:3002         # WA Service
curl http://localhost/supabase/auth/v1/health   # Supabase via Caddy (same-origin)
curl -sk https://localhost:8443/rest/v1/        # Kong langsung (harus 401)

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
| Supabase 401/502 via Caddy | Pastikan Kong 8000 hidup & blok `/supabase` di Caddyfile |
| WA service down | `pm2 restart wa-service` |
| Port conflict | `ss -tlnp` — cek port 3000 (Studio) vs 3001 (Next.js) |
| Out of memory | Check `pm2 monit`, increase VM RAM |
| Playwright error | `npx playwright install chromium` |

## Hardening Keamanan (WAJIB pasca temuan pentest Sept 2026)

Aplikasi sudah diperkeras di sisi kode (middleware `/api/*`, RLS, endpoint
registrasi admin-only). Sisa perbaikan berada di level VM/infra:

### 1. Kunci akses langsung ke Supabase/Kong (temuan H5 & C3)

Semua trafik browser harus lewat Caddy (`http://<host>/supabase/…`),
bukan ke port Kong (8000/8443). Backend tidak boleh terjangkau dari jaringan user:

```bash
# docker-compose Supabase self-hosted: bind mapping ke loopback saja
#   ports:
#     - "127.0.0.1:8000:8000"   # Kong (HTTP)
#     - "127.0.0.1:8443:8443"   # Kong (HTTPS)
#     - "127.0.0.1:3000:3000"   # Studio

# Docker melewati ufw — kunci lewat iptables DOCKER-USER (deploy/harden-network.sh):
sudo ADMIN_ALLOW_CIDRS="<IP-admin>" ./deploy/harden-network.sh
```

Set di `.env` produksi:
`NEXT_PUBLIC_SUPABASE_URL=http://<host-Caddy>/supabase`

### 2. Membuka registrasi publik & autoconfirm (temuan H4)

Di `.env` stack Supabase self-hosted (docker):
`GOTRUE_MAILER_AUTOCONFIRM=false` dan
`GOTRUE_DISABLE_SIGNUP="true"`
— admin tetap bisa membuat akun via `auth.admin`/service role, yang
merupakan satu-satunya jalur registrasi yang tersisa di aplikasi.

### 3. CORS backend (temuan H5)

Self-hosted Supabase men-set `Access-Control-Allow-Origin: *` secara default.
Matikan wildcard di Kong (`KONG_CORS_ENABLE=false` karena akses kini lewat
proxy Caddy host yang sama = same-origin, tidak butuh CORS sama sekali),
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
npm run security:migrate -- --stage production
npm run check:security-catalog  # semua tabel public ditemukan dinamis; 0 violation
npm run check:anon-exposure     # schema dikenal: 52 denied, 0 exposed
```

Tahap production selalu menjalankan migrasi `01`, `02`, `03`, lalu `04`.
Migration memakai preflight ketat: berhenti tanpa perubahan bila daftar tabel
public berbeda dari 52 yang dikenal, atau bila `service_role` tidak BYPASSRLS.
Bootstrap staging tidak termasuk tahap `production`/`all`; bila benar-benar
diperlukan, jalankan terpisah dengan
`npm run security:migrate -- --stage bootstrap --target staging`.

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
