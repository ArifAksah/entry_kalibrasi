import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const { data, error } = await supabaseAdmin
            .from('cert_standard')
            .update(body)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Error updating standard cert:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const { error } = await supabaseAdmin
            .from('cert_standard')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting standard cert:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ message: 'Certificate deleted successfully' })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
