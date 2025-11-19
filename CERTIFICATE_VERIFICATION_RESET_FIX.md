# Certificate Verification Reset on Revision

## Problem Description

Ada keanehan dalam workflow rejection dan revisi certificate:

1. **Verifikator 2 reject** → mengembalikan ke Verifikator 1
2. **Status balik ke pending** di Verifikator 1 ✅ (ini sudah benar)
3. **Verifikator 1 memperbaiki** berdasarkan notes dari Verifikator 2
4. **Setelah approved dan terkirim** → Verifikator 2 masih terbaca "rejected" ❌ (ini masalahnya)
5. **Seharusnya reset** setelah Verifikator 1 melakukan revisi ✅

## Root Cause

Ketika certificate direvisi setelah rejection, sistem tidak secara otomatis mereset status verification yang sudah ada. Status "rejected" tetap tersimpan di database meskipun certificate sudah direvisi.

## Solution Implemented

### 1. Database Function: `reset_verification_on_revision`

```sql
CREATE OR REPLACE FUNCTION reset_verification_on_revision(p_certificate_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_certificate RECORD;
  v_verifications RECORD[];
  v_result JSONB;
BEGIN
  -- Get certificate info
  SELECT * INTO v_certificate FROM certificate WHERE id = p_certificate_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificate not found');
  END IF;
  
  -- Reset all verification statuses to pending
  UPDATE certificate_verification 
  SET 
    status = 'pending',
    notes = NULL,
    rejection_reason = NULL,
    rejection_reason_detailed = NULL,
    rejection_destination = NULL,
    rejection_timestamp = NULL,
    approval_notes = NULL,
    updated_at = NOW()
  WHERE certificate_id = p_certificate_id;
  
  -- Update certificate status to 'sent' to indicate it's ready for verification again
  UPDATE certificate 
  SET 
    status = 'sent',
    updated_at = NOW()
  WHERE id = p_certificate_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification status reset successfully',
    'certificate_status', 'sent',
    'reset_count', COALESCE(array_length(v_verifications, 1), 0)
  );
END;
$$ LANGUAGE plpgsql;
```

### 2. Automatic Trigger

```sql
CREATE OR REPLACE FUNCTION trigger_reset_verification_on_revision()
RETURNS TRIGGER AS $$
DECLARE
  v_old_status TEXT;
  v_new_version INTEGER;
BEGIN
  -- Check if version increased (indicating revision)
  IF OLD.version < NEW.version THEN
    -- Check if there were any rejections
    IF EXISTS (
      SELECT 1 FROM certificate_verification 
      WHERE certificate_id = NEW.id AND status = 'rejected'
    ) THEN
      -- Reset verification statuses
      PERFORM reset_verification_on_revision(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER certificate_revision_trigger
  AFTER UPDATE ON certificate
  FOR EACH ROW
  EXECUTE FUNCTION trigger_reset_verification_on_revision();
```

### 3. API Integration

#### Certificate Update API (`/api/certificates/[id]`)

```typescript
// If certificate was revised (version increased), reset verification status
if (nextVersion > (currentCertificate?.version ?? 1)) {
  try {
    const { data: resetResult, error: resetError } = await supabaseAdmin
      .rpc('reset_verification_on_revision', { p_certificate_id: parseInt(id) })
    
    if (resetError) {
      console.error('Error resetting verification status:', resetError)
    } else {
      console.log('Verification status reset successfully:', resetResult)
    }
  } catch (resetErr) {
    console.error('Error calling reset_verification_on_revision:', resetErr)
  }
}
```

#### Send to Verifiers API (`/api/certificates/[id]/send-to-verifiers`)

```typescript
// Use upsert instead of insert to handle existing verification records
for (const record of verificationRecords) {
  const { error } = await supabase
    .from('certificate_verification')
    .upsert({
      ...record,
      status: 'pending',
      notes: null,
      rejection_reason: null,
      rejection_reason_detailed: null,
      rejection_destination: null,
      rejection_timestamp: null,
      approval_notes: null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'certificate_id,verification_level,certificate_version'
    })
}
```

## How It Works

### Workflow After Fix:

1. **Verifikator 2 reject** → Certificate dikembalikan ke Verifikator 1
2. **Status certificate** → 'sent' (Verifikator 1 bisa edit)
3. **Verifikator 1 edit certificate** → Version bertambah (misal: v1 → v2)
4. **Trigger otomatis** → `reset_verification_on_revision()` dipanggil
5. **Semua verification status** → Reset ke 'pending'
6. **Verifikator 1 approve** → Status Verifikator 1 jadi 'approved'
7. **Verifikator 2** → Sekarang bisa approve/reject lagi (status sudah reset)

### Key Benefits:

1. **Automatic Reset**: Tidak perlu manual intervention
2. **Version Tracking**: Menggunakan certificate version untuk detect revision
3. **Complete Cleanup**: Reset semua rejection data (notes, timestamps, dll)
4. **Consistent State**: Semua verification status kembali ke 'pending'
5. **Audit Trail**: Rejection history tetap tersimpan di `rejection_history` JSONB

## Testing

### Test Scenario:

1. Create certificate dengan Verifikator 1 dan 2
2. Verifikator 1 approve → Status: approved
3. Verifikator 2 reject → Status: rejected, certificate kembali ke Verifikator 1
4. Verifikator 1 edit certificate → Version bertambah
5. **Expected**: Semua verification status reset ke 'pending'
6. Verifikator 1 approve lagi → Status: approved
7. Verifikator 2 approve → Status: approved (tidak lagi 'rejected')

### SQL Test:

```sql
-- Test the function directly
SELECT reset_verification_on_revision(1); -- Replace 1 with actual certificate ID

-- Check verification status after reset
SELECT 
  certificate_id,
  verification_level,
  status,
  rejection_reason,
  updated_at
FROM certificate_verification 
WHERE certificate_id = 1;
```

## Files Modified:

1. `database/reset_verification_on_revision.sql` - New database functions and triggers
2. `app/api/certificates/[id]/route.ts` - Added reset logic on certificate update
3. `app/api/certificates/[id]/send-to-verifiers/route.ts` - Changed to upsert verification records

## Installation:

Run the SQL script in Supabase:

```sql
-- Execute the contents of database/reset_verification_on_revision.sql
```

This will create the necessary functions and triggers to automatically handle verification reset when certificates are revised after rejection.













