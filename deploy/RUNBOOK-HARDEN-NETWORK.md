# Runbook: Menjalankan `harden-network.sh` di Server Produksi

Panduan ini untuk operator yang mengakses VM produksi lewat SSH dan perlu
menutup port manajemen (Studio, Postgres, Kong, MinIO, GoTrue, Analytics) dari
jaringan user.

> Ganti `entry` (user SSH) dan `172.19.3.171` (IP produksi) sesuai kondisi Anda.

---

## 0. Prasyarat

- Anda punya akses SSH ke server produksi.
- Anda tahu IP/jump host yang dipakai untuk administrasi (mis. VPN kantor),
  karena IP itu harus dimasukkan ke allowlist agar akses manajemen tidak putus.
- Repo sudah ada di server (contoh folder: `/home/<user>/kalibrasi_opr`).

---

## 1. SSH ke server produksi

Dari laptop:

```bash
ssh entry@172.19.3.171
```

Jika port SSH bukan 22:

```bash
ssh -p <port> entry@172.19.3.171
```

Setelah masuk, Anda berada di shell server produksi.

---

## 2. Masuk ke folder aplikasi

Folder bisa berbeda per server. Cari dulu:

```bash
ls -d ~/kalibrasi_opr ~/entry_kalibrasi /opt/kalibrasi 2>/dev/null
```

Masuk ke folder yang benar (contoh `kalibrasi_opr`):

```bash
cd ~/kalibrasi_opr
```

Verifikasi bahwa Anda berada di repo yang benar:

```bash
pwd
git remote -v
ls deploy/harden-network.sh
```

Jika `deploy/harden-network.sh` tidak ada, ambil perubahan terbaru:

```bash
git pull origin master
```

---

## 3. Tentukan IP admin Anda (WAJIB)

Cari tahu dari IP mana Anda mengakses server. Dari shell server:

```bash
echo "$SSH_CLIENT"
```

Contoh output: `10.20.30.45 51234 22` → IP Anda `10.20.30.45`.

Jika akses admin berasal dari satu subnet kantor, gunakan CIDR, mis.
`10.20.30.0/24`. Jika beberapa sumber, pisahkan dengan koma.

Catat nilainya, misalnya:

```text
ADMIN=10.20.30.0/24
```

> Jika allowlist kosong, port manajemen akan tertutup untuk semua IP luar.
> Anda masih bisa SSH, tetapi akses langsung ke Postgres/Studio dari laptop
> akan hilang sampai aturan dihapus. Jadi isi allowlist ini dengan benar.

---

## 4. Jalankan dry-run (tidak mengubah apa pun)

```bash
sudo ADMIN_ALLOW_CIDRS="10.20.30.0/24" ./deploy/harden-network.sh --dry-run
```

Periksa output:

- `Blocked` menampilkan port `3000 4000 5432 6543 8000 8443 9000 9001 9999`
  (3000 = Studio, 8000/8443 = Kong).
- `Admin allow` menampilkan IP/CIDR Anda.
- Setiap baris `[dry-run] iptables ...` hanya dicetak, tidak dijalankan.
- **Guard**: jika `.env` masih menembak Kong langsung (`:8000`/`:8443`),
  akan muncul peringatan — perbaiki `.env` ke `http://<host>/supabase` dulu.

---

## 5. Terapkan aturan firewall

```bash
sudo ADMIN_ALLOW_CIDRS="10.20.30.0/24" ./deploy/harden-network.sh
```

Akan muncul konfirmasi:

```text
Lanjutkan menerapkan aturan firewall? [y/N]
```

Ketik `y` lalu Enter. Untuk tanpa prompt (otomasi), tambahkan `--yes`:

```bash
sudo ADMIN_ALLOW_CIDRS="10.20.30.0/24" ./deploy/harden-network.sh --yes
```

---

## 6. Verifikasi di server

```bash
sudo iptables -nvL DOCKER-USER --line-numbers
sudo iptables -nvL INPUT --line-numbers | grep simkal-backend-block
```

Harapan:

- Chain `SIMKAL-CONTAIN` terpasang di `DOCKER-USER`.
- Ada baris DROP untuk tiap port manajemen.

Uji dari laptop **lain** (bukan allowlist):

```bash
nc -vz 172.19.3.171 5432   # harus timeout/refused (Postgres)
nc -vz 172.19.3.171 8000   # harus timeout/refused (Kong) — dulu terbuka!
nc -vz 172.19.3.171 8443   # harus timeout/refused (Kong HTTPS)
nc -vz 172.19.3.171 3000   # harus timeout/refused (Studio)
nc -vz 172.19.3.171 80     # harus open (Caddy)
nc -vz 172.19.3.171 22     # harus open (SSH)
```

Uji aplikasi tetap jalan (dari browser/laptop):

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://172.19.3.171/supabase/auth/v1/health  # lewat Caddy
curl -s -o /dev/null -w '%{http_code}\n' http://172.19.3.171/supabase/pg/meta          # harus 404
```

---

## 7. Kontrol utama: bind Compose ke loopback

Firewall adalah lapisan tambahan. Kontrol yang lebih kuat adalah tidak
mem-publish port manajemen ke publik. Edit `docker-compose.yml` stack Supabase
(di folder stack Supabase, bukan file ini):

```yaml
services:
  kong:
    ports:
      - "127.0.0.1:8000:8000"   # Kong HTTP
      - "127.0.0.1:8443:8443"   # Kong HTTPS
  studio:
    ports:
      - "127.0.0.1:3000:3000"
  db:
    ports:
      - "127.0.0.1:5432:5432"
```

Lalu recreate hanya service terdampak:

```bash
docker compose up -d --no-deps --force-recreate kong studio db
docker compose ps
```

> Server ini TIDAK punya port 7000. Kong = 8000/8443.

---

## 8. Cara membatalkan

Jika perlu membuka kembali:

```bash
sudo systemctl disable --now simkal-network-containment.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/simkal-network-containment.service
sudo systemctl daemon-reload

sudo iptables -D DOCKER-USER -j SIMKAL-CONTAIN
sudo iptables -F SIMKAL-CONTAIN
sudo iptables -X SIMKAL-CONTAIN

# Hapus aturan INPUT (lihat dulu daftarnya)
sudo iptables -S INPUT | grep simkal-backend-block
# lalu untuk setiap baris:
# sudo iptables -D INPUT -p tcp --dport <port> -m comment --comment simkal-backend-block -j DROP
```

---

## 9. Ringkasan Perintah (copy-paste)

```bash
ssh entry@172.19.3.171
cd ~/kalibrasi_opr
git pull origin master
echo "$SSH_CLIENT"                      # catat IP Anda

sudo ADMIN_ALLOW_CIDRS="<IP-ANDA>" ./deploy/harden-network.sh --dry-run
sudo ADMIN_ALLOW_CIDRS="<IP-ANDA>" ./deploy/harden-network.sh

sudo iptables -nvL DOCKER-USER --line-numbers
```

---

## Catatan

- Script bersifat idempoten: aman dijalankan berulang, aturan tidak menumpuk.
- Script menolak dijalankan jika bukan root.
- Untuk host Docker, gunakan `deploy/simkal-network-containment.service` agar
  script idempoten diterapkan ulang setelah Docker siap/restart. Jangan simpan
  seluruh ruleset Docker dengan `iptables-save`, karena chain dinamis Docker
  dapat berubah setelah restart.

  ```bash
  sudo cp deploy/simkal-network-containment.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now simkal-network-containment.service
  ```

- Setelah firewall aktif, seluruh aplikasi (browser) tetap berjalan normal
  karena hanya lewat Caddy di port 80 (saat ini tanpa domain/TLS).
- **PRASYARAT MUTLAK sebelum menjalankan firewall**: Caddyfile produksi sudah
  terpasang (blok `/supabase`) dan `.env` aplikasi sudah menunjuk
  `http://<host>/supabase`, serta aplikasi sudah di-rebuild. Jika tidak,
  browser semua user akan kehilangan akses Supabase.
