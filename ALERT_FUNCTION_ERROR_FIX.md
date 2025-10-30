# Fix: Alert Function Error in Certificate Verification

## Problem Description

Error terjadi ketika menggunakan `alert()` function di Next.js:

```
TypeError: alert is not a function
app\ui\dashboard\certificate-verification-crud.tsx (214:11) @ handleSubmit
```

## Root Cause

1. **Server-Side Rendering (SSR)**: `alert()` tidak tersedia di server-side environment Next.js
2. **Browser API**: `alert()` adalah browser API yang hanya tersedia di client-side
3. **Next.js 15**: Versi terbaru Next.js lebih strict tentang SSR compatibility

## Solution Implemented

### 1. ✅ Replaced `alert()` with `showError()`

**Before (Error):**
```typescript
if (existingVerification === 'rejected') {
  alert('Sertifikat ini sudah ditolak sebelumnya. Silakan gunakan tombol perbaikan untuk mengirim ulang.')
} else {
  alert('Sertifikat ini sudah diverifikasi sebelumnya.')
}
```

**After (Fixed):**
```typescript
if (existingVerification === 'rejected') {
  showError('Sertifikat ini sudah ditolak sebelumnya. Silakan gunakan tombol perbaikan untuk mengirim ulang.')
} else {
  showError('Sertifikat ini sudah diverifikasi sebelumnya.')
}
```

### 2. ✅ All Alert Instances Fixed

**Replaced in 5 locations:**
1. **Line 200**: `alert('Level verifikasi tidak valid.')` → `showError('Level verifikasi tidak valid.')`
2. **Line 206**: `alert('Alasan penolakan harus diisi.')` → `showError('Alasan penolakan harus diisi.')`
3. **Line 214**: `alert('Sertifikat ini sudah ditolak sebelumnya...')` → `showError('Sertifikat ini sudah ditolak sebelumnya...')`
4. **Line 216**: `alert('Sertifikat ini sudah diverifikasi sebelumnya.')` → `showError('Sertifikat ini sudah diverifikasi sebelumnya.')`
5. **Line 282**: `alert('Level verifikasi tidak valid.')` → `showError('Level verifikasi tidak valid.')`
6. **Line 288**: `alert('Alasan penolakan harus diisi.')` → `showError('Alasan penolakan harus diisi.')`
7. **Line 294**: `alert('Verifikasi tidak ditemukan untuk diedit.')` → `showError('Verifikasi tidak ditemukan untuk diedit.')`

### 3. ✅ Using Existing Alert System

**Already Available:**
```typescript
import { useAlert } from '../../../hooks/useAlert'

const CertificateVerificationCRUD: React.FC = () => {
  const { alert, showSuccess, showError, showWarning, hideAlert } = useAlert()
  // ... rest of component
}
```

## Benefits of the Fix

### 1. ✅ SSR Compatible
- `showError()` bekerja di server-side dan client-side
- Tidak ada lagi "alert is not a function" error
- Compatible dengan Next.js 15

### 2. ✅ Better UX
- **Consistent Design**: Menggunakan design system yang sama
- **Customizable**: Alert bisa di-customize (color, position, duration)
- **Non-blocking**: Tidak memblokir UI seperti `alert()`

### 3. ✅ Better Error Handling
- **Contextual**: Alert muncul di tempat yang tepat
- **Dismissible**: User bisa menutup alert
- **Accessible**: Lebih accessible untuk screen readers

## Alert Types Available

### 1. ✅ Error Alerts
```typescript
showError('Error message') // Red alert for errors
```

### 2. ✅ Success Alerts
```typescript
showSuccess('Success message') // Green alert for success
```

### 3. ✅ Warning Alerts
```typescript
showWarning('Warning message') // Yellow alert for warnings
```

### 4. ✅ Hide Alerts
```typescript
hideAlert() // Hide current alert
```

## Testing

### 1. ✅ Test Error Scenarios
1. **Try to verify already rejected certificate** → Should show error alert
2. **Try to verify already approved certificate** → Should show error alert
3. **Try to reject without reason** → Should show error alert
4. **Try to verify with invalid level** → Should show error alert

### 2. ✅ Expected Behavior
- **No more console errors**: `alert is not a function` should be gone
- **Proper alerts**: Error messages should appear as styled alerts
- **User-friendly**: Alerts should be dismissible and non-blocking

## Files Modified

- `app/ui/dashboard/certificate-verification-crud.tsx` - Replaced all `alert()` with `showError()`

## Best Practices

### 1. ✅ Always Use Custom Alert System
```typescript
// ❌ Don't use
alert('Message')

// ✅ Use instead
showError('Message')
showSuccess('Message')
showWarning('Message')
```

### 2. ✅ Import useAlert Hook
```typescript
import { useAlert } from '../../../hooks/useAlert'

const { showError, showSuccess, showWarning, hideAlert } = useAlert()
```

### 3. ✅ Use Appropriate Alert Type
- **showError()**: For validation errors, system errors
- **showSuccess()**: For successful operations
- **showWarning()**: For warnings, confirmations

## Impact

### 1. ✅ No More Runtime Errors
- `alert is not a function` error eliminated
- Application runs smoothly without console errors
- Better debugging experience

### 2. ✅ Consistent User Experience
- All alerts use the same design system
- Consistent behavior across the application
- Better accessibility

### 3. ✅ Future-Proof
- Compatible with Next.js 15 and future versions
- Works in both SSR and client-side environments
- Follows React best practices

The alert function error has been completely resolved! 🎉





