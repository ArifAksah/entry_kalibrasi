#!/usr/bin/env node
// scripts/apply-security-migration.mjs
//
// Menjalankan tahapan hardening database terhadap target yang ditentukan
// lewat DATABASE_URL (staging atau production). Setiap tahap dijalankan
// sebagai satu transaksi; bila tahap gagal, tidak ada perubahan parsial.
//
// Pemakaian (STAGING):
//   DATABASE_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' \
//     node scripts/apply-security-migration.mjs --stage all
//
// Tahap:
//   preflight  -> database/security_migration_01_preflight.sql (read-only)
//   bootstrap  -> database/staging_bootstrap_missing_tables.sql (staging only)
//   lockdown   -> database/security_migration_02_lockdown.sql
//   all        -> preflight, bootstrap, lockdown (urutan ini)
//
// Catatan: bootstrap hanya untuk staging yang belum punya 11 tabel production.
// Jangan jalankan --stage bootstrap di production.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const STAGES = {
  preflight: ['database/security_migration_01_preflight.sql'],
  bootstrap: ['database/staging_bootstrap_missing_tables.sql'],
  lockdown: ['database/security_migration_02_lockdown.sql'],
  all: [
    'database/security_migration_01_preflight.sql',
    'database/staging_bootstrap_missing_tables.sql',
    'database/security_migration_02_lockdown.sql',
  ],
}

function parseArgs(argv) {
  const idx = argv.indexOf('--stage')
  const stage = idx >= 0 ? argv[idx + 1] : 'all'
  if (!STAGES[stage]) {
    throw new Error(`Tahap tidak dikenal: ${stage}. Pilihan: ${Object.keys(STAGES).join(', ')}`)
  }
  return stage
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL belum diset. Contoh (staging): postgresql://postgres.<ref>:<pw>@<host>:5432/postgres')
  }

  const stage = parseArgs(process.argv.slice(2))
  const files = STAGES[stage]

  const host = (() => {
    try {
      return new URL(databaseUrl).host
    } catch {
      return 'unknown-host'
    }
  })()
  console.log(`Target host : ${host}`)
  console.log(`Tahap       : ${stage}`)
  console.log(`File        : ${files.join(', ')}\n`)

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    for (const rel of files) {
      const sql = readFileSync(join(root, rel), 'utf8')
      process.stdout.write(`-> ${rel} ... `)
      // Jalankan setiap file sebagai transaksi tersendiri.
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('COMMIT')
        console.log('OK')
      } catch (error) {
        await client.query('ROLLBACK')
        console.log('GAGAL (rollback)')
        throw error
      }
    }
  } finally {
    await client.end()
  }

  console.log('\nSemua tahap selesai. Lanjutkan dengan:')
  console.log('  npm run check:anon-exposure   # harus 52 denied, 0 exposed')
}

main().catch((error) => {
  console.error('\nMigration gagal:', error.message)
  process.exit(1)
})
