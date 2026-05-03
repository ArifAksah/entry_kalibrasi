-- ============================================================
-- JALANKAN QUERY INI DI SUPABASE SQL EDITOR PRODUCTION
-- http://172.19.3.171:3000 -> Table Editor -> SQL Editor
-- Hasil: DDL lengkap schema public (copy hasilnya ke production_schema.sql)
-- ============================================================

WITH

-- 1. ENUM TYPES
enum_ddl AS (
  SELECT
    'CREATE TYPE public.' || t.typname || ' AS ENUM (' ||
    string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) ||
    ');' AS ddl,
    0 AS sort_order,
    t.typname AS obj_name
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.typname
),

-- 2. SEQUENCES (standalone)
seq_ddl AS (
  SELECT
    'CREATE SEQUENCE IF NOT EXISTS public.' || s.relname || ';' AS ddl,
    1 AS sort_order,
    s.relname AS obj_name
  FROM pg_class s
  JOIN pg_namespace n ON n.oid = s.relnamespace
  WHERE s.relkind = 'S' AND n.nspname = 'public'
),

-- 3. TABLE CREATE statements
table_ddl AS (
  SELECT
    'CREATE TABLE IF NOT EXISTS public.' || c.relname || ' (' ||
    string_agg(
      '  ' || quote_ident(a.attname) || ' ' ||
      pg_catalog.format_type(a.atttypid, a.atttypmod) ||
      CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
      CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END,
      E',\n' ORDER BY a.attnum
    ) || E'\n);' AS ddl,
    2 AS sort_order,
    c.relname AS obj_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
  WHERE c.relkind = 'r' AND n.nspname = 'public'
  GROUP BY c.relname
),

-- 4. PRIMARY KEYS
pk_ddl AS (
  SELECT
    'ALTER TABLE public.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' PRIMARY KEY (' ||
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) ||
    ');' AS ddl,
    3 AS sort_order,
    tc.table_name AS obj_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
  GROUP BY tc.table_name, tc.constraint_name
),

-- 5. UNIQUE CONSTRAINTS
unique_ddl AS (
  SELECT
    'ALTER TABLE public.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' UNIQUE (' ||
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) ||
    ');' AS ddl,
    4 AS sort_order,
    tc.table_name AS obj_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
  GROUP BY tc.table_name, tc.constraint_name
),

-- 6. INDEXES (excluding PK and UNIQUE)
index_ddl AS (
  SELECT
    pg_get_indexdef(i.indexrelid) || ';' AS ddl,
    5 AS sort_order,
    t.relname AS obj_name
  FROM pg_index i
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_class ix ON ix.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND NOT i.indisprimary
    AND NOT i.indisunique
    AND t.relkind = 'r'
),

-- 7. FOREIGN KEYS
fk_ddl AS (
  SELECT
    'ALTER TABLE public.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' ' || pg_get_constraintdef(pgc.oid) || ';' AS ddl,
    6 AS sort_order,
    tc.table_name AS obj_name
  FROM information_schema.table_constraints tc
  JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
  JOIN pg_namespace pgn ON pgn.oid = pgc.connamespace
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND pgn.nspname = 'public'
),

-- 8. CHECK CONSTRAINTS (excluding NOT NULL auto-checks)
check_ddl AS (
  SELECT
    'ALTER TABLE public.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' ' || pg_get_constraintdef(pgc.oid) || ';' AS ddl,
    7 AS sort_order,
    tc.table_name AS obj_name
  FROM information_schema.table_constraints tc
  JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
  JOIN pg_namespace pgn ON pgn.oid = pgc.connamespace
  WHERE tc.constraint_type = 'CHECK'
    AND tc.table_schema = 'public'
    AND pgn.nspname = 'public'
    AND pg_get_constraintdef(pgc.oid) NOT LIKE 'CHECK (% IS NOT NULL)'
),

-- 9. VIEWS
view_ddl AS (
  SELECT
    'CREATE OR REPLACE VIEW public.' || viewname || ' AS ' || definition AS ddl,
    8 AS sort_order,
    viewname AS obj_name
  FROM pg_views
  WHERE schemaname = 'public'
),

-- 10. RLS POLICIES
rls_enable AS (
  SELECT
    'ALTER TABLE public.' || relname || ' ENABLE ROW LEVEL SECURITY;' AS ddl,
    9 AS sort_order,
    relname AS obj_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relrowsecurity = true AND n.nspname = 'public' AND c.relkind = 'r'
),

policy_ddl AS (
  SELECT
    'CREATE POLICY ' || quote_ident(p.policyname) ||
    ' ON public.' || p.tablename ||
    CASE p.permissive WHEN 'PERMISSIVE' THEN ' AS PERMISSIVE' ELSE ' AS RESTRICTIVE' END ||
    ' FOR ' || p.cmd ||
    ' TO ' || array_to_string(p.roles, ', ') ||
    CASE WHEN p.qual IS NOT NULL THEN E'\n  USING (' || p.qual || ')' ELSE '' END ||
    CASE WHEN p.with_check IS NOT NULL THEN E'\n  WITH CHECK (' || p.with_check || ')' ELSE '' END ||
    ';' AS ddl,
    10 AS sort_order,
    p.tablename AS obj_name
  FROM pg_policies p
  WHERE p.schemaname = 'public'
)

-- COMBINE ALL DDL
SELECT sort_order, obj_name, ddl
FROM (
  SELECT sort_order, obj_name, ddl FROM enum_ddl
  UNION ALL SELECT sort_order, obj_name, ddl FROM seq_ddl
  UNION ALL SELECT sort_order, obj_name, ddl FROM table_ddl
  UNION ALL SELECT sort_order, obj_name, ddl FROM pk_ddl
  UNION ALL SELECT sort_order, obj_name, ddl FROM unique_ddl
  UNION ALL SELECT sort_order, obj_name, ddl FROM index_ddl
  UNION ALL SELECT sort_order, obj_name, ddl FROM fk_ddl
  UNION ALL SELECT sort_order, obj_name, ddl FROM check_ddl
  UNION ALL SELECT sort_order, obj_name, ddl FROM view_ddl
  UNION ALL SELECT sort_order, obj_name, ddl FROM rls_enable
  UNION ALL SELECT sort_order, obj_name, ddl FROM policy_ddl
) combined
ORDER BY sort_order, obj_name;
