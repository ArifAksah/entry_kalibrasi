import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

// GET - Ambil semua data master_qc
// Supports ?sensor_id=N to resolve: sensor → instrument → instrument_names_id → master_qc
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const q = (searchParams.get('q') || '').trim()
        const sensor_id = searchParams.get('sensor_id')

        // === LOOKUP BY SENSOR ID ===
        // Resolves the chain: sensor.instrument_id → instrument.instrument_names_id → master_qc
        if (sensor_id) {
            // Step 1: get sensor to find instrument_id
            const { data: sensor, error: sErr } = await supabaseAdmin
                .from('sensor')
                .select('id, instrument_id')
                .eq('id', Number(sensor_id))
                .maybeSingle()

            if (sErr || !sensor?.instrument_id) {
                return NextResponse.json({ data: null, message: 'Sensor or instrument not found' }, { status: 200 })
            }

            // Step 2: get instrument to find instrument_names_id
            const { data: instrument, error: iErr } = await supabaseAdmin
                .from('instrument')
                .select('id, instrument_names_id')
                .eq('id', sensor.instrument_id)
                .maybeSingle()

            if (iErr || !instrument?.instrument_names_id) {
                return NextResponse.json({ data: null, message: 'Instrument name not found' }, { status: 200 })
            }

            // Step 3: find matching master_qc row
            const { data: qcRow, error: qcErr } = await supabaseAdmin
                .from('master_qc')
                .select(`
                    id,
                    nilai_batas_koreksi,
                    catatan,
                    instrument_names ( id, name ),
                    ref_unit ( id, unit )
                `)
                .eq('instrument_name_id', instrument.instrument_names_id)
                .maybeSingle()

            if (qcErr) {
                console.error('GET /api/master-qc?sensor_id error:', qcErr)
                return NextResponse.json({ error: qcErr.message }, { status: 500 })
            }

            return NextResponse.json({ data: qcRow })
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
        instrument_names ( id, name ),
        ref_unit ( id, unit )
      `)
            .order('created_at', { ascending: false })

        if (q) {
            query = query.or(`nilai_batas_koreksi.ilike.%${q}%,catatan.ilike.%${q}%`)
        }

        const { data, error } = await query

        if (error) {
            console.error('GET /api/master-qc error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST - Tambah data baru
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { instrument_name_id, unit_id, nilai_batas_koreksi, catatan } = body

        if (!instrument_name_id || !unit_id || !nilai_batas_koreksi) {
            return NextResponse.json(
                { error: 'instrument_name_id, unit_id, dan nilai_batas_koreksi wajib diisi' },
                { status: 400 }
            )
        }

        const { data, error } = await supabaseAdmin
            .from('master_qc')
            .insert([{
                instrument_name_id: Number(instrument_name_id),
                unit_id: Number(unit_id),
                nilai_batas_koreksi: nilai_batas_koreksi.trim(),
                catatan: catatan?.trim() || null,
            }])
            .select(`
        id,
        nilai_batas_koreksi,
        catatan,
        created_at,
        updated_at,
        instrument_names ( id, name ),
        ref_unit ( id, unit )
      `)
            .single()

        if (error) {
            console.error('POST /api/master-qc error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ data }, { status: 201 })
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
