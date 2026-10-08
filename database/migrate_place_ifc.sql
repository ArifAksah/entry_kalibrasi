-- ============================================================================
-- Generalisasi calibration_place: tambah 'IFC' (lapang milik INTERNAL BMKG).
-- ----------------------------------------------------------------------------
-- Aturan IKK: LC = Laboratorium, FC = lapang EKSTERNAL (via PTSP),
--             IFC = lapang INTERNAL BMKG.
--
-- Fase ini hanya GENERALISASI: IFC diperlakukan setara FC (format nomor sama,
-- wajib no_identification). Pemetaan otomatis FC vs IFC (internal/eksternal)
-- BELUM diputuskan (menunggu konfirmasi Direktorat Kalibrasi).
--
-- Idempoten. Tidak menyentuh tipping bucket / pyranometer / raw_general.
-- ============================================================================

BEGIN;

-- 0) Lebarkan kolom: 'IFC' = 3 karakter (sebelumnya varchar(2)) --------------
ALTER TABLE public.calibration_orders             ALTER COLUMN calibration_place TYPE varchar(3);
ALTER TABLE public.calibration_order_counters     ALTER COLUMN calibration_place TYPE varchar(3);
ALTER TABLE public.calibration_order_counter_logs ALTER COLUMN calibration_place TYPE varchar(3);
ALTER TABLE public.certificate                    ALTER COLUMN calibration_place TYPE varchar(3);
ALTER TABLE public.certificate                    ALTER COLUMN calibration_kind  TYPE varchar(3);

-- 1) Constraint: izinkan IFC ------------------------------------------------
ALTER TABLE public.certificate DROP CONSTRAINT IF EXISTS certificate_place_check;
ALTER TABLE public.certificate ADD CONSTRAINT certificate_place_check
  CHECK (calibration_place IN ('FC', 'IFC', 'LC'));

ALTER TABLE public.certificate DROP CONSTRAINT IF EXISTS certificate_calibration_kind_check;
ALTER TABLE public.certificate ADD CONSTRAINT certificate_calibration_kind_check
  CHECK (calibration_kind IS NULL OR calibration_kind IN ('FC', 'IFC', 'LC'));

ALTER TABLE public.calibration_orders DROP CONSTRAINT IF EXISTS calibration_orders_place_chk;
ALTER TABLE public.calibration_orders ADD CONSTRAINT calibration_orders_place_chk
  CHECK (calibration_place IN ('FC', 'IFC', 'LC'));

ALTER TABLE public.calibration_order_counters DROP CONSTRAINT IF EXISTS calibration_order_counters_place_chk;
ALTER TABLE public.calibration_order_counters ADD CONSTRAINT calibration_order_counters_place_chk
  CHECK (calibration_place IN ('FC', 'IFC', 'LC'));

-- 2) Label jenis dokumen: Sertifikat "Sert", Surat Keterangan "S.Ket" -------
-- (rujukan IKK terbaru: S.Ket.FC-AWOS/352.001/DIK/X/2026)
CREATE OR REPLACE FUNCTION public._cert_type_label(p_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE LOWER(COALESCE(p_type, 'sert'))
           WHEN 'sert'  THEN 'Sert'
           WHEN 's_ket' THEN 'S.Ket'
           ELSE 'Sert'
         END
$function$;

-- 3) Format nomor: IFC memakai pola FC (dengan sub no_ident) -----------------
CREATE OR REPLACE FUNCTION public._format_certificate_no(p_cert_type text, p_place text, p_code text, p_no_ident text, p_no_order text, p_month integer, p_year integer)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  roman TEXT[] := ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  type_label TEXT := public._cert_type_label(p_cert_type);
  v_place TEXT := UPPER(COALESCE(p_place, 'FC'));
BEGIN
  IF v_place IN ('FC', 'IFC') THEN
    -- Format lapang: Sert.FC-CODE/NoOrder.NoIdent/DIK/Roman/Year
    --               Sert.IFC-CODE/NoOrder.NoIdent/DIK/Roman/Year
    RETURN type_label || '.' || v_place || '-' || p_code
        || '/' || p_no_order || '.' || p_no_ident
        || '/DIK/' || roman[p_month] || '/' || p_year;
  ELSIF v_place = 'LC' THEN
    RETURN type_label || '.LC-' || p_code
        || '/' || p_no_order
        || '/DIK/' || roman[p_month] || '/' || p_year;
  ELSE
    RAISE EXCEPTION 'Unsupported calibration_place: %', p_place;
  END IF;
END $function$;

-- 4) reserve_calibration_order: terima IFC ----------------------------------
CREATE OR REPLACE FUNCTION public.reserve_calibration_order(p_data jsonb)
 RETURNS SETOF calibration_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cur_year    smallint := EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Jakarta')::smallint;
  v_place     text     := UPPER(COALESCE(NULLIF(p_data->>'calibration_place',''), 'FC'));
  v_station   bigint   := NULLIF(p_data->>'station_id','')::bigint;
  v_planned   date     := NULLIF(p_data->>'planned_date','')::date;
  v_planned_end date   := COALESCE(
    NULLIF(p_data->>'planned_end_date','')::date,
    NULLIF(p_data->>'planned_date','')::date
  );
  v_notes     text     := NULLIF(p_data->>'notes','');
  v_creator   uuid     := NULLIF(p_data->>'created_by','')::uuid;
  v_next      integer;
  v_padded    text;
  v_order_id  bigint;
  v_addr      text;
  v_person    jsonb;
  v_new_id    bigint;
BEGIN
  IF v_place NOT IN ('FC','IFC','LC') THEN
    RAISE EXCEPTION 'calibration_place harus FC, IFC, atau LC, got: %', v_place;
  END IF;
  IF v_station IS NULL THEN
    RAISE EXCEPTION 'station_id wajib diisi';
  END IF;
  IF v_planned IS NULL THEN
    RAISE EXCEPTION 'planned_date wajib diisi';
  END IF;
  IF v_planned_end < v_planned THEN
    RAISE EXCEPTION 'planned_end_date tidak boleh sebelum planned_date';
  END IF;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'created_by wajib diisi';
  END IF;

  SELECT address INTO v_addr FROM public.station WHERE id = v_station;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Station % tidak ditemukan', v_station;
  END IF;

  INSERT INTO public.calibration_order_counters (numbering_year, calibration_place, last_value, updated_by)
  VALUES (cur_year, v_place, 0, v_creator)
  ON CONFLICT (numbering_year, calibration_place) DO NOTHING;

  UPDATE public.calibration_order_counters
     SET last_value = last_value + 1,
         updated_at = now(),
         updated_by = v_creator
   WHERE numbering_year = cur_year
     AND calibration_place = v_place
  RETURNING last_value INTO v_next;

  v_padded := public._format_order_number(v_next);

  INSERT INTO public.calibration_orders (
    numbering_year, order_number, no_order, station_id, station_address_snapshot,
    planned_date, planned_end_date, calibration_place, status, notes, created_by, confirmed_at
  ) VALUES (
    cur_year, v_next, v_padded, v_station, v_addr,
    v_planned, v_planned_end, v_place, 'booked', v_notes, v_creator, now()
  )
  RETURNING id INTO v_order_id;

  IF p_data ? 'personnel_ids' AND jsonb_typeof(p_data->'personnel_ids') = 'array' THEN
    FOR v_person IN SELECT * FROM jsonb_array_elements(p_data->'personnel_ids') LOOP
      INSERT INTO public.calibration_order_personnel (order_id, personel_id, assigned_by)
      VALUES (v_order_id, (v_person #>> '{}')::uuid, v_creator)
      ON CONFLICT (order_id, personel_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN QUERY SELECT * FROM public.calibration_orders WHERE id = v_order_id;
END;
$function$;

-- 5) create_calibration_order_draft: terima IFC -----------------------------
CREATE OR REPLACE FUNCTION public.create_calibration_order_draft(p_data jsonb)
 RETURNS SETOF calibration_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_station  bigint := NULLIF(p_data->>'station_id','')::bigint;
  v_planned  date   := NULLIF(p_data->>'planned_date','')::date;
  v_planned_end date := COALESCE(
    NULLIF(p_data->>'planned_end_date','')::date,
    NULLIF(p_data->>'planned_date','')::date
  );
  v_place    text   := UPPER(COALESCE(NULLIF(p_data->>'calibration_place',''), 'FC'));
  v_notes    text   := NULLIF(p_data->>'notes','');
  v_creator  uuid   := NULLIF(p_data->>'created_by','')::uuid;
  v_addr     text;
  v_order_id bigint;
  v_person   jsonb;
BEGIN
  IF v_place NOT IN ('FC','IFC','LC') THEN
    RAISE EXCEPTION 'calibration_place harus FC, IFC, atau LC, got: %', v_place;
  END IF;
  IF v_station IS NULL OR v_planned IS NULL OR v_creator IS NULL THEN
    RAISE EXCEPTION 'station_id, planned_date, dan created_by wajib diisi';
  END IF;
  IF v_planned_end < v_planned THEN
    RAISE EXCEPTION 'planned_end_date tidak boleh sebelum planned_date';
  END IF;

  SELECT address INTO v_addr FROM public.station WHERE id = v_station;
  IF NOT FOUND THEN RAISE EXCEPTION 'Station % tidak ditemukan', v_station; END IF;

  INSERT INTO public.calibration_orders (
    numbering_year, order_number, no_order, station_id,
    station_address_snapshot, planned_date, planned_end_date, calibration_place,
    status, notes, created_by
  ) VALUES (
    NULL, NULL, NULL, v_station,
    v_addr, v_planned, v_planned_end, v_place,
    'draft', v_notes, v_creator
  ) RETURNING id INTO v_order_id;

  IF p_data ? 'personnel_ids' AND jsonb_typeof(p_data->'personnel_ids') = 'array' THEN
    FOR v_person IN SELECT * FROM jsonb_array_elements(p_data->'personnel_ids') LOOP
      INSERT INTO public.calibration_order_personnel (order_id, personel_id, assigned_by)
      VALUES (v_order_id, (v_person #>> '{}')::uuid, v_creator)
      ON CONFLICT (order_id, personel_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN QUERY SELECT * FROM public.calibration_orders WHERE id = v_order_id;
END;
$function$;

-- 6) admin_reset_order_counter: terima IFC ----------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_order_counter(p_year smallint, p_place text, p_mode text, p_value integer DEFAULT NULL::integer, p_reason text DEFAULT NULL::text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_place     text    := UPPER(COALESCE(NULLIF(p_place,''), 'FC'));
  v_prev      integer;
  v_max_used  integer;
  v_new       integer;
BEGIN
  IF v_place NOT IN ('FC','IFC','LC') THEN
    RAISE EXCEPTION 'calibration_place harus FC, IFC, atau LC';
  END IF;
  IF p_mode NOT IN ('reset_unused_scope','set_next_value','skip_range') THEN
    RAISE EXCEPTION 'mode tidak dikenal: %', p_mode;
  END IF;

  INSERT INTO public.calibration_order_counters (numbering_year, calibration_place, last_value)
  VALUES (p_year, v_place, 0)
  ON CONFLICT (numbering_year, calibration_place) DO NOTHING;

  SELECT last_value INTO v_prev
    FROM public.calibration_order_counters
   WHERE numbering_year = p_year AND calibration_place = v_place
   FOR UPDATE;

  SELECT GREATEST(
    COALESCE((SELECT MAX(order_number) FROM public.calibration_orders
               WHERE numbering_year = p_year AND calibration_place = v_place), 0),
    COALESCE((SELECT MAX((regexp_match(no_order,'\d+'))[1]::int) FROM public.certificate
               WHERE EXTRACT(YEAR FROM created_at)::smallint = p_year
                 AND UPPER(calibration_place) = v_place), 0)
  ) INTO v_max_used;

  IF p_mode = 'reset_unused_scope' THEN
    IF v_max_used > 0 THEN
      RAISE EXCEPTION 'Scope %/% sudah memiliki nomor terpakai (max %), tidak boleh reset ke awal',
        p_year, v_place, v_max_used;
    END IF;
    v_new := 0;
  ELSIF p_mode = 'set_next_value' THEN
    IF p_value IS NULL THEN
      RAISE EXCEPTION 'p_value wajib untuk set_next_value';
    END IF;
    v_new := p_value - 1;
    IF v_new < v_max_used THEN
      RAISE EXCEPTION 'Nilai baru % lebih kecil dari nomor terpakai % pada scope %/%, ditolak',
        p_value, v_max_used, p_year, v_place;
    END IF;
  ELSE
    IF p_value IS NULL OR p_value <= 0 THEN
      RAISE EXCEPTION 'p_value harus > 0 untuk skip_range';
    END IF;
    v_new := GREATEST(v_prev, v_max_used) + p_value;
  END IF;

  UPDATE public.calibration_order_counters
     SET last_value = v_new, updated_at = now(), updated_by = p_actor
   WHERE numbering_year = p_year AND calibration_place = v_place;

  INSERT INTO public.calibration_order_counter_logs (
    numbering_year, calibration_place, previous_value, new_value,
    action, reason, performed_by
  ) VALUES (
    p_year, v_place, v_prev, v_new, p_mode, p_reason, p_actor
  );

  RETURN jsonb_build_object(
    'year', p_year, 'place', v_place,
    'previous_value', v_prev, 'new_value', v_new,
    'next_order_number', public._format_order_number(v_new + 1)
  );
END;
$function$;

-- 7) preview_next_certificate_number: terima IFC ----------------------------
CREATE OR REPLACE FUNCTION public.preview_next_certificate_number(p_cert_type text DEFAULT 'sert'::text, p_place text DEFAULT 'FC'::text, p_code text DEFAULT NULL::text, p_no_ident text DEFAULT NULL::text)
 RETURNS TABLE(no_order text, no_certificate text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cur_year    INT         := EXTRACT(YEAR  FROM NOW())::INT;
  cur_month   INT         := EXTRACT(MONTH FROM NOW())::INT;
  year_start  TIMESTAMPTZ := make_timestamptz(cur_year,     1, 1, 0, 0, 0);
  year_end    TIMESTAMPTZ := make_timestamptz(cur_year + 1, 1, 1, 0, 0, 0);
  v_place     TEXT        := UPPER(COALESCE(NULLIF(p_place,''), 'FC'));
  v_code      TEXT        := COALESCE(NULLIF(p_code,''), 'XXX');
  v_ident     TEXT        := COALESCE(NULLIF(p_no_ident,''), 'NNN');
  v_next      INT;
  v_padded    TEXT;
BEGIN
  IF v_place NOT IN ('FC', 'IFC', 'LC') THEN
    v_place := 'FC';
  END IF;
  SELECT COALESCE(MAX((regexp_match(c.no_order, '\d+'))[1]::INT), 0) + 1
    INTO v_next
    FROM public.certificate c
   WHERE c.created_at         >= year_start
     AND c.created_at         <  year_end
     AND c.calibration_place  = v_place;
  v_padded := lpad(v_next::TEXT, 3, '0');
  RETURN QUERY SELECT
    v_padded::TEXT,
    public._format_certificate_no(
      COALESCE(p_cert_type, 'sert'), v_place, v_code, v_ident, v_padded, cur_month, cur_year
    )::TEXT;
END $function$;

-- 8) create_certificate_with_auto_number: terima IFC ------------------------
CREATE OR REPLACE FUNCTION public.create_certificate_with_auto_number(p_data jsonb)
 RETURNS SETOF certificate
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF v_place NOT IN ('FC', 'IFC', 'LC') THEN
    RAISE EXCEPTION 'calibration_place harus FC, IFC, atau LC, got: %', v_place;
  END IF;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'instrument_code wajib diisi';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM instrument_code
     WHERE code_alat IS NOT NULL AND UPPER(code_alat) = UPPER(v_code)
     LIMIT 1
  ) THEN
    RAISE EXCEPTION 'instrument_code tidak terdaftar di master kode alat: %', v_code;
  END IF;
  IF v_place IN ('FC','IFC') AND v_no_ident IS NULL THEN
    RAISE EXCEPTION 'no_identification wajib untuk calibration_place=%', v_place;
  END IF;
  v_lock_key := (cur_year::BIGINT << 32)
    | (CASE WHEN v_place = 'FC' THEN 1 WHEN v_place = 'IFC' THEN 3 ELSE 2 END);
  PERFORM pg_advisory_xact_lock(v_lock_key);
  SELECT COALESCE(MAX((regexp_match(c.no_order, '\d+'))[1]::INT), 0) + 1
    INTO v_next
    FROM certificate c
   WHERE c.created_at        >= year_start
     AND c.created_at        <  year_end
     AND c.calibration_place  = v_place;
  v_padded := LPAD(v_next::TEXT, 3, '0');
  v_no_cert := public._format_certificate_no(
                 v_cert_type, v_place, v_code, v_no_ident, v_padded, cur_month, cur_year);
  RETURN QUERY
  INSERT INTO certificate (
    no_certificate, no_order, certificate_type, calibration_place, instrument_code,
    no_identification, issue_date, station, instrument, authorized_by,
    verifikator_1, verifikator_2, verifikator_3, assignor, station_address,
    results, sent_by, created_by
  )
  VALUES (
    v_no_cert, v_padded, v_cert_type, v_place, v_code, v_no_ident,
    CASE WHEN NULLIF(p_data->>'issue_date', '') IS NULL THEN NULL ELSE (p_data->>'issue_date')::DATE END,
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
$function$;

COMMIT;

-- Verifikasi (opsional):
--   SELECT * FROM public.preview_next_certificate_number('sert','IFC','AWOS','004');
--   SELECT public._format_certificate_no('s_ket','IFC','AWOS','004','037',6,2026);
