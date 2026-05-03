
import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const client = new Client({
  host: '172.19.3.171',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '117b4d69200eeb00cb326d4174c2bec3',
  connectionTimeoutMillis: 10000,
});

async function exportSchema() {
  await client.connect();
  console.log('✅ Connected to production database');

  let sql = '';

  // 1. Export ENUM types
  const enums = await client.query(`
    SELECT n.nspname AS schema, t.typname AS name,
      string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY n.nspname, t.typname
    ORDER BY t.typname
  `);
  if (enums.rows.length > 0) {
    sql += '\n-- ENUM TYPES\n';
    for (const row of enums.rows) {
      const vals = row.values.split(', ').map(v => `'${v}'`).join(', ');
      sql += `CREATE TYPE public.${row.name} AS ENUM (${vals});\n`;
    }
  }

  // 2. Export TABLE definitions (with columns, types, defaults, not null)
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  for (const tableRow of tables.rows) {
    const tableName = tableRow.table_name;
    const columns = await client.query(`
      SELECT
        c.column_name,
        c.data_type,
        c.udt_name,
        c.character_maximum_length,
        c.is_nullable,
        c.column_default,
        c.numeric_precision,
        c.numeric_scale
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = $1
      ORDER BY c.ordinal_position
    `, [tableName]);

    sql += `\n-- TABLE: ${tableName}\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;

    const colDefs = [];
    for (const col of columns.rows) {
      let typeDef = '';
      if (col.data_type === 'USER-DEFINED') {
        typeDef = `public.${col.udt_name}`;
      } else if (col.data_type === 'ARRAY') {
        typeDef = `${col.udt_name.replace(/^_/, '')}[]`;
      } else if (col.data_type === 'character varying') {
        typeDef = col.character_maximum_length
          ? `varchar(${col.character_maximum_length})`
          : 'text';
      } else if (col.data_type === 'numeric') {
        typeDef = (col.numeric_precision && col.numeric_scale)
          ? `numeric(${col.numeric_precision},${col.numeric_scale})`
          : 'numeric';
      } else {
        typeDef = col.data_type;
      }

      let colDef = `  ${col.column_name} ${typeDef}`;
      if (col.column_default !== null) {
        colDef += ` DEFAULT ${col.column_default}`;
      }
      if (col.is_nullable === 'NO') {
        colDef += ' NOT NULL';
      }
      colDefs.push(colDef);
    }

    // Primary keys
    const pks = await client.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
      ORDER BY kcu.ordinal_position
    `, [tableName]);

    if (pks.rows.length > 0) {
      const pkCols = pks.rows.map(r => r.column_name).join(', ');
      colDefs.push(`  PRIMARY KEY (${pkCols})`);
    }

    sql += colDefs.join(',\n');
    sql += '\n);\n';

    // Indexes (non-primary)
    const indexes = await client.query(`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = $1
        AND indexname NOT IN (
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = $1
            AND constraint_type = 'PRIMARY KEY'
        )
    `, [tableName]);

    for (const idx of indexes.rows) {
      sql += `${idx.indexdef};\n`;
    }
  }

  // 3. Foreign keys
  const fks = await client.query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `);

  if (fks.rows.length > 0) {
    sql += '\n-- FOREIGN KEYS\n';
    for (const fk of fks.rows) {
      sql += `ALTER TABLE public.${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} `;
      sql += `FOREIGN KEY (${fk.column_name}) REFERENCES public.${fk.foreign_table_name}(${fk.foreign_column_name})`;
      if (fk.update_rule && fk.update_rule !== 'NO ACTION') sql += ` ON UPDATE ${fk.update_rule}`;
      if (fk.delete_rule && fk.delete_rule !== 'NO ACTION') sql += ` ON DELETE ${fk.delete_rule}`;
      sql += ';\n';
    }
  }

  // 4. Check Constraints
  const checks = await client.query(`
    SELECT tc.table_name, tc.constraint_name, cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.constraint_type = 'CHECK'
      AND tc.table_schema = 'public'
      AND cc.check_clause NOT LIKE '% IS NOT NULL'
    ORDER BY tc.table_name, tc.constraint_name
  `);

  if (checks.rows.length > 0) {
    sql += '\n-- CHECK CONSTRAINTS\n';
    for (const c of checks.rows) {
      sql += `ALTER TABLE public.${c.table_name} ADD CONSTRAINT ${c.constraint_name} CHECK (${c.check_clause});\n`;
    }
  }

  // 5. Unique Constraints
  const uniques = await client.query(`
    SELECT tc.table_name, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
  `);

  if (uniques.rows.length > 0) {
    sql += '\n-- UNIQUE CONSTRAINTS\n';
    const grouped = {};
    for (const u of uniques.rows) {
      const key = `${u.table_name}__${u.constraint_name}`;
      if (!grouped[key]) grouped[key] = { table: u.table_name, name: u.constraint_name, cols: [] };
      grouped[key].cols.push(u.column_name);
    }
    for (const u of Object.values(grouped)) {
      sql += `ALTER TABLE public.${u.table} ADD CONSTRAINT ${u.name} UNIQUE (${u.cols.join(', ')});\n`;
    }
  }

  await client.end();

  const header = `-- ============================================
-- PRODUCTION SCHEMA EXPORT
-- Generated: ${new Date().toISOString()}
-- Source: postgresql://postgres@172.19.3.171:5432/postgres
-- ============================================\n`;

  const output = header + sql;
  fs.writeFileSync('production_schema.sql', output, 'utf-8');
  console.log('✅ Schema exported to production_schema.sql');
  console.log(`   Tables: ${tables.rows.length}`);
  console.log(`   Enum types: ${enums.rows.length}`);
  console.log(`   Foreign keys: ${fks.rows.length}`);
}

exportSchema().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
