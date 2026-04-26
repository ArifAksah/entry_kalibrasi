/**
 * ============================================================================
 * BACKFILL — certificate.results  V0 → V1
 * ============================================================================
 *
 * Menjalankan konversi legacy shape array → Certificate Results V1 secara
 * batch dengan mode dry-run terlebih dahulu (REKOMENDASI).
 *
 * ----------------------------------------------------------------------------
 * ⚠️  URUTAN EKSEKUSI WAJIB
 * ----------------------------------------------------------------------------
 *   1. Jalankan database/add_certificate_results_audit_columns.sql  (B1)
 *   2. Jalankan script backfill ini dengan --commit                 (A3)
 *   3. BARU jalankan database/add_certificate_results_freeze_trigger.sql (B2b)
 *
 *   Jika trigger (B2b) sudah aktif SEBELUM backfill, UPDATE pada row
 *   non-draft yang sudah punya results_frozen_at akan diblokir oleh
 *   trigger dan backfill akan gagal untuk row tersebut.
 *
 * ----------------------------------------------------------------------------
 * CARA MENJALANKAN
 * ----------------------------------------------------------------------------
 *
 *   # 1. Dry-run (default) — tidak menulis DB, hanya generate report
 *   npx tsx scripts/backfill-results-v1.ts
 *
 *   # 2. Commit mode — baru jalankan setelah review report
 *   npx tsx scripts/backfill-results-v1.ts --commit
 *
 *   # Opsi tambahan
 *   npx tsx scripts/backfill-results-v1.ts --limit 10       # test 10 row saja
 *   npx tsx scripts/backfill-results-v1.ts --report out.json # custom file
 *
 * ----------------------------------------------------------------------------
 * ENV VARS
 * ----------------------------------------------------------------------------
 *   NEXT_PUBLIC_SUPABASE_URL       (wajib)
 *   SUPABASE_SERVICE_ROLE_KEY      (wajib)
 *   Di-load otomatis dari .env.local atau .env via dotenv.
 *
 * ----------------------------------------------------------------------------
 * YANG DILAKUKAN
 * ----------------------------------------------------------------------------
 *   1. Fetch semua row `certificate` dengan `results IS NOT NULL`.
 *   2. Untuk tiap row:
 *        - Classify: ALREADY_V1 | LEGACY_V0 | BROKEN
 *        - LEGACY_V0 → coba convert ke V1 memakai legacy adapter
 *                      yang sudah ditest (reuse lib/validators/...)
 *        - Commit mode → UPDATE row kalau konversi sukses
 *   3. Tulis laporan JSON yang memuat: ringkasan, detail error per-row.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

import { isResultsV1Shape } from '../lib/validators/certificate-results'
import {
  tryConvertResultsLegacyToV1,
  type CalibrationKind,
} from '../lib/validators/certificate-results-legacy'

// ---------------------------------------------------------------------------
// 1. Env & config
// ---------------------------------------------------------------------------

// Load env — prefer .env.local, fall back ke .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'ERROR: NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY wajib di-set (.env.local atau env shell).'
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 2. CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2)
  const commit = args.includes('--commit')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : undefined
  const reportIdx = args.indexOf('--report')
  const reportPath = reportIdx >= 0 ? args[reportIdx + 1] : 'backfill-results-v1.report.json'
  return { commit, limit, reportPath }
}

const { commit, limit, reportPath } = parseArgs()

// ---------------------------------------------------------------------------
// 3. Types
// ---------------------------------------------------------------------------

type RowClassification = 'already_v1' | 'legacy_converted' | 'legacy_failed' | 'null_skipped'

interface RowReport {
  id: number
  no_certificate: string | null
  calibration_place: CalibrationKind | null
  classification: RowClassification
  /** Hanya terisi jika classification = 'legacy_failed' */
  error?: string
  /** Hanya terisi jika commit=true dan UPDATE gagal */
  commit_error?: string
}

interface Report {
  started_at: string
  finished_at?: string
  mode: 'dry-run' | 'commit'
  limit_used?: number
  totals: {
    total: number
    already_v1: number
    legacy_converted: number
    legacy_failed: number
    null_skipped: number
    commit_updated: number
    commit_errors: number
  }
  rows: RowReport[]
}

// ---------------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------------

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('──────────────────────────────────────────────────────────────')
  console.log(` Backfill certificate.results V0 → V1`)
  console.log(`  mode   : ${commit ? 'COMMIT (akan UPDATE DB!)' : 'dry-run (tidak menulis DB)'}`)
  console.log(`  limit  : ${limit ?? '∞'}`)
  console.log(`  report : ${reportPath}`)
  console.log('──────────────────────────────────────────────────────────────\n')

  // Fetch rows. Hindari filter is_not_null — kolom JSONB null di Supabase
  // butuh match 'is' operator.
  let query = supabase
    .from('certificate')
    .select('id, no_certificate, calibration_place, results')
    .order('id', { ascending: true })

  if (limit) query = query.limit(limit)

  const { data: rows, error } = await query
  if (error) {
    console.error('Fetch error:', error.message)
    process.exit(1)
  }

  if (!rows || rows.length === 0) {
    console.log('Tidak ada row certificate untuk diproses.')
    process.exit(0)
  }

  const report: Report = {
    started_at: new Date().toISOString(),
    mode: commit ? 'commit' : 'dry-run',
    limit_used: limit,
    totals: {
      total: rows.length,
      already_v1: 0,
      legacy_converted: 0,
      legacy_failed: 0,
      null_skipped: 0,
      commit_updated: 0,
      commit_errors: 0,
    },
    rows: [],
  }

  for (const row of rows as Array<{
    id: number
    no_certificate: string | null
    calibration_place: string | null
    results: unknown
  }>) {
    const calibration_place = (row.calibration_place || 'FC').toUpperCase() as CalibrationKind
    const base: Omit<RowReport, 'classification'> = {
      id: row.id,
      no_certificate: row.no_certificate,
      calibration_place: ['FC', 'LC'].includes(calibration_place) ? calibration_place : null,
    }

    // --- null guard -------------------------------------------------------
    if (row.results == null) {
      report.totals.null_skipped += 1
      report.rows.push({ ...base, classification: 'null_skipped' })
      continue
    }

    // --- already V1? skip -------------------------------------------------
    if (isResultsV1Shape(row.results)) {
      report.totals.already_v1 += 1
      report.rows.push({ ...base, classification: 'already_v1' })
      continue
    }

    // --- convert legacy ---------------------------------------------------
    const outcome = tryConvertResultsLegacyToV1(row.results, {
      calibration_kind: calibration_place,
    })

    if (!outcome.ok) {
      report.totals.legacy_failed += 1
      report.rows.push({ ...base, classification: 'legacy_failed', error: outcome.error })
      continue
    }

    report.totals.legacy_converted += 1
    const rowReport: RowReport = { ...base, classification: 'legacy_converted' }

    // --- commit -----------------------------------------------------------
    if (commit) {
      const { error: updErr } = await supabase
        .from('certificate')
        .update({ results: outcome.data })
        .eq('id', row.id)
      if (updErr) {
        report.totals.commit_errors += 1
        rowReport.commit_error = updErr.message
      } else {
        report.totals.commit_updated += 1
      }
    }

    report.rows.push(rowReport)
  }

  report.finished_at = new Date().toISOString()

  // --- Tulis file report --------------------------------------------------
  fs.writeFileSync(path.resolve(process.cwd(), reportPath), JSON.stringify(report, null, 2))

  // --- Ringkasan ke terminal ----------------------------------------------
  console.log('──────────────────────────────────────────────────────────────')
  console.log(' Ringkasan Backfill')
  console.log('──────────────────────────────────────────────────────────────')
  console.log(`  Total row                : ${report.totals.total}`)
  console.log(`    sudah V1 (skip)        : ${report.totals.already_v1}`)
  console.log(`    legacy → converted     : ${report.totals.legacy_converted}`)
  console.log(`    legacy FAILED          : ${report.totals.legacy_failed}`)
  console.log(`    results = null (skip)  : ${report.totals.null_skipped}`)
  if (commit) {
    console.log(`  Commit mode:`)
    console.log(`    DB updated             : ${report.totals.commit_updated}`)
    console.log(`    DB update errors       : ${report.totals.commit_errors}`)
  }
  console.log('──────────────────────────────────────────────────────────────')
  console.log(` Report file → ${reportPath}`)

  if (!commit && report.totals.legacy_converted > 0) {
    console.log('\n  Review report, lalu jalankan ulang dengan --commit untuk menulis ke DB:')
    console.log(`  npx tsx scripts/backfill-results-v1.ts --commit`)
  }

  if (report.totals.legacy_failed > 0) {
    console.log(`\n  ⚠  Ada ${report.totals.legacy_failed} row yang gagal dikonversi.`)
    console.log(`     Detail error per-row ada di ${reportPath}.`)
    console.log(`     Baris ini TIDAK akan di-update meskipun --commit dijalankan.`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Backfill crash:', err)
  process.exit(1)
})
