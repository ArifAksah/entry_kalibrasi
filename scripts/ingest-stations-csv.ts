/**
 * Ingest stasiun (UPT BMKG) dari file CSV ke tabel `station` di Supabase.
 *
 * CSV format: semicolon-separated, header: name;station_id;address;wigos_id;latitude;longitude;elevation;region;province;regency;type_id;time_zone
 *
 * ----------------------------------------------------------------------------
 * PEMAKAIAN:
 *   npx tsx scripts/ingest-stations-csv.ts <command> [options]
 *
 * COMMANDS:
 *   inspect                 Tampilkan baris hasil parse dari CSV (tanpa DB).
 *   backup                  Simpan isi tabel station saat ini ke file backup JSON.
 *   ingest                  Insert stasiun baru dari CSV.
 *       --purge             Hapus SEMUA stasiun lama dulu (otomatis backup dulu).
 *       --force             Lepas referensi FK sebelum purge.
 *       --dry-run           Hanya preview, tidak menulis ke DB.
 *       --file <path>       Path CSV (default: final_output_stasiun.csv).
 *       --created-by <uuid> Isi kolom created_by (default: null).
 *   rollback --from <file>  Pulihkan tabel station persis seperti isi file backup.
 *   set-type                Update type_id stasiun yang sudah ada dari CSV.
 *   upsert                  Upsert stasiun (insert baru, update yang sudah ada by name).
 *
 * CONTOH:
 *   npx tsx scripts/ingest-stations-csv.ts inspect
 *   npx tsx scripts/ingest-stations-csv.ts backup
 *   npx tsx scripts/ingest-stations-csv.ts ingest --dry-run
 *   npx tsx scripts/ingest-stations-csv.ts ingest --purge --force
 *   npx tsx scripts/ingest-stations-csv.ts upsert --dry-run
 *   npx tsx scripts/ingest-stations-csv.ts rollback --from backups/stations-2026xxxx.json
 *
 * ----------------------------------------------------------------------------
 * PERINGATAN (destruktif):
 *   `--purge` akan menghapus SEMUA stasiun lama. Otomatis backup dulu.
 *   Gunakan `rollback` untuk mengembalikan bila ada masalah.
 * ----------------------------------------------------------------------------
 */

import { config as loadEnv } from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

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

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPASE_URL (atau fallback) di environment.')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (atau SUPABASE_SERVICE_KEY) di environment.')

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Tipe
// ---------------------------------------------------------------------------
type StationInsert = {
  name: string
  station_id: string | null
  address: string | null
  wigos_id: string | null
  latitude: number | null
  longitude: number | null
  elevation: number | null
  region: string | null
  province: string | null
  regency: string | null
  type_id: number | null
  time_zone: string | null
  created_by: string | null
}

// ---------------------------------------------------------------------------
// Parsing CSV
// ---------------------------------------------------------------------------
function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text === '' ? null : text
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return isNaN(n) ? null : n
}

/** Mapping type_id dari teks ke angka (sesuai tabel station_type di DB) */
const TYPE_MAP: Record<string, number> = {
  'meteorologi': 1,
  'klimatologi': 2,
  'geofisika': 3,
  'balai': 4,
  'bmkg pusat': 5,
}

function resolveTypeId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const str = String(value).trim()
  // Jika sudah angka, pakai langsung
  const asNum = Number(str)
  if (!isNaN(asNum) && str !== '') return asNum
  // Mapping dari teks
  return TYPE_MAP[str.toLowerCase()] ?? null
}

function parseCsvLine(line: string, delimiter = ';'): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseStationsFromCsv(filePath: string, createdBy: string | null): StationInsert[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File CSV tidak ditemukan: ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) throw new Error('CSV kosong atau tidak punya data.')

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const stations: StationInsert[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    header.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim()
    })

    const name = clean(row['name'])
    if (!name) continue

    stations.push({
      name,
      station_id: clean(row['station_id']),
      address: clean(row['address']),
      wigos_id: clean(row['wigos_id']),
      latitude: toNumber(row['latitude']),
      longitude: toNumber(row['longitude']),
      elevation: toNumber(row['elevation']),
      region: clean(row['region']),
      province: clean(row['province']),
      regency: clean(row['regency']),
      type_id: resolveTypeId(row['type_id']),
      time_zone: clean(row['time_zone']),
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
  const { error } = await supabase.from('station').delete().neq('id', -1)
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

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function cmdInspect(filePath: string) {
  const stations = parseStationsFromCsv(filePath, null)
  console.log(`Parsed ${stations.length} stasiun dari ${filePath}\n`)
  stations.slice(0, 10).forEach((s, i) =>
    console.log(`${i + 1}. ${s.name}  [type_id=${s.type_id ?? '-'}] [${s.region ?? '-'}]\n     ${s.address ?? '-'}`),
  )
  if (stations.length > 10) console.log(`... dan ${stations.length - 10} lainnya`)

  // Summary type_id
  const typeCount: Record<string, number> = {}
  stations.forEach((s) => {
    const key = String(s.type_id ?? 'null')
    typeCount[key] = (typeCount[key] || 0) + 1
  })
  console.log('\nRingkasan type_id:', JSON.stringify(typeCount))
}

async function cmdBackup() {
  const supabase = getClient()
  await writeBackup(supabase)
}

async function cmdIngest(opts: { filePath: string; purge: boolean; force: boolean; dryRun: boolean; createdBy: string | null }) {
  const stations = parseStationsFromCsv(opts.filePath, opts.createdBy)
  console.log(`Akan meng-ingest ${stations.length} stasiun dari ${opts.filePath}.`)

  if (opts.dryRun) {
    console.log('\n[DRY-RUN] Tidak ada perubahan DB. Preview 5 baris pertama:')
    stations.slice(0, 5).forEach((s, i) => console.log(`${i + 1}.`, JSON.stringify(s)))
    if (opts.purge) console.log('[DRY-RUN] --purge aktif: semua stasiun lama akan dihapus dulu (di mode non-dry-run).')
    if (opts.force) console.log('[DRY-RUN] --force aktif: referensi instrument/certificate akan di-NULL-kan, user_stations cascade.')
    return
  }

  const supabase = getClient()
  const backupFile = await writeBackup(supabase)

  if (opts.purge) {
    console.log('\n⚠ MODE PURGE: menghapus seluruh stasiun lama.')
    if (opts.force) {
      await backupReferences(supabase)
    }
    await purgeAllStations(supabase, opts.force)
  }

  console.log('\nMenyisipkan stasiun baru...')
  const inserted = await insertStations(supabase, stations)
  console.log(`\n✔ Selesai. ${inserted} stasiun ter-insert.`)
  console.log(`  Untuk membatalkan: npx tsx scripts/ingest-stations-csv.ts rollback --from ${backupFile}`)
}

/**
 * Upsert stasiun: insert yang baru, update yang sudah ada (cocokkan by name).
 */
async function cmdUpsert(opts: { filePath: string; dryRun: boolean; createdBy: string | null }) {
  const stations = parseStationsFromCsv(opts.filePath, opts.createdBy)
  const supabase = getClient()

  // Ambil semua stasiun existing.
  // Prioritas pencocokan: station_id (WMO) dulu, baru nama lowercase sebagai
  // fallback. Ini mencegah stasiun yang berubah nama ter-insert ulang.
  const existing = await fetchAllStations(supabase)
  const byName = new Map<string, any>()
  const byWmo = new Map<string, any>()
  for (const s of existing) {
    byName.set(String(s.name || '').toLowerCase(), s)
    const wmo = String(s.station_id ?? '').trim()
    if (wmo) byWmo.set(wmo, s)
  }

  const toInsert: StationInsert[] = []
  const toUpdate: { id: number; data: Partial<StationInsert> }[] = []

  for (const s of stations) {
    const key = s.name.toLowerCase()
    const wmo = String(s.station_id ?? '').trim()
    const match = (wmo && byWmo.get(wmo)) || byName.get(key)
    if (match) {
      // Cek apakah ada perubahan
      const changes: Partial<StationInsert> = {}
      let hasChanges = false
      for (const k of ['station_id', 'address', 'wigos_id', 'latitude', 'longitude', 'elevation', 'region', 'province', 'regency', 'type_id', 'time_zone'] as const) {
        const oldVal = match[k] ?? null
        const newVal = s[k] ?? null
        if (String(oldVal) !== String(newVal)) {
          ;(changes as any)[k] = newVal
          hasChanges = true
        }
      }
      if (hasChanges) {
        toUpdate.push({ id: match.id, data: changes })
      }
    } else {
      toInsert.push(s)
    }
  }

  console.log(`Stasiun CSV: ${stations.length}`)
  console.log(`Stasiun existing: ${existing.length}`)
  console.log(`Akan insert baru: ${toInsert.length}`)
  console.log(`Akan update: ${toUpdate.length}`)

  if (opts.dryRun) {
    console.log('\n[DRY-RUN] Preview insert:')
    toInsert.slice(0, 5).forEach((s, i) => console.log(`  ${i + 1}. ${s.name} [type_id=${s.type_id}]`))
    console.log('\n[DRY-RUN] Preview update:')
    toUpdate.slice(0, 5).forEach((u, i) => console.log(`  ${i + 1}. #${u.id} -> ${JSON.stringify(u.data)}`))
    return
  }

  const backupFile = await writeBackup(supabase)

  // Insert baru
  if (toInsert.length > 0) {
    console.log('\nMenyisipkan stasiun baru...')
    await insertStations(supabase, toInsert)
  }

  // Update yang berubah
  if (toUpdate.length > 0) {
    console.log('\nMengupdate stasiun yang berubah...')
    let done = 0
    for (const u of toUpdate) {
      const { error } = await supabase.from('station').update(u.data).eq('id', u.id)
      if (error) throw new Error(`Gagal update station #${u.id}: ${error.message}`)
      done++
    }
    console.log(`  ✔ ${done} stasiun di-update.`)
  }

  console.log(`\n✔ Selesai. Insert: ${toInsert.length}, Update: ${toUpdate.length}`)
  console.log(`  Untuk membatalkan: npx tsx scripts/ingest-stations-csv.ts rollback --from ${backupFile}`)
}

/**
 * Update type_id stasiun yang sudah ada berdasarkan CSV.
 */
async function cmdSetTypeFromCsv(filePath: string, dryRun: boolean) {
  const stations = parseStationsFromCsv(filePath, null)
  const supabase = getClient()

  const existing = await fetchAllStations(supabase)
  const existingMap = new Map<string, any>()
  for (const s of existing) {
    existingMap.set(String(s.name || '').toLowerCase(), s)
  }

  const updates: { id: number; name: string; current: number | null; next: number | null }[] = []
  for (const s of stations) {
    const match = existingMap.get(s.name.toLowerCase())
    if (match && s.type_id !== null && s.type_id !== (match.type_id ?? null)) {
      updates.push({ id: match.id, name: s.name, current: match.type_id ?? null, next: s.type_id })
    }
  }

  console.log(`Stasiun CSV: ${stations.length}`)
  console.log(`Stasiun existing: ${existing.length}`)
  console.log(`Akan update type_id: ${updates.length}`)

  if (dryRun) {
    console.log('\n[DRY-RUN] Preview:')
    updates.slice(0, 15).forEach((u) =>
      console.log(`  #${u.id} "${u.name}" -> type_id ${u.current} => ${u.next}`),
    )
    return
  }

  let done = 0
  for (const u of updates) {
    const { error } = await supabase.from('station').update({ type_id: u.next }).eq('id', u.id)
    if (error) throw new Error(`Gagal update type_id station #${u.id}: ${error.message}`)
    done++
  }
  console.log(`✔ Selesai. ${done} stasiun diperbarui type_id-nya.`)
}

async function cmdRollback(fromFile: string) {
  if (!fromFile) throw new Error('rollback membutuhkan --from <file backup JSON>')
  if (!fs.existsSync(fromFile)) throw new Error(`File backup tidak ditemukan: ${fromFile}`)

  const backupRows: any[] = JSON.parse(fs.readFileSync(fromFile, 'utf8'))
  if (!Array.isArray(backupRows)) throw new Error('Format backup tidak valid (harus array).')

  const supabase = getClient()
  console.log(`Rollback ke kondisi backup: ${backupRows.length} stasiun (file: ${fromFile})`)

  await writeBackup(supabase)

  if (backupRows.length > 0) {
    const chunkSize = 100
    for (let i = 0; i < backupRows.length; i += chunkSize) {
      const chunk = backupRows.slice(i, i + chunkSize)
      const { error } = await supabase.from('station').upsert(chunk, { onConflict: 'id' })
      if (error) throw new Error(`Gagal upsert saat rollback: ${error.message}`)
    }
    console.log(`  ✔ ${backupRows.length} stasiun dari backup dipulihkan (upsert).`)
  }

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
  const filePath = getFlagValue(argv, '--file') || 'scripts/data/final_output_stasiun.csv'
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
    case 'upsert':
      await cmdUpsert({ filePath, dryRun, createdBy })
      break
    case 'set-type':
      await cmdSetTypeFromCsv(filePath, dryRun)
      break
    case 'rollback':
      await cmdRollback(getFlagValue(argv, '--from') || '')
      break
    default:
      console.log('Command tidak dikenal. Gunakan: inspect | backup | ingest | upsert | set-type | rollback')
      console.log('Lihat header file ini untuk detail opsi.')
      process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('\n✖ ERROR:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
