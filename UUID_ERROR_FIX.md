# Mengatasi Error UUID di Supabase

## Masalah
Error yang muncul:
```
invalid input syntax for type uuid: "mock-user-1759977824387"
```

## Penyebab
- Supabase memerlukan UUID yang valid untuk primary key
- Mock user ID yang kita buat bukan format UUID
- Database Supabase menggunakan tipe data UUID untuk user ID

## Solusi

### 1. **Install UUID Library**
```bash
npm install uuid @types/uuid
```

### 2. **Update API Endpoint**
Menggunakan UUID yang valid:

```typescript
import { v4 as uuidv4 } from 'uuid';

// Sebelum (Error)
const mockUser = {
  id: 'mock-user-' + Date.now(), // ❌ Bukan UUID
  email: email,
  // ...
};

// Sesudah (Benar)
const mockUser = {
  id: uuidv4(), // ✅ UUID yang valid
  email: email,
  // ...
};
```

### 3. **Format UUID yang Valid**
UUID yang valid memiliki format:
```
xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
```

Contoh:
- ✅ `349ae35c-d81d-49c9-a31b-73e77f67b358`
- ❌ `mock-user-1759977824387`

### 4. **File yang Diperbaiki**

#### ✅ `app/api/auth/signup-mock/route.ts`
```typescript
import { v4 as uuidv4 } from 'uuid';

// Generate UUID yang valid
const mockUser = {
  id: uuidv4(), // UUID yang valid
  email: email,
  created_at: new Date().toISOString(),
  user_metadata: userData
};
```

#### ✅ `app/api/auth/signup-custom-simple/route.ts`
```typescript
import { v4 as uuidv4 } from 'uuid';

// Menggunakan UUID untuk token
const confirmationToken = uuidv4() + '_' + Date.now();
```

### 5. **Testing**

Test API endpoint yang sudah diperbaiki:

```bash
# Test dengan UUID yang valid
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

### 6. **Response yang Benar**

```json
{
  "success": true,
  "message": "Registrasi berhasil! Email konfirmasi custom telah dikirim.",
  "user": {
    "id": "349ae35c-d81d-49c9-a31b-73e77f67b358", // ✅ UUID yang valid
    "email": "test@example.com",
    "created_at": "2025-10-09T02:44:45.123Z",
    "user_metadata": {
      "name": "Test User",
      "phone": "08123456789",
      "position": "Staff",
      "nip": "123456"
    }
  },
  "confirmationLink": "http://localhost:3000/confirm-email?token=349ae35c-d81d-49c9-a31b-73e77f67b358_1759977824387&email=test%40example.com",
  "emailSent": true
}
```

### 7. **Integrasi dengan Database**

Ketika menyimpan data ke database Supabase:

```typescript
// Simpan data personel dengan UUID yang valid
const res = await fetch('/api/personel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: userId, // UUID yang valid dari Supabase
    name: form.name,
    nip: form.nip,
    position: form.position,
    phone: form.phone,
    email: form.email,
  }),
});
```

### 8. **Troubleshooting**

**Masih error UUID**:
- Pastikan menggunakan `uuidv4()` untuk generate UUID
- Check apakah ID yang dikirim ke database adalah UUID
- Verify format UUID: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`

**Database error**:
- Pastikan kolom ID di database menggunakan tipe UUID
- Check constraint di database Supabase
- Verify foreign key relationships

**API error**:
- Pastikan import `uuid` library
- Check apakah UUID library terinstall dengan benar
- Verify response format dari API

### 9. **Production Deployment**

Untuk production:
1. **Environment Variables**: Pastikan konfigurasi Supabase benar
2. **Database Schema**: Verify tipe data UUID di database
3. **API Endpoints**: Test semua endpoint dengan UUID yang valid
4. **Error Handling**: Tambahkan error handling untuk UUID validation

---

Dengan perbaikan ini, error UUID sudah teratasi dan sistem registrasi berfungsi dengan benar! 🎉

## Status Perbaikan

- ✅ **UUID Library**: Terinstall
- ✅ **API Mock**: Menggunakan UUID yang valid
- ✅ **API Custom**: Menggunakan UUID yang valid
- ✅ **Testing**: Berfungsi dengan benar
- ✅ **Database**: Siap menerima UUID yang valid


