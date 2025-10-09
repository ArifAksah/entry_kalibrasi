# Cara Mengatasi Template Email Supabase

## Masalah
Supabase masih mengirim email dengan template bawaan mereka:
```
Confirm your signup
Follow this link to confirm your user:
Confirm your mail
You're receiving this email because you signed up for an application powered by Supabase ⚡️
```

## Solusi

### 1. **Nonaktifkan Email Otomatis Supabase**

#### A. Di Supabase Dashboard:
1. Buka **Authentication** → **Settings**
2. Di bagian **Email Templates**:
   - **Enable email confirmations**: `OFF`
   - **Enable email change confirmations**: `OFF`
   - **Enable password reset**: `OFF`

#### B. Atau konfigurasi Custom SMTP:
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

### 2. **Implementasi Custom Email (Sudah Dilakukan)**

Kita sudah membuat sistem custom email yang lengkap:

#### ✅ API Custom Signup
- **File**: `app/api/auth/signup-mock/route.ts` (untuk testing)
- **File**: `app/api/auth/signup-no-email/route.ts` (dengan nodemailer)
- Registrasi user tanpa email otomatis Supabase
- Kirim email custom dengan template modern

#### ✅ Template Email Modern
- **Desain**: Gradient header biru-ungu
- **Logo BMKG**: Branding yang konsisten
- **Button Konfirmasi**: CTA yang menarik
- **Security Note**: Peringatan keamanan
- **Responsive**: Mobile-friendly

#### ✅ Integrasi Registrasi
- **File**: `app/register/page.tsx`
- Menggunakan API custom signup
- Flow yang smooth dari registrasi ke konfirmasi

### 3. **Testing Sistem**

Untuk test sistem custom email:

```bash
# Test registrasi dengan custom email
curl -X POST http://localhost:3000/api/auth/signup-mock \
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

### 4. **Konfigurasi Environment Variables**

Pastikan file `.env.local` berisi:

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

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. **Cara Kerja Sistem Baru**

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

### 6. **Keuntungan Sistem Custom**

- ✅ **Template Modern**: Desain yang profesional dan menarik
- ✅ **Branding Konsisten**: Logo dan warna BMKG
- ✅ **Kontrol Penuh**: Kita yang mengatur template dan konten
- ✅ **Responsive**: Tampil sempurna di mobile dan desktop
- ✅ **Security**: Link konfirmasi yang aman dengan expiry

### 7. **Troubleshooting**

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

### 8. **Production Deployment**

Untuk production:
1. **Environment Variables**: Set semua konfigurasi email
2. **Supabase Configuration**: Disable email confirmations
3. **Custom SMTP**: Konfigurasi dengan credentials yang sama
4. **Security**: Pastikan domain production sudah dikonfigurasi

---

Dengan konfigurasi ini, sistem akan menggunakan template email custom yang modern dan profesional, bukan template bawaan Supabase! 🎉

## Status Implementasi

- ✅ **API Custom Signup**: Berfungsi
- ✅ **Template Email Modern**: Siap
- ✅ **Integrasi Registrasi**: Berfungsi
- ⚠️ **Konfigurasi Supabase**: Perlu dinonaktifkan di dashboard
- ⚠️ **Nodemailer**: Perlu konfigurasi SMTP yang benar


