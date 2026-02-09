import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

// Menggunakan shared supabaseAdmin dari lib/supabase agar memiliki fallback env dan konfigurasi konsisten

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '10', 10) || 10))
    const q = (searchParams.get('q') || '').trim()
    const type = searchParams.get('type') // 'standard' or 'uut'

    const userId = searchParams.get('user_id')

    // 1. Determine Station Join Logic
    // If strict user filtering, use !inner join on station -> user_stations
    let stationSelect = 'station(id, name)'
    if (userId) {
      stationSelect = 'station!inner(id, name, user_stations!inner(user_id))'
    }

    // 2. Determine Sensor Join Logic
    // If filtering for standard, use !inner join to enforce standard sensor existence
    let sensorSelect = 'sensor!left(id, name, type, serial_number, is_standard)'
    if (type === 'standard') {
      sensorSelect = 'sensor!inner(id, name, type, serial_number, is_standard)'
    }

    // Query dasar dengan join ke tabel station dan sensor (untuk filtering)
    // 3. Compose Query
    let query = supabaseAdmin
      .from('instrument')
      .select(`*, ${stationSelect}, ${sensorSelect}`, { count: 'exact' })

    // 4. Apply Filters
    if (type === 'standard') {
      query = query.eq('sensor.is_standard', true)
    }

    // For 'uut', we simply use the default list (server-side logic is open)
    // No specific filter needed here as per original logic.

    // Tambahkan filter pencarian jika ada query 'q'
    if (q) {
      query = query.or(
        `manufacturer.ilike.%${q}%,type.ilike.%${q}%,serial_number.ilike.%${q}%,name.ilike.%${q}%,others.ilike.%${q}%`
      );
    }

    if (userId) {
      query = query.eq('station.user_stations.user_id', userId)
    }

    // Terapkan paginasi dan pengurutan
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1

    query = query
      .order('created_at', { ascending: false })
      .range(start, end)

    // Eksekusi query
    const { data, error, count } = await query;

    // Error handling yang lebih baik
    if (error) {
      console.error("Supabase query error in GET /api/instruments:", error); // Log error spesifik
      // Cek error terkait relasi (meskipun seharusnya tidak terjadi dengan kode yang disederhanakan)
      if (error.code === '42P01' || error.message.includes('relation "station" does not exist')) {
        return NextResponse.json({ error: 'Database relation error: Station data could not be joined.' }, { status: 500 });
      }
      // Jika konektivitas ke Supabase gagal, kembalikan list kosong agar UI tetap jalan
      if (error.message?.toLowerCase?.().includes('fetch failed')) {
        console.warn('[instruments] Supabase unreachable, returning empty list fallback.')
        return NextResponse.json({ data: [], total: 0, page, pageSize, totalPages: 1 })
      }
      // Handle error RLS atau lainnya
      return NextResponse.json({ error: `Failed to fetch instruments: ${error.message}` }, { status: 500 });
    }

    // Kirim response sukses
    const total = count || 0;
    return NextResponse.json({
      data: Array.isArray(data) ? data : [],
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    });

  } catch (e: any) {
    console.error("Catch block error in GET /api/instruments:", e); // Log exception lain
    // Fallback ketika undici fetch gagal (misconfig URL/keys atau Supabase down)
    if (typeof e?.message === 'string' && e.message.toLowerCase().includes('fetch failed')) {
      console.warn('[instruments] Supabase unreachable in catch, returning empty list fallback.')
      return NextResponse.json({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 1 })
    }
    return NextResponse.json({ error: 'Failed to fetch instruments due to an unexpected server error.' }, { status: 500 });
  }
}

// Handler POST, PUT, DELETE (tetap sama seperti yang Anda unggah)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { manufacturer, type, serial_number, others, name, station_id, memiliki_lebih_satu } = body

    if (!manufacturer || !type || !serial_number || !name) {
      return NextResponse.json({
        error: 'Manufacturer, type, serial number, and name are required',
      }, { status: 400 })
    }

    if (station_id) {
      const { data: stationData, error: stationError } = await supabaseAdmin
        .from('station')
        .select('id')
        .eq('id', station_id)
        .single();

      if (stationError || !stationData) {
        return NextResponse.json({
          error: 'Station ID tidak valid.',
        }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('instrument')
      .insert({
        manufacturer,
        type,
        serial_number,
        others: others || null,
        name,
        station_id: station_id ? parseInt(station_id as any) : null,
        memiliki_lebih_satu: memiliki_lebih_satu || false
      })
      .select('*, station(id, name)') // Ambil data station setelah insert
      .single()

    if (error) {
      console.error("POST Instrument Error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error("POST Instrument Exception:", e);
    return NextResponse.json({ error: 'Failed to create instrument' }, { status: 500 })
  }
}
