-- Stage 2: atomic deny-by-default lockdown for the known production schema.
-- Run Stage 1 first, then:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/security_migration_02_lockdown.sql
--
-- The strict table preflight is repeated inside this transaction so schema
-- drift between stages cannot produce a partial lockdown.

BEGIN;

SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '5min';

-- -------------------------------------------------------------------------
-- 1. Strict schema/role preflight. Any mismatch aborts the entire transaction.
-- -------------------------------------------------------------------------
DO $preflight$
DECLARE
  expected_tables constant text[] := ARRAY[
    'audit_logs',
    'calibration_import',
    'calibration_import_mapping',
    'calibration_import_sheet',
    'calibration_measurement',
    'calibration_reference',
    'calibration_result',
    'calibration_session',
    'certificate',
    'certificate_logs',
    'certificate_standard',
    'certificate_templates',
    'certificate_verification',
    'cmc_profiles',
    'cmc_values',
    'endpoint_catalog',
    'inspection_person',
    'inspection_results',
    'instrument',
    'instrument_cal_result',
    'instrument_names',
    'instrument_sensors',
    'instrument_types',
    'letter',
    'logger_channel_map',
    'logger_discovery',
    'logger_rows',
    'master_qc',
    'notes',
    'notes_instrumen_standard',
    'notifications',
    'password_reset_tokens',
    'personel',
    'qc_files',
    'qc_points',
    'qc_runs',
    'qc_uncertainty_components',
    'qc_windows',
    'raw_data',
    'ref_stations',
    'ref_unit',
    'role_endpoint_permissions',
    'role_permissions',
    'sensor',
    'station',
    'station_type',
    'std_certificates',
    'std_manual_readings',
    'user_roles',
    'user_settings',
    'user_stations',
    'verifikator_cal_result'
  ];
  actual_tables text[];
  missing_tables text[];
  unexpected_tables text[];
  missing_roles text[];
BEGIN
  SELECT coalesce(array_agg(c.relname ORDER BY c.relname), ARRAY[]::text[])
    INTO actual_tables
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p');

  SELECT coalesce(array_agg(t ORDER BY t), ARRAY[]::text[])
    INTO missing_tables
    FROM unnest(expected_tables) AS t
   WHERE NOT (t = ANY(actual_tables));

  SELECT coalesce(array_agg(t ORDER BY t), ARRAY[]::text[])
    INTO unexpected_tables
    FROM unnest(actual_tables) AS t
   WHERE NOT (t = ANY(expected_tables));

  SELECT coalesce(array_agg(r ORDER BY r), ARRAY[]::text[])
    INTO missing_roles
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r
   WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles pr WHERE pr.rolname = r);

  IF cardinality(expected_tables) <> 52 THEN
    RAISE EXCEPTION 'Migration defect: expected 52 tables, list has %', cardinality(expected_tables);
  END IF;

  IF cardinality(missing_roles) > 0 THEN
    RAISE EXCEPTION 'Required Supabase roles are missing: %', array_to_string(missing_roles, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'service_role'
      AND rolbypassrls
  ) THEN
    RAISE EXCEPTION 'service_role must have BYPASSRLS before lockdown can be applied';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_roles owner_role ON owner_role.oid = c.relowner
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
      AND owner_role.rolname IN ('anon', 'authenticated', 'service_role')
  ) THEN
    RAISE EXCEPTION 'Unsafe public object owner found: anon/authenticated/service_role';
  END IF;

  IF cardinality(missing_tables) > 0 OR cardinality(unexpected_tables) > 0 THEN
    RAISE EXCEPTION 'Public table preflight failed. Missing: [%]. Unexpected: [%]. Transaction aborted.',
      array_to_string(missing_tables, ', '),
      array_to_string(unexpected_tables, ', ');
  END IF;
END
$preflight$;

-- -------------------------------------------------------------------------
-- 2. Lock all known tables before changing privileges or policies. Locks are
--    acquired in a stable order and released only by COMMIT/ROLLBACK.
-- -------------------------------------------------------------------------
DO $locks$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
     ORDER BY c.relname
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', table_name);
  END LOOP;
END
$locks$;

-- -------------------------------------------------------------------------
-- 3. Remove all legacy policies, enable RLS everywhere, and reset table ACLs.
--    service_role remains the server-side data plane; browser users get only
--    the explicitly restored reads below.
-- -------------------------------------------------------------------------
DO $tables$
DECLARE
  table_record record;
  policy_record record;
BEGIN
  FOR table_record IN
    SELECT c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
     ORDER BY c.relname
  LOOP
    FOR policy_record IN
      SELECT p.polname
        FROM pg_catalog.pg_policy p
       WHERE p.polrelid = format('public.%I', table_record.relname)::regclass
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_record.polname, table_record.relname);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.relname);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',
      table_record.relname
    );
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', table_record.relname);
  END LOOP;
END
$tables$;

-- Views can otherwise remain an indirect path around table ACL expectations.
DO $views$
DECLARE
  view_record record;
BEGIN
  FOR view_record IN
    SELECT c.relname, c.relkind
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('v', 'm', 'f')
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',
      view_record.relname
    );
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', view_record.relname);
  END LOOP;
END
$views$;

-- -------------------------------------------------------------------------
-- 4. Restore the minimum direct browser/proxy reads found in the repository.
-- -------------------------------------------------------------------------
CREATE POLICY personel_read_own_identity
  ON public.personel
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

GRANT SELECT (id, name) ON TABLE public.personel TO authenticated;

CREATE POLICY user_roles_read_own_role
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT (user_id, role) ON TABLE public.user_roles TO authenticated;

CREATE POLICY ref_stations_read_authenticated
  ON public.ref_stations
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON TABLE public.ref_stations TO authenticated;

-- -------------------------------------------------------------------------
-- 5. Lock schemas and sequences. Browser roles never need sequence access
--    because all direct writes have been removed.
-- -------------------------------------------------------------------------
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- -------------------------------------------------------------------------
-- 6. Functions: remove every implicit API execution path, permanently remove
--    every public.exec overload, then restore only exact server RPC signatures
--    that currently exist. Missing optional signatures are skipped safely.
-- -------------------------------------------------------------------------
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

DO $rpc_grants$
DECLARE
  signature text;
  resolved regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.create_certificate_with_auto_number(jsonb)',
    'public.preview_next_certificate_number(text,text,text,text)',
    'public.hitung_koreksi(double precision,bigint)',
    'public.request_certificate_repair(integer,text)',
    'public.complete_certificate_repair(integer,text)',
    'public.reset_certificate_verification(integer)'
  ]
  LOOP
    resolved := to_regprocedure(signature);
    IF resolved IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', resolved);
    ELSE
      RAISE NOTICE 'Optional application RPC absent, not granted: %', signature;
    END IF;
  END LOOP;

  resolved := to_regprocedure('public.is_system_admin()');
  IF resolved IS NOT NULL THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', resolved);
  END IF;
END
$rpc_grants$;

-- -------------------------------------------------------------------------
-- 7. Defaults owned by the role applying this migration. Future functions are
--    intentionally not granted to service_role; each new RPC must be explicit.
-- -------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

COMMIT;

-- Default privileges are per object-creator role. Repeat the ALTER DEFAULT
-- PRIVILEGES statements with `FOR ROLE <creator>` for every other role that
-- creates public objects in this installation.
