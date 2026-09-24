#!/usr/bin/env node

// Read-only PostgREST verification for the 52-table production schema.
// Exit 0: all tables reject anon; 1: anon exposure; 2: network failure;
// exit 3: unexpected HTTP/API response made the result inconclusive.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXPECTED_TABLES = [
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
  'verifikator_cal_result',
]

function parseEnvFile(file) {
  if (!existsSync(file)) return {}

  const values = {}
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator < 1) continue

    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

const here = dirname(fileURLToPath(import.meta.url))
const fileEnv = {
  ...parseEnvFile(join(here, '..', '.env')),
  ...parseEnvFile(join(here, '..', '.env.local')),
}
const env = { ...fileEnv, ...process.env }
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_PUBLIC_URL || env.API_EXTERNAL_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.ANON_KEY
const timeoutMs = Number(env.ANON_VERIFY_TIMEOUT_MS || 10_000)

if (!baseUrl || !anonKey) {
  console.error('Missing Supabase URL or anon key environment variables.')
  process.exit(3)
}

if (EXPECTED_TABLES.length !== 52) {
  console.error(`Verifier defect: expected 52 table names, found ${EXPECTED_TABLES.length}.`)
  process.exit(3)
}

async function probe(table) {
  const url = new URL(
    `${baseUrl.replace(/\/$/, '')}/rest/v1/${encodeURIComponent(table)}`,
  )
  url.searchParams.set('select', '*')
  url.searchParams.set('limit', '1')

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (response.status === 401 || response.status === 403) {
      return { table, kind: 'denied', status: response.status }
    }

    if (response.status === 200) {
      let rowCount = null
      try {
        const body = await response.json()
        rowCount = Array.isArray(body) ? body.length : null
      } catch {
        // A successful non-array response is still an exposed endpoint.
      }
      return { table, kind: 'leak', status: response.status, rowCount }
    }

    await response.body?.cancel()
    return { table, kind: 'inconclusive', status: response.status }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return { table, kind: 'network', detail }
  }
}

const results = await Promise.all(EXPECTED_TABLES.map(probe))

for (const result of results) {
  if (result.kind === 'denied') {
    console.log(`DENIED       ${String(result.status).padEnd(4)} ${result.table}`)
  } else if (result.kind === 'leak') {
    const detail = result.rowCount === null ? 'successful endpoint' : `${result.rowCount} row(s) returned`
    console.error(`EXPOSED      ${result.status}  ${result.table} (${detail})`)
  } else if (result.kind === 'network') {
    console.error(`NETWORK      ---- ${result.table} (${result.detail})`)
  } else {
    console.error(`INCONCLUSIVE ${String(result.status).padEnd(4)} ${result.table}`)
  }
}

const leaks = results.filter((result) => result.kind === 'leak')
const networkErrors = results.filter((result) => result.kind === 'network')
const inconclusive = results.filter((result) => result.kind === 'inconclusive')
const denied = results.filter((result) => result.kind === 'denied')

console.log(
  `\nSummary: ${denied.length} denied, ${leaks.length} exposed, ` +
    `${networkErrors.length} network error(s), ${inconclusive.length} inconclusive.`,
)

if (leaks.length > 0) process.exit(1)
if (networkErrors.length > 0) process.exit(2)
if (inconclusive.length > 0) process.exit(3)
process.exit(0)
