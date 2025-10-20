import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '10', 10) || 10))
    const q = (searchParams.get('q') || '').trim()

    const base = supabaseAdmin
      .from('instrument')
      // Modifikasi: Pilih '*' dan data station terkait
      .select('*, station(id, name, station_id)', { count: 'exact' }) // <-- MODIFIKASI: Tambahkan join station

    const qb = q
      ? base.or([
          `manufacturer.ilike.%${q}%`,
          `type.ilike.%${q}%`,
          `serial_number.ilike.%${q}%`,
          `name.ilike.%${q}%`,
          `others.ilike.%${q}%`,
          // Anda bisa menambahkan pencarian berdasarkan nama stasiun jika perlu
          // `station.name.ilike.%${q}%`, // <-- Contoh (perlu penyesuaian query jika relasi)
        ].join(','))
      : base

    const start = (page - 1) * pageSize
    const end = start + pageSize - 1

    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(start, end)

    if (error) {
      const msg = (error as any)?.message || ''
      const code = (error as any)?.code || ''
      // Penanganan error jika tabel tidak ada atau permission ditolak
      if (code === '42P01' || /relation .* does not exist/i.test(msg) || /permission denied/i.test(msg)) {
        // Jika tabel 'station' belum ada atau relasi bermasalah, kembalikan data tanpa join
        const fallbackBase = supabaseAdmin
            .from('instrument')
            .select('*', { count: 'exact' }); // Fallback ke select '*'

        const fallbackQuery = q
            ? fallbackBase.or([
                `manufacturer.ilike.%${q}%`,
                `type.ilike.%${q}%`,
                `serial_number.ilike.%${q}%`,
                `name.ilike.%${q}%`,
                `others.ilike.%${q}%`,
            ].join(','))
            : fallbackBase;

        const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery
            .order('created_at', { ascending: false })
            .range(start, end);

        if(fallbackError) {
             return NextResponse.json({ error: fallbackError.message }, { status: 500 });
        }
        const fallbackTotal = fallbackCount || 0;
        return NextResponse.json({ data: Array.isArray(fallbackData) ? fallbackData : [], total: fallbackTotal, page, pageSize, totalPages: Math.max(1, Math.ceil(fallbackTotal / pageSize)) });
      }
      // Error lain
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const total = count || 0
    return NextResponse.json({ data: Array.isArray(data) ? data : [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
  } catch (e) {
    console.error("GET Instruments Error:", e); // Log error
    return NextResponse.json({ error: 'Failed to fetch instruments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Modifikasi: Tambahkan station_id saat destrukturisasi
    const { manufacturer, type, serial_number, others, name, station_id } = body

    if (!manufacturer || !type || !serial_number || !name) {
      return NextResponse.json({
        error: 'Manufacturer, type, serial number, and name are required',
      }, { status: 400 })
    }

    // Modifikasi: Validasi station_id jika ada
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
      // Modifikasi: Sertakan station_id dalam insert
      .insert({
        manufacturer,
        type,
        serial_number,
        others: others || null, // Pastikan 'others' bisa null jika kosong
        name,
        station_id: station_id ? parseInt(station_id as any) : null // <-- MODIFIKASI: Tambahkan station_id
      })
      .select('*, station(id, name, station_id)') // <-- MODIFIKASI: Ambil juga data station setelah insert
      .single()

    if (error) {
       console.error("POST Instrument Error:", error); // Log error
       return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error("POST Instrument Exception:", e); // Log exception
    return NextResponse.json({ error: 'Failed to create instrument' }, { status: 500 })
  }
}