BEGIN;

CREATE OR REPLACE FUNCTION public.sync_letter_from_order_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  v_ctx RECORD;
  v_certificate_id bigint;
BEGIN
  IF NEW.calibration_order_item_id IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.calibration_order_item_id IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'calibration_order_item_id wajib diisi';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.calibration_order_item_id IS DISTINCT FROM NEW.calibration_order_item_id THEN
    RAISE EXCEPTION 'Order item pada Surat Keterangan tidak dapat diubah';
  END IF;

  SELECT
    i.id AS item_id,
    i.order_id,
    i.identification_sequence,
    i.no_identification,
    i.instrument_id,
    i.instrument_code,
    i.status AS item_status,
    o.no_order,
    o.station_id,
    o.calibration_place,
    o.status AS order_status
  INTO v_ctx
  FROM public.calibration_order_items i
  JOIN public.calibration_orders o ON o.id = i.order_id
  WHERE i.id = NEW.calibration_order_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item % tidak ditemukan', NEW.calibration_order_item_id;
  END IF;
  IF TG_OP = 'INSERT' AND v_ctx.order_status NOT IN ('booked', 'postponed', 'in_progress') THEN
    RAISE EXCEPTION 'Order berstatus % belum dapat dibuatkan Surat Keterangan', v_ctx.order_status;
  END IF;
  IF v_ctx.item_status = 'void' THEN
    RAISE EXCEPTION 'Order item % sudah tidak dipakai', NEW.calibration_order_item_id;
  END IF;
  IF v_ctx.no_order IS NULL OR v_ctx.no_identification IS NULL THEN
    RAISE EXCEPTION 'Nomor order dan identifikasi wajib tersedia';
  END IF;
  IF v_ctx.instrument_id IS NULL OR NULLIF(v_ctx.instrument_code, '') IS NULL THEN
    RAISE EXCEPTION 'Instrumen dan kode alat wajib tersedia';
  END IF;

  SELECT c.id
  INTO v_certificate_id
  FROM public.certificate c
  WHERE c.calibration_order_item_id = v_ctx.item_id
  LIMIT 1;

  NEW.calibration_order_id := v_ctx.order_id;
  NEW.certificate_id := v_certificate_id;
  NEW.no_order := v_ctx.no_order;
  NEW.no_identification := v_ctx.no_identification;
  NEW.instrument := v_ctx.instrument_id;
  NEW.owner := v_ctx.station_id;

  IF NEW.issue_date IS NULL THEN
    NEW.no_letter := NULL;
  ELSE
    NEW.no_letter := public._format_certificate_no(
      's_ket',
      v_ctx.calibration_place,
      v_ctx.instrument_code,
      public._format_order_number(v_ctx.identification_sequence),
      v_ctx.no_order,
      EXTRACT(MONTH FROM NEW.issue_date)::integer,
      EXTRACT(YEAR FROM NEW.issue_date)::integer
    );
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS letter_sync_order_item ON public.letter;
CREATE TRIGGER letter_sync_order_item
  BEFORE INSERT OR UPDATE ON public.letter
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_letter_from_order_item();

CREATE OR REPLACE FUNCTION public.link_letter_after_certificate_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.calibration_order_item_id IS NOT NULL THEN
    UPDATE public.letter
    SET certificate_id = NEW.id
    WHERE calibration_order_item_id = NEW.calibration_order_item_id;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS certificate_link_letter ON public.certificate;
CREATE TRIGGER certificate_link_letter
  AFTER INSERT ON public.certificate
  FOR EACH ROW
  EXECUTE FUNCTION public.link_letter_after_certificate_insert();

REVOKE ALL ON FUNCTION public.sync_letter_from_order_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_letter_after_certificate_insert() FROM PUBLIC, anon, authenticated;

COMMIT;
