# Certificate Logs Table Documentation

## Overview
Tabel `certificate_logs` digunakan untuk menyimpan log semua aktivitas dan perubahan status pada certificate, termasuk:
- Pembuatan konsep (draft)
- Pengiriman ke verifikator
- Persetujuan/penolakan dari verifikator 1
- Persetujuan/penolakan dari verifikator 2
- Pengesahan dari assignor/authorized_by
- Update dan delete certificate

## Schema

### Tabel: certificate_logs

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | ID unik log |
| certificate_id | INTEGER | ID certificate (FK ke certificate) |
| action | VARCHAR(50) | Jenis aksi yang dilakukan |
| performed_by | UUID | User ID yang melakukan aksi (FK ke auth.users) |
| performed_by_name | TEXT | Nama user (denormalized untuk performa) |
| notes | TEXT | Catatan umum dari action |
| rejection_reason | TEXT | Alasan penolakan (jika action = rejected) |
| approval_notes | TEXT | Catatan persetujuan |
| verification_level | INTEGER | Level verifikasi (1=v1, 2=v2, 3=assignor) |
| previous_status | VARCHAR(50) | Status certificate sebelum action |
| new_status | VARCHAR(50) | Status certificate setelah action |
| metadata | JSONB | Data tambahan (opsional) |
| created_at | TIMESTAMP | Waktu log dibuat |

## Action Types

### Nilai yang valid untuk kolom `action`:
- `created` - Certificate dibuat (draft)
- `sent` - Certificate dikirim ke verifikator
- `approved_v1` - Disetujui oleh verifikator 1
- `approved_v2` - Disetujui oleh verifikator 2
- `approved_assignor` - Disetujui oleh assignor/authorized_by
- `rejected_v1` - Ditolak oleh verifikator 1
- `rejected_v2` - Ditolak oleh verifikator 2
- `rejected_assignor` - Ditolak oleh assignor/authorized_by
- `updated` - Certificate diupdate
- `deleted` - Certificate dihapus

## Verification Levels

### Nilai untuk kolom `verification_level`:
- `1` - Verifikator 1
- `2` - Verifikator 2
- `3` - Assignor/Authorized By

## Contoh Penggunaan

### 1. Log ketika certificate dibuat (draft)
```sql
INSERT INTO certificate_logs (
  certificate_id,
  action,
  performed_by,
  notes,
  previous_status,
  new_status
) VALUES (
  123,
  'created',
  'user-uuid-here',
  'Certificate dibuat sebagai draft',
  NULL,
  'draft'
);
```

### 2. Log ketika certificate dikirim ke verifikator
```sql
INSERT INTO certificate_logs (
  certificate_id,
  action,
  performed_by,
  notes,
  previous_status,
  new_status
) VALUES (
  123,
  'sent',
  'user-uuid-here',
  'Certificate dikirim ke verifikator untuk verifikasi',
  'draft',
  'pending_verification'
);
```

### 3. Log approval dari verifikator 1
```sql
INSERT INTO certificate_logs (
  certificate_id,
  action,
  performed_by,
  approval_notes,
  verification_level,
  previous_status,
  new_status
) VALUES (
  123,
  'approved_v1',
  'verifikator-1-uuid',
  'Semua data sudah sesuai dengan standar',
  1,
  'pending_verification',
  'pending_verification_v2'
);
```

### 4. Log approval dari verifikator 2
```sql
INSERT INTO certificate_logs (
  certificate_id,
  action,
  performed_by,
  approval_notes,
  verification_level,
  previous_status,
  new_status
) VALUES (
  123,
  'approved_v2',
  'verifikator-2-uuid',
  'Telah diverifikasi dan disetujui',
  2,
  'pending_verification_v2',
  'pending_authorization'
);
```

### 5. Log pengesahan dari assignor
```sql
INSERT INTO certificate_logs (
  certificate_id,
  action,
  performed_by,
  approval_notes,
  verification_level,
  previous_status,
  new_status
) VALUES (
  123,
  'approved_assignor',
  'assignor-uuid',
  'Certificate telah disahkan dan siap diterbitkan',
  3,
  'pending_authorization',
  'approved'
);
```

### 6. Log rejection dari verifikator 1
```sql
INSERT INTO certificate_logs (
  certificate_id,
  action,
  performed_by,
  rejection_reason,
  verification_level,
  previous_status,
  new_status
) VALUES (
  123,
  'rejected_v1',
  'verifikator-1-uuid',
  'Data kalibrasi tidak lengkap, perlu dilengkapi',
  1,
  'pending_verification',
  'rejected'
);
```

## Query Examples

### 1. Get semua log untuk certificate tertentu
```sql
SELECT 
  cl.*,
  p.name as performer_name,
  p.email as performer_email
FROM certificate_logs cl
LEFT JOIN personel p ON p.id = cl.performed_by
WHERE cl.certificate_id = 123
ORDER BY cl.created_at DESC;
```

### 2. Get log approval dari semua verifikator
```sql
SELECT 
  cl.*,
  p.name as performer_name
FROM certificate_logs cl
LEFT JOIN personel p ON p.id = cl.performed_by
WHERE cl.certificate_id = 123
  AND cl.action IN ('approved_v1', 'approved_v2', 'approved_assignor')
ORDER BY cl.verification_level, cl.created_at;
```

### 3. Get log rejection
```sql
SELECT 
  cl.*,
  p.name as performer_name
FROM certificate_logs cl
LEFT JOIN personel p ON p.id = cl.performed_by
WHERE cl.certificate_id = 123
  AND cl.action LIKE 'rejected%'
ORDER BY cl.created_at DESC;
```

### 4. Get timeline lengkap certificate
```sql
SELECT 
  cl.action,
  cl.performed_by_name,
  cl.notes,
  cl.approval_notes,
  cl.rejection_reason,
  cl.created_at,
  CASE cl.verification_level
    WHEN 1 THEN 'Verifikator 1'
    WHEN 2 THEN 'Verifikator 2'
    WHEN 3 THEN 'Assignor'
    ELSE NULL
  END as verification_level_name
FROM certificate_logs cl
WHERE cl.certificate_id = 123
ORDER BY cl.created_at ASC;
```

## Integration dengan Application

### Trigger untuk auto-log (opsional)
Bisa dibuat trigger di tabel certificate untuk otomatis membuat log ketika ada perubahan status.

### API Endpoint
Disarankan membuat API endpoint `/api/certificates/[id]/logs` untuk mengakses log certificate.

## Security

Tabel ini menggunakan Row Level Security (RLS) dengan policies:
- **Admin**: Akses penuh
- **Assignor**: Akses penuh
- **Calibrator**: Akses penuh
- **Verifikator**: Read only, bisa insert log untuk certificate yang ditugaskan
- **User Station**: Read only untuk certificate yang terkait dengan station mereka

