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

// Jalankan satu batch SQL lewat Supabase Management API.
// Dipakai bila DATABASE_URL tidak tersedia tetapi SUPABASE_ACCESS_TOKEN ada.
async function runViaManagementApi(projectRef, token, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Management API HTTP ${res.status}: ${text.slice(0, 500)}`)
  }
  return text
}

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

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).host // <ref>.supabase.co
    const ref = host.split('.')[0]
    return /^[a-z0-9]{20}$/.test(ref) ? ref : null
  } catch {
    return null
  }
}

async function main() {
  const stage = parseArgs(process.argv.slice(2))
  const files = STAGES[stage]

  const databaseUrl = process.env.DATABASE_URL
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  const projectUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const projectRef =
    process.env.SUPABASE_PROJECT_REF || projectRefFromUrl(projectUrl)

  const mode = databaseUrl
    ? 'direct-db'
    : accessToken && projectRef
      ? 'management-api'
      : null

  if (!mode) {
    throw new Error(
      'Butuh salah satu: DATABASE_URL, atau SUPABASE_ACCESS_TOKEN + project ref ' +
        '(SUPABASE_PROJECT_REF / NEXT_PUBLIC_SUPABASE_URL).',
    )
  }

  const targetLabel =
    mode === 'direct-db'
      ? (() => {
          try {
            return new URL(databaseUrl).host
          } catch {
            return 'unknown-host'
          }
        })()
      : `project:${projectRef} (Management API)`

  console.log(`Mode        : ${mode}`)
  console.log(`Target      : ${targetLabel}`)
  console.log(`Tahap       : ${stage}`)
  console.log(`File        : ${files.join(', ')}\n`)

  let client = null
  if (mode === 'direct-db') {
    client = new pg.Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
  }

  try {
    for (const rel of files) {
      const sql = readFileSync(join(root, rel), 'utf8')
      process.stdout.write(`-> ${rel} ... `)
      try {
        if (client) {
          // File mengelola transaksinya sendiri (BEGIN/COMMIT di dalam file).
          await client.query(sql)
        } else {
          await runViaManagementApi(projectRef, accessToken, sql)
        }
        console.log('OK')
      } catch (error) {
        console.log('GAGAL (rollback)')
        throw error
      }
    }
  } finally {
    if (client) await client.end()
  }

  console.log('\nSemua tahap selesai. Lanjutkan dengan:')
  console.log('  npm run check:anon-exposure   # harus 52 denied, 0 exposed')
}

main().catch((error) => {
  console.error('\nMigration gagal:', error.message)
  process.exit(1)
})
