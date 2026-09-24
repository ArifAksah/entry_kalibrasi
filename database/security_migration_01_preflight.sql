-- Stage 1: read-only production schema preflight.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/security_migration_01_preflight.sql
--
-- This intentionally fails if public contains anything other than the known
-- 52-table production schema. Review and update both migration stages before
-- deploying against a newer schema.

BEGIN TRANSACTION READ ONLY;

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
    RAISE EXCEPTION 'Public table preflight failed. Missing: [%]. Unexpected: [%]. No changes were made.',
      array_to_string(missing_tables, ', '),
      array_to_string(unexpected_tables, ', ');
  END IF;

  RAISE NOTICE 'Preflight passed: all 52 expected public tables and required roles exist.';
END
$preflight$;

COMMIT;
