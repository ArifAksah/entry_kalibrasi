# Setup Email Konfirmasi BMKG Calibration System

## Konfigurasi Email

Sistem email konfirmasi telah diintegrasikan dengan template modern dan minimalis menggunakan Gmail SMTP.

### 1. Konfigurasi Environment Variables

Buat file `.env.local` di root project dengan konfigurasi berikut:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreplybmkg@gmail.com
SMTP_PASS=wjof eecc kruh vsnw
SMTP_FROM_NAME=BMKG Calibration System
SMTP_FROM_EMAIL=noreplybmkg@gmail.com

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Fitur yang Telah Diimplementasikan

#### ✅ Template Email Modern
- **File**: `app/api/send-confirmation-email/route.ts` (fungsi `generateEmailHTML`)
- Template email dengan desain modern dan minimalis
- Responsive design untuk mobile dan desktop
- Gradient header dengan logo BMKG
- Button konfirmasi yang menarik
- Security note untuk keamanan
- **Fixed**: Menggunakan HTML template langsung tanpa React untuk kompatibilitas API route

#### ✅ API Endpoint Email
- **File**: `app/api/send-confirmation-email/route.ts`
- Menggunakan Nodemailer untuk mengirim email
- Konfigurasi SMTP Gmail
- Generate HTML template langsung (tanpa React)
- Error handling yang komprehensif
- **Fixed**: Menghilangkan dependency `react-dom/server` untuk kompatibilitas Next.js

#### ✅ Halaman Konfirmasi Email
- **File**: `app/confirm-email/page.tsx`
- UI yang user-friendly untuk konfirmasi email
- Status loading, success, error, dan expired
- Auto redirect ke login setelah berhasil
- Error handling untuk berbagai skenario

#### ✅ Integrasi dengan Registrasi
- **File**: `app/register/page.tsx`
- Otomatis mengirim email konfirmasi setelah registrasi
- Feedback yang jelas untuk user
- Fallback jika email gagal dikirim

### 3. Cara Kerja Sistem

1. **Registrasi User**:
   - User mendaftar melalui halaman registrasi
   - Sistem membuat akun di Supabase
   - Otomatis mengirim email konfirmasi

2. **Email Konfirmasi**:
   - User menerima email dengan template modern
   - Email berisi link konfirmasi yang aman
   - Link mengarah ke halaman konfirmasi

3. **Konfirmasi Akun**:
   - User klik link di email
   - Sistem verifikasi token
   - Akun diaktifkan dan redirect ke login

### 4. Template Email Features

- **Header Gradient**: Desain modern dengan gradient biru-ungu
- **Logo BMKG**: Branding yang konsisten
- **Responsive**: Tampil baik di semua device
- **Security Note**: Peringatan keamanan untuk user
- **Alternative Link**: Fallback jika button tidak berfungsi
- **Professional Footer**: Informasi kontak dan disclaimer

### 5. Testing

Untuk test konfigurasi email:

```bash
# Test SMTP connection
curl -X GET http://localhost:3000/api/send-confirmation-email
```

### 6. Dependencies yang Diperlukan

```json
{
  "nodemailer": "^6.9.0",
  "@types/nodemailer": "^6.4.0"
}
```

**Note**: Tidak lagi memerlukan `react-dom` karena menggunakan HTML template langsung.

### 7. Keamanan

- App password Gmail untuk autentikasi
- Token konfirmasi yang aman
- Link kedaluwarsa dalam 24 jam
- Validasi input yang ketat
- Error handling yang tidak expose informasi sensitif

### 8. Customization

Template email dapat dikustomisasi di fungsi `generateEmailHTML` di `app/api/send-confirmation-email/route.ts`:
- Warna dan styling
- Logo dan branding
- Konten dan pesan
- Layout dan struktur

### 9. Troubleshooting

**Email tidak terkirim**:
- Periksa konfigurasi SMTP
- Pastikan app password Gmail benar
- Check firewall dan network

**Template tidak render**:
- Pastikan fungsi `generateEmailHTML` dipanggil dengan benar
- Check parameter yang dikirim ke fungsi

**Konfirmasi gagal**:
- Periksa token dan email parameter
- Check Supabase configuration
- Verify URL redirect

### 10. Production Deployment

Untuk production, pastikan:
- Environment variables diatur dengan benar
- SMTP credentials aman
- URL aplikasi sesuai domain production
- SSL/TLS configuration untuk keamanan

---

Sistem email konfirmasi siap digunakan dengan template modern dan minimalis yang profesional untuk BMKG Calibration System.
