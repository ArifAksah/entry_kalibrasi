-- ============================================================================
-- Calibration Order — 02 RPC
-- - seed counter dari data existing
-- - reserve_calibration_order(...)     -> buat order + alokasi no_order atomik
-- - reserve_order_identification(...)  -> alokasi no_identification atomik
-- - admin_reset_order_counter(...)     -> hard reset / repair yang aman
-- - preview_next_order_number(...)
-- Idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Seed counter dari certificate existing (agar nomor tidak duplikat).
-- last_value = MAX(order_number) historis per (tahun, place).
-- ---------------------------------------------------------------------------
INSERT INTO public.calibration_order_counters (numbering_year, calibration_place, last_value)
SELECT EXTRACT(YEAR FROM c.created_at)::smallint AS yr,
       UPPER(c.calibration_place)                 AS place,
       COALESCE(MAX((regexp_match(c.no_order, '\d+'))[1]::int), 0)
  FROM public.certificate c
 WHERE c.calibration_place IN ('FC', 'LC')
   AND c.no_order IS NOT NULL
 GROUP BY 1, 2
    ON CONFLICT (numbering_year, calibration_place)
    DO UPDATE SET last_value = GREATEST(
      public.calibration_order_counters.last_value,
      EXCLUDED.last_value
    );

-- ---------------------------------------------------------------------------
-- Format no_order = LPAD(n, 3, '0')
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._format_order_number(p_n integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT LPAD(GREATEST(p_n, 0)::text, 3, '0');
$fn$;

-- ---------------------------------------------------------------------------
-- create_calibration_order_draft
-- Draft belum mengonsumsi nomor order. Nomor dialokasikan ketika confirm.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_calibration_order_draft(p_data jsonb)
RETURNS SETOF public.calibration_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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
  IF v_place NOT IN ('FC','LC') THEN
    RAISE EXCEPTION 'calibration_place harus FC atau LC, got: %', v_place;
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
$fn$;

-- ---------------------------------------------------------------------------
-- confirm_calibration_order
-- Mengalokasikan nomor resmi secara atomik hanya untuk order draft.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_calibration_order(
  p_order_id bigint,
  p_actor uuid
)
RETURNS SETOF public.calibration_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  cur_year smallint := EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Jakarta')::smallint;
  v_order public.calibration_orders%ROWTYPE;
  v_next integer;
BEGIN
  SELECT * INTO v_order
    FROM public.calibration_orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order % tidak ditemukan', p_order_id; END IF;
  IF v_order.status <> 'draft' THEN
    RAISE EXCEPTION 'Hanya order draft yang dapat dikonfirmasi (status: %)', v_order.status;
  END IF;

  INSERT INTO public.calibration_order_counters (
    numbering_year, calibration_place, last_value, updated_by
  ) VALUES (cur_year, v_order.calibration_place, 0, p_actor)
  ON CONFLICT (numbering_year, calibration_place) DO NOTHING;

  UPDATE public.calibration_order_counters
     SET last_value = last_value + 1,
         updated_at = now(),
         updated_by = p_actor
   WHERE numbering_year = cur_year
     AND calibration_place = v_order.calibration_place
  RETURNING last_value INTO v_next;

  UPDATE public.calibration_orders
     SET numbering_year = cur_year,
         order_number = v_next,
         no_order = public._format_order_number(v_next),
         status = 'booked',
         confirmed_at = now()
   WHERE id = p_order_id;

  RETURN QUERY SELECT * FROM public.calibration_orders WHERE id = p_order_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- reserve_calibration_order
-- Membuat order + alokasi no_order dalam satu transaksi.
-- p_data: { station_id, planned_date, calibration_place, notes, created_by,
--           personnel_ids: [] }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_calibration_order(p_data jsonb)
RETURNS SETOF public.calibration_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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
  IF v_place NOT IN ('FC','LC') THEN
    RAISE EXCEPTION 'calibration_place harus FC atau LC, got: %', v_place;
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

  -- Pastikan baris counter ada, lalu kunci & naikkan.
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

  -- Petugas (opsional)
  IF p_data ? 'personnel_ids' AND jsonb_typeof(p_data->'personnel_ids') = 'array' THEN
    FOR v_person IN SELECT * FROM jsonb_array_elements(p_data->'personnel_ids') LOOP
      INSERT INTO public.calibration_order_personnel (order_id, personel_id, assigned_by)
      VALUES (v_order_id, (v_person #>> '{}')::uuid, v_creator)
      ON CONFLICT (order_id, personel_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN QUERY SELECT * FROM public.calibration_orders WHERE id = v_order_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- reserve_order_identification
-- Alokasi no_identification berikutnya untuk sebuah order secara atomik.
-- p_data: { order_id, instrument_id, instrument_code, created_by }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_order_identification(p_data jsonb)
RETURNS SETOF public.calibration_order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_order_id  bigint := NULLIF(p_data->>'order_id','')::bigint;
  v_instr     bigint := NULLIF(p_data->>'instrument_id','')::bigint;
  v_code      text   := NULLIF(p_data->>'instrument_code','');
  v_creator   uuid   := NULLIF(p_data->>'created_by','')::uuid;
  v_no_order  text;
  v_status    text;
  v_seq       integer;
  v_no_ident  text;
  v_new_id    bigint;
BEGIN
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id wajib diisi';
  END IF;

  SELECT o.no_order, o.status
    INTO v_no_order, v_status
    FROM public.calibration_orders o
   WHERE o.id = v_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % tidak ditemukan', v_order_id;
  END IF;
  IF v_status NOT IN ('booked','postponed','in_progress') THEN
    RAISE EXCEPTION 'Order % berstatus % tidak dapat ditambah item', v_order_id, v_status;
  END IF;

  SELECT COALESCE(MAX(identification_sequence), 0) + 1
    INTO v_seq
    FROM public.calibration_order_items
   WHERE order_id = v_order_id;

  v_no_ident := v_no_order || '.' || public._format_order_number(v_seq);

  INSERT INTO public.calibration_order_items (
    order_id, identification_sequence, no_identification,
    instrument_id, instrument_code, status, created_by
  ) VALUES (
    v_order_id, v_seq, v_no_ident, v_instr, v_code, 'identified', v_creator
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT * FROM public.calibration_order_items WHERE id = v_new_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- preview_next_order_number
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_next_order_number(
  p_year smallint DEFAULT NULL,
  p_place text DEFAULT 'FC'
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_year  smallint := COALESCE(p_year, EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Jakarta')::smallint);
  v_place text     := UPPER(COALESCE(NULLIF(p_place,''), 'FC'));
  v_next  integer;
BEGIN
  SELECT COALESCE(last_value, 0) + 1
    INTO v_next
    FROM public.calibration_order_counters
   WHERE numbering_year = v_year AND calibration_place = v_place;

  v_next := COALESCE(v_next, 1);
  RETURN public._format_order_number(v_next);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- admin_reset_order_counter
-- Hard reset / repair yang aman.
-- mode:
--   'reset_unused_scope' -> set ke 0 hanya jika belum pernah ada order resmi
--   'set_next_value'     -> set last_value = p_value (harus >= max historis)
--   'skip_range'         -> majukan sejumlah p_value
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_order_counter(
  p_year   smallint,
  p_place  text,
  p_mode   text,
  p_value  integer DEFAULT NULL,
  p_reason text    DEFAULT NULL,
  p_actor  uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_place     text    := UPPER(COALESCE(NULLIF(p_place,''), 'FC'));
  v_prev      integer;
  v_max_used  integer;
  v_new       integer;
BEGIN
  IF v_place NOT IN ('FC','LC') THEN
    RAISE EXCEPTION 'calibration_place harus FC atau LC';
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

  -- Nomor tertinggi yang PERNAH dialokasikan (order + sertifikat).
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
    -- p_value = nomor berikutnya yang diinginkan -> last_value = p_value - 1
    v_new := p_value - 1;
    IF v_new < v_max_used THEN
      RAISE EXCEPTION 'Nilai baru % lebih kecil dari nomor terpakai % pada scope %/%, ditolak',
        p_value, v_max_used, p_year, v_place;
    END IF;
  ELSE -- skip_range
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
$fn$;

-- ---------------------------------------------------------------------------
-- Grants: hanya service_role
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.reserve_calibration_order(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_order_identification(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_reset_order_counter(smallint,text,text,integer,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_calibration_order_draft(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_calibration_order(bigint,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_calibration_order(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_order_identification(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_order_counter(smallint,text,text,integer,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.preview_next_order_number(smallint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_calibration_order_draft(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_calibration_order(bigint,uuid) TO service_role;
