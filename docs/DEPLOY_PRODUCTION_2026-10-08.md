# Deploy Production — 2026-10-08

## 1. Deploy kode

```bash
cd ~/kalibrasi_opr
git stash            # bila ada perubahan lokal di server
git pull origin master
npm install          # bila ada dependency baru
npm run build
pm2 restart next-app
```

Verifikasi: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/` → `200`,
lalu `pm2 logs next-app --lines 100 | grep -i "does not exist" || echo OK`.

## 2. SQL yang WAJIB dijalankan di Supabase production

Jalankan berurutan di **Supabase SQL Editor** (semua idempoten / `IF NOT EXISTS`).

| # | File | Isi |
|---|---|---|
| 1 | `database/letter_tte_schema.sql` | Tabel/kolom TTE & verifikasi Surat Keterangan, `public_id`, `pdf_path`, `version` |
| 2 | `database/letter_multi_sensor.sql` | Surat per sensor (multi-sensor) |
| 3 | `database/letter_from_order_item.sql` | Surat dibuat dari Order + No. Identifikasi (bukan dari sertifikat) |
| 4 | `database/letter_number_sket_label.sql` | Label nomor surat `S.Ket` (fungsi `_cert_type_label`) |
| 5 | `database/order_item_document_assignment.sql` | Penugasan dokumen per item order (verifikator/checkers + snapshot + audit + RPC + trigger) |
| 6 | `database/order_document_assignment_defaults.sql` | Kolom `default_verifikator_1/2/3`, `default_authorized_by` pada `calibration_orders` |
| 7 | `database/order_item_sequence_high_water.sql` | Nomor item order tidak dipakai ulang setelah dihapus |
| 8 | `database/add_sensor_sensitivity.sql` | **Kolom `sensor.sensitivity`** (dipakai fitur sensitivitas pyranometer) |
| 9 | `database/migrate_graduating_to_resolution.sql` | **Data**: `graduating` → `resolution` (punya tabel cadangan) |
| 10 | `database/migrate_place_ifc.sql` | Sinkronisasi `calibration_place` (IFC) |
| 11 | `database/calibration_order_03_link_certificate.sql` | Penautan order ke sertifikat |

> File 9 bersifat **perubahan data**. Periksa dulu:
> `SELECT id, name, resolution, graduating FROM sensor WHERE resolution IS NULL AND graduating <> '';`
> lalu jalankan bila memang ingin menyatukan `graduating` ke `resolution`.

## 3. JANGAN dijalankan di production (khusus data dev)

File-file ini memakai **ID baris milik database dev**, jadi akan salah sasaran di production:

- `database/fix_cert173_pyranometer_u95.sql` — memperbaiki sertifikat **id 173** (dev).
- `database/fix_standard_precision_aws10.sql` — menargetkan `certificate_standard` id 105–111 (dev).
- `database/seed_pyranometer_staklim_bali.sql` — menargetkan station 854 & sensor 165–167 (dev).

Bila perbaikan itu diperlukan di production, buat versi baru dengan **kunci yang stabil**
(nomor sertifikat / nama sensor), bukan ID.

## 4. Catatan perubahan aplikasi yang ikut ter-deploy

- Kondisi ruang: sumber = **Awal & Akhir** (+ `U95` khusus Tipping Bucket), konvensi tampilan
  mengikuti workbook per jenis sertifikat (AWOS/AWS rata-rata ± ½rentang · Pyranometer Awal ± ½rentang ·
  TB Awal ± U95), seragam di print/view/draft-view.
- Pyranometer: input dipersatukan (`lib/pyranometer-inputs.ts`) — U95 standar diinterpolasi,
  mean pembacaan dikirim, drift ISO 9060 diambil dari tipe standar **atau** dari `drift` sertifikat standar.
- Tampilan sertifikat: pembacaan mengikuti **resolusi UUT**, ketidakpastian 2 angka penting
  (pyranometer: 2 desimal), koreksi mengikuti desimal ketidakpastian; pyranometer memakai satuan `± %`,
  faktor kalibrasi tanpa satuan.
- Master: kolom **Sensitivitas** pada sensor + menu-nya; field `graduating` dihapus dari menu.
- Surat/verifikasi: TTE, reset-for-resign, PDF, verifikasi publik, menu penandatanganan & verifikasi.
