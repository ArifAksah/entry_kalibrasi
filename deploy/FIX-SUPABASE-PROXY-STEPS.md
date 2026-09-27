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

## 7. Bind semua port Supabase ke loopback (kontrol utama)

Edit `docker-compose.yml` stack Supabase (di folder stack Supabase, cari dulu):

```bash
# Cari file compose Supabase
docker inspect supabase-kong --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'

# Tampilkan nama service Compose untuk setiap container yang publish port
for c in supabase-kong supabase-studio supabase-analytics supabase-auth supabase-pooler supabase-minio-1; do
  printf '%-24s service=' "$c"
  docker inspect "$c" --format '{{ index .Config.Labels "com.docker.compose.service" }}'
done
```

Masuk ke working directory yang ditampilkan, backup compose, lalu buka file:

```bash
cd "$(docker inspect supabase-kong --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}')"
cp docker-compose.yml "docker-compose.yml.bak.$(date +%F-%H%M%S)"
nano docker-compose.yml
```

Ubah setiap mapping `ports:` yang dipublish ke host agar memiliki prefix
`127.0.0.1:`. Gunakan **nama service dari label di atas**, bukan nama container.
Contoh topologi server ini:

```yaml
services:
  kong:       # container supabase-kong
    ports:
      - "127.0.0.1:8000:8000"
      - "127.0.0.1:8443:8443"
  studio:     # container supabase-studio
    ports:
      - "127.0.0.1:3000:3000"
  analytics:  # container supabase-analytics
    ports:
      - "127.0.0.1:4000:4000"
  auth:       # container supabase-auth
    ports:
      - "127.0.0.1:9999:9999"
  pooler:     # nama aktual bisa supavisor; ikuti label Compose
    ports:
      - "127.0.0.1:5432:5432"
      - "127.0.0.1:6543:6543"
  minio:      # ikuti nama service dari label Compose
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
```

Validasi hasil Compose sebelum melakukan perubahan container:

```bash
docker compose config --quiet
docker compose config | grep -A8 -E '^  (kong|studio|analytics|auth|pooler|supavisor|minio):'
```

Recreate hanya service yang mapping port-nya diubah. Ganti nama di bawah dengan
hasil label Compose jika berbeda; jangan gunakan `docker compose down`:

```bash
docker compose up -d --no-deps --force-recreate kong studio analytics auth pooler minio
docker compose ps
docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep -E 'kong|studio|analytics|auth|pooler|minio'
```

Semua mapping host harus diawali `127.0.0.1:`; tidak boleh ada `0.0.0.0` atau
`[::]` untuk port backend. Setelah recreate, uji dari server:

```bash
curl -sS -o /dev/null -w 'app=%{http_code}\n' http://127.0.0.1/
curl -sS -o /dev/null -w 'supabase=%{http_code}\n' http://127.0.0.1/supabase/rest/v1/
```

Ekspektasi: `app=200`, `supabase=401` tanpa `apikey`.

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

### Persist dengan systemd (server ini tidak punya netfilter-persistent)

Pasang unit yang tersedia di repo. Unit berjalan setelah Docker siap dan ikut
di-restart ketika `docker.service` di-restart:

```bash
sudo cp deploy/simkal-network-containment.service /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/simkal-network-containment.service
sudo systemctl daemon-reload
sudo systemctl enable --now simkal-network-containment.service
sudo systemctl status simkal-network-containment.service --no-pager -l
```

Status yang diharapkan: `active (exited)`. Pastikan tidak ada duplikasi:

```bash
sudo iptables -S DOCKER-USER | grep -c -- '-j SIMKAL-CONTAIN'  # harus 1
sudo iptables -S INPUT | grep -c simkal-backend-block          # harus 9
```

Tidak perlu `iptables-save`; menyimpan seluruh ruleset Docker dapat memulihkan
chain dinamis yang sudah tidak cocok setelah Docker restart.

---

## 10. Cara membatalkan (rollback)

```bash
# Firewall dan persistence systemd
sudo systemctl disable --now simkal-network-containment.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/simkal-network-containment.service
sudo systemctl daemon-reload
sudo iptables -D DOCKER-USER -j SIMKAL-CONTAIN 2>/dev/null
sudo iptables -F SIMKAL-CONTAIN 2>/dev/null
sudo iptables -X SIMKAL-CONTAIN 2>/dev/null
sudo iptables -S INPUT | grep simkal-backend-block
# hapus tiap baris: sudo iptables -D INPUT -p tcp --dport <port> -m comment --comment simkal-backend-block -j DROP
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
