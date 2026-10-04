# Order Kalibrasi — Status & Alur Kerja

## Status Order

| Status | Label UI | Warna | Makna |
|---|---|---|---|
| `draft` | Draf | Abu-abu | Pemesanan baru dibuat, **belum punya nomor order**. Bisa dihapus tanpa memengaruhi penomoran. |
| `booked` | Dipesan | Biru | Pemesanan sudah dikonfirmasi, **nomor order sudah dialokasikan**. Menunggu keberangkatan. |
| `postponed` | Ditunda | Kuning | Keberangkatan ditunda. **Nomor tetap**, hanya tanggal rencana berubah. |
| `in_progress` | Berjalan | Indigo | Petugas sudah mulai kegiatan di lokasi. Bisa menambah alat, membuat identifikasi, dan mengisi sertifikat. |
| `completed` | Selesai | Hijau | Seluruh identifikasi sudah diselesaikan. Order ditutup. |
| `cancelled` | Dibatalkan | Merah | Order dibatalkan permanen. **Nomor tidak dipakai ulang**, hanya tercatat dalam histori. |

## Status Item (Identifikasi Alat)

| Status | Label UI | Makna |
|---|---|---|
| `identified` | Teridentifikasi | Alat sudah dipilih, identifikasi dibuat (misal `346.001`), belum ada sertifikat. |
| `certificate_draft` | Draf Sertifikat | Draf sertifikat sudah dibuat untuk identifikasi ini. |
| `completed` | Selesai | Sertifikat sudah selesai ditandatangani. |
| `void` | Tidak Dipakai | Identifikasi tidak dipakai (alat rusak/batal). Nomor tetap tercatat tapi tidak digunakan. |

## Alur Lengkap

```text
┌─────────────────────────────────────────────────────┐
│ 1. BUAT DRAFT                                      │
│    Petugas Kalibrasi memilih:                       │
│    - Station/lokasi                                 │
│    - Tanggal rencana (mulai - selesai)              │
│    - Jenis FC/LC                                    │
│    - Petugas tim                                    │
│    → Status: draft                                  │
│    → No. Order: belum ada                           │
│    → Counter: tidak berubah                         │
├─────────────────────────────────────────────────────┤
│ 2. KONFIRMASI PEMESANAN                         │
│    Tombol "Konfirmasi Pemesanan" oleh pembuat draf.│
│    Sistem mengalokasikan nomor atomik.              │
│    → Status: dipesan                                │
│    → No. Order: 346 (permanen)                      │
│    → Counter FC 2026: naik 1                        │
├─────────────────────────────────────────────────────┤
│ 3A. MULAI KEGIATAN          3B. TUNDA              │
│     Status: in_progress         Status: postponed   │
│     Tanggal mulai aktivitas     Tanggal berubah     │
│     Bisa tambah alat            Nomor tetap 346     │
│                                 Histori tersimpan   │
│                                     │               │
│                                     ▼               │
│                                 Resume → booked     │
│                                 atau Start → in_progress
├─────────────────────────────────────────────────────┤
│ 4. TAMBAH ALAT/SISTEM AKTUAL                      │
│    Di lokasi, petugas memilih instrumen UUT.        │
│    Sistem otomatis memberi identifikasi:            │
│    → 346.001, 346.002, 346.003, ...                 │
│    Satu identifikasi = satu alat/sistem.            │
│    AWOS multisensor tetap 1 identifikasi.           │
├─────────────────────────────────────────────────────┤
│ 5. BUAT SERTIFIKAT                                 │
│    Klik "Buat Sertifikat" pada item identifikasi.   │
│    Form terbuka dengan data read-only:              │
│    - No. Order: 346                                 │
│    - No. Identifikasi: 346.001                      │
│    - Station, instrumen, kode alat                  │
│    Petugas mengisi: data ukur, standar, hasil, dll. │
│    → Item status: draf_sertifikat                   │
│    → Sertifikat status: draft                       │
├─────────────────────────────────────────────────────┤
│ 6. PROSES SERTIFIKAT                               │
│    draft → sent → verified → completed              │
│    (verifikasi 4 level + tanda tangan BSrE)         │
│    → Item status: completed                         │
├─────────────────────────────────────────────────────┤
│ 7. SELESAIKAN ORDER                                │
│    Tombol "Selesaikan" tersedia saat:               │
│    - Semua item: selesai atau tidak dipakai         │
│    - Tidak ada item yang masih teridentifikasi/draf │
│    → Status: completed                              │
│    → Order ditutup                                  │
├─────────────────────────────────────────────────────┤
│ ALTERNATIF: BATAL                                  │
│    Kapan saja sebelum completed:                    │
│    → Status: cancelled                              │
│    → Nomor tetap tercatat, tidak dipakai ulang      │
│    → Wajib isi alasan                               │
└─────────────────────────────────────────────────────┘
```

## Contoh Perjalanan Lengkap

```text
22-09-2026  Draf dibuat (Station Budiarto, 22-09 s.d. 27-09)
            → No. Order: belum ada

23-09-2026  Konfirmasi Pemesanan
            → No. Order: 346, status: dipesan

25-09-2026  Tunda ke 01-10 s.d. 05-10
            → Status: postponed, nomor tetap 346

01-10-2026  Resume + Mulai Kegiatan
            → Status: in_progress

01-10-2026  Tambah alat: AWOS Runway 30
            → Identifikasi: 346.001, status: teridentifikasi

01-10-2026  Tambah alat: Tipping Bucket
            → Identifikasi: 346.002, status: teridentifikasi

02-10-2026  Buat Sertifikat untuk 346.001
            → Sertifikat draf, item: draf_sertifikat

03-10-2026  Verifikasi + tanda tangan 346.001
            → Sertifikat selesai, item: selesai

03-10-2026  Tidak Dipakai 346.002 (Tipping Bucket rusak)
            → Item: tidak_dipakai

03-10-2026  Semua item selesai (1 selesai, 1 tidak dipakai)
            → Klik "Selesaikan" → status: selesai
```

## Aturan Transisi

| Dari | Aksi | Ke | Syarat |
|---|---|---|---|
| `draf` | Konfirmasi | `dipesan` | Hanya pembuat draf |
| `dipesan` | Mulai | `berjalan` | — |
| `dipesan` | Tunda | `ditunda` | Isi tanggal baru |
| `ditunda` | Lanjutkan | `dipesan` | — |
| `ditunda` | Mulai | `berjalan` | — |
| `berjalan` | Selesaikan | `selesai` | Semua item `selesai` atau `tidak_dipakai` |
| `*` | Batalkan | `dibatalkan` | Wajib alasan, kecuali sudah `selesai` |

## Yang Terkunci Setelah Konfirmasi

Setelah order berstatus `dipesan`, berikut **tidak bisa diubah**:

- No. Order
- Station/lokasi
- Jenis FC/LC
- Tanggal rencana (hanya bisa lewat penundaan)

Dan setelah identifikasi dibuat:

- No. Identifikasi
- Instrumen yang terkait
- Kode instrumen

Semua terkunci baik di UI, API, maupun database trigger.

## Penomoran

| Komponen | Contoh | Kapan dialokasikan |
|---|---|---|
| No. Order | `346` | Saat **Konfirmasi Pemesanan** |
| No. Identifikasi | `346.001` | Saat **Tambah Alat** |
| No. Sertifikat | `Sert.FC-AWOS/346.001/DIK/X/2026` | Saat **Buat Sertifikat** (otomatis dari item) |

- Reset tahunan otomatis (counter per tahun + FC/LC).
- Nomor yang batal/tidak dipakai tidak digunakan ulang.
- Hard reset admin hanya bisa majukan counter, tidak bisa mundur.
