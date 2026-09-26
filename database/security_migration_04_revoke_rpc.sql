-- ============================================================================
-- Security migration 04 — cabut EXECUTE RPC dari anon & authenticated
-- ============================================================================
--
-- Temuan: setelah migrasi 03, tabel sudah default-deny untuk anon, tetapi
-- `authenticated` masih memegang EXECUTE pada RPC aplikasi — termasuk dua yang
-- SECURITY DEFINER sehingga melewati RLS:
--
--   public.create_certificate_with_auto_number(jsonb)  SECURITY DEFINER
--   public.preview_next_certificate_number(text,text,text,text) SECURITY DEFINER
--
-- Akibatnya user login biasa bisa memanggil:
--   POST /rest/v1/rpc/create_certificate_with_auto_number
-- langsung ke PostgREST dan menulis certificate, melewati pemeriksaan role
-- aplikasi (Broken Function Level Authorization / C1).
--
-- Prinsip:
--   1. Cabut EXECUTE dari PUBLIC, anon, dan authenticated untuk SEMUA fungsi
--      di schema public.
--   2. Kembalikan HANYA public.is_system_admin() ke authenticated (dipakai
--      policy RLS; SECURITY DEFINER, search_path tetap) dan service_role.
--   3. Grant ulang seluruh RPC aplikasi hanya ke service_role.
--
-- Aman karena semua pemanggilan RPC aplikasi berjalan server-side lewat
-- supabaseAdmin (service_role). Tidak ada `.rpc()` dari browser.
--
-- Jalankan di Supabase SQL Editor. Idempotent.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Tutup seluruh tabel public (termasuk yang dibuat SETELAH migrasi 03,
--    mis. certificate_templates). RLS + default-deny untuk anon/authenticated.
--    Grant baca minimum dikembalikan di langkah 5 di bawah.
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
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_record.relname);
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', table_record.relname);
  END LOOP;
END
$tables$;

-- View: security_invoker + cabut dari browser (defensif).
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
      RAISE NOTICE 'security_invoker dilewati untuk %: %', view_record.relname, SQLERRM;
    END;
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', view_record.relname);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', view_record.relname);
  END LOOP;
END
$views$;

-- ---------------------------------------------------------------------------
-- 1. Cabut semua jalur eksekusi dari publik dan role browser.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bantuan yang wajib bisa dieksekusi authenticated: hanya is_system_admin
--    (pengganti aman untuk subquery user_roles di dalam policy).
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. RPC aplikasi: service_role saja.
-- ---------------------------------------------------------------------------
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
-- 4. Kembalikan grant baca minimum untuk authenticated (sama seperti migrasi 03)
--    karena langkah 0 mencabut semuanya terlebih dahulu.
-- ---------------------------------------------------------------------------
GRANT SELECT (id, name) ON TABLE public.personel TO authenticated;
GRANT SELECT (user_id, role) ON TABLE public.user_roles TO authenticated;
GRANT SELECT ON TABLE public.ref_stations TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Cegah objek baru otomatis terbuka.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

COMMIT;

-- ============================================================================
-- Verifikasi: hanya is_system_admin yang boleh tampil untuk authenticated/anon.
--
-- SELECT p.proname,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
--         OR has_function_privilege('anon', p.oid, 'EXECUTE'));
--
-- Uji negatif (harus 401 permission denied for function):
--   curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/create_certificate_with_auto_number" \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--     -H "Content-Type: application/json" -d '{"p_data":{}}'
-- ============================================================================
