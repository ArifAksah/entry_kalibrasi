#!/usr/bin/env node
// scripts/check_pii_rls.mjs
//
// Verifies that `database/harden_pii_and_masterdata_rls.sql` is actually
// enforced on your Supabase instance. Hits PostgREST directly with the ANON
// key — no user JWT — and asserts that PII / masterdata tables are not
// readable by an unauthenticated client.
//
// Expected after running the migration:
//   - tabel yang direvoke oleh SQL (personel, user_roles, password_reset_tokens)
//     → HTTP 401/403 (permission denied)
//   - tabel master yang dilindungi RLS (station, station_type,
//     instrument_names, sensor_names, notes) → HTTP 200 + [] (kosong karena
//     policy `TO authenticated` tidak match anon)
//
// Exit code: 1 when any table that should be protected still returns rows.
// Run with: `node scripts/check_pii_rls.mjs` or `npm run check:pii-rls`.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

function loadEnv() {
  const file = join(projectRoot, '.env.local')
  if (!existsSync(file)) throw new Error('.env.local tidak ditemukan di project root')
  const env = {}
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const k = line.slice(0, eq).trim()
    let v = line.slice(eq + 1).trim()
    // strip wrapping matching quotes
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[k] = v
  }
  return env
}

const env = loadEnv()
const BASE = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!BASE || !ANON) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY kosong')

// What the harden_pii_and_masterdata_rls.sql protects.
const PII = new Set(['personel', 'user_roles', 'password_reset_tokens'])
const MASTER = new Set(['station', 'station_type', 'instrument_names', 'notes'])

async function probe(table) {
  const url = `${BASE}/rest/v1/${table}?select=*&limit=2`
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    })
    const body = await res.text()
    const ms = Date.now() - t0
    let rows = null
    try {
      const parsed = JSON.parse(body)
      if (Array.isArray(parsed)) rows = parsed
    } catch {
      /* body bukan JSON, biarkan raw */
    }
    return { table, status: res.status, ms, rows, body }
  } catch (e) {
    return { table, status: 0, ms: Date.now() - t0, error: String(e) }
  }
}

function classify(r) {
  if (r.error) return { tag: 'NETERR', ok: false, note: r.error.slice(0, 80) }
  const { status, rows } = r
  if (status === 401 || status === 403) {
    return { tag: 'REJECTED', ok: true, note: 'grant revoked atau role-based denial' }
  }
  if (status !== 200) return { tag: 'OTHER', ok: false, note: `status ${status}` }
  // PostgREST: 200 + [] berarti RLS memfilter anon (tidak ada policy match).
  if (rows && rows.length === 0) {
    return { tag: 'RLS-DENY', ok: true, note: '0 rows (anon tidak masuk policy)' }
  }
  if (rows && rows.length > 0) {
    return { tag: 'LEAK', ok: false, note: `${rows.length} rows kebocor!` }
  }
  return { tag: 'OTHER', ok: false, note: `body length ${r.body?.length}` }
}

console.log(`Base: ${BASE}\n`)

const tables = [...PII, ...MASTER]
const results = []
for (const t of tables) {
  const r = await probe(t)
  const { tag, ok, note } = classify(r)
  results.push({ table: t, tag, ok, note })
  const kind = PII.has(t) ? 'CRITICAL (PII)' : 'HIGH  (master)'
  const status = (r.status ?? r.error ?? '?').toString().padStart(3)
  console.log(
    `  ${kind.padEnd(15)}  ${status}  ${t.padEnd(22)}  ${tag.padEnd(10)} ${note}`,
  )
}
const bad = results.filter((x) => !x.ok)
console.log(
  `\n=== ${results.length - bad.length}/${results.length} table sudah locked ===`,
)
if (bad.length === 0) {
  console.log('Semua tabel target sudah terkunci. Migration OK.\n')
  process.exit(0)
} else {
  console.log(
    '\nTabel-tabel yang masih bisa dibaca anon:\n  ' +
      bad.map((b) => b.table).join('\n  ') +
      '\n\nJalankan query ini Supabase Studio SQL Editor:\n  @file database/harden_pii_and_masterdata_rls.sql\n\ncurl test lagi setelahnya.',
  )
  process.exit(1)
}
