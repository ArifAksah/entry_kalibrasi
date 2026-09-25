#!/usr/bin/env node
/**
 * Merge duplicate station rows that share the same WMO/station_id.
 *
 * Strategi:
 *   1. Kelompokkan station berdasarkan station_id (WMO) yang di-trim.
 *   2. Pilih satu row canonical per grup:
 *      - nama yang sama persis dengan ref_stations.station_name (resmi), atau
 *      - nama dengan token-overlap tertinggi terhadap nama resmi, atau
 *      - row dengan relasi terbanyak lalu created_at terbaru.
 *   3. Pindahkan seluruh foreign key ke canonical.
 *   4. Rapikan user_stations/user_roles agar tidak melanggar unique (user_id, station_id).
 *   5. Hapus row duplikat.
 *
 * Pemakaian:
 *   node scripts/merge-duplicate-stations.mjs            # dry-run (default)
 *   node scripts/merge-duplicate-stations.mjs --apply    # eksekusi
 *   node scripts/merge-duplicate-stations.mjs --wmo 96013 --apply   # satu grup saja
 *
 * Backup wajib dibuat lebih dulu (lihat backups/pre-station-merge-*.json).
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
const onlyWmo = (() => {
  const i = args.indexOf('--wmo')
  return i >= 0 ? String(args[i + 1]).trim() : null
})()

// FK columns that point at station.id
// Grup yang ambigu secara semantik: dua unit berbeda bisa berbagi WMO
// placeholder. Jangan digabung otomatis; review manual.
const SKIP_WMO = new Set(['99921'])

// pkColumn = primary/identity column used for batched updates
const FK_REFS = [
  { table: 'certificate', column: 'station', pkColumn: 'id' },
  { table: 'instrument', column: 'station_id', pkColumn: 'id' },
  { table: 'letter', column: 'owner', pkColumn: 'id' },
  { table: 'personel', column: 'station_user', pkColumn: 'id' },
  { table: 'qc_runs', column: 'station_id', pkColumn: 'id' },
  { table: 'calibration_session', column: 'station_id', pkColumn: 'session_id' },
]

const ASSIGNMENT_REFS = [
  { table: 'user_stations', userColumn: 'user_id' },
  { table: 'user_roles', userColumn: 'user_id' },
]

async function fetchAll(table, columns) {
  const out = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
    from += 1000
  }
  return out
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(value) {
  return new Set(normalizeName(value).split(' ').filter(Boolean))
}

function similarity(a, b) {
  const ta = tokenSet(a)
  const tb = tokenSet(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

async function main() {
  const stations = await fetchAll(
    'station',
    'id,station_id,name,address,region,province,regency,created_at',
  )
  const refStations = await fetchAll(
    'ref_stations',
    'station_wmo_id,station_name',
  )

  const refByWmo = new Map()
  for (const r of refStations) {
    const wmo = String(r.station_wmo_id || '').trim()
    if (!wmo) continue
    const list = refByWmo.get(wmo) || []
    list.push(r)
    refByWmo.set(wmo, list)
  }

  const groups = new Map()
  for (const s of stations) {
    const wmo = String(s.station_id || '').trim()
    if (!wmo) continue
    const list = groups.get(wmo) || []
    list.push(s)
    groups.set(wmo, list)
  }

  // Reference counts per station id (for tie-breaking)
  const refCounts = new Map()
  const bump = (id) => refCounts.set(id, (refCounts.get(id) || 0) + 1)
  for (const ref of FK_REFS) {
    const rows = await fetchAll(ref.table, ref.column)
    for (const row of rows) {
      const v = row[ref.column]
      if (v !== null && v !== undefined) bump(Number(v))
    }
  }
  for (const ref of ASSIGNMENT_REFS) {
    const rows = await fetchAll(ref.table, ref.column)
    for (const row of rows) {
      const v = row[ref.column]
      if (v !== null && v !== undefined) bump(Number(v))
    }
  }

  const plan = []
  for (const [wmo, rows] of groups) {
    if (rows.length < 2) continue
    if (onlyWmo && wmo !== onlyWmo) continue
    // SKIP_WMO hanya berlaku untuk proses massal; override eksplisit --wmo
    // menandakan operator sudah meninjau grup tersebut secara manual.
    if (SKIP_WMO.has(wmo) && !onlyWmo) continue

    const refs = refByWmo.get(wmo) || []
    const official = refs[0]?.station_name || null

    const metadataScore = (r) =>
      (r.province ? 1 : 0) + (r.regency ? 1 : 0) + (r.address ? 1 : 0)
    const newerFirst = (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

    let canonical = null
    if (official) {
      const exact = rows.find((r) => normalizeName(r.name) === normalizeName(official))
      if (exact) {
        canonical = exact
      } else {
        canonical = [...rows].sort((a, b) => {
          const simDiff = similarity(b.name, official) - similarity(a.name, official)
          if (Math.abs(simDiff) > 1e-9) return simDiff
          const metaDiff = metadataScore(b) - metadataScore(a)
          if (metaDiff !== 0) return metaDiff
          return newerFirst(a, b)
        })[0]
      }
    }
    if (!canonical) {
      canonical = [...rows].sort((a, b) => {
        const metaDiff = metadataScore(b) - metadataScore(a)
        if (metaDiff !== 0) return metaDiff
        const diff = (refCounts.get(Number(b.id)) || 0) - (refCounts.get(Number(a.id)) || 0)
        if (diff !== 0) return diff
        return newerFirst(a, b)
      })[0]
    }

    plan.push({
      wmo,
      official,
      canonical,
      duplicates: rows.filter((r) => r.id !== canonical.id),
    })
  }

  console.log(`Total grup duplikat (dipilih): ${plan.length}`)
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: DRY-RUN (tidak ada perubahan)')

  let movedFk = 0
  let removedDuplicates = 0
  let cleanedAssignments = 0

  for (const entry of plan) {
    const canonicalId = entry.canonical.id
    const duplicateIds = entry.duplicates.map((d) => d.id)
    const dupSet = new Set(duplicateIds)

    console.log(
      `\nWMO ${entry.wmo}${entry.official ? ` (resmi: ${entry.official})` : ''}`,
    )
    console.log(`  canonical: ${canonicalId} — ${entry.canonical.name}`)
    console.log(`  hapus: ${entry.duplicates.map((d) => `${d.id} (${d.name})`).join(', ')}`)

    // Regular FKs: update each duplicate column to canonical
    for (const ref of FK_REFS) {
      const rows = await fetchAll(ref.table, `${ref.pkColumn},${ref.column}`)
      const affected = rows.filter((r) => dupSet.has(Number(r[ref.column])))
      if (affected.length === 0) continue
      movedFk += affected.length
      console.log(`  ${ref.table}.${ref.column}: pindah ${affected.length}`)
      if (APPLY) {
        const ids = affected.map((r) => r[ref.pkColumn])
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100)
          const { error } = await supabase
            .from(ref.table)
            .update({ [ref.column]: canonicalId })
            .in(ref.pkColumn, batch)
          if (error) throw new Error(`${ref.table} update: ${error.message}`)
        }
      }
    }

    // Assignments with unique (user, station)
    for (const ref of ASSIGNMENT_REFS) {
      const rows = await fetchAll(ref.table, `${ref.userColumn},station_id`)
      const affected = rows.filter((r) => dupSet.has(Number(r.station_id)))
      if (affected.length === 0) continue

      const byUser = new Map()
      for (const r of affected) {
        const list = byUser.get(r[ref.userColumn]) || []
        list.push(Number(r.station_id))
        byUser.set(r[ref.userColumn], list)
      }

      const alreadyCanonical = new Set(
        rows
          .filter((r) => Number(r.station_id) === canonicalId)
          .map((r) => r[ref.userColumn]),
      )

      let toDelete = 0
      let toMove = 0
      for (const [userId, ids] of byUser) {
        const keep = ids[0]
        if (alreadyCanonical.has(userId)) {
          toDelete += ids.length
        } else {
          toMove += 1
          toDelete += ids.length - 1
        }
      }

      cleanedAssignments += toDelete
      console.log(
        `  ${ref.table}: pindah ${toMove}, hapus assignment duplikat ${toDelete}`,
      )

      if (APPLY) {
        for (const [userId, ids] of byUser) {
          if (alreadyCanonical.has(userId)) {
            const { error } = await supabase
              .from(ref.table)
              .delete()
              .eq(ref.userColumn, userId)
              .in('station_id', ids)
            if (error) throw new Error(`${ref.table} delete: ${error.message}`)
          } else {
            const keep = ids[0]
            const { error: updErr } = await supabase
              .from(ref.table)
              .update({ station_id: canonicalId })
              .eq(ref.userColumn, userId)
              .eq('station_id', keep)
            if (updErr) throw new Error(`${ref.table} move: ${updErr.message}`)
            const rest = ids.slice(1)
            if (rest.length > 0) {
              const { error: delErr } = await supabase
                .from(ref.table)
                .delete()
                .eq(ref.userColumn, userId)
                .in('station_id', rest)
              if (delErr) throw new Error(`${ref.table} delete rest: ${delErr.message}`)
            }
          }
        }
      }
    }

    removedDuplicates += duplicateIds.length
    if (APPLY) {
      const { error } = await supabase.from('station').delete().in('id', duplicateIds)
      if (error) throw new Error(`station delete: ${error.message}`)
    }
  }

  console.log('\n=== Ringkasan ===')
  console.log(`Grup diproses      : ${plan.length}`)
  console.log(`FK dipindahkan     : ${movedFk}`)
  console.log(`Assignment dibersihkan: ${cleanedAssignments}`)
  console.log(`Row duplikat dihapus  : ${removedDuplicates}`)
  if (!APPLY) console.log('\nDry-run selesai. Jalankan ulang dengan --apply untuk eksekusi.')
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
