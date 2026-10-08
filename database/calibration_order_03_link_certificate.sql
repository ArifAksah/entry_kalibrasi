-- ============================================================================
-- Calibration Order — 03 Link Certificate
-- create_certificate_from_order(p_data jsonb)
--   Membuat certificate dari order item secara ATOMIK:
--   - memvalidasi order aktif, station, instrument, item belum ter-link
--   - memakai no_order & no_identification dari item (bukan generate baru)
--   - meng-link certificate.calibration_order_item_id
--   - status item -> certificate_draft
-- Idempotent (CREATE OR REPLACE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_certificate_from_order(p_data jsonb)
RETURNS SETOF public.certificate
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_issue_date DATE := COALESCE(
    NULLIF(p_data->>'issue_date','')::date,
    (now() AT TIME ZONE 'Asia/Jakarta')::date
  );
  cur_month   INT  := EXTRACT(MONTH FROM v_issue_date)::INT;
  cur_year    INT  := EXTRACT(YEAR  FROM v_issue_date)::INT;
  v_item_id   BIGINT := NULLIF(p_data->>'calibration_order_item_id','')::bigint;
  v_cert_type TEXT   := COALESCE(NULLIF(p_data->>'certificate_type',''), 'sert');
  v_code      TEXT   := NULLIF(p_data->>'instrument_code','');
  v_creator   UUID   := NULLIF(p_data->>'created_by','')::uuid;
  v_station   BIGINT := NULLIF(p_data->>'station','')::bigint;
  v_instr     BIGINT := NULLIF(p_data->>'instrument','')::bigint;

  v_item      RECORD;
  v_order     RECORD;
  v_no_cert   TEXT;
  v_new_id    BIGINT;
BEGIN
  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'calibration_order_item_id wajib diisi';
  END IF;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'instrument_code wajib diisi';
  END IF;

  -- Kunci item agar tidak dua pembuatan sertifikat paralel untuk item sama.
  SELECT i.*, o.status AS order_status, o.numbering_year, o.calibration_place,
         o.no_order, o.station_id, o.station_address_snapshot
    INTO v_item
    FROM public.calibration_order_items i
    JOIN public.calibration_orders o ON o.id = i.order_id
   WHERE i.id = v_item_id
   FOR UPDATE OF i;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item % tidak ditemukan', v_item_id;
  END IF;
  IF v_item.order_status NOT IN ('booked','in_progress') THEN
    RAISE EXCEPTION 'Order berstatus % tidak dapat menerbitkan sertifikat', v_item.order_status;
  END IF;
  IF v_item.status = 'void' THEN
    RAISE EXCEPTION 'Item % sudah void', v_item_id;
  END IF;
  IF v_item.instrument_id IS NULL THEN
    RAISE EXCEPTION 'Item % belum dikaitkan dengan instrumen aktual', v_item_id;
  END IF;
  IF v_station IS NOT NULL AND v_station <> v_item.station_id THEN
    RAISE EXCEPTION 'Station certificate (%) berbeda dari station order (%)', v_station, v_item.station_id;
  END IF;
  IF v_instr IS NOT NULL AND v_instr <> v_item.instrument_id THEN
    RAISE EXCEPTION 'Instrument certificate (%) berbeda dari instrument order item (%)', v_instr, v_item.instrument_id;
  END IF;
  IF v_item.instrument_code IS NOT NULL AND UPPER(v_item.instrument_code) <> UPPER(v_code) THEN
    RAISE EXCEPTION 'Kode instrumen certificate (%) berbeda dari order item (%)', v_code, v_item.instrument_code;
  END IF;
  IF EXISTS (SELECT 1 FROM public.certificate c WHERE c.calibration_order_item_id = v_item_id) THEN
    RAISE EXCEPTION 'Item % sudah memiliki sertifikat', v_item_id USING ERRCODE = '23505';
  END IF;

  -- Pastikan kode alat terdaftar
  IF NOT EXISTS (
    SELECT 1 FROM public.instrument_code WHERE UPPER(code_alat) = UPPER(v_code)
  ) THEN
    RAISE EXCEPTION 'instrument_code tidak terdaftar: %', v_code;
  END IF;

  v_no_cert := public._format_certificate_no(
    v_cert_type,
    v_item.calibration_place,
    v_code,
    public._format_order_number(v_item.identification_sequence),
    v_item.no_order,
    cur_month,
    cur_year
  );

  INSERT INTO public.certificate (
    no_certificate, no_order, certificate_type, calibration_place, calibration_kind, instrument_code,
    no_identification, issue_date, station, instrument,
    authorized_by, verifikator_1, verifikator_2, verifikator_3, assignor,
    station_address, results, sent_by, created_by,
    calibration_order_id, calibration_order_item_id
  ) VALUES (
    v_no_cert,
    v_item.no_order,
    v_cert_type,
    v_item.calibration_place,
    v_item.calibration_place,
    v_code,
    v_item.no_identification,
    v_issue_date,
    v_item.station_id,
    v_item.instrument_id,
    NULLIF(p_data->>'authorized_by','')::uuid,
    NULLIF(p_data->>'verifikator_1','')::uuid,
    NULLIF(p_data->>'verifikator_2','')::uuid,
    NULLIF(p_data->>'verifikator_3','')::uuid,
    NULLIF(p_data->>'assignor','')::uuid,
    COALESCE(NULLIF(p_data->>'station_address',''), v_item.station_address_snapshot),
    NULLIF(p_data->>'results','')::jsonb,
    NULLIF(p_data->>'sent_by','')::uuid,
    v_creator,
    v_item.order_id,
    v_item.id
  )
  RETURNING id INTO v_new_id;

  UPDATE public.calibration_order_items
     SET status = 'certificate_draft', updated_at = now()
   WHERE id = v_item.id;

  RETURN QUERY SELECT * FROM public.certificate WHERE id = v_new_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_certificate_from_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_certificate_from_order(jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Immutability guard untuk sertifikat yang bersumber dari booking.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_order_linked_certificate_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF OLD.calibration_order_item_id IS DISTINCT FROM NEW.calibration_order_item_id
     OR OLD.calibration_order_id IS DISTINCT FROM NEW.calibration_order_id THEN
    RAISE EXCEPTION 'Link Order Kalibrasi pada certificate tidak dapat diubah';
  END IF;

  IF OLD.calibration_order_item_id IS NOT NULL AND (
       OLD.no_certificate IS DISTINCT FROM NEW.no_certificate
    OR OLD.no_order IS DISTINCT FROM NEW.no_order
    OR OLD.no_identification IS DISTINCT FROM NEW.no_identification
    OR OLD.station IS DISTINCT FROM NEW.station
    OR OLD.instrument IS DISTINCT FROM NEW.instrument
    OR OLD.calibration_place IS DISTINCT FROM NEW.calibration_place
    OR OLD.calibration_kind IS DISTINCT FROM NEW.calibration_kind
    OR OLD.instrument_code IS DISTINCT FROM NEW.instrument_code
  ) THEN
    RAISE EXCEPTION 'Metadata nomor, station, instrumen, dan order certificate booking bersifat permanen';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS certificate_protect_order_metadata ON public.certificate;
CREATE TRIGGER certificate_protect_order_metadata
  BEFORE UPDATE ON public.certificate
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_order_linked_certificate_metadata();
