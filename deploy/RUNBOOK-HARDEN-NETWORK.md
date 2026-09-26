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

- `Blocked` menampilkan port `3000 4000 5432 6543 8000 8443 9000 9001 9999`.
- `Admin allow` menampilkan IP/CIDR Anda.
- Setiap baris `[dry-run] iptables ...` hanya dicetak, tidak dijalankan.

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
nc -vz 172.19.3.171 5432   # harus timeout/refused
nc -vz 172.19.3.171 8000   # harus timeout/refused
nc -vz 172.19.3.171 443    # harus open
nc -vz 172.19.3.171 22     # harus open
```

---

## 7. Kontrol utama: bind Compose ke loopback

Firewall adalah lapisan tambahan. Kontrol yang lebih kuat adalah tidak
mem-publish port manajemen ke publik. Edit `docker-compose.yml` Supabase:

```yaml
services:
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

Lalu:

```bash
docker compose up -d
docker compose ps
```

---

## 8. Cara membatalkan

Jika perlu membuka kembali:

```bash
sudo iptables -D DOCKER-USER -j SIMKAL-CONTAIN
sudo iptables -F SIMKAL-CONTAIN
sudo iptables -X SIMKAL-CONTAIN

# Hapus aturan INPUT (lihat dulu daftarnya)
sudo iptables -S INPUT | grep simkal-backend-block
# lalu untuk setiap baris:
# sudo iptables -D INPUT -p tcp --dport <port> -m comment --comment simkal-backend-block -j DROP

sudo netfilter-persistent save
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
- `netfilter-persistent save` membuat aturan bertahan setelah reboot. Jika paket
  tidak tersedia, simpan manual:

  ```bash
  sudo iptables-save | sudo tee /etc/iptables/rules.v4
  ```

- Setelah firewall aktif, seluruh aplikasi (browser) tetap berjalan normal
  karena hanya lewat Caddy di port 80/443.
