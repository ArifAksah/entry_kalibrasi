#!/usr/bin/env node
/**
 * Backfill uut_correction untuk raw_data lama yang dihitung sebelum trigger
 * unit-aware terpasang.
 *
 * Kenapa perlu: menjalankan DDL trigger tidak menghitung ulang baris lama.
 * Meng-UPDATE satu kolom pada baris akan memicu trigger
 * `trg_calculate_calibration` dan menghitung ulang std_correction,
 * std_corrected, dan uut_correction dengan benar.
 *
 * Pemakaian:
 *   node scripts/backfill-raw-data-corrections.mjs             # dry-run
 *   node scripts/backfill-raw-data-corrections.mjs --apply     # eksekusi
 *   node scripts/backfill-raw-data-corrections.mjs --apply --limit 5000
 *   node scripts/backfill-raw-data-corrections.mjs --session <uuid>
 *
 * Strategi: set ulang kolom `unit_uut` dengan nilainya sendiri. Kolom itu
 * termasuk daftar `UPDATE OF` pada trigger, sehingga trigger terpicu dan
 * menghitung ulang tanpa mengubah nilai.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

function loadEnvLocal() {
  const text = readFileSync(join(root, '.env.local'), 'utf8')
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const env = loadEnvLocal()
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const limitIndex = args.indexOf('--limit')
const LIMIT = limitIndex >= 0 ? Number(args[limitIndex + 1]) : null
const sessionIndex = args.indexOf('--session')
const SESSION = sessionIndex >= 0 ? args[sessionIndex + 1] : null
const fromIndex = args.indexOf('--from')
const FROM_OFFSET = fromIndex >= 0 ? Number(args[fromIndex + 1]) : 0

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Supabase REST kadang memutus koneksi pada dataset besar; retry bertahap.
async function fetchPage(buildQuery, offset) {
  let lastError
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const { data, error } = await buildQuery(offset)
      if (error) throw new Error(error.message)
      return data || []
    } catch (e) {
      lastError = e
      console.warn(`  retry halaman offset=${offset} (${attempt}/5): ${e.message}`)
      await sleep(attempt * 500)
    }
  }
  throw lastError
}

const PAGE = 500

// Faktor delta (tanpa offset) mengikuti lib/unitConversion.ts.
function deltaFactor(fromUnit, toUnit) {
  const from = String(fromUnit || '').toLowerCase().replace(/\s+/g, '')
  const to = String(toUnit || '').toLowerCase().replace(/\s+/g, '')
  if (!from || !to || from === to) return 1
  if (from === 'hpa' && to === 'inhg') return 0.029529983071445
  if (from === 'hpa' && to === 'mmhg') return 0.750062
  if (from === 'hpa' && to === 'bar') return 0.001
  if (from === 'mbar' && to === 'inhg') return 0.029529983071445
  if (from === 'm/s' && (to === 'knot' || to === 'kt')) return 1.9438444924406
  if (from === 'm/s' && to === 'fpm') return 196.850393700787
  if (from === 'inhg' && to === 'hpa') return 1 / 0.029529983071445
  if ((from === 'knot' || from === 'kt') && to === 'm/s') return 1 / 1.9438444924406
  return 1
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  if (SESSION) console.log(`Session filter: ${SESSION}`)
  if (LIMIT) console.log(`Limit: ${LIMIT}`)

  let lastId = FROM_OFFSET
  let scanned = 0
  let stale = 0
  let updated = 0
  let failed = 0

  for (;;) {
    const data = await fetchPage(
      (afterId) => {
        let query = supabase
          .from('raw_data')
          .select('id, unit_std, unit_uut, sheet_name, std_corrected, uut_data, uut_correction')
          .gt('id', afterId)
          .order('id', { ascending: true })
          .limit(PAGE)

        if (SESSION) query = query.eq('session_id', SESSION)
        return query
      },
      lastId,
    )
    if (!data || data.length === 0) break

    for (const row of data) {
      scanned++
      if (LIMIT && stale >= LIMIT) {
        console.log('\nLimit tercapai, berhenti.')
        printSummary(scanned, stale, updated, failed)
        return
      }

      if (
        row.std_corrected === null ||
        row.std_corrected === undefined ||
        row.uut_data === null ||
        row.uut_data === undefined
      ) {
        continue
      }

      const factor = deltaFactor(row.unit_std, row.unit_uut)
      const expected = Number(row.std_corrected) * factor - Number(row.uut_data)
      const stored = row.uut_correction === null ? null : Number(row.uut_correction)

      const isStale =
        stored === null ||
        !Number.isFinite(stored) ||
        Math.abs(stored - expected) > 1e-9

      if (!isStale) continue

      stale++
      if (!APPLY) continue

      // Set ulang unit_uut dengan nilai yang sama agar trigger terpicu.
      const { error: updateError } = await supabase
        .from('raw_data')
        .update({ unit_uut: row.unit_uut })
        .eq('id', row.id)

      if (updateError) {
        failed++
        console.error(`  gagal id=${row.id}: ${updateError.message}`)
      } else {
        updated++
      }
    }

    lastId = data[data.length - 1].id
    console.log(
      `  lastId=${lastId}: scanned=${scanned}, stale=${stale}, updated=${updated}, failed=${failed}`,
    )

    if (data.length < PAGE) break
  }

  printSummary(scanned, stale, updated, failed)
  if (!APPLY) {
    console.log('\nDry-run selesai. Jalankan dengan --apply untuk eksekusi.')
  }
}

function printSummary(scanned, stale, updated, failed) {
  console.log('\n=== Ringkasan ===')
  console.log(`Baris dipindai        : ${scanned}`)
  console.log(`Baris usang (stale)   : ${stale}`)
  console.log(`${APPLY ? 'Baris di-update' : 'Akan di-update'}: ${APPLY ? updated : stale}`)
  console.log(`Gagal                 : ${failed}`)
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
