# Langkah Perbaikan: Proxy Supabase lewat Caddy + Containment Firewall

Panduan copy-paste untuk dijalankan di server produksi (`entry@172.19.3.171`).

## Latar belakang (temuan)

- Caddy `/etc/caddy/Caddyfile` **tidak punya blok `/supabase`** → browser
  menembak Kong langsung ke `http://172.19.3.171:8000`.
- Kong terbuka ke `0.0.0.0:8000` & `0.0.0.0:8443` (tembus jaringan user).
- Topologi nyata: Kong=8000/8443, Next.js=3001, WA=3002, Studio=3000.
  **Tidak ada port 7000.**

Tujuan: browser hanya lewat Caddy `http://172.19.3.171/supabase`, lalu Kong
8000/8443 & port backend lain hanya bisa diakses dari host/loopback.

> **URUTAN PENTING.** Jangan aktifkan firewall sebelum Caddy + `.env` + rebuild
> selesai, atau semua user kehilangan akses Supabase.

---

## 0. Masuk ke server

```bash
ssh entry@172.19.3.171
cd ~/kalibrasi_opr
```

Catat IP admin Anda (untuk allowlist firewall):

```bash
echo "$SSH_CLIENT"      # kolom pertama = IP Anda, mis. 10.20.30.45
```

Tulis sebagai variabel (ganti sesuai IP Anda):

```bash
ADMIN="10.20.30.0/24"   # ganti dengan IP/subnet admin Anda
```

---

## 1. Ambil kode terbaru yang sudah diperbaiki

Di laptop, commit & push dulu (lihat bagian "Dari laptop" di akhir dokumen).
Lalu di server:

```bash
cd ~/kalibrasi_opr
git pull origin master      # atau 'main' sesuai remote
```

Verifikasi file baru/berubah ada:

```bash
ls -l deploy/Caddyfile.production deploy/harden-network.sh
grep -n "rev" deploy/Caddyfile.production | head
```

---

## 2. Backup konfigurasi lama (WAJIB)

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%F-%H%M)
cp .env .env.bak.$(date +%F-%H%M) 2>/dev/null || true
```

---

## 3. Pasang Caddyfile produksi (blok /supabase)

**Tinjau dulu** isinya, pastikan sesuai topologi:

```bash
cat deploy/Caddyfile.production
```

Terapkan:

```bash
sudo cp deploy/Caddyfile.production /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Uji same-origin dari server (harus tidak 404/401 untuk health):

```bash
curl -s -o /dev/null -w 'auth health = %{http_code}\n' http://127.0.0.1/supabase/auth/v1/health
curl -s -o /dev/null -w 'pg/meta     = %{http_code}\n' http://127.0.0.1/supabase/pg/meta    # harus 404
curl -s -o /dev/null -w 'app root    = %{http_code}\n' http://127.0.0.1/                   # harus 200
```

> `auth health` 401 masih wajar (butuh apikey). Yang penting **bukan 404** dan
> `pg/meta` memang **404** (management plane ditutup).

---

## 4. Ubah `.env` aplikasi ke same-origin

Edit `.env` di root repo:

```bash
nano .env
```

Set/nambahkan (ganti IP bila perlu):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://172.19.3.171/supabase
SUPABASE_PUBLIC_URL=http://172.19.3.171/supabase
API_EXTERNAL_URL=http://172.19.3.171/supabase
```

Pastikan TIDAK ada lagi nilai yang menembak `:8000`/`:8443` langsung:

```bash
grep -nE "NEXT_PUBLIC_SUPABASE_URL|SUPABASE_PUBLIC_URL|API_EXTERNAL_URL" .env
```

---

## 5. Rebuild & restart aplikasi

Sesuai Stack produksi (PM2, Next.js di 3001, WA di 3002):

```bash
npm run build
pm2 restart next-app wa-service   # atau: pm2 restart all
pm2 list
```

Pastikan aplikasi masih listen di 3001 dan WA di 3002:

```bash
sudo ss -tlnp | grep -E ':3001|:3002'
```

Buka di browser: `http://172.19.3.171/` — login & buka data Supabase harus
tetap jalan (sekarang lewat `/supabase`).

---

## 6. Uji menyeluruh SEBELUM firewall

```bash
# Lewat Caddy (harus jalan):
curl -s -o /dev/null -w 'caddy supabase = %{http_code}\n' http://172.19.3.171/supabase/rest/v1/

# Kong langsung (sekarang masih terbuka, kita akan tutup):
curl -sk -o /dev/null -w 'kong 8443 = %{http_code}\n' https://172.19.3.171:8443/rest/v1/
```

> Sesudah langkah 3–5, aplikasi di browser tidak boleh lagi memanggil
> `:8000`/`:8443`. Buka DevTools → Network, pastikan request ke
> `http://172.19.3.171/supabase/...`.

---

## 7. Bind Kong/Studio ke loopback (kontrol utama)

Edit `docker-compose.yml` stack Supabase (di folder stack Supabase, cari dulu):

```bash
# Cari file compose Supabase
docker inspect supabase-kong --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
```

Ubah mapping `ports:` menjadi loopback (contoh):

```yaml
  kong:
    ports:
      - "127.0.0.1:8000:8000"
      - "127.0.0.1:8443:8443"
  studio:
    ports:
      - "127.0.0.1:3000:3000"
  db:
    ports:
      - "127.0.0.1:5432:5432"
```

Recreate hanya service terdampak:

```bash
docker compose up -d --no-deps --force-recreate kong studio db
docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep -E 'kong|studio|pooler'
```

Pastikan sekarang `127.0.0.1:8000->8000` (bukan `0.0.0.0`).

---

## 8. Jalankan containment firewall

Dry-run dulu (tidak mengubah apa pun):

```bash
sudo ADMIN_ALLOW_CIDRS="$ADMIN" ./deploy/harden-network.sh --dry-run
```

Periksa: `Blocked : 3000 4000 5432 6543 8000 8443 9000 9001 9999`,
`Public ok : 80 22`, dan **tidak ada** peringatan GUARD (berarti `.env` sudah benar).

Terapkan:

```bash
sudo ADMIN_ALLOW_CIDRS="$ADMIN" ./deploy/harden-network.sh --yes
```

---

## 9. Verifikasi & persist

Di server:

```bash
sudo iptables -nvL DOCKER-USER --line-numbers
sudo iptables -nvL INPUT --line-numbers | grep simkal-backend-block
```

Dari laptop **lain** (bukan allowlist):

```bash
nc -vz 172.19.3.171 8000   # harus timeout/refused
nc -vz 172.19.3.171 8443   # harus timeout/refused
nc -vz 172.19.3.171 3000   # harus timeout/refused
nc -vz 172.19.3.171 5432   # harus timeout/refused
nc -vz 172.19.3.171 80     # harus open
nc -vz 172.19.3.171 22     # harus open
```

Uji aplikasi dari browser: buka `http://172.19.3.171/`, login, akses data —
harus normal.

Aturan sudah di-persist otomatis oleh script (`netfilter-persistent save`).

---

## 10. Cara membatalkan (rollback)

```bash
# Firewall
sudo iptables -D DOCKER-USER -j SIMKAL-CONTAIN 2>/dev/null
sudo iptables -F SIMKAL-CONTAIN 2>/dev/null
sudo iptables -X SIMKAL-CONTAIN 2>/dev/null
sudo iptables -S INPUT | grep simkal-backend-block
# hapus tiap baris: sudo iptables -D INPUT -p tcp --dport <port> -m comment --comment simkal-backend-block -j DROP
sudo netfilter-persistent save

# Caddy & .env
sudo cp /etc/caddy/Caddyfile.bak.* /etc/caddy/Caddyfile
sudo systemctl reload caddy
cp .env.bak.* .env
```

---

## Dari laptop (sebelum langkah server)

Commit & push perubahan di repo:

```bash
cd /home/arif/Dokumen/Simkal/entry_kalibrasi
git add deploy/ lib/supabase.ts proxy.ts next.config.mjs .env.example
git status
git commit -m "fix(deploy): proxy Supabase lewat Caddy /supabase + containment firewall"
git push origin master   # atau 'main'
```

> File `.env` produksi di server **tidak** ikut git (berisi rahasia). Ubah manual
> di langkah 4.
