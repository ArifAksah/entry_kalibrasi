import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Gunakan service role client untuk menghindari masalah RLS di sisi server
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

    // Query dasar dengan join ke tabel station
    let query = supabaseAdmin
      .from('instrument')
      .select('*, station(id, name)', { count: 'exact' }) // Ambil data station terkait

    // Tambahkan filter pencarian jika ada query 'q'
    if (q) {
      query = query.or(
          `manufacturer.ilike.%${q}%,type.ilike.%${q}%,serial_number.ilike.%${q}%,name.ilike.%${q}%,others.ilike.%${q}%`
          // Catatan: Pencarian berdasarkan nama station (station.name) memerlukan syntax query yang berbeda
          // atau penggunaan database view/function. Dihilangkan sementara untuk simplifikasi.
      );
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

  } catch (e) {
    console.error("Catch block error in GET /api/instruments:", e); // Log exception lain
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    // Pastikan mengambil station_id dari body
    const { manufacturer, type, serial_number, others, name, station_id, memiliki_lebih_satu } = body

    if (!manufacturer || !type || !serial_number || !name) {
      return NextResponse.json({
        error: 'Manufacturer, type, serial number, and name are required',
      }, { status: 400 })
    }

    // Validasi station_id jika ada
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
      // Pastikan menyertakan station_id dalam update
      .update({
        manufacturer,
        type,
        serial_number,
        others: others || null,
        name,
        station_id: station_id ? parseInt(station_id as any) : null,
        memiliki_lebih_satu: memiliki_lebih_satu || false
      })
      .eq('id', id)
      .select('*, station(id, name)') // Ambil data station setelah update
      .single()

    if (error) {
       console.error("PUT Instrument Error:", error);
       return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error("PUT Instrument Exception:", e);
    return NextResponse.json({ error: 'Failed to update instrument' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabaseAdmin
      .from('instrument')
      .delete()
      .eq('id', id)

    if (error) {
       console.error("DELETE Instrument Error:", error);
       return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ message: 'Instrument deleted successfully' })
  } catch (e) {
    console.error("DELETE Instrument Exception:", e);
    return NextResponse.json({ error: 'Failed to delete instrument' }, { status: 500 })
  }
}