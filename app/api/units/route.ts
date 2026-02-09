
import { supabase } from '../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    let query = supabase
        .from('ref_unit')
        .select('*')
        .order('created_at', { ascending: false });

    if (q) {
        query = query.ilike('unit', `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const { unit } = json;

        if (!unit) {
            return NextResponse.json({ error: 'Unit name is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('ref_unit')
            .insert([{ unit }])
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const json = await request.json();
        const { id, unit } = json;

        if (!id || !unit) {
            return NextResponse.json({ error: 'ID and Unit name are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('ref_unit')
            .update({ unit })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('ref_unit')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Unit deleted successfully' });
}
