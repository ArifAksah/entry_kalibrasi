-- ============================================================================
-- SIMKAL — Remediasi anon exposure (V3) via Supabase SQL Editor
-- ============================================================================
--
-- CARA PAKAI:
--   1. Buka Supabase Studio -> SQL Editor -> New query.
--   2. Tempelkan SELURUH isi file ini.
--   3. Klik Run SEKALI. Tidak perlu memilih baris.
--
-- File ini adalah gabungan logika security_migration_03 + 04 yang bersifat
-- DINAMIS (melompati semua tabel publik yang ada) dan IDEMPOTENT, jadi aman
-- dijalankan berulang dan cocok untuk skema produksi apa pun.
--
-- File ini SENGAJA tidak memakai BEGIN/COMMIT agar tidak bentrok dengan
-- transaksi yang mungkin dibungkus otomatis oleh SQL Editor.
--
-- Hasil yang diharapkan:
--   - Semua tabel public: RLS aktif, anon tidak punya akses.
--   - authenticated: hanya SELECT pada personel(id,name), user_roles(user_id,role),
--     dan ref_stations. Semua mutasi lewat service_role (route API).
--   - RPC aplikasi hanya untuk service_role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper admin (tanpa rekursi RLS). anon TIDAK boleh mengeksekusi.
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
-- 1. Default-deny semua tabel public + cabut seluruh akses anon.
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
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon', table_record.relname);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_record.relname);
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', table_record.relname);
  END LOOP;
END
$tables$;

-- ---------------------------------------------------------------------------
-- 2. View: security_invoker (PostgreSQL 15+) + cabut akses browser.
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
-- 3. personel (PII): user hanya baris sendiri; kolom dibatasi id+name.
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

-- ---------------------------------------------------------------------------
-- 4. user_roles: user hanya role sendiri; admin semua.
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

-- ---------------------------------------------------------------------------
-- 5. Satu-satunya master-data yang dibaca browser langsung: ref_stations.
--    (ref_stations sudah ada di skema produksi.)
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
-- 6. Tabel khusus: tidak ada policy untuk authenticated/anon -> default deny.
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

-- ---------------------------------------------------------------------------
-- 7. Schema & sequence lockdown.
-- ---------------------------------------------------------------------------
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Fungsi: hapus semua jalur eksekusi implisit.
-- ---------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

DO $drop_exec$
DECLARE
  function_signature regprocedure;
BEGIN
  FOR function_signature IN
    SELECT p.oid::regprocedure
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'exec'
  LOOP
    EXECUTE format('DROP FUNCTION %s', function_signature);
  END LOOP;
END
$drop_exec$;

-- ---------------------------------------------------------------------------
-- 9. Grant ulang: is_system_admin untuk authenticated; RPC aplikasi untuk
--    service_role saja.
-- ---------------------------------------------------------------------------
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
    'public.convert_unit_absolute(double precision,text,text)',
    'public.is_system_admin()'
  ]
  LOOP
    resolved := to_regprocedure(signature);
    IF resolved IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', resolved);
    ELSE
      RAISE NOTICE 'RPC tidak ada, dilewati: %', signature;
    END IF;
  END LOOP;
END
$rpc$;

-- ---------------------------------------------------------------------------
-- 10. Grant baca minimum untuk authenticated (dikembalikan SETELAH revoke).
-- ---------------------------------------------------------------------------
GRANT SELECT (id, name) ON TABLE public.personel TO authenticated;
GRANT SELECT (user_id, role) ON TABLE public.user_roles TO authenticated;
GRANT SELECT ON TABLE public.ref_stations TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. Cegah objek baru otomatis terbuka.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

-- ============================================================================
-- VERIFIKASI (jalankan setelah di atas sukses)
-- ----------------------------------------------------------------------------
-- A. Tabel yang masih punya grant anon (harus KOSONG):
--
-- SELECT table_schema, table_name, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE grantee = 'anon'
--  ORDER BY table_schema, table_name, privilege_type;
--
-- B. RLS aktif di semua tabel public:
--
-- SELECT relname, relrowsecurity
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
--  ORDER BY relname;
--
-- C. Fungsi yang masih bisa dieksekusi authenticated/anon
--    (hanya is_system_admin yang boleh muncul untuk authenticated):
--
-- SELECT p.proname,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
--         OR has_function_privilege('anon', p.oid, 'EXECUTE'))
--  ORDER BY p.proname;
--
-- D. Uji HTTP anon (dari server, harus 401/403, BUKAN data):
--
-- curl -s -o /dev/null -w '%{http_code}\n' \
--   "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/ref_stations?select=*&limit=1" \
--   -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
-- ============================================================================
