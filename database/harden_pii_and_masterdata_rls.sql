-- ============================================================================
-- Security hardening migration (pentemuan C3 & C2) — Sept 2026
--
-- C3 (Critical): tabel personel (PII: NIK/NIP/telepon/email) dan user_roles
--   dapat dibaca langsung via PostgREST memakai anon key (tanpa RLS).
-- C2 (High): master data (station, station_type, instrument_names,
--   notes) terekspos tanpa autentikasi.
--
-- Strategi:
--   1. SECURITY DEFINER function is_system_admin() — dipakai policy tanpa
--      risiko rekursi RLS pada user_roles.
--   2. ENABLE RLS pada tabel yang belum dipayungi policy.
--   3. anon TIDAK diberi policy apa pun => akses via anon key ditolak.
--   4. REVOKE eksplisit dari anon pada tabel PII (belt & suspenders).
--   service_role tetap bypass RLS => seluruh route API (supabaseAdmin)
--   tidak terpengaruh.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::user_role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_system_admin() FROM PUBLIC;
-- Hanya role authenticated yang boleh memanggil helper RLS ini. `anon`
-- TIDAK boleh (selaras dengan security_migration_03/04) agar role anonim
-- tidak bisa menyentuh permukaan admin sama sekali.
GRANT  EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- PERSONEL (PII)
-- ---------------------------------------------------------------------------
ALTER TABLE public.personel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personel_select_self_or_admin ON public.personel;
CREATE POLICY personel_select_self_or_admin ON public.personel
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_system_admin());

DROP POLICY IF EXISTS personel_update_self_or_admin ON public.personel;
CREATE POLICY personel_update_self_or_admin ON public.personel
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_system_admin())
  WITH CHECK (id = auth.uid() OR public.is_system_admin());

DROP POLICY IF EXISTS personel_insert_admin ON public.personel;
CREATE POLICY personel_insert_admin ON public.personel
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS personel_delete_admin ON public.personel;
CREATE POLICY personel_delete_admin ON public.personel
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- USER_ROLES
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select_self_or_admin ON public.user_roles;
CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_system_admin());

DROP POLICY IF EXISTS user_roles_write_admin ON public.user_roles;
CREATE POLICY user_roles_write_admin ON public.user_roles
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS user_roles_update_admin ON public.user_roles;
CREATE POLICY user_roles_update_admin ON public.user_roles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS user_roles_delete_admin ON public.user_roles;
CREATE POLICY user_roles_delete_admin ON public.user_roles
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- STATION (master data) — dibaca semua user login, tidak untuk anon
-- ---------------------------------------------------------------------------
ALTER TABLE public.station ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS station_select_authenticated ON public.station;
CREATE POLICY station_select_authenticated ON public.station
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS station_write_authenticated ON public.station;
DROP POLICY IF EXISTS station_update_authenticated ON public.station;
DROP POLICY IF EXISTS station_delete_authenticated ON public.station;
DROP POLICY IF EXISTS station_write_admin ON public.station;
DROP POLICY IF EXISTS station_update_admin ON public.station;
DROP POLICY IF EXISTS station_delete_admin ON public.station;
-- Mutasi (insert/update/delete) hanya boleh lewat API server (service_role)
-- atau admin secara eksplisit. Semua user login tetap bisa baca.
CREATE POLICY station_write_admin ON public.station
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.is_system_admin());
CREATE POLICY station_update_admin ON public.station
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());
CREATE POLICY station_delete_admin ON public.station
  AS PERMISSIVE FOR DELETE TO authenticated USING (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- STATION_TYPE / INSTRUMENT_NAMES / NOTES (master data)
--   Catatan: tabel `sensor_names` TIDAK ada di skema ini — sensor memakai
--   `instrument_names` lewat FK sensor.sensor_name_id. Blok RLS-nya sengaja
--   tidak disertakan supaya transaction ini tidak rollback (previously
--   migration failed karena ALTER TABLE ke relasi yang tidak eksis).
-- ---------------------------------------------------------------------------
ALTER TABLE public.station_type ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS station_type_select_authenticated ON public.station_type;
CREATE POLICY station_type_select_authenticated ON public.station_type
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

ALTER TABLE public.instrument_names ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instrument_names_select_authenticated ON public.instrument_names;
CREATE POLICY instrument_names_select_authenticated ON public.instrument_names
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notes_select_authenticated ON public.notes;
CREATE POLICY notes_select_authenticated ON public.notes
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS notes_write_authenticated ON public.notes;
DROP POLICY IF EXISTS notes_update_authenticated ON public.notes;
DROP POLICY IF EXISTS notes_delete_authenticated ON public.notes;
DROP POLICY IF EXISTS notes_write_admin ON public.notes;
DROP POLICY IF EXISTS notes_update_admin ON public.notes;
DROP POLICY IF EXISTS notes_delete_admin ON public.notes;
CREATE POLICY notes_write_admin ON public.notes
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.is_system_admin());
CREATE POLICY notes_update_admin ON public.notes
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());
CREATE POLICY notes_delete_admin ON public.notes
  AS PERMISSIVE FOR DELETE TO authenticated USING (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- REVOKE eksplisit dari anon pada tabel sensitif (anon key tidak boleh
-- menyentuh PII sama sekali, bahkan sebelum RLS dievaluasi).
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.personel FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.password_reset_tokens FROM anon;

-- ---------------------------------------------------------------------------
-- PASSWORD_RESET_TOKENS (CRITICAL)
--   Tanpa RLS, setiap `authenticated` user (termasuk orang yang baru bikin
--   akun sendiri) bisa SELECT token reset user lain → reset password
--   arbitrary akun. Semua operasi tabel ini di aplikasi lewat NextJS route
--   (`app/api/auth/forgot-password` & `/reset-password`) yang pakai
--   supabaseAdmin (service_role ⇒ bypass RLS), jadi authenticated & anon
--   tidak butuh akses sama sekali.
-- ---------------------------------------------------------------------------
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_tokens FROM authenticated;
-- Sengaja TIDAK membuat policy untuk authenticated/anon → RLS default
-- akan menolak, bahkan kalau REVOKE terlewat.

-- ---------------------------------------------------------------------------
--DROP helper RPC "exec" (raw SQL runner). Selama fungsi ini ada, siapa pun
-- yang memegang API key dengan hak EXECUTE dapat menjalankan SQL arbitrary
-- melalui PostgREST. Semua migrasi kini lewat file SQL, jadi helper ini
-- tidak dibutuhkan lagi.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'exec'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.sig);
  END LOOP;
END $$;

COMMIT;

-- Verifikasi cepat setelah migrasi (jalankan manual bila perlu):
--   SELECT tablename, policyname, permissive, roles FROM pg_policies
--   WHERE schemaname='public' AND tablename IN
--     ('personel','user_roles','station','station_type','instrument_names','notes');
--   Setelan psql: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/harden_pii_and_masterdata_rls.sql
--   Verifikasi postgrest: npm run check:pii-rls  (harus "7/7 table sudah locked", exit 0)
