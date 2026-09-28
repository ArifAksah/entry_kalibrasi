# MIGRASI PRODUCTION — WAJIB SEBELUM RESTART

Dokumen ini berisi langkah SQL yang **harus dijalankan di Supabase production**
sebelum meng-restart aplikasi setelah `git pull`.

Latar: kode terbaru memakai beberapa kolom yang belum ada di database production.
Jika aplikasi di-restart tanpa migrasi ini, fitur raw-data (QC) dan manajemen
personel dapat gagal.

---

## Langkah 1 — Wajib (blokir deploy)

Jalankan lewat **Supabase SQL Editor** (production) dua file berikut secara
berurutan:

### 1a. `database/add_raw_data_traceability.sql`
Menambah kolom pada `raw_data`:
- `source_row_index integer`
- `standard_certificate_id bigint` (+ FK ke `certificate_standard.id`, index)

Dipakai oleh: QC Check / raw-data, penyimpanan `sensor_id_std` per baris.

### 1b. `database/fix_personel_update_softdelete.sql`
Menambah kolom pada `personel`:
- `is_active boolean NOT NULL DEFAULT true`
- `deleted_at timestamptz`
- memastikan `balai_id`, `signer_title`, dan constraint `chk_personel_balai_id`

Dipakai oleh: daftar personel, nonaktifkan/aktifkan personel.

> Kedua file **idempoten** (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
> cek constraint). Aman dijalankan berkali-kali.

---

## Langkah 2 — Opsional (hanya jika belum pernah dijalankan)

Hanya jalankan bila tabel/kolom terkait belum ada:

- `database/create_master_cmc.sql` — tabel `cmc_profiles` & `cmc_values`
  (production sudah punya; skip).
- `database/seed_master_cmc_from_workbook.sql` — seed nilai CMC
  (production sudah punya data; skip kecuali ingin menambah).
- `database/dedupe_station_wmo_and_unique.sql` — unique index `station.station_id`.
  File ini **membatalkan transaksi** bila masih ada duplikat WMO, jadi aman.
  Jalankan hanya setelah merge duplikat selesai.

---

## Langkah 3 — JANGAN dijalankan otomatis

- `database/dev_hard_reset_for_resign.sql` — script administratif manual,
  **destruktif** (menghapus approval level 4 & mengubah status 1 sertifikat).
  Sudah dikeluarkan dari repo. Jalankan manual hanya bila perlu.

---

## Urutan aman deploy di server

```bash
cd ~/kalibrasi_opr
git stash                      # jika ada perubahan lokal di server
git pull origin master

# 1) Jalankan migrasi Langkah 1 di Supabase SQL Editor (production)
# 2) Verifikasi kolom sudah ada (opsional, lewat SQL Editor):
#    select column_name from information_schema.columns
#     where table_schema='public' and table_name='raw_data'
#       and column_name in ('source_row_index','standard_certificate_id');
#    select column_name from information_schema.columns
#     where table_schema='public' and table_name='personel'
#       and column_name in ('is_active','deleted_at');

npm install                    # jika ada dependency baru
npm run build
pm2 restart next-app
```

---

## Verifikasi setelah restart

```bash
# Halaman utama
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/

# API inti (butuh login; cek tidak 500)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/personel
```

Cek log PM2 untuk memastikan tidak ada error `column ... does not exist`:

```bash
pm2 logs next-app --lines 100 | grep -i "does not exist" || echo "OK: tidak ada error kolom"
```
