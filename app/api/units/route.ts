
import { supabaseAdmin } from '../../../lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { clientSafeMessage } from '../../../lib/api-error'
import { requireRoles } from '../../../lib/api-auth'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    let query = supabaseAdmin
        .from('ref_unit')
        .select('*')
        .order('created_at', { ascending: false });

    if (q) {
        query = query.ilike('unit', `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const gate = await requireRoles(request, ['admin', 'calibrator']);
    if (gate instanceof NextResponse) return gate;

    try {
        const json = await request.json();
        const { unit } = json;

        if (!unit) {
            return NextResponse.json({ error: 'Unit name is required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('ref_unit')
            .insert([{ unit }])
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const gate = await requireRoles(request, ['admin', 'calibrator']);
    if (gate instanceof NextResponse) return gate;

    try {
        const json = await request.json();
        const { id, unit } = json;

        if (!id || !unit) {
            return NextResponse.json({ error: 'ID and Unit name are required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('ref_unit')
            .update({ unit })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const gate = await requireRoles(request, ['admin', 'calibrator']);
    if (gate instanceof NextResponse) return gate;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
        .from('ref_unit')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
    }

    return NextResponse.json({ message: 'Unit deleted successfully' });
}
