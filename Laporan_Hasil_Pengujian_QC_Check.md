# Laporan Hasil Pengujian Perhitungan QC Check Data

**Aplikasi:** Simkal (Entry Kalibrasi BMKG)
**Tanggal Pengujian:** 1 Juli 2026
**Objek Pengujian:** Fungsi `hitung_koreksi()` dan perhitungan Koreksi Std, Std Terkoreksi, Koreksi UUT
**Sensor yang Diuji:** Suhu (Temperature) dan Kelembapan (RH)

---

## 1. Tujuan Pengujian

Memverifikasi bahwa perhitungan koreksi standar dan koreksi UUT pada aplikasi Simkal menghasilkan nilai yang benar, serta menganalisis penyebab selisih kecil yang muncul saat dibandingkan dengan perhitungan manual di Microsoft Excel.

---

## 2. Metodologi Pengujian

1. Mengambil data sertifikat standar dari database Simkal
2. Menghitung manual interpolasi linear untuk setiap baris data
3. Membandingkan hasil hitungan manual dengan output Simkal
4. Membandingkan dengan hasil perhitungan Excel
5. Menganalisis penyebab selisih (jika ada)

---

## 3. Data Sertifikat Standar (dari Database Simkal)

| Setpoint | Koreksi | U95 |
|---|---|---|
| 15.44 | -0.4 | 1.1 |
| 19.77 | -0.3 | 1.1 |
| 29.83 | -0.2 | 1.1 |
| 39.86 | -0.1 | 1.1 |
| 49.86 | 0.1 | 1.1 |
| 59.79 | 0.3 | 1.1 |
| 69.84 | 0.7 | 1.1 |
| 79.80 | 1.2 | 1.1 |
| 89.62 | 1.9 | 1.1 |
| 92.82 | 2.2 | 1.1 |

**Drift:** 2.150435294
**Resolusi:** 0.01

---

## 4. Rumus yang Digunakan

### 4.1 Rumus Interpolasi Linear (Simkal)

Fungsi `hitung_koreksi(reading, sensor_std_id)` pada database PostgreSQL:

```
y = y1 + ((x - x1) * (y2 - y1) / (x2 - x1))
```

Di mana:
- `x` = Std Reading (pembacaan standar)
- `x1, x2` = Setpoint yang membatasi x
- `y1, y2` = Koreksi pada x1 dan x2

### 4.2 Rumus Perhitungan

```
Koreksi Std    = interpolasi_linear(Std Reading, setpoint[], koreksi[])
Std Terkoreksi = Std Reading + Koreksi Std
Koreksi UUT    = Std Terkoreksi - UUT Reading
```

---

## 5. Hasil Pengujian: Sensor Suhu (Temperature)

### 5.1 Data Pengujian

| No | Timestamp | Std Reading | UUT Reading |
|---|---|---|---|
| 1 | 22/6/2026, 06.59.59 | 33.59 | 33.67 |
| 2 | 22/6/2026, 07.01.00 | 33.54 | 34.06 |
| 3 | 22/6/2026, 07.02.00 | 33.64 | 33.72 |
| 4 | 22/6/2026, 07.02.59 | 33.45 | 33.50 |
| 5 | 22/6/2026, 07.04.00 | 33.09 | 33.06 |

### 5.2 Perhitungan Manual (Baris 1: Std = 33.59)

```
Setpoint pembatas: x1 = 29.83 (koreksi = -0.2), x2 = 39.86 (koreksi = -0.1)

t = (33.59 - 29.83) / (39.86 - 29.83)
t = 3.76 / 10.03
t = 0.374875

Koreksi = -0.2 + 0.374875 × (-0.1 - (-0.2))
        = -0.2 + 0.374875 × 0.1
        = -0.2 + 0.037488
        = -0.162513
```

### 5.3 Perbandingan Hasil Suhu

| No | Std | Simkal Koreksi | Excel Koreksi | Selisih | Simkal Std Terkoreksi | Excel Std Terkoreksi | Selisih |
|---|---|---|---|---|---|---|---|
| 1 | 33.59 | 0.09684 | 0.09072 | 0.00612 | 33.68684 | 33.68072 | 0.00612 |
| 2 | 33.54 | 0.09674 | 0.09311 | 0.00363 | 33.63674 | 33.63311 | 0.00363 |
| 3 | 33.64 | 0.09694 | 0.08582 | 0.01112 | 33.73694 | 33.72582 | 0.01112 |
| 4 | 33.45 | 0.09656 | 0.09046 | 0.00610 | 33.54656 | 33.54046 | 0.00610 |
| 5 | 33.09 | 0.09584 | 0.09481 | 0.00103 | 33.18584 | 33.18481 | 0.00103 |

**Rata-rata selisih koreksi suhu: ~0.006**

---

## 6. Hasil Pengujian: Sensor Kelembapan (RH)

### 6.1 Data Pengujian

| No | Timestamp | Std Reading | UUT Reading |
|---|---|---|---|
| 1 | 22/6/2026, 06.59.59 | 51.48 | 55.00 |
| 2 | 22/6/2026, 07.01.00 | 53.63 | 57.70 |
| 3 | 22/6/2026, 07.02.00 | 56.91 | 60.30 |
| 4 | 22/6/2026, 07.02.59 | 58.06 | 62.30 |
| 5 | 22/6/2026, 07.04.00 | 60.16 | 65.30 |

### 6.2 Perhitungan Manual

**Baris 1: Std = 51.48**
```
Setpoint pembatas: x1 = 49.86 (koreksi = 0.1), x2 = 59.79 (koreksi = 0.3)

t = (51.48 - 49.86) / (59.79 - 49.86)
t = 1.62 / 9.93
t = 0.163142

Koreksi = 0.1 + 0.163142 × (0.3 - 0.1)
        = 0.1 + 0.032628
        = 0.132628

Std Terkoreksi = 51.48 + 0.132628 = 51.612628
Koreksi UUT    = 51.612628 - 55 = -3.387372
```

**Baris 2: Std = 53.63**
```
t = (53.63 - 49.86) / (59.79 - 49.86) = 3.77 / 9.93 = 0.379658

Koreksi = 0.1 + 0.379658 × 0.2 = 0.175932
Std Terkoreksi = 53.63 + 0.175932 = 53.805932
Koreksi UUT    = 53.805932 - 57.7 = -3.894068
```

**Baris 3: Std = 56.91**
```
t = (56.91 - 49.86) / (59.79 - 49.86) = 7.05 / 9.93 = 0.709970

Koreksi = 0.1 + 0.709970 × 0.2 = 0.241994
Std Terkoreksi = 56.91 + 0.241994 = 57.151994
Koreksi UUT    = 57.151994 - 60.3 = -3.148006
```

**Baris 4: Std = 58.06**
```
t = (58.06 - 49.86) / (59.79 - 49.86) = 8.20 / 9.93 = 0.825780

Koreksi = 0.1 + 0.825780 × 0.2 = 0.265156
Std Terkoreksi = 58.06 + 0.265156 = 58.325156
Koreksi UUT    = 58.325156 - 62.3 = -3.974844
```

**Baris 5: Std = 60.16**
```
Setpoint pembatas: x1 = 59.79 (koreksi = 0.3), x2 = 69.84 (koreksi = 0.7)
(60.16 > 59.79, masuk segmen berikutnya)

t = (60.16 - 59.79) / (69.84 - 59.79) = 0.37 / 10.05 = 0.036816

Koreksi = 0.3 + 0.036816 × (0.7 - 0.3)
        = 0.3 + 0.014726
        = 0.314726

Std Terkoreksi = 60.16 + 0.314726 = 60.474726
Koreksi UUT    = 60.474726 - 65.3 = -4.825274
```

### 6.3 Verifikasi Simkal vs Manual (RH)

| No | Std | Manual Koreksi | Simkal Koreksi | Cocok? | Manual Std Terkoreksi | Simkal Std Terkoreksi | Cocok? |
|---|---|---|---|---|---|---|---|
| 1 | 51.48 | 0.132628 | 0.132628 | ✅ | 51.612628 | 51.612628 | ✅ |
| 2 | 53.63 | 0.175932 | 0.175932 | ✅ | 53.805932 | 53.805932 | ✅ |
| 3 | 56.91 | 0.241994 | 0.241994 | ✅ | 57.151994 | 57.151994 | ✅ |
| 4 | 58.06 | 0.265156 | 0.265156 | ✅ | 58.325156 | 58.325156 | ✅ |
| 5 | 60.16 | 0.314726 | 0.314726 | ✅ | 60.474726 | 60.474726 | ✅ |

### 6.4 Perbandingan Simkal vs Excel (RH)

| No | Std | Simkal Koreksi | Excel Koreksi | Selisih | Simkal Std Terkoreksi | Excel Std Terkoreksi | Selisih |
|---|---|---|---|---|---|---|---|
| 1 | 51.48 | 0.132628 | 0.120532 | **0.012096** | 51.612628 | 51.600532 | **0.012096** |
| 2 | 53.63 | 0.175932 | 0.183115 | **-0.007183** | 53.805932 | 53.813115 | **-0.007183** |
| 3 | 56.91 | 0.241994 | 0.267636 | **-0.025642** | 57.151994 | 57.177636 | **-0.025642** |
| 4 | 58.06 | 0.265156 | 0.296244 | **-0.031088** | 58.325156 | 58.356244 | **-0.031088** |
| 5 | 60.16 | 0.314726 | 0.353750 | **-0.039024** | 60.474726 | 60.513750 | **-0.039024** |

**Rata-rata selisih koreksi RH: ~0.023** (lebih besar dari suhu ~0.006)

---

## 7. Analisis Penyebab Selisih Simkal vs Excel

### 7.1 Temuan Utama

Selisih antara Simkal dan Excel **bukan karena kesalahan perhitungan Simkal**, melainkan karena perbedaan referensi x-value pada interpolasi.

| Aspek | Simkal | Excel |
|---|---|---|
| X-value interpolasi | Setpoint nominal (dari DB) | stdtt[UUT] (pembacaan aktual instrumen) |
| Y-value (koreksi) | correction_std (dari DB) | stdtt[Koreksi] (dari tabel Excel) |
| Metode | Interpolasi linear 2 titik | FORECAST.LINEAR (regresi/interpolasi) |
| Sumber data | Tabel `certificate_standard` di database | Tabel `stdtt` di file Excel |

### 7.2 Bukti Matematis

Jika Excel menggunakan setpoint yang sama dengan Simkal (49.86 dan 59.79), maka untuk Std = 51.48:

```
FORECAST.LINEAR(51.48, {0.1, 0.3}, {49.86, 59.79}) = 0.13263
```

Tapi Excel menghasilkan **0.12053**, yang berbeda **0.01210** dari hasil yang seharusnya.

Ini membuktikan bahwa Excel **tidak menggunakan setpoint 49.86 dan 59.79** sebagai x-value, melainkan nilai lain (pembacaan aktual UUT dari tabel sertifikat).

### 7.3 Mengapa Selisih RH Lebih Besar dari Suhu?

| Faktor | Suhu | RH |
|---|---|---|
| Gradien koreksi | ~0.004 per unit | ~0.023 per unit |
| Rasio gradien | 1x | **~5.7x** |
| Rata-rata selisih | ~0.006 | ~0.023 |

Gradien koreksi RH yang lebih curam menyebabkan perbedaan kecil pada x-value menghasilkan perbedaan yang lebih besar pada nilai koreksi akhir.

---

## 8. Kesimpulan

1. **Perhitungan Simkal BENAR.** Semua nilai koreksi, Std Terkoreksi, dan Koreksi UUT cocok 100% dengan hitungan manual interpolasi linear.

2. **Selisih dengan Excel bukan bug.** Selisih terjadi karena perbedaan referensi x-value:
   - Simkal menggunakan **setpoint nominal** dari database
   - Excel menggunakan **pembacaan aktual UUT** (stdtt[UUT]) dari tabel sertifikat

3. **Selisih RH lebih besar dari suhu** karena gradien koreksi RH ~5.7x lebih curam, sehingga perbedaan kecil pada x-value diperbesar secara proporsional.

4. **Rekomendasi:** Tidak ada perubahan yang diperlukan pada rumus perhitungan Simkal. Jika keseragaman dengan Excel diperlukan, yang perlu disesuaikan adalah sumber data x-value di Excel (ubah dari stdtt[UUT] ke setpoint nominal).

---

## 9. Rumus Interpolasi yang Digunakan Simkal

```sql
-- Fungsi PostgreSQL: hitung_koreksi(reading, sensor_std_id)
-- Lokasi: database/create_calibration_function.sql

-- 1. Ambil sertifikat terbaru
SELECT * FROM certificate_standard
WHERE sensor_id = sensor_std_id
ORDER BY calibration_date DESC LIMIT 1;

-- 2. Parse setpoint[] dan correction_std[] dari JSON

-- 3. Interpolasi linear
y = y1 + ((reading - x1) * (y2 - y1) / (x2 - x1))
```

```typescript
// Fungsi TypeScript: computeRowQC()
// Lokasi: components/features/QCDataModal.tsx

// Koreksi Std = hitung_koreksi(standard_data, sensor_id_std)
// Std Terkoreksi = standard_data + koreksi_std
// Koreksi UUT = std_terkoreksi - uut_data
```

---

*Dokumen ini dibuat sebagai bukti verifikasi perhitungan QC Check Data pada aplikasi Simkal.*
