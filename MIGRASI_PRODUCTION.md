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

## Langkah 4 — Surat Keterangan (WAJIB untuk deploy ini)

Deploy perubahan Surat Keterangan (template/view/print, TTE, verifikasi 3 tahap,
linimasa, log, filter & pagination, format tanggal Indonesia) memerlukan tiga
migrasi tambahan. **Semuanya idempoten** — aman dijalankan berulang.

Jalankan lewat **Supabase SQL Editor** (production), tiap file sebagai satu query:

### 4a. `database/letter_included_sensors.sql`
Menambah kolom `letter.included_sensor_ids bigint[]` — daftar sensor yang benar-benar
dipakai pada surat (NULL = tampilkan semua sensor instrumen, perilaku lama).
Dipakai oleh: form buat/edit Surat Keterangan (hapus sensor tersimpan).

### 4b. `database/create_letter_logs_table.sql`
Membuat tabel `letter_logs` (+ index, RLS, dan trigger pengisi `performed_by_name`).
Dipakai oleh: linimasa surat, menu **Log Surat**, dan `letter-log-helper`.

### 4c. `database/letter_number_at_creation.sql`
Mengganti fungsi trigger `sync_letter_from_order_item` sehingga **nomor surat dibuat
saat draf dibuat** (bukan menunggu TTE), memakai bulan/tahun saat dibuat — mengikuti
perilaku nomor sertifikat. Nomor yang sudah ada **tidak** diubah, jadi surat lama tetap
aman; script ini tidak menyentuh baris yang sudah ada.

> 4c mengubah **perilaku penomoran**. Jalankan bersamaan dengan deploy kode
> (sebelum/saat restart), jangan jauh sebelumnya, agar nomor draf tidak muncul di
> UI versi lama.

---

## Urutan aman deploy di server

```bash
cd ~/kalibrasi_opr
git stash                      # jika ada perubahan lokal di server
git pull origin master

# 1) Jalankan migrasi Langkah 1 (ops/QC & personel) di Supabase SQL Editor
# 2) Jalankan migrasi Langkah 4 (4a, 4b, 4c — Surat Keterangan)
# 3) Verifikasi kolom sudah ada (opsional, lewat SQL Editor):
#    select column_name from information_schema.columns
#     where table_schema='public' and table_name='raw_data'
#       and column_name in ('source_row_index','standard_certificate_id');
#    select column_name from information_schema.columns
#     where table_schema='public' and table_name='personel'
#       and column_name in ('is_active','deleted_at');
#    select column_name from information_schema.columns
#     where table_schema='public' and table_name='letter'
#       and column_name in ('included_sensor_ids');
#    select to_regclass('public.letter_logs');  -- harus tidak NULL

npm install                    # jika ada dependency baru
npm run build
pm2 restart kalibrasi-app      # proses aktifnya bernama kalibrasi-app (bukan next-app)
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
pm2 logs kalibrasi-app --lines 100 | grep -i "does not exist" || echo "OK: tidak ada error kolom"
```
