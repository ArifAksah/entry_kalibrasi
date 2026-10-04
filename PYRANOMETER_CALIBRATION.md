# Dokumentasi Kalibrasi Pyranometer - Simkal

## Daftar Isi

1. [Ringkasan Perubahan](#1-ringkasan-perubahan)
2. [Latar Belakang](#2-latar-belakang)
3. [Perbedaan Kalibrasi Pyranometer vs Biasa](#3-perbedaan-kalibrasi-pyranometer-vs-biasa)
4. [Arsitektur Implementasi](#4-arsitektur-implementasi)
5. [Fungsi yang Ditambahkan](#5-fungsi-yang-ditambahkan)
6. [Skema Data](#6-skema-data)
7. [Alur Kerja](#7-alur-kerja)
8. [Contoh Perhitungan](#8-contoh-perhitungan)
9. [Backward Compatibility](#9-backward-compatibility)
10. [Testing](#10-testing)
11. [Daftar File yang Diubah](#11-daftar-file-yang-diubah)

---

## 1. Ringkasan Perubahan

### Versi: 1.0.0
### Tanggal: Juli 2025
### Penanggung Jawab: Tim Pengembangan Simkal

#### Perubahan Utama:
- ✅ Menambahkan dukungan kalibrasi pyranometer sesuai standar ISO 9060:2018
- ✅ Menghitung Faktor Kalibrasi (CF) dalam bentuk rasio (%)
- ✅ Menghitung sensitivitas baru untuk pyranometer analog
- ✅ Menggunakan drift berdasarkan klasifikasi ISO 9060:2018 (Class A/B/C)
- ✅ Menampilkan hasil dalam format % (bukan absolut W/m²)
- ✅ Backward compatibility 100% - tidak mempengaruhi perhitungan alat lain

---

## 2. Latar Belakang

### Masalah
Sistem Simkal sebelumnya hanya mendukung perhitungan kalibrasi dengan metode **selisih absolut**:
```
Koreksi = Standar - UUT (dalam satuan W/m², °C, hPa, dll)
```

Untuk pyranometer, standar kalibrasi BMKG menggunakan metode **Faktor Kalibrasi (CF)**:
```
CF = Standar / UUT (rasio tanpa satuan, dalam %)
```

### Referensi Standar
- **ISO 9847:1992** - Kalibrasi pyranometer menggunakan matahari sebagai sumber
- **ISO 9060:2018** - Klasifikasi pyranometer (Class A, B, C)
- **WMO** - Standar pengukuran radiasi matahari

---

## 3. Perbedaan Kalibrasi Pyranometer vs Biasa

### Tabel Perbandingan

| Aspek | Kalibrasi Biasa | Kalibrasi Pyranometer |
|-------|-----------------|----------------------|
| **Rumus** | Koreksi = Std - UUT | CF = Std / UUT |
| **Hasil** | Selisih (W/m², °C, hPa) | Rasio (%, tanpa satuan) |
| **Sensitivitas** | Tidak dihitung | S_new = S_old × CF_final |
| **Drift** | Dari sertifikat standar | Dari ISO 9060:2018 |
| **Uncertainty** | Dalam satuan absolut | Dalam persen (%) |

### Formula Faktor Kalibrasi (CF)

```
CF_i = Irradiance_std,i / Irradiance_uut,i

CF_final = Σ(CF_i) / n

dimana:
  CF_i     = Faktor kalibrasi setiap baris data
  CF_final = Faktor kalibrasi final (rata-rata)
  n        = Jumlah pasangan data valid; outlier statistik hanya dilaporkan
```

### Formula Sensitivitas Baru (Pyranometer Analog)

```
S_new = S_old × CF_final

dimana:
  S_new  = Sensitivitas baru setelah kalibrasi (µV/Wm⁻²)
  S_old  = Sensitivitas sebelum kalibrasi (µV/Wm⁻²)
  CF_final = Faktor kalibrasi final
```

### Klasifikasi ISO 9060:2018

| Class | Drift | Contoh Sensor |
|-------|-------|---------------|
| **A** | 0.8% | CMP22, CMP21, CMP11, CMP10 |
| **B** | 1.5% | CMP6 |
| **C** | 3.0% | CMP3, SPLite2, QMS102, QMS101 |

---

## 4. Arsitektur Implementasi

## Catatan Audit Workbook `pyranometer.xlsx`

> Catatan ini dibuat untuk ditindaklanjuti bersama petugas kalibrasi. Untuk
> sementara, aplikasi memakai formula Pyranometer yang konsisten secara
> statistik dan tidak menyalin referensi sel workbook yang terindikasi tidak
> konsisten.

### A. Jumlah Data dan Pembagi Repeatability

| Area | Rujukan workbook | Temuan | Dampak | Konfirmasi petugas |
|---|---|---|---|---|
| Sheet `Data glolbal`, data pembacaan | Data berada pada baris `19:168`, total 150 pasangan STD-UUT | Formula pada `Hit U!G12` memakai `=SQRT('Data glolbal'!B154)`, sehingga pembagi menjadi `SQRT(136) = 11,66190379`, bukan `SQRT(150)` | Nilai `u_repeat` Global berbeda dari penggunaan jumlah data aktual | Apakah `B154` sengaja dipakai sebagai jumlah data efektif, atau seharusnya memakai jumlah pasangan valid 150? |
| Sheet `Data glolbal`, derajat bebas | `Hit U!I12 = 'Data glolbal'!B168-1` | `B168 = 150`, sehingga `vi = 149`; jumlah data untuk pembagi dan derajat bebas tidak konsisten | Repeatability memakai `n=136`, tetapi `vi` memakai `n=150` | Tetapkan satu aturan: `n` pasangan valid atau jumlah efektif setelah pengecualian |
| Sheet `Data diffuse`, data pembacaan | Data berada pada baris `18:167`, total 150 pasangan | `Hit U!H34 = SQRT('Data glolbal'!B168)` memakai referensi sheet Global untuk pembagi Diffuse | Referensi lintas sheet menyulitkan audit dan berisiko salah jika jumlah data berbeda | Apakah Diffuse harus memakai jumlah data pada `Data diffuse` sendiri? |

### B. Derajat Kebebasan Sertifikat Standar

| Area | Rujukan workbook | Temuan | Dampak | Konfirmasi petugas |
|---|---|---|---|---|
| Global | `Hit U!I13 = 60` | Komponen `Sertifikat Standar` memakai `vi=60` | Memengaruhi kontribusi `(ci.ui)^4/vi`, `veff`, `k`, dan U95 | Apakah `60` berasal dari sertifikat standar atau hanya angka manual workbook? |
| Diffuse, budget utama | `Hit U!I35 = 150` | Komponen yang sama memakai `vi=150` | Tidak sama dengan Global | Apakah perbedaan `60` dan `150` disengaja berdasarkan sertifikat/metode, atau kesalahan template? |
| Diffuse, budget salinan | `Salinan dari Hit U!I48 = 50` | Budget Diffuse kedua memakai `vi=50` | Satu workbook memiliki tiga nilai vi untuk komponen yang sama: 60, 150, dan 50 | Tentukan nilai vi resmi untuk sertifikat standar Pyranometer |

### C. Resolusi Standar

| Area | Rujukan workbook | Temuan | Dampak | Konfirmasi petugas |
|---|---|---|---|---|
| Global | `Hit U!G14 = ((0.5*'Input Data'!C45/2)/'Data glolbal'!C168)*100%` | Denominator `Data glolbal!C168` adalah nilai pembacaan baris terakhir, bukan rata-rata STD | Nilai resolusi standar bergantung pada satu baris data tertentu | Apakah denominator dimaksudkan sebagai rata-rata STD, nilai minimum, atau pembacaan tertentu? |
| Diffuse | `Hit U!G36 = ((0.5*'Input Data'!C45)/'Data diffuse'!C168)*100%` | Denominator `Data diffuse!C168` berada pada baris ringkasan rata-rata, tetapi struktur formula berbeda dari Global | Global dan Diffuse tidak memakai basis yang sama | Tetapkan basis resolusi standar yang sama untuk kedua sensor |
| Sumber input | `Input Data!C45 = 0,01 W/m²` | Resolusi standar berasal dari Input Data, sedangkan aplikasi mengambil `resolution` dari record sertifikat standar | Sumber nilai dapat berbeda saat data master/sertifikat berubah | Pastikan sumber resmi resolusi standar: Input Data, sertifikat standar, atau master instrumen |

### D. Resolusi UUT

| Area | Rujukan workbook | Temuan | Dampak | Konfirmasi petugas |
|---|---|---|---|---|
| Global | `Hit U!G16 = ((0.5*'Input Data'!C31)/'Data glolbal'!C157*100)` | Denominator `Data glolbal!C157` adalah pembacaan STD pada baris data tertentu, bukan rata-rata UUT | Nilai resolusi UUT tidak langsung memakai rata-rata UUT | Apakah denominator tersebut sengaja dipilih sebagai titik ukur tertentu? |
| Diffuse | `Hit U!G38 = ((0.5*'Input Data'!C38)/'Data diffuse'!C170*100)` | Denominator `Data diffuse!C170` adalah nilai minimum STD, bukan mean UUT | Formula Diffuse berbeda dari Global dan dari interpretasi umum resolusi UUT | Tetapkan apakah resolusi UUT harus dibagi mean UUT, minimum UUT, atau nilai setpoint tertentu |
| Sumber resolusi | `Input Data!C31` dan `Input Data!C38` | Global dan Diffuse memakai resolusi UUT dari input terpisah | Ini dapat benar jika kedua sensor berbeda, tetapi perlu jejak sumber | Pastikan nilai resolusi di master sensor sama dengan nilai Input Data saat sertifikat dibuat |

### E. Faktor Cakupan

| Area | Rujukan workbook | Temuan | Dampak | Konfirmasi petugas |
|---|---|---|---|---|
| Global | `Hit U!N20 = IF(N19>10000000000,1.96,TINV(0.05,N19))` | Excel memakai `veff` desimal langsung pada `TINV` | `k` sekitar `1,988609667` | Ini menjadi aturan resmi Pyranometer? |
| Diffuse | `Hit U!N42 = IF(N41>10000000000,1.96,TINV(0.05,N41))` | Aturan sama, tetapi nilai `veff` berbeda karena komponen dan vi berbeda | U95 mengikuti kombinasi formula/vi yang berbeda | Konfirmasi penggunaan Student-t berbasis `veff` desimal |
| Catatan sertifikat | Sheet `Global!38:39` dan `Diffuse!38:39` | Catatan menyatakan `k = 2`, sedangkan budget memakai `k` sekitar 1,99 | Pernyataan sertifikat adalah pembulatan, bukan angka kalkulasi persis | Apakah catatan tetap `k=2` atau perlu menyebut faktor aktual? |

### F. Nilai CF pada Sertifikat

| Area | Rujukan workbook | Temuan | Dampak | Konfirmasi petugas |
|---|---|---|---|---|
| Global | `Data glolbal!F169 = AVERAGE(F19:F168)` | CF sertifikat memakai rata-rata 150 CF, termasuk nilai ekstrem | CF Global `0,9896852593` | Sesuai metode aplikasi legacy saat ini |
| Diffuse | `Data diffuse!E168 = AVERAGE(E18:E167)` | CF sertifikat juga memakai rata-rata 150 CF | CF Diffuse `0,9940407291` | Sesuai metode aplikasi legacy saat ini |
| Filter outlier | Data ekstrem ada pada beberapa baris, tetapi workbook tetap memasukkan seluruh data pada rata-rata | Workbook tidak menghapus outlier secara otomatis | Perlu dibedakan antara data invalid dan outlier statistik | Jika petugas ingin mengecualikan data, catatan/alasan harus dibuat eksplisit |

### Kebijakan Aplikasi Sementara

Sebelum ada konfirmasi petugas, aplikasi menggunakan aturan berikut untuk
Pyranometer:

1. Pasangan STD-UUT yang tidak lengkap, non-numerik, atau tidak positif tidak dipakai.
2. Pasangan valid dihitung sebagai `CF_i = STD_i / UUT_i`.
3. `CF final` adalah rata-rata seluruh pasangan valid.
4. Outlier statistik tidak otomatis dikeluarkan dari CF final; hanya ditandai sebagai informasi.
5. Repeatability menggunakan standar deviasi dan mean CF seluruh pasangan valid.
6. Drift standar mengikuti tipe standar yang terdeteksi melalui klasifikasi Pyranometer.
7. Nilai `U95`, `veff`, `k`, dan derajat bebas tetap mengikuti fungsi aplikasi yang terdokumentasi; perbedaan workbook di atas menjadi bahan konfirmasi, bukan disalin otomatis.

### Rujukan Workbook yang Perlu Dibawa Saat Follow-up

- Sheet `Data glolbal`: baris data `19:168`, ringkasan `169:171`.
- Sheet `Data diffuse`: baris data `18:167`, ringkasan `168:170`.
- Sheet `Hit U`: budget Global pada baris `12:21`, budget Diffuse pada baris `34:43`.
- Sheet `Salinan dari Hit U`: budget pembanding pada baris `12:21`, `24:33`, dan `37:46`.
- Sheet `Input Data`: resolusi dan sensitivitas pada baris `30:45`.
- Sheet `Global`: nilai sertifikat Global pada baris `23:25`, catatan faktor cakupan pada baris `38:39`.
- Sheet `Diffuse`: nilai sertifikat Diffuse pada baris `23:25`, catatan faktor cakupan pada baris `38:39`.

### Prinsip Desain

```
┌─────────────────────────────────────────────────────────────────┐
│              PRINSIP KEAMANAN                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. JANGAN UBAH FUNGSI YANG SUDAH ADA                          │
│     - calculateUncertaintyBudget() → TETAP SAMA                 │
│     - calculateCalibrationResult() → TETAP SAMA                 │
│                                                                 │
│  2. TAMBAH FUNGSI BARU (TERPISAH)                              │
│     - Fungsi pyranometer terpisah dari fungsi existing          │
│     - Tidak ada interferensi                                    │
│                                                                 │
│  3. DETEKSI OTOMATIS DENGAN SAFEGUARD                          │
│     - Hanya aktif jika sensor terdeteksi pyranometer            │
│     - Fallback ke metode lama jika deteksi gagal                │
│                                                                 │
│  4. BACKWARD COMPATIBILITY 100%                                │
│     - Alat lain tetap menggunakan metode lama                   │
│     - Output format tetap sama untuk non-pyranometer            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Diagram Alur

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTRY POINT                                  │
│            calculateCalibrationResult()                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              DETEKSI PYRANOMETER                                │
│              isPyranometer(sensor)                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│  BUKAN PYRANOMETER│     │  PYRANOMETER     │
│  (existing path)  │     │  (new path)      │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│ calculate         │     │ calculate         │
│ UncertaintyBudget │     │ Pyranometer       │
│ (existing)        │     │ Uncertainty (NEW) │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│ Hasil:            │     │ Hasil:            │
│ Koreksi (W/m²)    │     │ CF (%)            │
│ U95 (W/m²)        │     │ U95 (%)           │
└──────────────────┘     └──────────────────┘
```

---

## 5. Fungsi yang Ditambahkan

### 5.1 Konstanta

```typescript
export const PYRANOMETER_CONFIG = {
    // Keywords untuk deteksi pyranometer
    KEYWORDS: [
        'pyranometer', 'pyrheliometer', 'radiation', 'solar',
        'global', 'diffuse', 'net radiometer', 'uv-a', 'uv-b',
        'sunshine duration', 'cmp22', 'cmp21', 'cmp11', 'cmp10',
        'cmp6', 'cmp3', 'splite2', 'qms102', 'qms101',
        'ms-802', 'ms-80', 'eko'
    ],
    
    // High confidence keywords (langsung return true)
    HIGH_CONFIDENCE_KEYWORDS: [
        'pyranometer', 'pyrheliometer', 'net radiometer',
        'cmp22', 'cmp21', 'cmp11', 'cmp10',
        'cmp6', 'cmp3', 'ms-802', 'ms-80'
    ],
    
    // instrument_code untuk solar radiation
    RADIATION_CODES: ['SR'],
    
    // ISO 9060:2018 Drift Classification (%)
    ISO_DRIFT: {
        'A': 0.8,   // CMP22, CMP21, CMP11, CMP10
        'B': 1.5,   // CMP6
        'C': 3.0,   // CMP3, SPLite2, QMS102, QMS101
    },
    
    // Default range (W/m²)
    DEFAULT_RANGE: 2000,
    
    // Minimal data untuk perhitungan
    MIN_READINGS: 3,
    
    // Default outlier threshold (standar deviasi)
    DEFAULT_OUTLIER_THRESHOLD: 2,
    
    // Default coverage factor (veff ≈ 50, 95% CL)
    DEFAULT_K_FACTOR: 2.01,
};
```

### 5.2 Interface

```typescript
// Data sensor pyranometer
export interface PyranometerSensorData {
    name?: string;
    type?: string;
    instrument_code?: string;
    resolution?: number;
    range_capacity?: string;
    sensor_name_id?: number;
}

// Hasil perhitungan Faktor Kalibrasi (CF)
export interface CalibrationFactorResult {
    cf_i: number[];
    cf_final: number;
    n_total: number;
    n_filtered: number;
    outlier_indices: number[];
    std_dev: number;
}

// Komponen uncertainty pyranometer
export interface PyranometerUncertaintyComponent {
    name: string;
    value_percent: number;
    u_percent: number;
    distribution: 'Normal' | 'Rectangular';
    divisor: number;
}

// Hasil uncertainty pyranometer
export interface PyranometerUncertaintyResult {
    cf_result: CalibrationFactorResult;
    components: PyranometerUncertaintyComponent[];
    uc_percent: number;
    u95_percent: number;
    k_factor: number;
    certificate: {
        calibration_factor: number;
        correction_percent: number;
        uncertainty_percent: number;
    };
}
```

### 5.3 Fungsi Deteksi

```typescript
/**
 * Deteksi apakah sensor adalah pyranometer
 * Kombinasi: instrument_code = 'SR' + keyword matching
 * 
 * SAFEGUARD:
 * - Hanya return true jika KONFIDEN sensor adalah pyranometer
 * - Jika ragu, return false (fallback ke metode lama)
 */
export function isPyranometer(sensor: PyranometerSensorData | null | undefined): boolean
```

### 5.4 Fungsi Klasifikasi ISO

```typescript
/**
 * Mendapatkan ISO 9060:2018 Class dari tipe sensor
 * Return null jika tidak diketahui
 */
export function getISO9060Class(sensorType: string): 'A' | 'B' | 'C' | null

/**
 * Mendapatkan drift value berdasarkan ISO 9060:2018
 * Return 0 jika tidak diketahui
 */
export function getISO9060Drift(sensorType: string): number
```

### 5.5 Fungsi Perhitungan CF

```typescript
/**
 * Hitung Faktor Kalibrasi (CF) untuk pyranometer
 * CF_i = Std_i / UUT_i
 * CF_final = avg(CF_i) dari semua pasangan valid
 * 
 * SAFEGUARD:
 * - Validasi input sebelum hitung
 * - Handle division by zero
 * - Laporkan outlier statistik tanpa mengeluarkannya dari CF final secara otomatis
 * - Return empty result jika data tidak valid
 */
export function calculateCalibrationFactor(
    stdReadings: number[],
    uutReadings: number[],
    options?: {
        outlierThreshold?: number;
        minReadings?: number;
    }
): CalibrationFactorResult
```

### 5.6 Fungsi Uncertainty

```typescript
/**
 * Hitung uncertainty budget untuk pyranometer (dalam %)
 * 
 * Komponen:
 * 1. Repeat (%) - dari std dev CF
 * 2. Sertifikat Std (%) - dari sertifikat kalibrasi standar
 * 3. Resolusi Std (%) - dari range alat
 * 4. Drift Std (%) - dari ISO 9060:2018
 * 5. Resolusi UUT (%) - dari range alat
 */
export function calculatePyranometerUncertainty(params: {
    cf_result: CalibrationFactorResult;
    certU95_percent: number;
    resolutionStd: number;
    resolutionUut: number;
    range: number;
    sensorType: string;
}): PyranometerUncertaintyResult
```

### 5.7 Fungsi Wrapper

```typescript
/**
 * Hitung hasil kalibrasi pyranometer untuk sertifikat
 * 
 * SAFEGUARD:
 * - Fungsi TERPISAH, tidak mempengaruhi calculateCalibrationResult()
 * - Return null jika input tidak valid (caller bisa fallback ke metode lama)
 */
export function calculatePyranometerCertificate(params: {
    stdReadings: number[];
    uutReadings: number[];
    certU95_percent: number;
    resolutionStd: number;
    resolutionUut: number;
    range: number;
    sensorType: string;
    outlierThreshold?: number;
}): PyranometerUncertaintyResult | null
```

---

## 6. Skema Data

### 6.1 Database Schema (Existing)

Tidak ada perubahan pada database schema. Semua data yang diperlukan sudah ada:

**Tabel `sensor`:**
- `name` - Nama sensor (misal: "CMP22", "MS-802")
- `type` - Tipe sensor (misal: "Pyranometer")
- `resolution` - Resolusi sensor (W/m²)
- `range_capacity` - Kapasitas range (misal: "2000")
- `range_capacity_unit` - Satuan range (misal: "W/m²")

**Tabel `certificate_standard`:**
- `resolution` - Resolusi standar (W/m²)
- `u95_general` - Uncertainty standar (%)
- `drift` - Drift standar (%)

**Tabel `instrument_code`:**
- `code_alat` - Kode alat (misal: "SR" untuk solar radiation)

### 6.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLOW                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INPUT:                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ sensor.name = "CMP22"                                   │   │
│  │ sensor.type = "Pyranometer"                             │   │
│  │ sensor.resolution = 0.1 (W/m²)                          │   │
│  │ sensor.range_capacity = "2000" (W/m²)                   │   │
│  │                                                         │   │
│  │ certificate_standard.resolution = 0.01 (W/m²)           │   │
│  │ certificate_standard.u95_general = 2.1 (%)              │   │
│  │                                                         │   │
│  │ raw_data.standard_data = [727.26, 776.89, ...]          │   │
│  │ raw_data.uut_data = [745.60, 786.20, ...]               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  PROCESSING:                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Deteksi: isPyranometer(sensor) → true                │   │
│  │ 2. Hitung CF: calculateCalibrationFactor(std, uut)      │   │
│  │ 3. Hitung ISO Class: getISO9060Class("CMP22") → 'A'    │   │
│  │ 4. Hitung Uncertainty: calculatePyranometerUncertainty()│   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  OUTPUT:                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ calibration_factor = 0.9856                             │   │
│  │ correction_percent = 1.44%                              │   │
│  │ uncertainty_percent = ±2.33%                            │   │
│  │                                                         │   │
│  │ components:                                             │   │
│  │   Repeat: 1.26% → u = 0.154%                           │   │
│  │   Sertifikat Std: 2.10% → u = 1.050%                   │   │
│  │   Resolusi Std: 0.0005% → u = 0.0003%                  │   │
│  │   Drift Std: 0.80% → u = 0.462% (Class A)              │   │
│  │   Resolusi UUT: 0.005% → u = 0.003%                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Alur Kerja

### 7.1 Alur Kalibrasi Pyranometer

```
┌─────────────────────────────────────────────────────────────────┐
│              ALUR KALIBRASI PYRANOMETER                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. PERSIAPAN                                                   │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ - Input data sensor (nama, tipe, range, resolusi)   │     │
│     │ - Input sertifikat standar (U95, resolusi)          │     │
│     │ - Upload data kalibrasi (standar & UUT)             │     │
│     └─────────────────────────────────────────────────────┘     │
│                         │                                       │
│                         ▼                                       │
│  2. DETEKSI                                                     │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ isPyranometer(sensor) → true                        │     │
│     │ - Cek instrument_code = 'SR'                        │     │
│     │ - Cek keyword: 'pyranometer', 'CMP22', dll         │     │
│     └─────────────────────────────────────────────────────┘     │
│                         │                                       │
│                         ▼                                       │
│  3. HITUNG CF                                                   │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ calculateCalibrationFactor(std, uut)                │     │
│     │ - Hitung CF_i = Std_i / UUT_i                       │     │
│     │ - Filter outlier (2× standar deviasi)               │     │
│     │ - Hitung CF_final = avg(CF_i)                       │     │
│     └─────────────────────────────────────────────────────┘     │
│                         │                                       │
│                         ▼                                       │
│  4. HITUNG UNCERTAINTY                                         │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ calculatePyranometerUncertainty()                   │     │
│     │ - Repeat: std_dev(CF) / CF_final × 100%             │     │
│     │ - Sertifikat Std: U95 dari sertifikat               │     │
│     │ - Resolusi Std: (res_std / range) × 100%            │     │
│     │ - Drift Std: dari ISO 9060:2018 (Class A/B/C)       │     │
│     │ - Resolusi UUT: (res_uut / range) × 100%            │     │
│     │ - uc = √(Σ ui²)                                     │     │
│     │ - U95 = k × uc                                      │     │
│     └─────────────────────────────────────────────────────┘     │
│                         │                                       │
│                         ▼                                       │
│  5. OUTPUT SERTIFIKAT                                          │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Faktor Kalibrasi (CF) = 0.9856                      │     │
│     │ Koreksi = 1.44%                                     │     │
│     │ Ketidakpastian = ±2.33%                             │     │
│     │ Sensitivitas Baru = 7.11 µV/Wm⁻² (jika analog)     │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Deteksi Pyranometer

```
┌─────────────────────────────────────────────────────────────────┐
│              MEKANISME DETEKSI                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PRIORITAS 1: instrument_code (Konfiden Tinggi)                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Jika sensor.instrument_code = 'SR'                      │   │
│  │ → return true (PASTI pyranometer)                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  PRIORITAS 2: High Confidence Keywords (Konfiden Tinggi)        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Keywords:                                               │   │
│  │   'pyranometer', 'pyrheliometer', 'net radiometer'      │   │
│  │   'cmp22', 'cmp21', 'cmp11', 'cmp10'                   │   │
│  │   'cmp6', 'cmp3', 'ms-802', 'ms-80'                    │   │
│  │                                                         │   │
│  │ Jika sensor.name atau sensor.type mengandung keyword    │   │
│  │ → return true                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  PRIORITAS 3: Medium Keywords + Context (Konfiden Sedang)       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Medium Keywords:                                        │   │
│  │   'radiation', 'solar', 'global', 'diffuse'            │   │
│  │                                                         │   │
│  │ Context Keywords:                                       │   │
│  │   'w/m', 'wm', 'irradiance', 'radiometer'             │   │
│  │                                                         │   │
│  │ Jika ada MEDIUM + CONTEXT → return true                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  DEFAULT: return false (aman, fallback ke metode lama)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Contoh Perhitungan

### 8.1 Data Kalibrasi

**UUT (Alat Uji):**
- Nama: Global Pyranometer
- Merk: EKO
- Type: MS-802
- Nomor Seri: F22045R
- Daerah Ukur: 0 ~ 2000 W/m²
- Sensitivitas: 7.22 µV/Wm⁻²

**Standar (Alat Acuan):**
- Nama: Pyranometer
- Merk: Kipp&Zonen
- Type: CMP3
- Nomor Seri: 164097
- Daerah Ukur: 0 ~ 2000 W/m²
- Sensitivitas: 12.50 µV/Wm⁻²
- U (uncertainty): 2.1%

### 8.2 Data Readings (Sample)

| No | Standar (W/m²) | UUT (W/m²) | CF_i |
|----|----------------|------------|------|
| 1 | 727.26 | 745.60 | 0.9754 |
| 2 | 776.89 | 786.20 | 0.9882 |
| 3 | 800.29 | 812.00 | 0.9856 |
| ... | ... | ... | ... |
| 69 | 1214.63 | 1228.00 | 0.9891 |

### 8.3 Hasil Perhitungan

```
┌─────────────────────────────────────────────────────────────────┐
│              HASIL PERHITUNGAN                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. FAKTOR KALIBRASI (CF)                                       │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Total data: 69                                      │     │
│     │ Data setelah filter outlier: 67                     │     │
│     │ Outlier: 2 data (No 52 dan 60)                      │     │
│     │ CF_final = 0.9856                                   │     │
│     │ Std Dev = 0.0124                                    │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  2. SENSITIVITAS BARU (Analog)                                  │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ S_old = 7.22 µV/Wm⁻²                               │     │
│     │ S_new = 7.22 × 0.9856 = 7.11 µV/Wm⁻²              │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  3. BUDGET UNCERTAINTY (%)                                      │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Komponen           │ Nilai  │ ui      │ Distribusi  │     │
│     │────────────────────│────────│─────────│─────────────│     │
│     │ Repeat             │ 1.26%  │ 0.154%  │ Normal      │     │
│     │ Sertifikat Std     │ 2.10%  │ 1.050%  │ Normal      │     │
│     │ Resolusi Std       │ 0.0005%│ 0.0003% │ Rectangular │     │
│     │ Drift Std (Class C)│ 3.00%  │ 1.732%  │ Rectangular │     │
│     │ Resolusi UUT       │ 0.005% │ 0.003%  │ Rectangular │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  4. HASIL AKHIR                                                │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ uc = √(0.154² + 1.050² + 0.0003² + 1.732² + 0.003²)│    │
│     │ uc = 2.03%                                          │     │
│     │                                                     │     │
│     │ k = 2.01 (95% CL, veff ≈ 50)                       │     │
│     │ U95 = k × uc = 2.01 × 2.03% = 4.08%               │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  5. OUTPUT SERTIFIKAT                                           │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Faktor Kalibrasi (CF) = 0.9856                      │     │
│     │ Koreksi = (1 - 0.9856) × 100% = 1.44%              │     │
│     │ Ketidakpastian = ±4.08%                             │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Backward Compatibility

### 9.1 Jaminan

```
┌─────────────────────────────────────────────────────────────────┐
│              JAMINAN BACKWARD COMPATIBILITY                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ FUNGSI EXISTING TIDAK DIUBAH                                │
│    - calculateUncertaintyBudget() → SAMA                        │
│    - calculateCalibrationResult() → SAMA                        │
│    - Semua helper functions → SAMA                              │
│                                                                 │
│  ✓ FUNGSI BARU TERPISAH                                        │
│    - isPyranometer() → FUNGSI BARU                              │
│    - calculateCalibrationFactor() → FUNGSI BARU                 │
│    - calculatePyranometerUncertainty() → FUNGSI BARU            │
│    - Tidak ada interferensi dengan existing                     │
│                                                                 │
│  ✓ DETEKSI DENGAN SAFEGUARD                                    │
│    - Jika ragu → return false (fallback ke metode lama)         │
│    - User bisa override manual jika diperlukan                  │
│    - Tidak ada perubahan otomatis tanpa konfirmasi              │
│                                                                 │
│  ✓ ALAT LAIN TIDAK TERPENGARUH                                 │
│    - Barometer (PTB330) → Tetap pakai metode lama               │
│    - Thermometer (HMP155) → Tetap pakai metode lama             │
│    - Anemometer (WindSonic) → Tetap pakai metode lama           │
│    - Rain gauge → Tetap pakai metode lama                       │
│                                                                 │
│  ✓ OUTPUT FORMAT TETAP SAMA                                    │
│    - Non-pyranometer: Koreksi (W/m²), U95 (W/m²)               │
│    - Pyranometer: CF (%), U95 (%)                               │
│    - Tidak ada perubahan format untuk alat lain                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Test Cases

| Test | Sensor | Expected | Status |
|------|--------|----------|--------|
| 1 | PTB330 (Barometer) | isPyranometer = false | ✓ PASS |
| 2 | HMP155 (Thermometer) | isPyranometer = false | ✓ PASS |
| 3 | WindSonic (Anemometer) | isPyranometer = false | ✓ PASS |
| 4 | CMP3 + SR | isPyranometer = true | ✓ PASS |
| 5 | CMP22 (Pyranometer) | isPyranometer = true | ✓ PASS |
| 6 | MS-802 (Pyranometer) | isPyranometer = true | ✓ PASS |
| 7 | CMP6 (Pyranometer) | isPyranometer = true | ✓ PASS |

---

## 10. Testing

### 10.1 Unit Tests

```bash
# Run TypeScript check
npx tsc --noEmit --skipLibCheck

# Expected: No errors in modified files
# - lib/uncertainty-utils.ts
# - components/features/UncertaintyModal.tsx
# - components/features/QCDataModal.tsx
# - app/ui/dashboard/certificates-crud.tsx
```

### 10.2 Integration Tests

```bash
# Test dengan data kalibrasi aktual
node -e "
const stdReadings = [727.26, 776.89, 800.29, ...];
const uutReadings = [745.60, 786.20, 812.00, ...];

const cfResult = calculateCalibrationFactor(stdReadings, uutReadings);
console.log('CF_final:', cfResult.cf_final); // Expected: ~0.9856

const result = calculatePyranometerUncertainty({
    cf_result: cfResult,
    certU95_percent: 2.1,
    resolutionStd: 0.01,
    resolutionUut: 0.1,
    range: 2000,
    sensorType: 'CMP3'
});
console.log('U95:', result.u95_percent); // Expected: ~4.08%
"
```

### 10.3 Manual Tests

1. **Test Deteksi:**
   - Input sensor dengan nama "CMP22" → harus terdeteksi sebagai pyranometer
   - Input sensor dengan nama "PTB330" → tidak boleh terdeteksi sebagai pyranometer

2. **Test Perhitungan:**
   - Upload data kalibrasi pyranometer
   - Klik "Hitung dari Data QC"
   - Verifikasi output dalam format % (bukan W/m²)

3. **Test Backward Compatibility:**
   - Upload data kalibrasi barometer
   - Klik "Hitung dari Data QC"
   - Verifikasi output dalam format W/m² (seperti sebelumnya)

---

## 11. Daftar File yang Diubah

| File | Jenis Perubahan | Detail |
|------|-----------------|--------|
| `lib/uncertainty-utils.ts` | TAMBAH | Fungsi & interface pyranometer baru |
| `components/features/UncertaintyModal.tsx` | UPDATE | Deteksi & display pyranometer |
| `components/features/QCDataModal.tsx` | UPDATE | Deteksi & hitung pyranometer |
| `app/ui/dashboard/certificates-crud.tsx` | UPDATE | Deteksi & generate sertifikat pyranometer |

### Catatan:
- Tidak ada perubahan pada database schema
- Tidak ada perubahan pada API endpoints
- Tidak ada perubahan pada fungsi existing
- Semua penambahan bersifat additive (tidak mengubah behavior lama)

---

## Lampiran

### A. Referensi Standar

1. **ISO 9847:1992** - Solar energy — Calibration of field pyranometers by comparison to a reference pyranometer
2. **ISO 9060:2018** - Solar energy — Specification and classification of instruments for measuring hemispherical solar and direct solar radiation
3. **WMO-No. 8** - Guide to Meteorological Instruments and Methods of Observation

### B. Kontak

Untuk pertanyaan atau issue terkait implementasi ini:
- Tim Pengembangan Simkal
- Email: [development@bmkg.go.id]

### C. Changelog

| Versi | Tanggal | Perubahan |
|-------|---------|-----------|
| 1.0.0 | Juli 2025 | Implementasi awal kalibrasi pyranometer |

---

*Dokumen ini dibuat oleh Tim Pengembangan Simkal*
*Terakhir diperbarui: Juli 2025*
