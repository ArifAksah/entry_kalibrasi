#!/usr/bin/env node

// Read-only catalog verification for the effective production security state.
// Unlike the PostgREST probe, this discovers every current public object.

import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('Missing DATABASE_URL for privileged catalog verification.')
  process.exit(3)
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
})

const verificationSql = `
  WITH public_relations AS (
    SELECT c.oid, c.relname, c.relkind, c.relrowsecurity
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  ),
  public_functions AS (
    SELECT p.oid, p.oid::regprocedure::text AS signature
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
  ),
  violations AS (
    SELECT 'catalog' AS object_type, 'public' AS object_name,
           'no public tables were discovered' AS violation
     WHERE NOT EXISTS (
       SELECT 1 FROM public_relations WHERE relkind IN ('r', 'p')
     )
    UNION ALL
    SELECT 'table', relname, 'RLS is disabled'
      FROM public_relations
     WHERE relkind IN ('r', 'p') AND NOT relrowsecurity
    UNION ALL
    SELECT CASE WHEN relkind IN ('r', 'p') THEN 'table' ELSE 'view' END,
           relname, 'anon has table privileges'
      FROM public_relations
     WHERE has_table_privilege(
       'anon', oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     )
    UNION ALL
    SELECT 'function', signature, 'anon has EXECUTE'
      FROM public_functions
     WHERE has_function_privilege('anon', oid, 'EXECUTE')
    UNION ALL
    SELECT 'function', signature, 'authenticated has unexpected EXECUTE'
      FROM public_functions
     WHERE has_function_privilege('authenticated', oid, 'EXECUTE')
       AND oid <> coalesce(to_regprocedure('public.is_system_admin()')::oid, 0::oid)
    UNION ALL
    SELECT 'schema', 'public', role_name || ' has CREATE'
      FROM unnest(ARRAY['anon', 'authenticated']) AS role_name
     WHERE has_schema_privilege(role_name, 'public', 'CREATE')
  )
  SELECT object_type, object_name, violation
    FROM violations
   ORDER BY object_type, object_name, violation
`

try {
  await client.connect()
  await client.query('BEGIN TRANSACTION READ ONLY')

  const counts = await client.query(`
    SELECT
      count(*) FILTER (WHERE c.relkind IN ('r', 'p'))::int AS tables,
      count(*) FILTER (WHERE c.relkind IN ('v', 'm', 'f'))::int AS views
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  `)
  const functions = await client.query(`
    SELECT count(*)::int AS functions
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  `)
  const result = await client.query(verificationSql)
  await client.query('COMMIT')

  for (const row of result.rows) {
    console.error(`VIOLATION ${row.object_type.padEnd(8)} ${row.object_name}: ${row.violation}`)
  }

  const summary = counts.rows[0]
  console.log(
    `Checked ${summary.tables} public table(s), ${summary.views} view(s), ` +
      `${functions.rows[0].functions} function(s): ${result.rowCount} violation(s).`,
  )
  process.exitCode = result.rowCount === 0 ? 0 : 1
} catch (error) {
  console.error(`Catalog verification failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 2
} finally {
  await client.end().catch(() => {})
}
