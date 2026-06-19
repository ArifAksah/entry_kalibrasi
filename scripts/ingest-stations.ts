/**
 * Ingest stasiun (UPT BMKG) dari file Excel ke tabel `station` di Supabase.
 *
 * Mendukung backup + rollback (reverse) supaya migrasi aman.
 *
 * ----------------------------------------------------------------------------
 * PEMAKAIAN:
 *   npx tsx scripts/ingest-stations.ts <command> [options]
 *
 * COMMANDS:
 *   inspect                 Tampilkan baris hasil parse dari Excel (tanpa DB).
 *   backup                  Simpan isi tabel station saat ini ke file backup JSON.
 *   ingest                  Insert stasiun baru dari Excel.
 *       --purge             Hapus SEMUA stasiun lama dulu (otomatis backup dulu).
 *       --dry-run           Hanya preview, tidak menulis ke DB.
 *       --file <path>       Path Excel (default: tabular_upt_bmkg.xlsx).
 *       --created-by <uuid> Isi kolom created_by (default: null).
 *   rollback --from <file>  Pulihkan tabel station persis seperti isi file backup.
 *
 * CONTOH:
 *   npx tsx scripts/ingest-stations.ts inspect
 *   npx tsx scripts/ingest-stations.ts backup
 *   npx tsx scripts/ingest-stations.ts ingest --dry-run
 *   npx tsx scripts/ingest-stations.ts ingest --purge
 *   npx tsx scripts/ingest-stations.ts rollback --from backups/stations-2026xxxx.json
 *
 * ----------------------------------------------------------------------------
 * PERINGATAN (destruktif):
 *   Tabel `station` direferensikan oleh banyak tabel lain (certificate.station,
 *   instrument.station_id, user_stations.station_id, letter.owner,
 *   personel.station_user, qc_runs.station_id). Foreign key biasa (tanpa
 *   ON DELETE CASCADE) akan MEMBLOKIR penghapusan stasiun yang masih dipakai.
 *   `--purge` akan otomatis membuat backup lebih dulu; gunakan `rollback` untuk
 *   mengembalikan keadaan semula bila ada masalah.
 * ----------------------------------------------------------------------------
 */

import { config as loadEnv } from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
// xlsx 0.18 adalah CommonJS — pakai require interop
import XLSX = require('xlsx')

// ---------------------------------------------------------------------------
// Env & client
// ---------------------------------------------------------------------------
function loadEnvironment() {
  loadEnv({ path: '.env' })
  loadEnv({ path: '.env.local', override: true })
}

function getClient(): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_PUBLIC_URL ||
    process.env.API_EXTERNAL_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL (atau fallback) di environment.')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (atau SUPABASE_SERVICE_KEY) di environment.')

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Tipe & parsing Excel
// ---------------------------------------------------------------------------
type StationInsert = {
  name: string
  address: string | null
  region: string | null
  type_id: number | null
  // Kolom berikut tidak ada di Excel; biarkan null agar konsisten dgn schema.
  station_id: string | null
  latitude: number | null
  longitude: number | null
  elevation: number | null
  time_zone: string | null
  province: string | null
  regency: string | null
  created_by: string | null
}

const SHEET_NAME = 'Data UPT BMKG'

/**
 * Normalisasi nama stasiun: ganti singkatan menjadi bentuk lengkap.
 *   "Sta."  -> "Stasiun"
 *   "Geof." -> "Geofisika"
 *   "Klim." -> "Klimatologi"
 *   "Met."  -> "Meteorologi"
 * Memakai word-boundary sehingga kata yang sudah lengkap (mis. "Meteorologi",
 * "Geofisika" pada nama "Balai Besar ...") TIDAK ikut terganti.
 */
function normalizeStationName(raw: string): string {
  let n = String(raw)
  n = n.replace(/\bSta\b\.?/g, 'Stasiun')
  // Bersihkan sisa titik bila sumber memakai "Stasiun." (mis. "Stasiun. Geof.")
  n = n.replace(/\bStasiun\b\./g, 'Stasiun')
  n = n.replace(/\bGeof\b\.?/g, 'Geofisika')
  n = n.replace(/\bKlim\b\.?/g, 'Klimatologi')
  n = n.replace(/\bMet\b\.?/g, 'Meteorologi')
  return n.replace(/\s+/g, ' ').trim()
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text === '' ? null : text
}

/**
 * Tentukan jenis (type) stasiun dari kata kunci pada nama UPT.
 * Kata kunci: "Geof" -> Geofisika, "Klim" -> Klimatologi, "Met" -> Meteorologi.
 * "Balai Besar" memuat ketiganya & tidak punya padanan di tabel station_type,
 * sehingga dikembalikan null (type_id dibiarkan kosong). Begitu juga nama tanpa
 * kata kunci (mis. Stasiun Pemantau Atmosfer Global).
 */
function deriveStationTypeName(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.includes('balai besar')) return null
  if (lower.includes('geof')) return 'Geofisika'
  if (lower.includes('klim')) return 'Klimatologi'
  if (lower.includes('met')) return 'Meteorologi'
  return null
}

/** Ambil peta nama jenis (lowercase) -> id dari tabel station_type. */
async function getStationTypeMap(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('station_type').select('id, name')
  if (error) throw new Error(`Gagal membaca station_type: ${error.message}`)
  const map = new Map<string, number>()
  for (const row of data || []) {
    if (row?.name != null) map.set(String(row.name).toLowerCase(), Number(row.id))
  }
  return map
}

/** Resolusi nama stasiun -> type_id memakai peta station_type. */
function resolveTypeId(name: string, typeMap: Map<string, number>): number | null {
  const typeName = deriveStationTypeName(name)
  if (!typeName) return null
  return typeMap.get(typeName.toLowerCase()) ?? null
}

function parseStationsFromExcel(filePath: string, createdBy: string | null): StationInsert[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File Excel tidak ditemukan: ${filePath}`)
  }

  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan.`)

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

  const stations: StationInsert[] = []
  for (const row of rows) {
    const rawName = clean(row['UPT'])
    if (!rawName) continue // baris kosong / tanpa nama UPT dilewati
    const name = normalizeStationName(rawName)

    stations.push({
      name,
      address: clean(row['Alamat']),
      region: clean(row['Wilayah']),
      type_id: null,
      station_id: null,
      latitude: null,
      longitude: null,
      elevation: null,
      time_zone: null,
      province: null,
      regency: null,
      type_id: null,
      created_by: createdBy,
    })
  }

  return stations
}

// ---------------------------------------------------------------------------
// Util backup
// ---------------------------------------------------------------------------
const BACKUP_DIR = 'backups'

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function fetchAllStations(supabase: SupabaseClient): Promise<any[]> {
  const all: any[] = []
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('station')
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`Gagal membaca tabel station: ${error.message}`)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

async function writeBackup(supabase: SupabaseClient): Promise<string> {
  const rows = await fetchAllStations(supabase)
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const file = path.join(BACKUP_DIR, `stations-${timestamp()}.json`)
  fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8')
  console.log(`✔ Backup ${rows.length} stasiun -> ${file}`)
  return file
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function cmdInspect(filePath: string) {
  const stations = parseStationsFromExcel(filePath, null)
  console.log(`Parsed ${stations.length} stasiun dari ${filePath}\n`)
  stations.slice(0, 10).forEach((s, i) =>
    console.log(`${i + 1}. ${s.name}  [${s.region ?? '-'}]\n     ${s.address ?? '-'}`),
  )
  if (stations.length > 10) console.log(`... dan ${stations.length - 10} lainnya`)
  console.log('\nCatatan: kolom Kontak/Email/Kepala tidak dimigrasi (tidak ada kolom tujuan di tabel station).')
}

async function cmdBackup() {
  const supabase = getClient()
  await writeBackup(supabase)
}

/**
 * Backup tautan referensi (yang akan dilepas/cascade) ke file JSON untuk audit
 * & pemulihan manual. Mencakup instrument.station_id, certificate.station,
 * dan seluruh baris user_stations.
 */
async function backupReferences(supabase: SupabaseClient): Promise<string> {
  const fetchAll = async (table: string, cols: string) => {
    const out: any[] = []
    let from = 0
    for (;;) {
      const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
      if (error) throw new Error(`Gagal membaca ${table}: ${error.message}`)
      if (!data || data.length === 0) break
      out.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
    return out
  }

  const payload = {
    created_at: new Date().toISOString(),
    instrument: (await fetchAll('instrument', 'id,station_id')).filter((r) => r.station_id != null),
    certificate: (await fetchAll('certificate', 'id,station')).filter((r) => r.station != null),
    user_stations: await fetchAll('user_stations', '*'),
  }

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const file = path.join(BACKUP_DIR, `station-references-${timestamp()}.json`)
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8')
  console.log(
    `✔ Backup tautan referensi -> ${file} ` +
      `(instrument: ${payload.instrument.length}, certificate: ${payload.certificate.length}, user_stations: ${payload.user_stations.length})`,
  )
  return file
}

/**
 * Lepas (NULL-kan) referensi station di instrument & certificate supaya
 * penghapusan station tidak diblokir FK. user_stations dibiarkan — akan
 * ter-cascade otomatis saat station dihapus.
 */
async function detachBlockingReferences(supabase: SupabaseClient) {
  const r1 = await supabase.from('instrument').update({ station_id: null }).not('station_id', 'is', null)
  if (r1.error) throw new Error(`Gagal melepas instrument.station_id: ${r1.error.message}`)
  console.log('  ✔ instrument.station_id di-NULL-kan.')

  const r2 = await supabase.from('certificate').update({ station: null }).not('station', 'is', null)
  if (r2.error) throw new Error(`Gagal melepas certificate.station: ${r2.error.message}`)
  console.log('  ✔ certificate.station di-NULL-kan (station_address teks tetap utuh).')
}

async function purgeAllStations(supabase: SupabaseClient, force: boolean) {
  const existing = await fetchAllStations(supabase)
  if (existing.length === 0) {
    console.log('Tidak ada stasiun lama untuk dihapus.')
    return
  }

  if (force) {
    console.log('Melepas referensi yang memblokir (instrument & certificate)...')
    await detachBlockingReferences(supabase)
  }

  console.log(`Menghapus ${existing.length} stasiun lama...`)
  const { error } = await supabase.from('station').delete().neq('id', -1) // hapus semua
  if (error) {
    throw new Error(
      `Gagal menghapus stasiun lama: ${error.message}\n` +
        'Masih ada stasiun yang direferensikan. Jalankan dengan --force untuk melepas tautan ' +
        'instrument/certificate lebih dulu (user_stations akan ter-cascade otomatis).',
    )
  }
  console.log('✔ Semua stasiun lama dihapus.')
}

async function insertStations(supabase: SupabaseClient, stations: StationInsert[]) {
  const chunkSize = 100
  let inserted = 0
  for (let i = 0; i < stations.length; i += chunkSize) {
    const chunk = stations.slice(i, i + chunkSize)
    const { data, error } = await supabase.from('station').insert(chunk).select('id')
    if (error) throw new Error(`Gagal insert stasiun (chunk ${i / chunkSize + 1}): ${error.message}`)
    inserted += data?.length ?? 0
    console.log(`  + ${inserted}/${stations.length} stasiun ter-insert`)
  }
  return inserted
}

async function cmdIngest(opts: { filePath: string; purge: boolean; force: boolean; dryRun: boolean; createdBy: string | null }) {
  const stations = parseStationsFromExcel(opts.filePath, opts.createdBy)
  console.log(`Akan meng-ingest ${stations.length} stasiun dari ${opts.filePath}.`)

  if (opts.dryRun) {
    console.log('\n[DRY-RUN] Tidak ada perubahan DB. Preview 5 baris pertama:')
    stations.slice(0, 5).forEach((s, i) => console.log(`${i + 1}.`, JSON.stringify(s)))
    if (opts.purge) console.log('[DRY-RUN] --purge aktif: semua stasiun lama akan dihapus dulu (di mode non-dry-run).')
    if (opts.force) console.log('[DRY-RUN] --force aktif: referensi instrument/certificate akan di-NULL-kan, user_stations cascade.')
    return
  }

  const supabase = getClient()

  // Selalu backup dulu sebelum perubahan apa pun.
  const backupFile = await writeBackup(supabase)

  if (opts.purge) {
    console.log('\n⚠ MODE PURGE: menghapus seluruh stasiun lama.')
    if (opts.force) {
      await backupReferences(supabase)
    }
    await purgeAllStations(supabase, opts.force)
  }

  console.log('\nMenyisipkan stasiun baru...')
  const typeMap = await getStationTypeMap(supabase)
  const stationsWithType = stations.map((s) => ({ ...s, type_id: resolveTypeId(s.name, typeMap) }))
  const inserted = await insertStations(supabase, stationsWithType)
  console.log(`\n✔ Selesai. ${inserted} stasiun ter-insert.`)
  console.log(`  Untuk membatalkan: npx tsx scripts/ingest-stations.ts rollback --from ${backupFile}`)
}

/**
 * Isi/percamkan kolom `type` pada stasiun yang SUDAH ada berdasarkan kata kunci
 * di namanya (Geof/Klim/Met/Balai Besar). Tidak menghapus apa pun — hanya UPDATE.
 */
async function cmdNormalizeNames(dryRun: boolean) {
  const supabase = getClient()
  const stations = await fetchAllStations(supabase)
  console.log(`Memeriksa nama untuk ${stations.length} stasiun...`)

  const updates = stations
    .map((s) => ({ id: s.id, current: String(s.name || ''), next: normalizeStationName(String(s.name || '')) }))
    .filter((u) => u.next !== u.current && u.next !== '')

  console.log(`${updates.length} nama stasiun akan dinormalisasi.`)

  if (dryRun) {
    console.log('\n[DRY-RUN] Preview 15 perubahan:')
    updates.slice(0, 15).forEach((u) => console.log(`  #${u.id} "${u.current}" -> "${u.next}"`))
    return
  }

  let done = 0
  for (const u of updates) {
    const { error } = await supabase.from('station').update({ name: u.next }).eq('id', u.id)
    if (error) throw new Error(`Gagal update nama station #${u.id}: ${error.message}`)
    done++
  }
  console.log(`✔ Selesai. ${done} nama stasiun diperbarui.`)
}

async function cmdSetType(dryRun: boolean) {
  const supabase = getClient()
  const typeMap = await getStationTypeMap(supabase)
  const stations = await fetchAllStations(supabase)
  console.log(`Memetakan type_id untuk ${stations.length} stasiun...`)

  const idToName = new Map<number, string>()
  typeMap.forEach((id, name) => idToName.set(id, name))

  const updates = stations
    .map((s) => ({
      id: s.id,
      name: s.name,
      current: s.type_id ?? null,
      next: resolveTypeId(String(s.name || ''), typeMap),
    }))
    .filter((u) => u.next !== null && u.next !== u.current)

  console.log(`${updates.length} stasiun akan di-update type_id-nya.`)
  const summary = updates.reduce<Record<string, number>>((acc, u) => {
    const label = idToName.get(u.next as number) || String(u.next)
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {})
  console.log('Ringkasan type:', JSON.stringify(summary))

  if (dryRun) {
    console.log('\n[DRY-RUN] Preview 10 perubahan:')
    updates.slice(0, 10).forEach((u) =>
      console.log(`  #${u.id} "${u.name}" -> type_id ${u.next} (${idToName.get(u.next as number)})`),
    )
    return
  }

  let done = 0
  for (const u of updates) {
    const { error } = await supabase.from('station').update({ type_id: u.next }).eq('id', u.id)
    if (error) throw new Error(`Gagal update type_id station #${u.id}: ${error.message}`)
    done++
  }
  console.log(`✔ Selesai. ${done} stasiun diperbarui.`)
}

async function cmdRollback(fromFile: string) {
  if (!fromFile) throw new Error('rollback membutuhkan --from <file backup JSON>')
  if (!fs.existsSync(fromFile)) throw new Error(`File backup tidak ditemukan: ${fromFile}`)

  const backupRows: any[] = JSON.parse(fs.readFileSync(fromFile, 'utf8'))
  if (!Array.isArray(backupRows)) throw new Error('Format backup tidak valid (harus array).')

  const supabase = getClient()
  console.log(`Rollback ke kondisi backup: ${backupRows.length} stasiun (file: ${fromFile})`)

  // Safety: backup kondisi sekarang sebelum rollback (jaga-jaga).
  await writeBackup(supabase)

  // 1. Upsert semua baris backup (id dipertahankan agar FK tetap valid).
  if (backupRows.length > 0) {
    const chunkSize = 100
    for (let i = 0; i < backupRows.length; i += chunkSize) {
      const chunk = backupRows.slice(i, i + chunkSize)
      const { error } = await supabase.from('station').upsert(chunk, { onConflict: 'id' })
      if (error) throw new Error(`Gagal upsert saat rollback: ${error.message}`)
    }
    console.log(`  ✔ ${backupRows.length} stasiun dari backup dipulihkan (upsert).`)
  }

  // 2. Hapus stasiun yang TIDAK ada di backup (mis. hasil ingest yang ingin dibatalkan).
  const keepIds = backupRows.map((r) => r.id).filter((v) => v !== null && v !== undefined)
  const current = await fetchAllStations(supabase)
  const toDelete = current.filter((r) => !keepIds.includes(r.id)).map((r) => r.id)

  if (toDelete.length > 0) {
    const { error } = await supabase.from('station').delete().in('id', toDelete)
    if (error) {
      throw new Error(
        `Gagal menghapus stasiun non-backup saat rollback: ${error.message}\n` +
          'Kemungkinan stasiun hasil ingest sudah terlanjur direferensikan tabel lain.',
      )
    }
    console.log(`  ✔ ${toDelete.length} stasiun non-backup dihapus.`)
  } else {
    console.log('  (Tidak ada stasiun tambahan yang perlu dihapus.)')
  }

  console.log('✔ Rollback selesai.')
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function getFlagValue(argv: string[], flag: string): string | null {
  const idx = argv.indexOf(flag)
  if (idx === -1) return null
  return argv[idx + 1] ?? null
}

async function main() {
  loadEnvironment()
  const argv = process.argv.slice(2)
  const command = argv[0]
  const filePath = getFlagValue(argv, '--file') || 'tabular_upt_bmkg.xlsx'
  const purge = argv.includes('--purge')
  const force = argv.includes('--force')
  const dryRun = argv.includes('--dry-run')
  const createdBy = getFlagValue(argv, '--created-by')

  switch (command) {
    case 'inspect':
      await cmdInspect(filePath)
      break
    case 'backup':
      await cmdBackup()
      break
    case 'ingest':
      await cmdIngest({ filePath, purge, force, dryRun, createdBy })
      break
    case 'rollback':
      await cmdRollback(getFlagValue(argv, '--from') || '')
      break
    case 'set-type':
      await cmdSetType(dryRun)
      break
    case 'normalize-names':
      await cmdNormalizeNames(dryRun)
      break
    default:
      console.log('Command tidak dikenal. Gunakan: inspect | backup | ingest | rollback | set-type | normalize-names')
      console.log('Lihat header file ini untuk detail opsi.')
      process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('\n✖ ERROR:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
