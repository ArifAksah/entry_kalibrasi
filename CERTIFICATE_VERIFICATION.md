# Certificate Verification System

## Overview
Sistem verifikasi certificate memungkinkan verifikator 1 dan verifikator 2 untuk memverifikasi certificate yang telah dibuat. Setiap certificate dapat memiliki dua level verifikasi yang harus diselesaikan.

## Features

### 1. Assignment System
- Certificate dibuat dengan field `verifikator_1` dan `verifikator_2`
- Personel yang dipilih sebagai verifikator akan otomatis mendapat akses untuk memverifikasi certificate tersebut
- Setiap verifikator hanya dapat memverifikasi certificate yang ditugaskan kepada mereka

### 2. Verification Levels
- **Level 1 (Verifikator 1)**: Verifikasi pertama yang harus dilakukan
- **Level 2 (Verifikator 2)**: Verifikasi kedua yang harus dilakukan
- Kedua level verifikasi harus diselesaikan untuk certificate dianggap fully verified

### 3. Verification Status
- **Pending**: Belum diverifikasi
- **Approved**: Disetujui oleh verifikator
- **Rejected**: Ditolak oleh verifikator

## Database Schema

### Table: certificate_verification
```sql
CREATE TABLE certificate_verification (
  id SERIAL PRIMARY KEY,
  certificate_id INTEGER NOT NULL REFERENCES certificate(id),
  verification_level INTEGER NOT NULL CHECK (verification_level IN (1, 2)),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notes TEXT,
  verified_by UUID NOT NULL REFERENCES personel(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(certificate_id, verification_level)
);
```

## API Endpoints

### 1. Get All Verifications
```
GET /api/certificate-verification
```

### 2. Get Pending Certificates for Current User
```
GET /api/certificate-verification/pending
```

### 3. Create Verification
```
POST /api/certificate-verification
Body: {
  certificate_id: number,
  verification_level: 1 | 2,
  status: 'approved' | 'rejected',
  notes?: string
}
```

### 4. Update Verification
```
PUT /api/certificate-verification/{id}
Body: {
  status: 'approved' | 'rejected',
  notes?: string
}
```

### 5. Delete Verification
```
DELETE /api/certificate-verification/{id}
```

## User Interface

### 1. Certificate Verification Page
- **URL**: `/certificate-verification`
- **Access**: Users assigned as verifikator
- **Features**:
  - List certificates assigned to current user
  - View verification status for both verifikator 1 and 2
  - Verify certificates (approve/reject)
  - Add notes to verification

### 2. Certificate List Enhancement
- **URL**: `/certificates`
- **Enhancement**: Added verification status column showing:
  - Verifikator 1 status
  - Verifikator 2 status
  - Color-coded badges for easy status identification

## Workflow

### 1. Certificate Creation
1. Admin creates certificate
2. Assigns verifikator_1 and verifikator_2
3. Certificate appears in both verifikators' pending list

### 2. Verification Process
1. Verifikator 1 reviews and verifies certificate
2. Verifikator 2 reviews and verifies certificate
3. Both verifications must be completed for full verification

### 3. Status Tracking
- Certificate shows overall verification status
- Individual verifikator status is tracked
- Real-time updates when verifications are submitted

## Security

### Row Level Security (RLS)
- Users can only view certificates assigned to them
- Users can only create verifications for their assigned certificates
- Users can only update/delete their own verifications

### Permission System
- Integration with existing permission system
- Verifikator access controlled by endpoint permissions
- Menu visibility based on user permissions

## Usage

### For Verifikators
1. Navigate to "Certificate Verification" in the menu
2. View list of certificates assigned to you
3. Click "Verify" on a certificate
4. Review certificate details
5. Choose "Approve" or "Reject"
6. Add optional notes
7. Submit verification

### For Administrators
1. Create certificates with verifikator assignments
2. Monitor verification status in certificate list
3. View detailed verification history

## Technical Implementation

### Frontend Components
- `CertificateVerificationCRUD`: Main verification interface
- `useCertificateVerification`: Hook for verification data management
- Enhanced certificate list with status display

### Backend APIs
- RESTful API endpoints for verification management
- Database integration with Supabase
- Authentication and authorization checks

### Database
- PostgreSQL with RLS policies
- Foreign key relationships for data integrity
- Unique constraints to prevent duplicate verifications

## Future Enhancements

1. **Email Notifications**: Notify verifikators when certificates are assigned
2. **Bulk Verification**: Allow multiple certificate verification at once
3. **Verification History**: Detailed audit trail of verification changes
4. **Approval Workflow**: Sequential verification requirements
5. **Dashboard Analytics**: Verification statistics and metrics

