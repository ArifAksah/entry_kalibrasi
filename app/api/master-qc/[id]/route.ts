import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

function getMasterQcErrorMessage(error: any) {
    if (error?.code === '23505') {
        if (error?.message?.includes('master_qc_pkey')) {
            return 'ID Master QC bentrok. Sequence auto-increment perlu disinkronkan di database.'
        }

        return 'Data Master QC untuk instrumen dan satuan ini sudah ada.'
    }

    return error?.message || 'Gagal menyimpan data Master QC'
}

// PUT - Update data berdasarkan ID
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: rawId } = await params
        const id = Number(rawId)
        if (!id || isNaN(id)) {
            return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
        }

        const body = await request.json()
        const { instrument_name_id, unit_id, nilai_batas_koreksi, catatan } = body

        if (!instrument_name_id || !unit_id || !nilai_batas_koreksi) {
            return NextResponse.json(
                { error: 'instrument_name_id, unit_id, dan nilai_batas_koreksi wajib diisi' },
                { status: 400 }
            )
        }

        const normalizedInstrumentNameId = Number(instrument_name_id)
        const normalizedUnitId = Number(unit_id)

        const { data: duplicateRows, error: duplicateError } = await supabaseAdmin
            .from('master_qc')
            .select('id')
            .eq('instrument_name_id', normalizedInstrumentNameId)
            .eq('unit_id', normalizedUnitId)
            .neq('id', id)
            .limit(1)

        if (duplicateError) {
            console.error(`PUT /api/master-qc/${id} duplicate check error:`, duplicateError)
            return NextResponse.json({ error: duplicateError.message }, { status: 400 })
        }

        if (Array.isArray(duplicateRows) && duplicateRows.length > 0) {
            return NextResponse.json(
                { error: 'Data Master QC untuk instrumen dan satuan ini sudah ada.' },
                { status: 409 }
            )
        }

        const { data, error } = await supabaseAdmin
            .from('master_qc')
            .update({
                instrument_name_id: normalizedInstrumentNameId,
                unit_id: normalizedUnitId,
                nilai_batas_koreksi: nilai_batas_koreksi.trim(),
                catatan: catatan?.trim() || null,
            })
            .eq('id', id)
            .select(`
        id,
        nilai_batas_koreksi,
        catatan,
        created_at,
        updated_at,
        instrument_name:instrument_name_id ( id, name ),
        ref_unit ( id, unit )
      `)
            .single()

        if (error) {
            console.error(`PUT /api/master-qc/${id} error:`, error)
            return NextResponse.json({ error: getMasterQcErrorMessage(error) }, { status: error.code === '23505' ? 409 : 400 })
        }

        return NextResponse.json({ data })
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE - Hapus data berdasarkan ID
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: rawId } = await params
        const id = Number(rawId)
        if (!id || isNaN(id)) {
            return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
        }

        const { error } = await supabaseAdmin
            .from('master_qc')
            .delete()
            .eq('id', id)

        if (error) {
            console.error(`DELETE /api/master-qc/${id} error:`, error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ message: 'Data berhasil dihapus' })
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
