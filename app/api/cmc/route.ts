import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { canConvertUnit, convertDeltaUnit } from '../../../lib/unitConversion'
import { authenticateRequest, getUserRole } from '../../../lib/certificate-access'

async function requireAdmin(request: NextRequest) {
  const { user, error } = await authenticateRequest(request)
  if (error || !user) return { error: error || 'Unauthorized', status: 401 }
  const role = await getUserRole(user.id)
  if (role !== 'admin') return { error: 'Hanya admin yang dapat mengubah Master CMC', status: 403 }
  return null
}

function profileMatches(profile: any, text: string): boolean {
  const code = String(profile.parameter_code || '').toLowerCase()
  const name = String(profile.name || '').toLowerCase()
  if (/arah angin|wind direction|wind vane|mk\s*0?5/.test(text)) return code === 'wd'
  if (/kecepatan angin|wind speed|mk\s*0?4/.test(text)) return code === 'ws'
  if (/tekanan|pressure|barometer|mk\s*0?2/.test(text)) return code === 'pp'
  if (/curah hujan|penakar hujan|rain|tipping bucket|mk\s*0?6/.test(text)) {
    if (/analog|konvensional/.test(text)) return profile.code === 'CMC-RR-ANALOG'
    return profile.code === 'CMC-RR-DIGITAL'
  }
  // Suhu sebelum kelembapan: sensor "Termometer HygroClip2" adalah Suhu.
  if (/suhu|temperature|termometer|temp|mk\s*0?1/.test(text)) {
    if (/digital/.test(text)) return /digital/.test(name)
    if (/analog/.test(text)) return /analog/.test(name)
    if (/gelas/.test(text)) return /gelas/.test(name)
    return code === 'tt' && /udara/.test(name)
  }
  if (/kelembapan|kelembaban|humidity|hygro|(^|\W)rh(\W|$)|mk\s*0?3/.test(text)) return code === 'rh'
  return false
}

async function fetchProfiles() {
  const { data: profiles, error } = await supabaseAdmin
    .from('cmc_profiles')
    .select('*, cmc_values(*)')
    .order('parameter_code')
    .order('version', { ascending: false })
  if (error) throw error
  return profiles || []
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const profiles = await fetchProfiles()
    if (searchParams.get('resolve') !== 'true') {
      return NextResponse.json({ data: profiles })
    }

    const text = [
      searchParams.get('sensorName'),
      searchParams.get('sensorType'),
      searchParams.get('sheetName'),
      searchParams.get('calibrationMethod'),
    ].filter(Boolean).join(' ').toLowerCase()
    const today = new Date().toISOString().slice(0, 10)
    const profile = profiles
      .filter((item: any) => item.is_active
        && (!item.effective_from || item.effective_from <= today)
        && (!item.effective_until || item.effective_until >= today))
      .find((item: any) => profileMatches(item, text))
    if (!profile) return NextResponse.json({ data: null })

    const measurementPoint = Number(searchParams.get('measurementPoint'))
    const sortedValues = [...(profile.cmc_values || [])]
      .sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0))
    const value = Number.isFinite(measurementPoint)
      ? sortedValues.find((item: any) =>
          (item.range_min == null || measurementPoint >= Number(item.range_min))
          && (item.range_max == null || measurementPoint <= Number(item.range_max))
        ) || sortedValues[0]
      : sortedValues[0]
    if (!value) return NextResponse.json({ data: null })

    const unitUut = searchParams.get('unitUut') || searchParams.get('unitStd') || value.unit
    const cmcNative = Number(value.cmc_value)
    if (!canConvertUnit(value.unit, unitUut)) {
      return NextResponse.json({ error: `Konversi CMC ${value.unit} ke ${unitUut} tidak didukung` }, { status: 422 })
    }
    const cmcOutput = convertDeltaUnit(cmcNative, value.unit, unitUut)
    return NextResponse.json({
      data: {
        profileId: profile.id,
        profileCode: profile.code,
        profileName: profile.name,
        version: profile.version,
        sourceDocument: profile.source_document,
        cmcNative,
        nativeUnit: value.unit,
        cmcOutput,
      },
    })
  } catch (error: any) {
    const missingTable = error?.code === '42P01' || /cmc_profiles|cmc_values/i.test(error?.message || '')
    return NextResponse.json({ error: error?.message || 'Gagal mengambil CMC' }, { status: missingTable ? 503 : 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
    const body = await request.json()
    const required = ['code', 'name', 'parameter_code', 'cmc_value', 'unit']
    if (required.some(field => body[field] === undefined || body[field] === '')) {
      return NextResponse.json({ error: 'Kode, nama, parameter, nilai CMC, dan unit wajib diisi' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('cmc_profiles')
      .insert({
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        parameter_code: String(body.parameter_code).trim().toUpperCase(),
        calibration_method: body.calibration_method || null,
        source_document: body.source_document || null,
        version: Number(body.version || 1),
        effective_from: body.effective_from || new Date().toISOString().slice(0, 10),
        effective_until: body.effective_until || null,
        is_active: body.is_active !== false,
      })
      .select('*')
      .single()
    if (profileError) throw profileError

    const { error: valueError } = await supabaseAdmin.from('cmc_values').insert({
      cmc_profile_id: profile.id,
      range_min: body.range_min === '' ? null : body.range_min,
      range_max: body.range_max === '' ? null : body.range_max,
      cmc_value: body.cmc_value,
      unit: String(body.unit).trim(),
      formula: body.formula || null,
      sequence: Number(body.sequence || 1),
    })
    if (valueError) throw valueError

    return NextResponse.json({ data: profile }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal menyimpan CMC' }, { status: 500 })
  }
}
