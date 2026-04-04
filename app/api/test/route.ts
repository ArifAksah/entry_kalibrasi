import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabaseAdmin.from('sensor').select('*').limit(1);
  if (error) return NextResponse.json({ error });
  return NextResponse.json({ keys: Object.keys(data[0] || {}) });
}
