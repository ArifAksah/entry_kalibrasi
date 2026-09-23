import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { clientSafeMessage } from '../../../lib/api-error'
import { parseMasterQcPayload } from '../../../lib/master-qc-validation'
import { normaliseUnit } from '../../../lib/unitConversion'

function getMasterQcErrorMessage(error: any) {
    if (error?.code === '23505') {
        if (error?.message?.includes('master_qc_pkey')) {
            return 'ID Master QC bentrok. Sequence auto-increment perlu disinkronkan di database.'
        }

        return 'Master QC untuk kode instrumen dan satuan ini sudah ada.'
    }

    return error?.message || 'Gagal menyimpan data Master QC'
}

// GET - Ambil semua data master_qc
// Supports ?sensor_id=N to resolve: sensor → instrument → instrument_names_id → master_qc
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const q = (searchParams.get('q') || '').trim()
        const sensor_id = searchParams.get('sensor_id')
        const unit_uut = (searchParams.get('unit_uut') || '').trim()

        // === LOOKUP BY SENSOR ID ===
        // Resolves the chain: sensor.sensor_name_id OR sensor.instrument_id → instrument.instrument_names_id → master_qc
        if (sensor_id) {
            if (!unit_uut) {
                return NextResponse.json({ data: null, message: 'UUT unit is required for QC lookup' }, { status: 200 })
            }

            // Step 1: get sensor
            const { data: sensor, error: sErr } = await supabaseAdmin
                .from('sensor')
                .select('id, instrument_id, sensor_name_id')
                .eq('id', Number(sensor_id))
                .maybeSingle()

            if (sErr || (!sensor?.instrument_id && !sensor?.sensor_name_id)) {
                return NextResponse.json({ data: null, message: 'Sensor or instrument not found' }, { status: 200 })
            }

            let targetNameId = sensor.sensor_name_id;

            // Step 2: if sensor_name_id not available, fallback to instrument to find names (FK to instrument_names)
            if (!targetNameId && sensor.instrument_id) {
                const { data: instrument, error: iErr } = await supabaseAdmin
                    .from('instrument')
                    .select('id, names')
                    .eq('id', sensor.instrument_id)
                    .maybeSingle()

                if (!iErr && instrument?.names) {
                    targetNameId = instrument.names;
                }
            }

            if (!targetNameId) {
                return NextResponse.json({ data: null, message: 'Sensor/Instrument name not found' }, { status: 200 })
            }

            const { data: sensorName, error: sensorNameError } = await supabaseAdmin
                .from('instrument_names')
                .select('instrument_code_id')
                .eq('id', targetNameId)
                .maybeSingle()

            if (sensorNameError || !sensorName?.instrument_code_id) {
                return NextResponse.json({ data: null, message: 'Instrument code not found' }, { status: 200 })
            }

            // Step 3: select only the QC limit for the sensor code and UUT unit.
            const { data: qcRows, error: qcErr } = await supabaseAdmin
                .from('master_qc')
                .select(`
                    id,
                    unit_id,
                    nilai_batas_koreksi,
                    catatan,
                    instrument_names:instrument_name_id ( id, names ),
                    ref_unit ( id, unit )
                `)
                .eq('instrument_code_id', sensorName.instrument_code_id)

            if (qcErr) {
                console.error('GET /api/master-qc?sensor_id error:', qcErr)
                return NextResponse.json({ error: qcErr.message }, { status: 500 })
            }

            const requestedUnit = normaliseUnit(unit_uut)
            const matchingRows = (qcRows || []).filter((row: any) => {
                const relation = Array.isArray(row.ref_unit) ? row.ref_unit[0] : row.ref_unit
                return normaliseUnit(relation?.unit || '') === requestedUnit
            })

            if (matchingRows.length > 1) {
                console.error('GET /api/master-qc duplicate unit match:', {
                    sensorId: sensor_id,
                    targetNameId,
                    instrumentCodeId: sensorName.instrument_code_id,
                    unit: requestedUnit,
                    ids: matchingRows.map((row: any) => row.id),
                })
                return NextResponse.json(
                    { error: 'Data Master QC duplikat untuk instrumen dan satuan ini.' },
                    { status: 409 },
                )
            }

            return NextResponse.json({ data: matchingRows[0] || null })
        }

        // === LIST ALL (default behaviour) ===
        let query = supabaseAdmin
            .from('master_qc')
            .select(`
        id,
        nilai_batas_koreksi,
        catatan,
        created_at,
        updated_at,
        instrument_name_id,
        instrument_code_id,
        unit_id
      `)
            .order('created_at', { ascending: false })

        if (q) {
            query = query.or(`nilai_batas_koreksi.ilike.%${q}%,catatan.ilike.%${q}%`)
        }

        const { data, error } = await query

        if (error) {
            console.error('GET /api/master-qc error:', error)
            return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 })
        }

        // Fetch related data separately
        const instrumentNameIds = Array.from(new Set((data || []).map(item => item.instrument_name_id).filter(Boolean)))
        const instrumentCodeIds = Array.from(new Set((data || []).map(item => item.instrument_code_id).filter(Boolean)))
        const unitIds = Array.from(new Set((data || []).map(item => item.unit_id).filter(Boolean)))

        let instrumentNamesMap: Record<number, any> = {}
        let instrumentCodesMap: Record<number, any> = {}
        let unitsMap: Record<number, any> = {}

        if (instrumentCodeIds.length > 0) {
            const { data: codesData } = await supabaseAdmin
                .from('instrument_code')
                .select('id, code_alat')
                .in('id', instrumentCodeIds)

            if (codesData) {
                instrumentCodesMap = Object.fromEntries(codesData.map(code => [code.id, code]))
            }
        }

        if (instrumentNameIds.length > 0) {
            const { data: namesData } = await supabaseAdmin
                .from('instrument_names')
                .select('id, names, instrument_code_id')
                .in('id', instrumentNameIds)

            if (namesData) {
                const codeIds = Array.from(new Set(namesData.map(n => n.instrument_code_id).filter(Boolean)))
                let codesMap: Record<number, any> = {}

                if (codeIds.length > 0) {
                    const { data: codesData } = await supabaseAdmin
                        .from('instrument_code')
                        .select('id, code_alat')
                        .in('id', codeIds)

                    if (codesData) {
                        codesMap = Object.fromEntries(codesData.map(c => [c.id, c]))
                    }
                }

                instrumentNamesMap = Object.fromEntries(
                    namesData.map(n => [
                        n.id,
                        {
                            id: n.id,
                            name: n.names,
                            instrument_code: n.instrument_code_id ? codesMap[n.instrument_code_id] : null
                        }
                    ])
                )
            }
        }

        if (unitIds.length > 0) {
            const { data: unitsData } = await supabaseAdmin
                .from('ref_unit')
                .select('id, unit')
                .in('id', unitIds)

            if (unitsData) {
                unitsMap = Object.fromEntries(unitsData.map(u => [u.id, u]))
            }
        }

        // Map the data
        const mapped = (data || []).map(item => ({
            ...item,
            instrument_name: instrumentNamesMap[item.instrument_name_id]
                ? {
                    ...instrumentNamesMap[item.instrument_name_id],
                    instrument_code: instrumentCodesMap[item.instrument_code_id]
                        || instrumentNamesMap[item.instrument_name_id].instrument_code
                        || null,
                }
                : null,
            instrument_code: instrumentCodesMap[item.instrument_code_id] || null,
            ref_unit: unitsMap[item.unit_id] || null
        }))

        return NextResponse.json({ data: mapped })
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST - Tambah data baru
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const parsed = parseMasterQcPayload(body)
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error }, { status: 400 })
        }
        const {
            instrumentCodeId: normalizedInstrumentCodeId,
            instrumentNameId: normalizedInstrumentNameId,
            unitId: normalizedUnitId,
            correctionLimit,
            notes,
        } = parsed.data

        const { data: selectedName, error: selectedNameError } = await supabaseAdmin
            .from('instrument_names')
            .select('id, instrument_code_id')
            .eq('id', normalizedInstrumentNameId)
            .maybeSingle()

        if (selectedNameError || selectedName?.instrument_code_id !== normalizedInstrumentCodeId) {
            return NextResponse.json(
                { error: 'Nama instrumen tidak sesuai dengan kode instrumen yang dipilih.' },
                { status: 400 },
            )
        }

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('master_qc')
            .select('id')
            .eq('instrument_code_id', normalizedInstrumentCodeId)
            .eq('unit_id', normalizedUnitId)
            .maybeSingle()

        if (existingError) {
            console.error('POST /api/master-qc duplicate check error:', existingError)
            return NextResponse.json({ error: existingError.message }, { status: 400 })
        }

        if (existing) {
            return NextResponse.json(
                { error: 'Master QC untuk kode instrumen dan satuan ini sudah ada. Silakan edit nilai yang sudah tersedia.', existingId: existing.id },
                { status: 409 }
            )
        }

        const { data, error } = await supabaseAdmin
            .from('master_qc')
            .insert([{
                instrument_name_id: normalizedInstrumentNameId,
                instrument_code_id: normalizedInstrumentCodeId,
                unit_id: normalizedUnitId,
                nilai_batas_koreksi: correctionLimit,
                catatan: notes,
            }])
            .select('id, nilai_batas_koreksi, catatan, created_at, updated_at, instrument_name_id, instrument_code_id, unit_id')
            .single()

        if (error) {
            console.error('POST /api/master-qc error:', error)
            return NextResponse.json({ error: getMasterQcErrorMessage(error) }, { status: error.code === '23505' ? 409 : 400 })
        }

        // Fetch related data for the inserted record
        const { data: nameData } = await supabaseAdmin
            .from('instrument_names')
            .select('id, names, instrument_code_id')
            .eq('id', data.instrument_name_id)
            .single()

        let instrumentCode = null
        if (nameData?.instrument_code_id) {
            const { data: codeData } = await supabaseAdmin
                .from('instrument_code')
                .select('id, code_alat')
                .eq('id', nameData.instrument_code_id)
                .single()
            instrumentCode = codeData
        }

        const { data: unitData } = await supabaseAdmin
            .from('ref_unit')
            .select('id, unit')
            .eq('id', data.unit_id)
            .single()

        const mapped = {
            ...data,
            instrument_name: nameData ? {
                id: nameData.id,
                name: nameData.names,
                instrument_code: instrumentCode
            } : null,
            ref_unit: unitData
        }

        return NextResponse.json({ data: mapped }, { status: 201 })
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
