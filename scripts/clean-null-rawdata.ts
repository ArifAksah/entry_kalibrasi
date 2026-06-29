/**
 * Hapus baris raw_data yang KOSONG (standard_data NULL dan uut_data NULL) —
 * baris ini tidak punya data ukur dan merusak perhitungan min/max (Daerah Ukur
 * & Kondisi Ruangan) di LHKS.
 *
 * Pemakaian:
 *   npx tsx scripts/clean-null-rawdata.ts --dry-run   (lihat dulu, default)
 *   npx tsx scripts/clean-null-rawdata.ts --apply      (hapus)
 */
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
loadEnv({ path: '.env' }); loadEnv({ path: '.env.local', override: true })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  const apply = process.argv.includes('--apply')

  // Ambil baris yang std & uut dua-duanya NULL
  const { data: rows, error } = await sb
    .from('raw_data')
    .select('id, session_id, sheet_name, timestamp, standard_data, uut_data')
    .is('standard_data', null)
    .is('uut_data', null)
    .limit(10000)
  if (error) throw new Error(error.message)

  console.log(`Baris kosong (std NULL & uut NULL): ${rows?.length ?? 0}`)
  const bySheet = new Map<string, number>()
  for (const r of rows || []) {
    const k = `${String(r.session_id).slice(0, 8)} | ${r.sheet_name}`
    bySheet.set(k, (bySheet.get(k) || 0) + 1)
  }
  for (const [k, n] of bySheet) console.log(`  ${k}: ${n} baris`)
  ;(rows || []).slice(0, 10).forEach((r) => console.log(`    id=${r.id} ts=${r.timestamp} sheet="${r.sheet_name}"`))

  if (!apply) {
    console.log('\n[DRY-RUN] Tidak ada yang dihapus. Jalankan dengan --apply untuk menghapus.')
    return
  }

  const ids = (rows || []).map((r) => r.id)
  if (ids.length === 0) { console.log('Tidak ada yang perlu dihapus.'); return }

  // Hapus per-chunk
  let deleted = 0
  const chunk = 500
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk)
    const { error: e } = await sb.from('raw_data').delete().in('id', part)
    if (e) throw new Error(`Gagal menghapus: ${e.message}`)
    deleted += part.length
  }
  console.log(`✔ Selesai. ${deleted} baris kosong dihapus.`)
}
main().catch((e) => { console.error('\n✖ ERROR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
