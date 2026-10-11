-- Nomor Surat Keterangan (no_letter) dibuat SEJAK SURAT DIBUAT (draf), bukan
-- menunggu TTE.
--
-- Latar: sebelumnya no_letter hanya diisi ketika issue_date terisi, sehingga
-- (a) draf menampilkan "-", dan (b) reset-for-resign mengosongkan issue_date ->
-- no_letter di-null-kan -> dibuat ulang dengan bulan berbeda (nomor berubah).
--
-- Perubahan: nomor dibuat sekali memakai bulan/tahun SAAT DIBUAT (mengikuti cara
-- nomor sertifikat) dan TIDAK diubah lagi bila sudah ada. Format tetap mengikuti
-- IKK: "S.Ket.<place>-<kode>/<no_order>.<no_ident>/DIK/<roman>/<tahun>".
--
-- Idempoten: aman dijalankan berulang.

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

  -- Nomor dibuat sekali (bulan/tahun saat dibuat) dan stabil; tidak diubah bila
  -- sudah terisi.
  IF NEW.no_letter IS NULL THEN
    NEW.no_letter := public._format_certificate_no(
      's_ket',
      v_ctx.calibration_place,
      v_ctx.instrument_code,
      public._format_order_number(v_ctx.identification_sequence),
      v_ctx.no_order,
      EXTRACT(MONTH FROM NOW())::integer,
      EXTRACT(YEAR FROM NOW())::integer
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

REVOKE ALL ON FUNCTION public.sync_letter_from_order_item() FROM PUBLIC, anon, authenticated;

COMMIT;
