# Instruments CRUD Update - Memiliki Lebih Satu Sensor Feature

## Overview
Implementasi fitur baru untuk CRUD instrumen dengan field kondisional `memiliki_lebih_satu` yang mengontrol tampilan form sensor.

## Changes Made

### 1. Database Schema Update
- **File**: `database/add_memiliki_lebih_satu_field.sql`
- **Action**: Menambahkan field `memiliki_lebih_satu` (boolean) ke tabel `instrument`
- **Default**: `FALSE`
- **Purpose**: Mengontrol apakah field sensor ditampilkan atau tidak

### 2. TypeScript Interface Update
- **File**: `lib/supabase.ts`
- **Action**: Menambahkan field `memiliki_lebih_satu?: boolean` ke interface `Instrument`
- **Impact**: Memperbarui type definitions untuk konsistensi

### 3. API Endpoints Update
- **Files**: 
  - `app/api/instruments/route.ts` (POST & PUT)
  - `app/api/instruments/[id]/route.ts` (PUT)
- **Action**: Menambahkan handling untuk field `memiliki_lebih_satu` dalam request body
- **Validation**: Field opsional dengan default value `false`

### 4. Frontend CRUD Update
- **File**: `app/ui/dashboard/instruments-crud.tsx`
- **Changes**:
  - Menambahkan kolom "Multi Sensor" di tabel dengan badge status (Yes/No)
  - Menambahkan checkbox "Memiliki Lebih Satu Sensor" di form modal
  - Implementasi form sensor kondisional yang muncul hanya ketika checkbox dicentang
  - State management untuk sensor form data
  - Auto-reset sensor form ketika checkbox tidak dicentang

## Features

### Conditional Sensor Fields
Ketika user mencentang "Memiliki Lebih Satu Sensor", form akan menampilkan section tambahan dengan field:

- **Basic Sensor Info**:
  - Nama Sensor
  - Merk Sensor  
  - Tipe Sensor
  - Serial Number Sensor

- **Technical Specifications**:
  - Range Capacity & Unit
  - Graduating & Unit
  - Funnel Diameter & Unit
  - Volume Per Tip & Unit
  - Funnel Area & Unit
  - Is Standard (checkbox)

### UI/UX Improvements
- **Visual Indicators**: Badge status di tabel untuk menunjukkan apakah instrumen memiliki multi sensor
- **Progressive Disclosure**: Form sensor hanya muncul ketika diperlukan
- **Auto-reset**: Data sensor otomatis direset ketika checkbox tidak dicentang
- **Responsive Design**: Form sensor menggunakan grid layout yang responsif

## Usage

### For Users
1. Buka halaman Instruments
2. Klik "Add New" atau "Edit" pada instrumen
3. Isi informasi dasar instrumen
4. Centang "Memiliki Lebih Satu Sensor" jika diperlukan
5. Jika dicentang, form sensor akan muncul untuk diisi
6. Simpan perubahan

### For Developers
- Field `memiliki_lebih_satu` tersedia di semua API endpoints
- Sensor form data saat ini hanya untuk UI display (belum tersimpan ke database)
- Struktur siap untuk integrasi dengan tabel sensor jika diperlukan

## Database Migration
Jalankan script SQL berikut untuk menambahkan field ke database:

```sql
-- File: database/add_memiliki_lebih_satu_field.sql
ALTER TABLE instrument 
ADD COLUMN memiliki_lebih_satu BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN instrument.memiliki_lebih_satu IS 'Controls whether sensor fields are active/shown. When true, sensor fields become visible.';

UPDATE instrument 
SET memiliki_lebih_satu = FALSE 
WHERE memiliki_lebih_satu IS NULL;

ALTER TABLE instrument 
ALTER COLUMN memiliki_lebih_satu SET NOT NULL;
```

## Future Enhancements
- Integrasi dengan tabel sensor untuk menyimpan data sensor
- Validasi form sensor ketika memiliki_lebih_satu = true
- Bulk operations untuk mengelola multiple sensors per instrument
- Export/Import functionality dengan sensor data





