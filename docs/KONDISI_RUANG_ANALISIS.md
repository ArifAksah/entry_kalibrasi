# Kondisi Ruang / Room Condition — Analisis & Bahan Diskusi

Dokumen ini bahan diskusi dengan **petugas kalibrasi** sebelum kita memutuskan
perlakuan final untuk input kondisi ruang di SIMKAL.

## 1. Ringkasan

- **Yang diminta sertifikat**: pernyataan kondisi ruang saat kalibrasi
  (mis. `(24.55 ± 0.1) °C`).
- **Cara workbook**: petugas mencatat **dua angka** — **Awal** (mulai) dan
  **Akhir** (selesai) — lalu dihitung:

  ```
  mean      = (Awal + Akhir) / 2
  halfRange = |Akhir − Awal| / 2
  tampil    = "(mean ± halfRange) <satuan>"    (dibulatkan 1 desimal)
  ```

- **Cara SIMKAL sekarang**: form menyediakan baris **Suhu** dan **Kelembapan**
  dengan input **Awal & Akhir**; perhitungan otomatis memakai rumus yang sama
  dengan workbook. Bila Awal/Akhir dibiarkan kosong, nilai teks bebas lama
  masih bisa dipakai (kompatibel dengan cara lama).
- **Kondisi ruang bukan komponen rumus U95** — fungsinya kelengkapan dokumen
  dan ketertelusuran.

## 2. Temuan: pengisian di workbook tidak konsisten

Blok "Kondisi Ruang" adalah **template tetap 5 baris**
(`TT Udara`, `RH/…`, `PP`, `… Air`, `Lain-lain`) yang ada di **setiap** sheet.
Yang benar-benar diisi berbeda-beda:

| Sheet | Suhu udara | RH | PP (tekanan ruang) | Suhu media |
|---|---|---|---|---|
| TT 1–4 | diisi | diisi | — | — |
| PP 1 | diisi | diisi | — | — |
| PP 2–4 | diisi | diisi | diisi | diisi |
| RH 1–4 | diisi | diisi | diisi | diisi |
| WS 1 | diisi | diisi | — | — |
| WS 2 | diisi | diisi | diisi | diisi |
| WD 1–2 | diisi | diisi | diisi | diisi |
| RR 1 | diisi | diisi | diisi | diisi |

Penyebabnya (dari pemeriksaan file):

1. **Tidak ada validasi.** Baris kosong hanya memunculkan `#DIV/0!`, dan
   sertifikat **tetap boleh dicetak**. Tidak ada konsekuensi bila ditinggal.
2. **Tidak ada aturan "baris wajib" per jenis kalibrasi**, sehingga bergantung
   kebiasaan pengisi: PP 1 kosong tetapi PP 2–4 lengkap; WS 1 dua baris tetapi
   WS 2 empat baris.
3. **Bukan karena beda petugas.** TT 1 (Roy Handoko) mengisi 2 baris, RH 1
   (petugas yang sama) mengisi 4 baris.
4. **Jejak copy-paste.** Di RH 1 baris berjudul "RH Udara" satuannya tertulis
   `ºC` (salah label) — tanda template disalin tanpa diperiksa.

## 3. Status implementasi di SIMKAL

| Bagian | Status |
|---|---|
| Rumus Awal & Akhir → `(mean ± halfRange)` | **Sudah ada & teruji** (identik workbook: `24.6/24.5 → (24.55 ± 0.1) °C`) |
| Presisi penyimpanan | Presisi penuh; pembulatan hanya saat tampil |
| Input di form | **Suhu & Kelembapan** (2 baris) |
| Parameter Tekanan Ruang & Suhu Media | **Mesin sudah siap di kode**, namun **belum ditampilkan** di form (menunggu keputusan) |
| Baris kosong | Tidak pernah ikut tercetak (di-prune saat simpan & dilewati saat render) |
| Sertifikat lama (nilai teks saja) | Tidak berubah |

## 4. Opsi perlakuan (untuk dipilih setelah diskusi)

- **A. 2 baris default + tombol tambah** — default Suhu & Kelembapan; Tekanan
  Ruang / Suhu Media muncul hanya bila diperlukan. *Keseimbangan antara ringkas
  dan lengkap.*
- **B. Satu field "Kondisi Ruang" saja** — paling cepat diisi; rincian
  Awal/Akhir per parameter hilang.
- **C. Otomatis dari alat monitor ruang** — kondisi ruang diambil dari
  thermohygrometer/monitor ruang (di master sudah ada instrumen *Thermohygrometer*,
  id 51), tanpa isian manual; perlu sumber pembacaan/log.
- **D. Tetap 4 baris** — paling lengkap, paling banyak isian.

## 5. Pertanyaan untuk petugas kalibrasi

1. Untuk **kalibrasi jenis apa** tekanan ruang wajib dicatat: semua, atau hanya
   yang melibatkan tekanan (barometer/PP)?
2. Apakah **suhu media (bak air)** perlu selalu dicatat, atau hanya untuk sensor
   yang memang memakai media?
3. Apakah cukup **Awal & Akhir**, atau pembacaan dicatat **kontinu (logger)**
   sehingga perlu deret nilai?
4. Siapa yang sebaiknya menentukan baris relevan: **sistem** (otomatis menurut
   jenis sensor) atau **petugas** (pilih sendiri)?
5. Apakah kondisi ruang perlu muncul di **setiap halaman sensor** sertifikat,
   atau cukup sekali di halaman pertama/ringkasan?
6. Bila pengisian di workbook tidak konsisten, apakah untuk sertifikat baru
   kondisi ruang wajib lengkap (dijadikan penjaga/validasi di SIMKAL)?

## 6. Catatan teknis

- Sumber nilai saat ini: saat impor sheet, SIMKAL mencari kolom berjudul
  `suhu/temperature` dan `humidity/rh`, lalu mengisi **Awal = nilai terkecil**,
  **Akhir = nilai terbesar** dari kolom itu. Nilai ini bisa ditimpa manual.
- Rumus pengganti berbasis Awal & Akhir sudah ada di `lib/room-condition.ts`
  (`calculateRoomConditionFromEndpoints`, `resolveRoomCondition`), termasuk
  definisi parameter `tekanan` (hPa) dan `suhu_air` (°C) yang belum dinyalakan.
- Bila nanti diputuskan memakai 4 parameter atau otomatis per jenis sensor,
  perubahan di form cukup satu konstanta (`DEFAULT_ROOM_CONDITION_TYPES`),
  karena seluruh mesinnya sudah tersedia.
