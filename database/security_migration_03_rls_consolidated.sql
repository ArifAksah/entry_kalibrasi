-- ============================================================================
-- Security migration 03 — RLS consolidated, idempotent (C1/C2/C3 + views)
-- ============================================================================
--
-- Kenapa file ini ada:
--   security_migration_02_lockdown.sql dan harden_pii_and_masterdata_rls.sql
--   saling menimpa policy (lockdown menghapus semua policy, lalu harden
--   menambah ulang). Urutan eksekusi menentukan hasil akhir. File ini adalah
--   lapisan FINAL yang idempotent: aman dijalankan berapa pun urutan migrasi
--   sebelumnya, dan menghasilkan kondisi default-deny yang konsisten.
--
-- Prinsip:
--   1. Setiap tabel public default-deny: RLS aktif, anon tidak punya akses.
--   2. authenticated hanya boleh SELECT pada master-data publik dan baris
--      miliknya sendiri (personel/user_roles). Semua mutasi lewat service_role.
--   3. View memakai security_invoker supaya RLS tabel dasar tetap dihormati.
--   4. Fungsi RPC hanya di-grant ke role yang benar.
--
-- Jalankan di Supabase SQL Editor. Idempotent.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Helper: cek admin tanpa rekursi RLS.
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.is_system_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Default-deny setiap tabel public + cabut semua akses anon.
--    service_role tetap penuh (semua route API memakai supabaseAdmin).
-- ---------------------------------------------------------------------------
DO $tables$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.relname);
    -- anon tidak boleh menyentuh tabel bisnis sama sekali.
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon', table_record.relname);
    -- authenticated default-deny dulu; policy SELECT ditambahkan selektif di bawah.
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_record.relname);
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', table_record.relname);
  END LOOP;
END
$tables$;

-- ---------------------------------------------------------------------------
-- 2. View: pakai security_invoker agar RLS tabel dasar ikut berlaku, dan
--    cabut akses anon. Dijalankan defensif (butuh PostgreSQL 15+).
-- ---------------------------------------------------------------------------
DO $views$
DECLARE
  view_record record;
BEGIN
  FOR view_record IN
    SELECT c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'v'
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', view_record.relname);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'security_invoker tidak didukung untuk view % (skip): %', view_record.relname, SQLERRM;
    END;
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', view_record.relname);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', view_record.relname);
  END LOOP;
END
$views$;

-- ---------------------------------------------------------------------------
-- 3. personel (PII): authenticated hanya baris sendiri, kolom terbatas.
--    Admin penuh lewat is_system_admin(). anon tidak pernah boleh.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS personel_read_own_identity ON public.personel;
DROP POLICY IF EXISTS personel_select_self_or_admin ON public.personel;
DROP POLICY IF EXISTS personel_insert_admin ON public.personel;
DROP POLICY IF EXISTS personel_update_self_or_admin ON public.personel;
DROP POLICY IF EXISTS personel_update_admin ON public.personel;
DROP POLICY IF EXISTS personel_delete_admin ON public.personel;

CREATE POLICY personel_select_self_or_admin ON public.personel
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_system_admin());

CREATE POLICY personel_insert_admin ON public.personel
  FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin());

CREATE POLICY personel_update_self_or_admin ON public.personel
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_system_admin())
  WITH CHECK (id = auth.uid() OR public.is_system_admin());

CREATE POLICY personel_delete_admin ON public.personel
  FOR DELETE TO authenticated
  USING (public.is_system_admin());

-- Browser hanya butuh id+name; kolom PII tetap hanya lewat service_role.
GRANT SELECT (id, name) ON TABLE public.personel TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. user_roles: authenticated hanya role sendiri; admin boleh semua.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_roles_read_own_role ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_self_or_admin ON public.user_roles;
DROP POLICY IF EXISTS user_roles_write_admin ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update_admin ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete_admin ON public.user_roles;

CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_system_admin());

CREATE POLICY user_roles_write_admin ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin());

CREATE POLICY user_roles_update_admin ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

CREATE POLICY user_roles_delete_admin ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_system_admin());

GRANT SELECT (user_id, role) ON TABLE public.user_roles TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Master-data yang BENAR-BENAR dibaca langsung oleh browser.
--
--    Hasil audit: satu-satunya query client-side langsung adalah
--    `ref_stations` (pencarian referensi stasiun di stations-crud). Semua
--    master-data lain diakses via route /api/* memakai service_role, sehingga
--    tidak perlu grant ke authenticated. Deny-by-default tetap berlaku untuk
--    yang tidak didaftarkan di sini.
--
--    `ref_stations` sudah di-grant di security_migration_02; diulang di sini
--    supaya file ini berdiri sendiri.
-- ---------------------------------------------------------------------------
DO $master$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ref_stations']
  LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE NOTICE 'Tabel master % tidak ada, dilewati', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read_authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_read_authenticated', t
    );
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
  END LOOP;
END
$master$;

-- ---------------------------------------------------------------------------
-- 6. Tabel khusus: tidak ada policy untuk authenticated/anon → default deny.
-- ---------------------------------------------------------------------------
DO $deny$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'password_reset_tokens', 'endpoint_catalog', 'role_endpoint_permissions',
    'role_permissions', 'audit_logs', 'user_settings'
  ]
  LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END
$deny$;

-- role_permissions & role_endpoint_permissions memang dibaca admin via API
-- (service_role), jadi tetap hanya service_role.

-- ---------------------------------------------------------------------------
-- 7. Fungsi RPC: cabut jalur eksekusi implisit, grant hanya yang dibutuhkan.
-- ---------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;

DO $rpc$
DECLARE
  signature text;
  resolved regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.create_certificate_with_auto_number(jsonb)',
    'public.preview_next_certificate_number(text,text,text,text)',
    'public.hitung_koreksi(double precision,bigint)',
    'public.hitung_koreksi(double precision,bigint,bigint)',
    'public.request_certificate_repair(integer,text)',
    'public.complete_certificate_repair(integer,text)',
    'public.reset_certificate_verification(integer)',
    'public.normalize_unit(text)',
    'public.unit_conversion_factor(text,text)',
    'public.convert_unit_absolute(double precision,text,text)'
  ]
  LOOP
    resolved := to_regprocedure(signature);
    IF resolved IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', resolved);
    END IF;
  END LOOP;
END
$rpc$;

COMMIT;

-- ============================================================================
-- Verifikasi setelah menjalankan:
--   npm run check:pii-rls        -- PII/master harus locked
--   npm run check:anon-exposure  -- seluruh tabel harus denied untuk anon
--
-- Uji cepat anon (harus 401/403/"permission denied", bukan data):
--   curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/personel?select=*" \
--     -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" | head
-- ============================================================================
