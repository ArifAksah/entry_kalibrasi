
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        console.log('DEBUG: Backend Received Body:', JSON.stringify(body, null, 2))
        const { session_id, data, filename, uploaded_by } = body

        if (!session_id || !data) {
            console.error('Validation failed: session_id or data missing', { session_id, hasData: !!data })
            return NextResponse.json({
                error: 'Missing session_id or data',
                details: { session_id, hasData: !!data }
            }, { status: 400 })
        }

        // Parse data (Array of sheets) into rows for raw_data table
        const rowsToInsert: any[] = []

        if (Array.isArray(data)) {
            for (const sheet of data) {
                const sheetName = sheet.name
                const sheetData = sheet.data // Array of arrays
                const sensorIdUut = sheet.sensor_id_uut
                const sensorIdStd = sheet.sensor_id_std

                if (!Array.isArray(sheetData) || sheetData.length < 2) continue


                // Find header row (assume first row)
                const headers = sheetData[0].map((h: any) => String(h).toLowerCase().trim())

                const timestampIdx = headers.findIndex((h: string) => h.includes('timestamp') || h.includes('waktu') || h.includes('time') || h.includes('tanggal'))
                const standardIdx = headers.findIndex((h: string) => h.includes('standar') || h.includes('ref') || h.includes('master') || h.includes('std'))
                const uutIdx = headers.findIndex((h: string) => h.includes('uut') || h.includes('bacaan') || h.includes('reading') || h.includes('alat'))

                // Skip if critical columns not found
                if (timestampIdx === -1 || standardIdx === -1 || uutIdx === -1) {
                    console.warn(`Skipping sheet ${sheetName}: Missing required columns. Found: ${headers.join(', ')}`)
                    continue
                }

                // Process data rows
                for (let i = 1; i < sheetData.length; i++) {
                    const row = sheetData[i]
                    if (!row || row.length === 0) continue

                    const timestampVal = row[timestampIdx]
                    const standardVal = row[standardIdx]
                    const uutVal = row[uutIdx]

                    // Basic validation: ensure we have data
                    if (timestampVal === undefined || standardVal === undefined || uutVal === undefined) continue

                    // Parse numeric values (handle comma as decimal)
                    const cleanFloat = (val: any) => {
                        if (typeof val === 'number') return val
                        if (typeof val === 'string') return parseFloat(val.replace(',', '.'))
                        return NaN
                    }

                    const standardData = cleanFloat(standardVal)
                    const uutData = cleanFloat(uutVal)

                    // Parse timestamp (basic handling)
                    let timestamp: string | null = null
                    try {
                        if (timestampVal) {
                            // Handle Excel serial date if passed as number
                            if (typeof timestampVal === 'number' && timestampVal > 20000) {
                                // Basic Excel date conversion (approximate for modern Excel)
                                const date = new Date((timestampVal - 25569) * 86400 * 1000)
                                timestamp = date.toISOString()
                            } else {
                                timestamp = new Date(timestampVal).toISOString()
                            }
                        }
                    } catch (e) {
                        timestamp = new Date().toISOString() // Fallback
                    }

                    if (isNaN(standardData) || isNaN(uutData)) continue // Skip invalid rows

                    rowsToInsert.push({
                        session_id,
                        timestamp: timestamp || new Date().toISOString(),
                        standard_data: standardData,
                        uut_data: uutData,
                        created_at: new Date().toISOString(),
                        sensor_id_uut: sensorIdUut || null,
                        sensor_id_std: sensorIdStd || null,
                    })
                }
            }
        }

        console.log('DEBUG: Rows to Insert:', JSON.stringify(rowsToInsert.slice(0, 3), null, 2)); // Log first 3 rows

        if (rowsToInsert.length === 0) {
            return NextResponse.json({ message: 'No valid data rows found to insert' }, { status: 200 })
        }

        // Bulk insert
        const { data: insertedData, error } = await supabase
            .from('raw_data')
            .insert(rowsToInsert)
            .select()

        if (error) throw error

        return NextResponse.json({ message: `Successfully inserted ${rowsToInsert.length} rows`, data: insertedData })
    } catch (error: any) {
        console.error('Error saving raw data (FULL):', JSON.stringify(error, Object.getOwnPropertyNames(error)))
        return NextResponse.json({
            error: error.message || 'Unknown server error',
            fullError: error
        }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const session_id = searchParams.get('session_id')

        if (!session_id) {
            return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('raw_data')
            .select('*')
            .eq('session_id', session_id)
            .order('created_at', { ascending: true })

        if (error) throw error

        return NextResponse.json({ data })
    } catch (error: any) {
        console.error('Error fetching raw data:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
