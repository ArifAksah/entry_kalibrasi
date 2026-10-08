BEGIN;

-- Nomor identifikasi tidak boleh dipakai ulang. Selama ini penomoran memakai
-- MAX(sequence) yang masih ada, sehingga menghapus baris akan membuat nomornya
-- dipakai lagi. Dengan penanda "tertinggi yang pernah terpakai", item yang
-- salah dibuat bisa dihapus tanpa mendaur ulang nomor.
ALTER TABLE public.calibration_orders
  ADD COLUMN IF NOT EXISTS last_identification_sequence integer NOT NULL DEFAULT 0;

UPDATE public.calibration_orders o
   SET last_identification_sequence = COALESCE(
     (SELECT MAX(i.identification_sequence) FROM public.calibration_order_items i WHERE i.order_id = o.id),
     0
   );

CREATE OR REPLACE FUNCTION public.reserve_order_identification(p_data jsonb)
 RETURNS SETOF calibration_order_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id  bigint := NULLIF(p_data->>'order_id','')::bigint;
  v_instr     bigint := NULLIF(p_data->>'instrument_id','')::bigint;
  v_code      text   := NULLIF(p_data->>'instrument_code','');
  v_creator   uuid   := NULLIF(p_data->>'created_by','')::uuid;
  v_no_order  text;
  v_status    text;
  v_last_seq  integer;
  v_seq       integer;
  v_no_ident  text;
  v_new_id    bigint;
BEGIN
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id wajib diisi';
  END IF;

  SELECT o.no_order, o.status, COALESCE(o.last_identification_sequence, 0)
    INTO v_no_order, v_status, v_last_seq
    FROM public.calibration_orders o
   WHERE o.id = v_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % tidak ditemukan', v_order_id;
  END IF;
  IF v_status NOT IN ('booked','postponed','in_progress') THEN
    RAISE EXCEPTION 'Order % berstatus % tidak dapat ditambah item', v_order_id, v_status;
  END IF;

  -- Nomor berikutnya = tertinggi antara nomor yang masih ada dan nomor yang
  -- pernah terpakai (walau barisnya sudah dihapus).
  SELECT GREATEST(COALESCE(MAX(identification_sequence), 0), v_last_seq) + 1
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

  UPDATE public.calibration_orders
     SET last_identification_sequence = GREATEST(COALESCE(last_identification_sequence, 0), v_seq)
   WHERE id = v_order_id;

  RETURN QUERY SELECT * FROM public.calibration_order_items WHERE id = v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_order_identification(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_order_identification(jsonb) TO service_role;

COMMIT;
