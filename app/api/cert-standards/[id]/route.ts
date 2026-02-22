import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        console.log(`PUT /api/cert-standards/${id} body:`, JSON.stringify(body, null, 2))

        // Handle data splitting
        let setpoint: any[] = [];
        let correction: any[] = [];
        let u95: any[] = [];

        // Check for array of objects (correction_data or correction_std)
        const sourceData = body.correction_data || body.correction_std;
        if (Array.isArray(sourceData) && sourceData.length > 0 && typeof sourceData[0] === 'object') {
            setpoint = sourceData.map((c: any) => c.setpoint ?? '');
            correction = sourceData.map((c: any) => c.correction ?? '');
            u95 = sourceData.map((c: any) => c.u95 ?? '');
        } else {
            // Fallback
            if (Array.isArray(body.setpoint)) setpoint = body.setpoint;
            if (Array.isArray(body.correction_std)) correction = body.correction_std;
            if (Array.isArray(body.u95_std)) u95 = body.u95_std;
        }

        const payload: any = {
            ...body,
            setpoint,
            correction_std: correction,
            u95_std: u95
        };

        // Remove correction_data from payload if it exists
        delete payload.correction_data;

        const { data, error } = await supabaseAdmin
            .from('certificate_standard')
            .update(payload)
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
            .from('certificate_standard')
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
