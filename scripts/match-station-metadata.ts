/**
 * Cocokkan stasiun di DB (hasil ingest UPT) dengan metadata "metadata stasiun mkg.csv"
 * berdasarkan kemiripan nama, lalu (opsional) enrich field yang ANDAL:
 *   - wmo_id   -> kolom station.station_id
 *   - type     -> station.type_id (via tabel station_type; "Balai" -> null)
 *   - time_zone (7/8/9) -> "UTC+07:00" / "UTC+08:00" / "UTC+09:00"
 *
 * CATATAN PENTING: kolom region/provinsi/kabupaten/lat/long/elevation di CSV
 * banyak yang tertukar/korup, jadi TIDAK diimpor secara default.
 *
 * Pemakaian:
 *   npx tsx scripts/match-station-metadata.ts match --dry-run
 *   npx tsx scripts/match-station-metadata.ts match            (tulis ke DB)
 *   opsi: --min 0.5  (ambang skor kecocokan, default 0.45)
 */
import { config as loadEnv } from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const CSV_PATH = 'metadata stasiun mkg.csv'

type MetaRow = {
  name: string
  wmo_id: string
  region_desc: string
  type: string
  time_zone: string
  latitude: string
  longitude: string
  elevation: string
}

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Env Supabase tidak lengkap.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function parseCsv(path: string): MetaRow[] {
  const text = fs.readFileSync(path, 'utf8')
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = lines[0].split(';')
  const idx = (name: string) => header.indexOf(name)
  const iName = idx('name')
  const iWmo = idx('wmo_id')
  const iRegion = idx('region_desc')
  const iType = idx('type_MeteorologiKlimatologiGeofisika')
  const iTz = idx('time_zone')
  const iLat = idx('latitude')
  const iLon = idx('longitude')
  const iElev = idx('elevation_m')
  return lines.slice(1).map((line) => {
    const c = line.split(';')
    return {
      name: (c[iName] || '').trim(),
      wmo_id: (c[iWmo] || '').trim(),
      region_desc: (c[iRegion] || '').trim(),
      type: (c[iType] || '').trim(),
      time_zone: (c[iTz] || '').trim(),
      latitude: (c[iLat] || '').trim(),
      longitude: (c[iLon] || '').trim(),
      elevation: (c[iElev] || '').trim(),
    }
  }).filter((r) => r.name)
}

const STOP = new Set([
  'stasiun', 'sta', 'pos', 'balai', 'besar', 'meteorologi', 'klimatologi', 'geofisika',
  'dan', 'maritim', 'pemantau', 'atmosfer', 'global', 'tniau', 'taman', 'alat', 'digital',
  'detasemen', 'pengamatan', 'polusi', 'udara', 'bandara',
])

/** Token distinctive: buang stopword, buang "kelas <romawi>", samakan wilayah->wil. */
function tokens(name: string): Set<string> {
  let n = name.toLowerCase()
  n = n.replace(/\bwilayah\b/g, 'wil')
  n = n.replace(/\bkelas\s+(i{1,3}|iv|v|\d+)\b/g, ' ') // buang "kelas II" dst
  n = n.replace(/[^a-z0-9\s]/g, ' ')
  const toks = n.split(/\s+/).filter((t) => t && !STOP.has(t))
  return new Set(toks)
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  a.forEach((t) => { if (b.has(t)) inter++ })
  const jaccard = inter / (a.size + b.size - inter)
  const coverage = inter / Math.min(a.size, b.size)
  return 0.6 * coverage + 0.4 * jaccard
}

/** String distinctive tergabung (token diurutkan, tanpa spasi) untuk uji substring. */
function concatKey(toks: Set<string>): string {
  return Array.from(toks).sort().join('')
}

/** Disiplin stasiun: met | klim | geof | balai | other. */
function discipline(name: string, typeHint?: string): string {
  const t = (typeHint || '').toLowerCase()
  if (t === 'balai') return 'balai'
  if (t === 'meteorologi') return 'met'
  if (t === 'klimatologi') return 'klim'
  if (t === 'geofisika') return 'geof'
  const n = name.toLowerCase()
  if (n.includes('balai besar')) return 'balai'
  if (n.includes('pemantau atmosfer')) return 'klim'
  if (n.includes('geofisika')) return 'geof'
  if (n.includes('klimatologi')) return 'klim'
  if (n.includes('meteorologi')) return 'met'
  return 'other'
}

const tzMap: Record<string, string> = { '7': 'UTC+07:00', '8': 'UTC+08:00', '9': 'UTC+09:00' }

/**
 * Koordinat dianggap masuk akal bila berada di sekitar wilayah Indonesia.
 * Membuang 0;0;0 dan nilai mustahil (mis. "21541.5"). Catatan: filter ini
 * TIDAK bisa mendeteksi koordinat yang "tertukar tapi masih plausibel"
 * (mis. stasiun Ambon yang di CSV memakai koordinat Aceh).
 */
function parseGeo(latRaw: string, lonRaw: string, elevRaw: string, tz: string) {
  const lat = Number(latRaw)
  const lon = Number(lonRaw)
  const elev = Number(elevRaw)
  const latOk = Number.isFinite(lat) && lat >= -11.5 && lat <= 7.5 && lat !== 0
  const lonOk = Number.isFinite(lon) && lon >= 94 && lon <= 142 && lon !== 0
  if (!latOk || !lonOk) return null
  // Konsistensi bujur vs zona waktu — buang koordinat yang jelas tertukar
  // (mis. stasiun WIT/WITA tapi bujurnya di Sumatra/Aceh).
  if (tz === '7' && lon > 120) return null              // WIB harusnya barat
  if (tz === '8' && (lon < 112 || lon > 127)) return null // WITA tengah
  if (tz === '9' && lon < 123) return null              // WIT timur
  const elevOk = Number.isFinite(elev) && elev >= -5 && elev <= 5000
  return { latitude: lat, longitude: lon, elevation: elevOk ? elev : null }
}

async function main() {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const minIdx = argv.indexOf('--min')
  const minScore = minIdx !== -1 ? Number(argv[minIdx + 1]) : 0.45

  const meta = parseCsv(CSV_PATH)
  const metaTok = meta.map((m) => ({ m, tok: tokens(m.name), key: concatKey(tokens(m.name)), disc: discipline(m.name, m.type) }))
  console.log(`Metadata: ${meta.length} baris`)

  const supabase = getClient()
  const { data: stations, error } = await supabase.from('station').select('id, name, station_id, type_id, time_zone').order('id')
  if (error) throw new Error(error.message)
  console.log(`DB stations: ${stations?.length}`)

  const { data: stypes } = await supabase.from('station_type').select('id, name')
  const typeMap = new Map<string, number>()
  ;(stypes || []).forEach((t: any) => typeMap.set(String(t.name).toLowerCase(), Number(t.id)))

  let matched = 0
  let unmatched: string[] = []
  const updates: any[] = []

  for (const s of stations || []) {
    const stok = tokens(String(s.name || ''))
    const sConcat = Array.from(stok).join('')
    const sdisc = discipline(String(s.name || ''))

    // Sebuah token metadata dianggap "tercakup" bila ada persis di token DB,
    // atau (untuk token panjang) muncul di gabungan token DB (menangani
    // perbedaan penggabungan seperti "gunung sitoli" vs "gunungsitoli").
    const covered = (t: string) => stok.has(t) || (t.length >= 5 && sConcat.includes(t))

    // Kandidat: disiplin sama DAN SEMUA token distinctive metadata tercakup di DB.
    // Pilih yang PALING spesifik (jumlah token terbanyak). Tie + wmo beda -> ambigu.
    let best: { m: MetaRow; n: number } | null = null
    let ambiguous = false
    for (const c of metaTok) {
      if (sdisc !== 'other' && c.disc !== 'other' && sdisc !== c.disc) continue
      if (c.tok.size === 0) continue
      let allCovered = true
      c.tok.forEach((t) => { if (!covered(t)) allCovered = false })
      if (!allCovered) continue
      if (!best || c.tok.size > best.n) { best = { m: c.m, n: c.tok.size }; ambiguous = false }
      else if (c.tok.size === best.n && c.m.wmo_id !== best.m.wmo_id) ambiguous = true
    }

    if (best && !ambiguous) {
      matched++
      const tzVal = tzMap[best.m.time_zone] || null
      const typeId = best.m.type && best.m.type.toLowerCase() !== 'balai'
        ? typeMap.get(best.m.type.toLowerCase()) ?? null
        : null
      const geo = parseGeo(best.m.latitude, best.m.longitude, best.m.elevation, best.m.time_zone)
      updates.push({
        id: s.id,
        dbName: s.name,
        metaName: best.m.name,
        score: '1.00',
        station_id: best.m.wmo_id || null,
        type_id: typeId,
        time_zone: tzVal,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        elevation: geo?.elevation ?? null,
      })
    } else {
      unmatched.push(`${s.name}${ambiguous ? ' (AMBIGU)' : ''}`)
    }
  }

  console.log(`\nCocok (substring distinctive): ${matched} | Tidak cocok/ambigu: ${unmatched.length}`)
  const withGeo = updates.filter((u) => u.latitude != null).length
  console.log(`Dari ${matched} yg cocok: ${withGeo} punya koordinat masuk akal, ${matched - withGeo} koordinatnya 0/kosong/mustahil (di-skip).`)
  console.log('\n=== Contoh 25 kecocokan (DB -> META | wmo | tz | type_id) ===')
  updates.slice(0, 25).forEach((u) =>
    console.log(`  "${u.dbName}"  ->  "${u.metaName}"  | wmo=${u.station_id} tz=${u.time_zone} type_id=${u.type_id}`),
  )
  console.log('\n=== Tidak cocok / ambigu (perlu cek manual) ===')
  unmatched.slice(0, 40).forEach((u) => console.log('  -', u))

  if (dryRun) {
    console.log('\n[DRY-RUN] Tidak ada penulisan ke DB. Field geografis (region/provinsi/lat/long) SENGAJA tidak diimpor karena korup.')
    return
  }

  console.log('\nMenulis station_id, type_id, time_zone untuk yang cocok...')
  let done = 0
  let geoCount = 0
  for (const u of updates) {
    const patch: any = {}
    if (u.station_id) patch.station_id = u.station_id
    if (u.type_id != null) patch.type_id = u.type_id
    if (u.time_zone) patch.time_zone = u.time_zone
    // Selalu set koordinat (nilai valid atau null) supaya nilai salah dari run
    // sebelumnya ikut dikoreksi menjadi null bila kini dianggap tidak konsisten.
    patch.latitude = u.latitude
    patch.longitude = u.longitude
    patch.elevation = u.elevation
    if (u.latitude != null && u.longitude != null) geoCount++
    if (Object.keys(patch).length === 0) continue
    const { error: e } = await supabase.from('station').update(patch).eq('id', u.id)
    if (e) throw new Error(`Gagal update #${u.id}: ${e.message}`)
    done++
  }
  console.log(`✔ Selesai. ${done} stasiun di-enrich. Koordinat masuk akal diisi untuk ${geoCount} stasiun.`)
}

main().catch((e) => { console.error('\n✖ ERROR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
