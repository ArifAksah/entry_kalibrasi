# Konfigurasi Email Supabase untuk Template Custom

## Masalah
Supabase masih mengirim email konfirmasi dengan template bawaan mereka, bukan template custom yang sudah kita buat.

## Solusi

### 1. Disable Email Otomatis Supabase

Untuk menggunakan template email custom, kita perlu menonaktifkan email otomatis Supabase:

#### A. Di Supabase Dashboard:
1. Buka **Authentication** → **Settings**
2. Di bagian **Email Templates**, set:
   - **Enable email confirmations**: `OFF` (untuk development)
   - Atau gunakan **Custom SMTP** dengan konfigurasi Gmail

#### B. Atau gunakan Custom SMTP di Supabase:
1. Buka **Authentication** → **Settings** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Konfigurasi:
   ```
   Host: smtp.gmail.com
   Port: 587
   Username: noreplybmkg@gmail.com
   Password: wjof eecc kruh vsnw
   Sender name: BMKG Calibration System
   Sender email: noreplybmkg@gmail.com
   ```

### 2. Implementasi Custom Email (Sudah Dilakukan)

Kita sudah membuat sistem custom email yang lengkap:

#### ✅ API Custom Signup
- **File**: `app/api/auth/signup-custom/route.ts`
- Registrasi user tanpa email otomatis Supabase
- Kirim email custom dengan template modern
- Integrasi dengan sistem personel dan role

#### ✅ Template Email Modern
- **File**: `app/api/auth/signup-custom/route.ts` (fungsi `generateEmailHTML`)
- Desain modern dengan gradient header
- Logo BMKG dan branding konsisten
- Button konfirmasi yang menarik
- Security note dan alternative link

#### ✅ Integrasi Registrasi
- **File**: `app/register/page.tsx`
- Menggunakan API custom signup
- Feedback yang jelas untuk user
- Flow yang smooth dari registrasi ke konfirmasi

### 3. Cara Kerja Sistem Baru

1. **User Registrasi**:
   - Form registrasi → API custom signup
   - Buat user di Supabase (tanpa email otomatis)
   - Kirim email custom dengan template modern

2. **Email Custom**:
   - Template HTML modern dan minimalis
   - Branding BMKG yang konsisten
   - Link konfirmasi yang aman

3. **Konfirmasi Email**:
   - User klik link di email custom
   - Redirect ke halaman konfirmasi
   - Verifikasi token dan aktivasi akun

### 4. Keuntungan Sistem Custom

- ✅ **Template Modern**: Desain yang profesional dan menarik
- ✅ **Branding Konsisten**: Logo dan warna BMKG
- ✅ **Kontrol Penuh**: Kita yang mengatur template dan konten
- ✅ **Responsive**: Tampil sempurna di mobile dan desktop
- ✅ **Security**: Link konfirmasi yang aman dengan expiry

### 5. Testing

Untuk test sistem custom email:

```bash
# Test registrasi dengan custom email
curl -X POST http://localhost:3000/api/auth/signup-custom \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "userData": {
      "name": "Test User",
      "phone": "08123456789",
      "position": "Staff",
      "nip": "123456"
    }
  }'
```

### 6. Troubleshooting

**Masih menerima email Supabase**:
- Pastikan email otomatis Supabase sudah dinonaktifkan
- Check konfigurasi SMTP di Supabase Dashboard
- Pastikan menggunakan API custom signup

**Email custom tidak terkirim**:
- Periksa konfigurasi SMTP Gmail
- Pastikan app password benar
- Check network dan firewall

**Template tidak muncul**:
- Pastikan fungsi `generateEmailHTML` dipanggil
- Check parameter yang dikirim
- Verify HTML template syntax

### 7. Production Deployment

Untuk production:
1. **Environment Variables**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=noreplybmkg@gmail.com
   SMTP_PASS=wjof eecc kruh vsnw
   SMTP_FROM_NAME=BMKG Calibration System
   SMTP_FROM_EMAIL=noreplybmkg@gmail.com
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

2. **Supabase Configuration**:
   - Disable email confirmations di Supabase Dashboard
   - Atau konfigurasi Custom SMTP dengan credentials yang sama

3. **Security**:
   - Gunakan app password Gmail yang aman
   - Pastikan domain production sudah dikonfigurasi
   - Check SSL/TLS untuk keamanan email

---

Dengan konfigurasi ini, sistem akan menggunakan template email custom yang modern dan profesional, bukan template bawaan Supabase! 🎉


