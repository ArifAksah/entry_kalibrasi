BEGIN;

-- Sesuai rujukan IKK terbaru, nomor Surat Keterangan memakai label "S.Ket"
-- (contoh: S.Ket.FC-AWOS/352.001/DIK/X/2026). Sertifikat tetap "Sert".
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

-- Hitung ulang nomor Surat yang belum ditandatangani. Trigger
-- letter_sync_order_item akan membentuk ulang no_letter dari identitas order.
UPDATE public.letter l
   SET no_letter = l.no_letter
  FROM public.calibration_order_items i
  JOIN public.calibration_orders o ON o.id = i.order_id
 WHERE l.calibration_order_item_id = i.id
   AND l.issue_date IS NOT NULL
   AND l.signed_at IS NULL;

COMMIT;
