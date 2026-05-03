import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role client to avoid RLS issues on server-side updates
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function getDeleteInstrumentErrorMessage(error: any) {
  const message = String(error?.message || '')

  if (message.includes('sensor_instrument_id_fkey')) {
    return 'Instrumen masih memiliki sensor terkait. Sensor harus dihapus terlebih dahulu.'
  }

  if (message.includes('certificate_instrument_fkey')) {
    return 'Instrumen tidak bisa dihapus karena sudah digunakan pada sertifikat.'
  }

  if (message.includes('calibration_session_uut_instrument_id_fkey') || message.includes('calibration_reference_std_instrument_id_fkey')) {
    return 'Instrumen tidak bisa dihapus karena sudah digunakan pada sesi kalibrasi.'
  }

  if (message.includes('letter_instrument_fkey')) {
    return 'Instrumen tidak bisa dihapus karena sudah digunakan pada surat.'
  }

  if (message.includes('raw_data_sensor_id') || message.includes('calibration_result_sensor_fkey')) {
    return 'Instrumen tidak bisa dihapus karena salah satu sensornya sudah digunakan pada data kalibrasi.'
  }

  return error?.message || 'Failed to delete instrument'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabaseAdmin
      .from('instrument')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch instrument' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { manufacturer, type, serial_number, others, name, instrument_names_id, station_id, memiliki_lebih_satu, instrument_type_id } = body

    if (!manufacturer || !type || !serial_number || !name) {
      return NextResponse.json({
        error: 'Manufacturer, type, serial number, and name are required',
      }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('instrument')
      .update({
        manufacturer,
        type,
        serial_number,
        others,
        name,
        instrument_names_id: instrument_names_id ? parseInt(instrument_names_id as any) : null,
        instrument_type_id: instrument_type_id ? parseInt(instrument_type_id as any) : null,
        station_id: station_id ? parseInt(station_id as any) : null,
        memiliki_lebih_satu: memiliki_lebih_satu || false
      })
      .eq('id', id)
      .select('*, station(id, name)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update instrument' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const instrumentId = Number(id)

    if (!Number.isFinite(instrumentId)) {
      return NextResponse.json({ error: 'ID instrumen tidak valid' }, { status: 400 })
    }

    const { data: sensors, error: sensorFetchError } = await supabaseAdmin
      .from('sensor')
      .select('id')
      .eq('instrument_id', instrumentId)

    if (sensorFetchError) {
      return NextResponse.json({ error: sensorFetchError.message }, { status: 500 })
    }

    const sensorIds = (sensors || []).map((sensor: any) => Number(sensor.id)).filter(Number.isFinite)

    const { error: junctionDeleteError } = await supabaseAdmin
      .from('instrument_sensors')
      .delete()
      .eq('instrument_id', instrumentId)

    if (junctionDeleteError) {
      return NextResponse.json({ error: getDeleteInstrumentErrorMessage(junctionDeleteError) }, { status: 500 })
    }

    if (sensorIds.length > 0) {
      const { error: certificateDeleteError } = await supabaseAdmin
        .from('certificate_standard')
        .delete()
        .in('sensor_id', sensorIds)

      if (certificateDeleteError) {
        return NextResponse.json({ error: getDeleteInstrumentErrorMessage(certificateDeleteError) }, { status: 500 })
      }

      const { error: sensorDeleteError } = await supabaseAdmin
        .from('sensor')
        .delete()
        .eq('instrument_id', instrumentId)

      if (sensorDeleteError) {
        return NextResponse.json({ error: getDeleteInstrumentErrorMessage(sensorDeleteError) }, { status: 500 })
      }
    }

    const { error } = await supabaseAdmin
      .from('instrument')
      .delete()
      .eq('id', instrumentId)

    if (error) return NextResponse.json({ error: getDeleteInstrumentErrorMessage(error) }, { status: 500 })
    return NextResponse.json({ message: 'Instrument deleted successfully' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete instrument' }, { status: 500 })
  }
}






