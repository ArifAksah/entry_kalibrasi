-- ============================================================================
-- FIX: personel.id NULL mismatch dengan auth.users.id
-- ----------------------------------------------------------------------------
-- Gejala: login gagal ("User not found in system") padahal akun auth ada &
-- password benar, karena aplikasi mencari personel berdasarkan id auth user
-- (`/api/personel/{authId}`), sementara baris `personel` punya id yang berbeda
-- (mis. hasil seed/import) walau emailnya sama.
--
-- Solusi (aman, tidak menghapus referensi lama):
--   1) Buat baris `personel` baru dengan id = auth user id (via email yang sama).
--   2) Pindahkan role (user_roles) & station (user_stations) & penugasan order
--      (calibration_order_personnel) ke id auth.
--   3) Arsipkan baris lama (email -> '...old', is_active=false) karena masih
--      direferensikan oleh sertifikat lama (FK NO ACTION).
--
-- Idempoten: hanya memproses pasangan yang belum punya baris personel ber-id auth.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id AS old_id, u.id AS new_id, p.email AS email
    FROM public.personel p
    JOIN auth.users u ON lower(u.email) = lower(p.email)
    WHERE p.id <> u.id
      AND NOT EXISTS (SELECT 1 FROM auth.users x WHERE x.id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.personel q WHERE q.id = u.id)
  LOOP
    UPDATE public.personel SET email = r.email || '.old' WHERE id = r.old_id;

    INSERT INTO public.personel
      (id, created_at, name, nip, position, phone, email, station_user, nik, nik_index, balai_id, signer_title, is_active, deleted_at)
    SELECT r.new_id, created_at, name, nip, position, phone, r.email, station_user, nik, nik_index, balai_id, signer_title, true, NULL
    FROM public.personel WHERE id = r.old_id;

    UPDATE public.user_roles SET user_id = r.new_id WHERE user_id = r.old_id;
    UPDATE public.user_stations SET user_id = r.new_id WHERE user_id = r.old_id;
    UPDATE public.calibration_order_personnel SET personel_id = r.new_id WHERE personel_id = r.old_id;

    UPDATE public.personel SET is_active = false, deleted_at = now() WHERE id = r.old_id;

    RAISE NOTICE 'reconciled % -> %', r.old_id, r.new_id;
  END LOOP;
END $$;

COMMIT;
