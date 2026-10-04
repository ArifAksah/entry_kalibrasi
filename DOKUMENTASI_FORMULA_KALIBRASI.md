# Dokumentasi Formula Kalibrasi

**Aplikasi:** Simkal Entry Kalibrasi BMKG  
**Cakupan:** Barometer, Termometer, Hygrometer, Wind Speed, Wind Direction, Pyranometer, dan Tipping Bucket/RR  
**Tujuan:** Menjelaskan formula yang benar-benar diterapkan aplikasi, sumber data, aturan satuan, uncertainty, CMC, dan nilai yang disimpan ke sertifikat.

> Dokumen ini mendokumentasikan implementasi aplikasi. Dokumen acuan dan
> keputusan teknis laboratorium tetap harus disahkan oleh petugas kalibrasi.
> Sistem mengolah data yang sudah dinyatakan layak/clean oleh petugas dan tidak
> menggantikan keputusan teknis tersebut.

## 1. Prinsip Umum

Alur umum:

```text
Data raw/input
  -> validasi pasangan/data
  -> koreksi per baris
  -> rata-rata dan standar deviasi
  -> budget uncertainty
  -> uc, veff, k, U95
  -> MAX(U95, CMC)
  -> tabel hasil sertifikat
```

Data numerik disimpan dengan presisi penuh. Pembulatan hanya dilakukan pada
lapisan tampilan sertifikat.

Profil metode dan adapter:

| Scope | Profil legacy | Adapter |
|---|---|---|
| Raw umum AWOS/AWS | `RAW-QC-GENERAL v1` | `raw-general-v1` |
| Pyranometer | `PYR-LEGACY-BMKG v1` | `pyranometer-v1` |
| Tipping Bucket/RR | `RR-LEGACY-V1` | `tipping-bucket-v1` |

`adapter_id` adalah implementasi formula yang terdaftar di kode. JSON aturan
pada menu **Master Metode Kalibrasi** menjadi metadata/audit contract dan tidak
menjalankan formula bebas.

## 2. Data dan Validasi

Untuk raw data umum, satu pasangan terdiri dari:

```text
standard_data, uut_data, sensor_id_std, sensor_id_uut,
unit_std, unit_uut, session_id
```

Pasangan kosong, nonnumerik, atau tidak lengkap tidak dipakai dalam perhitungan.
Jumlah raw row, pasangan valid, dan baris yang diabaikan dicatat di audit
metadata.

Untuk RR, input berasal dari `setup.tipping_bucket`, bukan `raw_data` umum.
Diameter dan pembacaan hujan harus berupa angka positif.

## 3. Interpolasi Koreksi Standar

Jika titik bawah dan atas tersedia, koreksi standar dihitung dengan interpolasi
linear:

```text
t = (x - x1) / (x2 - x1)
y = y1 + t × (y2 - y1)
```

Keterangan:

```text
x  = standard_data
x1 = setpoint bawah
x2 = setpoint atas
y1 = correction_std pada x1
y2 = correction_std pada x2
```

Di luar rentang setpoint, nilai di-clamp ke titik batas. Jika hanya satu titik,
nilai titik tersebut digunakan.

Rujukan:

```text
lib/qc-utils.ts: interpolateCorrectionFromPoints()
lib/uncertainty-utils.ts: interpolateU95FromPoints()
```

## 4. Konversi Satuan

Untuk nilai absolut:

```text
convertUnit(value, unit_from, unit_to)
```

Untuk koreksi, drift, resolusi, dan uncertainty:

```text
convertDeltaUnit(value, unit_from, unit_to)
```

Konversi yang digunakan antara lain:

| Dari | Ke | Faktor utama |
|---|---|---:|
| hPa | inHg | 0,029529983071445 |
| m/s | knot | 1,9438444924406 |
| m/s | fpm | 196,850393700787 |
| W/m² | J/cm²/s | 0,0001 |
| °C | °F | faktor 9/5 dan offset 32 untuk nilai absolut |

`%RH`, `RH%`, dan `%` dinormalisasi sebagai satuan kelembapan relatif yang sama.

Rujukan: `lib/unitConversion.ts`.

## 5. Formula Raw Data Umum

Berlaku untuk Barometer, Termometer, Hygrometer, Wind Speed, dan Wind Direction.

### 5.1 Standar terkoreksi

```text
std_terkoreksi = standard_data + koreksi_std
```

### 5.2 Standar pada unit UUT

```text
std_terkoreksi_UUT = convertUnit(std_terkoreksi, unit_std, unit_uut)
```

### 5.3 Koreksi UUT

Untuk instrumen linear:

```text
koreksi_uut = std_terkoreksi_UUT - uut_data
```

Untuk Wind Direction:

```text
koreksi_uut = MOD(delta + 180, 360) - 180
```

### 5.4 Rata-rata

Untuk instrumen linear:

```text
uutAvg        = Σ uut_data / n
correctionAvg = Σ koreksi_uut / n
stdCorrAvg    = Σ std_terkoreksi / n
```

Untuk Wind Direction, rata-rata heading UUT menggunakan circular mean:

```text
sumSin = Σ sin(angle × π / 180)
sumCos = Σ cos(angle × π / 180)
headingMean = atan2(sumSin, sumCos) × 180 / π
headingMean = MOD(headingMean + 360, 360)
```

### 5.5 Standar deviasi

```text
mean = Σ x_i / n
s = √(Σ(x_i - mean)² / (n - 1))
```

Untuk raw data umum, `x_i` adalah koreksi UUT per baris. Untuk Wind Direction,
koreksi yang digunakan sudah berupa residual sudut terpendek.

Rujukan:

```text
lib/uncertainty-utils.ts: calculateStandardDeviation()
lib/wind-direction.ts: wrapWindDirectionCorrection(), circularMeanDegrees()
```

## 6. Budget Uncertainty Raw Umum

Budget standar terdiri dari lima komponen:

| Komponen | U atau a | Pembagi | vi |
|---|---|---:|---:|
| Repeat | standar deviasi koreksi | √n | n - 1 |
| Sertifikat standar | U95 sertifikat | 2 | 50 |
| Drift standar | drift / 2 | √3 digital atau √6 analog | 50 |
| Resolusi standar | resolusi / 2 | √3 atau √6 | 50 |
| Resolusi UUT | resolusi / 2 | √3 atau √6 | 50 |

Distribusi:

```text
Digital: Rectangular, pembagi √3
Analog : Triangular, pembagi √6
```

Per komponen:

```text
ui = a / pembagi
ci = 1
ci.ui = ci × ui
```

Gabungan:

```text
uc = √Σ(ci.ui)²
veff = uc⁴ / Σ((ci.ui)⁴ / vi)
k = Student-t 95% pada floor(veff)
U95 = k × uc
```

Nilai akhir:

```text
reportedU95 = MAX(U95, CMC)
```

Rujukan: `lib/uncertainty-utils.ts: calculateUncertaintyBudget()` dan
`calculateCalibrationResult()`.

## 7. Barometer

Barometer menggunakan jalur raw umum.

```text
STD dapat dalam hPa
UUT dapat dalam hPa atau inHg
std_terkoreksi dikonversi sebelum koreksi UUT
```

CMC Master:

```text
CMC-PP-DIGITAL = 0,026 hPa
```

Jika UUT memakai inHg:

```text
CMC output = 0,026 × 0,029529983071445
```

## 8. Termometer

Termometer menggunakan jalur raw umum.

Distribusi resolusi:

```text
Digital: Rectangular, √3
Analog : Triangular, √6
```

Profil CMC yang tersedia:

```text
CMC-TT-DIGITAL = 0,01 °C
CMC-TT-UDARA   = 0,3 °C
CMC-TT-ANALOG  = 0,071 °C
CMC-TT-GELAS   = 0,071 °C
```

Nilai akhir selalu mengikuti:

```text
MAX(raw U95, CMC)
```

## 9. Hygrometer

Hygrometer menggunakan jalur raw umum dengan output persen kelembapan relatif.

```text
unit %RH, RH%, dan % diperlakukan ekuivalen
```

CMC:

```text
CMC-RH-DIGITAL = 1,1 %RH
```

Tidak ada perubahan angka saat `%RH` dikonversi ke `%`; normalisasi hanya
menyamakan label satuan agar sumber Master CMC tetap terlacak.

## 10. Wind Speed

Wind Speed menggunakan jalur raw umum.

Jika standar dalam m/s dan UUT dalam knot:

```text
std_terkoreksi_knot = convertUnit(std_terkoreksi, 'm/s', 'knot')
koreksi = std_terkoreksi_knot - uut_knot
```

CMC:

```text
CMC-WS = 0,48 m/s
CMC knot = 0,48 × 1,9438444924406
```

## 11. Wind Direction

Wind Direction adalah circular data.

```text
0° = 360°
```

Koreksi menggunakan jarak sudut terpendek:

```text
koreksi = MOD(STD - UUT + 180, 360) - 180
```

Rata-rata heading menggunakan circular mean, bukan rata-rata linear:

```text
mean = atan2(Σsin(angle), Σcos(angle))
```

Contoh:

```text
[358°, 359°, 0°, 1°, 2°] -> 0°
```

CMC:

```text
CMC-WD = 1°
```

## 12. Pyranometer

Profil metode:

```text
PYR-LEGACY-BMKG v1
adapter: pyranometer-v1
```

Referensi metadata:

```text
ISO 9060:2018
ISO 9847:1992
WMO-No. 8:2018
```

Faktor kalibrasi per baris:

```text
CF_i = STD_i / UUT_i
```

CF final:

```text
CF_final = mean(CF_i dari semua pasangan valid)
```

Data invalid tidak digunakan. Outlier statistik di luar `mean ± 2 SD` hanya
dicatat sebagai informasi dan tidak dibuang otomatis.

Repeatability:

```text
repeatU = SD(CF seluruh data) / mean(CF seluruh data)
u_repeat = repeatU / √n
```

Komponen uncertainty:

```text
Repeat
Sertifikat standar
Resolusi standar
Drift standar ISO
Resolusi UUT
```

Drift ISO:

```text
Class A = 0,8%
Class B = 1,5%
Class C = 3,0%
```

Output sertifikat:

```text
Penunjukan alat = rata-rata UUT
Faktor kalibrasi = CF_final
Ketidakpastian = U95 persen
```

## 13. Tipping Bucket/RR

Profil metode:

```text
RR-LEGACY-V1
adapter: tipping-bucket-v1
```

### 13.1 Luas dan sensitivitas corong

```text
diameterAvg = Σ diameter / n
area_mm2 = π × diameterAvg² / 4
volumeSensitivity = area_mm2 × 10⁻⁶
```

### 13.2 Curah hujan standar dan koreksi

```text
standardRainfall = resolutionUut × testVolume / volumePerTip
correctionMm = standardRainfall - UUT
correctionPercent = 100 × correctionMm / UUT
```

### 13.3 Budget uncertainty

Komponen:

1. Repeatability.
2. Sertifikat gelas ukur.
3. Drift gelas ukur.
4. Sertifikat jangka sorong.
5. Pengukuran jangka sorong.
6. Drift jangka sorong.
7. Resolusi jangka sorong.
8. Meniskus.

Formula gabungan:

```text
uc = √Σ(ci.ui)²
veff = uc⁴ / Σ((ci.ui)⁴ / vi)
U95 = k × uc
reportedU95 = MAX(U95, CMC)
```

Metode legacy memakai pembagi workbook:

```text
repeatability divisor = √5
diameter divisor = √5
```

Nilai meniskus berasal dari input petugas dan tidak diubah otomatis saat
perhitungan ulang.

## 14. CMC dan Nilai Sertifikat

CMC dipilih dari `cmc_profiles` dan `cmc_values` berdasarkan identitas sensor,
metode, unit, tanggal berlaku, dan measurement point.

```text
reportedU95 = MAX(rawU95, cmcOutput)
```

Jika sumber Master CMC tidak tersedia, fallback legacy dapat digunakan sesuai
profil metode, tetapi hasil harus menyimpan metadata sumber yang dipakai.

## 15. Audit dan Snapshot

Raw umum menyimpan:

```text
method_profile_code
method_profile_version
adapter_id
raw_row_count
valid_pair_count
ignored_row_count
unit_std
unit_uut
calculation_rule
uncertainty_rule
```

Pyranometer menyimpan tambahan:

```text
standard_references
cf_rule
outlier_rule
outlier_indices
drift_class
drift_value_percent
```

RR menyimpan tambahan:

```text
method_version
formula_version
method_references
validDiameterCount
validRainReadingCount
meniscusValueUsed
standardsSummary
```

## 16. Rujukan Kode dan Workbook

| Area | Rujukan kode/dokumen |
|---|---|
| Koreksi raw umum | `components/features/QCDataModal.tsx`, `lib/uncertainty-utils.ts` |
| Budget umum | `lib/uncertainty-utils.ts: calculateUncertaintyBudget()` |
| Wind Direction | `lib/wind-direction.ts` |
| Konversi unit | `lib/unitConversion.ts` |
| CMC | `lib/cmc-config.ts`, `app/api/cmc/route.ts` |
| Pyranometer | `lib/uncertainty-utils.ts`, `PYRANOMETER_CALIBRATION.md` |
| Tipping Bucket | `lib/tipping-bucket.ts` |
| Profil metode | `lib/calibration-method-profiles.ts`, `/calibration-methods` |
| Raw AWOS/AWS | `F.M.2026.037.001 AWOS 30.xlsx` |
| Pyranometer | `pyranometer.xlsx` |
| Tipping Bucket | `FORMAT TIPPING BUCKET LAPANG.xlsx` |

## 17. Status dan Batasan

Dokumen ini menjelaskan formula implementasi aplikasi, bukan pengganti SOP atau
persetujuan laboratorium. Petugas tetap bertanggung jawab menyatakan data
clean/layak, memilih standar, dan menyetujui metode.

Perubahan formula harus dibuat sebagai adapter dan profil metode versi baru,
bukan dengan mengubah JSON aturan secara bebas.
