-- =====================================================================
-- Fix create_certificate_with_auto_number function
-- Update validation to use instrument_code table instead of 
-- instrument_names.code_alat column
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_certificate_with_auto_number(p_data JSONB)
RETURNS SETOF public.certificate
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_year      INT         := EXTRACT(YEAR  FROM NOW())::INT;
  cur_month     INT         := EXTRACT(MONTH FROM NOW())::INT;
  year_start    TIMESTAMPTZ := make_timestamptz(cur_year,     1, 1, 0, 0, 0);
  year_end      TIMESTAMPTZ := make_timestamptz(cur_year + 1, 1, 1, 0, 0, 0);
  v_cert_type   TEXT        := COALESCE(NULLIF(p_data->>'certificate_type',''), 'sert');
  v_place       TEXT        := UPPER(COALESCE(NULLIF(p_data->>'calibration_place',''), 'FC'));
  v_code        TEXT        := NULLIF(p_data->>'instrument_code','');
  v_no_ident    TEXT        := NULLIF(p_data->>'no_identification','');
  v_next        INT;
  v_padded      TEXT;
  v_no_cert     TEXT;
  v_lock_key    BIGINT;
BEGIN
  -- Validasi input wajib
  IF v_place NOT IN ('FC', 'LC') THEN
    RAISE EXCEPTION 'calibration_place harus FC atau LC, got: %', v_place;
  END IF;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'instrument_code wajib diisi';
  END IF;

  -- FIXED: Validasi kode alat menggunakan tabel instrument_code
  -- (bukan instrument_names.code_alat yang sudah deprecated)
  IF NOT EXISTS (
    SELECT 1 FROM instrument_code
     WHERE code_alat IS NOT NULL AND UPPER(code_alat) = UPPER(v_code)
     LIMIT 1
  ) THEN
    RAISE EXCEPTION 'instrument_code tidak terdaftar di master kode alat: %', v_code;
  END IF;

  -- Untuk FC no_identification wajib (dipakai di format). Untuk LC opsional.
  IF v_place = 'FC' AND v_no_ident IS NULL THEN
    RAISE EXCEPTION 'no_identification wajib untuk calibration_place=FC';
  END IF;

  -- Advisory lock scoped per (year, place). FC & LC tidak saling blocking.
  v_lock_key := (cur_year::BIGINT << 32) | (CASE WHEN v_place = 'FC' THEN 1 ELSE 2 END);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Hitung no_order berikutnya dalam tahun ini untuk place ini.
  SELECT COALESCE(MAX(no_order::INT), 0) + 1
    INTO v_next
    FROM certificate
   WHERE created_at >= year_start
     AND created_at <  year_end
     AND calibration_place = v_place;

  v_padded := LPAD(v_next::TEXT, 3, '0');

  -- Format nomor sesuai IKK BMKG:
  -- FC: Sert/FC/AWS/123/001/DIK/IV/2026
  -- LC: Sert/LC/AWS/500/DIK/II/2025
  IF v_place = 'FC' THEN
    v_no_cert := v_cert_type || '/' || v_place || '/' || v_code || '/' || v_no_ident || '/' || v_padded || '/DIK/' || TO_CHAR(NOW(), 'FMRM') || '/' || cur_year::TEXT;
  ELSE
    v_no_cert := v_cert_type || '/' || v_place || '/' || v_code || '/' || v_padded || '/DIK/' || TO_CHAR(NOW(), 'FMRM') || '/' || cur_year::TEXT;
  END IF;

  -- INSERT row baru dengan nomor definitif.
  RETURN QUERY
  INSERT INTO certificate (
    no_certificate,
    no_order,
    certificate_type,
    calibration_place,
    instrument_code,
    no_identification,
    issue_date,
    station,
    instrument,
    authorized_by,
    verifikator_1,
    verifikator_2,
    verifikator_3,
    assignor,
    station_address,
    results,
    sent_by,
    created_by
  )
  VALUES (
    v_no_cert,
    v_padded,
    v_cert_type,
    v_place,
    v_code,
    v_no_ident,
    CASE
      WHEN NULLIF(p_data->>'issue_date', '') IS NULL THEN NULL
      ELSE (p_data->>'issue_date')::DATE
    END,
    NULLIF((p_data->>'station')::INT, 0),
    NULLIF((p_data->>'instrument')::INT, 0),
    NULLIF(p_data->>'authorized_by', '')::UUID,
    NULLIF(p_data->>'verifikator_1', '')::UUID,
    NULLIF(p_data->>'verifikator_2', '')::UUID,
    NULLIF(p_data->>'verifikator_3', '')::UUID,
    NULLIF(p_data->>'assignor', '')::UUID,
    NULLIF(p_data->>'station_address', ''),
    p_data->'results',
    NULLIF(p_data->>'sent_by', '')::UUID,
    NULLIF(p_data->>'created_by', '')::UUID
  )
  RETURNING *;
END;
$$;

-- Grant permissions
REVOKE ALL    ON FUNCTION public.create_certificate_with_auto_number(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_certificate_with_auto_number(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_certificate_with_auto_number(JSONB) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.create_certificate_with_auto_number(JSONB) IS 
'Creates certificate with auto-generated number. Uses instrument_code table for validation (updated from deprecated instrument_names.code_alat).';

-- Made with Bob
