import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

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

        const { data, error } = await supabaseAdmin
            .from('master_qc')
            .update({
                instrument_name_id: Number(instrument_name_id),
                unit_id: Number(unit_id),
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
        instrument_names ( id, name ),
        ref_unit ( id, unit )
      `)
            .single()

        if (error) {
            console.error(`PUT /api/master-qc/${id} error:`, error)
            return NextResponse.json({ error: error.message }, { status: 400 })
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
