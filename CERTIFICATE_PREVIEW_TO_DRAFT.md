# Certificate Preview Moved to Draft View

## Overview
Fungsi preview sertifikat telah dipindahkan dari `/certificates/[id]/view` ke `/draft-view` untuk memberikan pengalaman yang lebih terintegrasi dalam mengelola draft sertifikat.

## Changes Made

### 1. Enhanced Draft View Page (`app/draft-view/page.tsx`)

#### Added Preview Functionality
- **Preview Button**: Tombol "PREVIEW" untuk menampilkan/menyembunyikan preview sertifikat
- **CertificatePreview Component**: Komponen baru yang menampilkan sertifikat seperti di `/certificates/[id]/view`
- **Toggle State**: State `showPreview` untuk mengontrol tampilan preview

#### New CertificatePreview Component
```typescript
const CertificatePreview: React.FC<{
  certificate: Certificate
  stations: Station[]
  instruments: Instrument[]
  personel: Personel[]
}> = ({ certificate, stations, instruments, personel }) => {
  // Renders complete certificate preview
}
```

#### Features Included
- **Certificate Header**: Logo BMKG dan judul sertifikat
- **Certificate Details**: Nomor sertifikat, order, identifikasi, tanggal terbit
- **Station & Instrument Info**: Informasi stasiun dan instrumen
- **Station Address**: Alamat stasiun jika tersedia
- **Calibration Results**: Hasil kalibrasi lengkap dengan:
  - Basic info (tanggal mulai, selesai, tempat)
  - Environment conditions
  - Calibration table
  - Images
  - Notes (traceable to SI, reference document, calibration method, etc.)
- **Verification Info**: Informasi verifikator 1, verifikator 2, dan assignor

### 2. Updated Sidebar Navigation (`app/ui/dashboard/sidenav.tsx`)

#### Added Draft View Menu
```typescript
{
  title: 'Documents',
  items: [
    { name: 'Certificates', href: '/certificates', icon: Icon.doc },
    { name: 'Draft View', href: '/draft-view', icon: Icon.beaker }, // NEW
    { name: 'Letters', href: '/letters', icon: Icon.mail },
  ],
},
```

#### Updated Filter Logic
```typescript
if (item.name === 'Draft View') {
  // All roles can see draft view
  return true;
}
```

## User Experience Improvements

### Before
- **Separate Preview**: User perlu navigasi ke `/certificates/[id]/view` untuk melihat preview
- **Disconnected Workflow**: Preview terpisah dari draft management
- **Multiple Navigation**: User perlu bolak-balik antara draft dan preview

### After
- **Integrated Preview**: Preview langsung dalam halaman draft
- **Unified Workflow**: Semua operasi draft dalam satu tempat
- **Single Navigation**: Tidak perlu navigasi tambahan

## Technical Implementation

### 1. Preview Toggle
```jsx
<button
  onClick={() => setShowPreview(!showPreview)}
  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
>
  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
  {showPreview ? 'HIDE PREVIEW' : 'PREVIEW'}
</button>
```

### 2. Conditional Preview Rendering
```jsx
{showPreview && (
  <div className="mt-8 border-t border-gray-200 pt-8">
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Preview Sertifikat</h3>
      <p className="text-sm text-gray-600">Tampilan sertifikat seperti yang akan dilihat verifikator</p>
    </div>
    
    <CertificatePreview 
      certificate={certificate}
      stations={stations}
      instruments={instruments}
      personel={personel}
    />
  </div>
)}
```

### 3. Data Parsing
```typescript
// Parse results data
const results = certificate.results ? (typeof certificate.results === 'string' ? JSON.parse(certificate.results) : certificate.results) : []
```

## Benefits

### ✅ **Improved Workflow**
- **Single Page**: Semua operasi draft dalam satu halaman
- **Real-time Preview**: Preview langsung tanpa navigasi
- **Better Context**: Preview dalam konteks draft management

### ✅ **Enhanced User Experience**
- **Faster Access**: Tidak perlu navigasi ke halaman terpisah
- **Better Visibility**: Preview dan draft info dalam satu view
- **Consistent Interface**: UI yang konsisten dengan tema aplikasi

### ✅ **Technical Benefits**
- **Code Reuse**: Komponen preview dapat digunakan di tempat lain
- **Maintainability**: Preview logic terpusat dalam draft view
- **Performance**: Tidak perlu load halaman terpisah

## Navigation Structure

### Current Sidebar Structure
```
Documents
├── Certificates (role-based)
├── Draft View (all roles) ← NEW
├── Letters (admin/assignor only)
└── Certificate Verification (verifikator/assignor only)
```

### Access Patterns
- **Admin**: Can see all menu items
- **Assignor**: Can see Draft View, Letters, Certificate Verification
- **Verifikator**: Can see Draft View, Certificate Verification
- **Other Roles**: Can see Certificates, Draft View

## Usage Flow

1. **Access Draft View**: User navigasi ke "Draft View" dari sidebar
2. **View Draft List**: Melihat daftar sertifikat dalam status draft
3. **Select Certificate**: Klik pada sertifikat untuk melihat detail
4. **Toggle Preview**: Klik tombol "PREVIEW" untuk melihat preview sertifikat
5. **Manage Draft**: Assign verifikator atau kirim ke verifikator
6. **Hide Preview**: Klik "HIDE PREVIEW" untuk menyembunyikan preview

## Future Enhancements

- **Print Preview**: Tambahkan tombol print dari preview
- **Export Options**: Export preview ke PDF atau format lain
- **Side-by-side View**: Preview dan draft form dalam layout side-by-side
- **Real-time Updates**: Preview update otomatis saat draft berubah
- **Comparison Mode**: Bandingkan versi draft yang berbeda

## Backward Compatibility

- ✅ **Existing Routes**: `/certificates/[id]/view` masih berfungsi
- ✅ **API Endpoints**: Tidak ada perubahan pada API
- ✅ **Database**: Tidak ada perubahan pada struktur database
- ✅ **Existing Features**: Semua fitur draft view tetap berfungsi

## Testing Checklist
- [x] Preview button toggles correctly
- [x] CertificatePreview component renders properly
- [x] All certificate data displays correctly
- [x] Navigation to Draft View works
- [x] Sidebar menu shows for all roles
- [x] No console errors
- [x] Responsive design maintained
- [x] Existing draft functionality preserved












