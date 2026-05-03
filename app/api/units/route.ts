
import { supabaseAdmin } from '../../../lib/supabase';
import { NextResponse } from 'next/server';

async function requireAuthenticatedUser(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { user: null, response: NextResponse.json({ error: 'Authorization header required' }, { status: 401 }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
        return { user: null, response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
    }

    return { user, response: null };
}

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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: Request) {
    try {
        const auth = await requireAuthenticatedUser(request);
        if (auth.response) return auth.response;

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
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const auth = await requireAuthenticatedUser(request);
        if (auth.response) return auth.response;

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
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) return auth.response;

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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Unit deleted successfully' });
}
