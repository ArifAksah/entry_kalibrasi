
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
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
                const unitStd = sheet.unit_std || null
                const unitUut = sheet.unit_uut || null

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

                // Parse numeric values — handles comma decimal, thousand separator, null/undefined
                const cleanFloat = (val: any): number | null => {
                    if (val === null || val === undefined || val === '') return null
                    if (typeof val === 'number') return isNaN(val) ? null : val
                    if (typeof val === 'string') {
                        // Remove thousand separators (dot before 3-digit groups) then swap comma→dot for decimal
                        let s = val.trim()
                        // European format "1.234,56" → strip dots used as thousands → "1234,56" → "1234.56"
                        if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
                            s = s.replace(/\./g, '').replace(',', '.')
                        } else {
                            // Replace comma decimal separator (non-European)
                            s = s.replace(',', '.')
                        }
                        const n = parseFloat(s)
                        return isNaN(n) ? null : n
                    }
                    return null
                }

                let skippedNoUut = 0, skippedNoTimestamp = 0, kept = 0

                // Process data rows
                for (let i = 1; i < sheetData.length; i++) {
                    const row = sheetData[i]
                    if (!row || row.length === 0) continue

                    const timestampVal = row[timestampIdx]
                    const uutVal      = uutIdx !== -1 ? row[uutIdx] : undefined
                    const standardVal = standardIdx !== -1 ? row[standardIdx] : undefined

                    // Only timestamp + UUT are required; standard_data is nullable in DB
                    if (timestampVal === undefined || timestampVal === null || timestampVal === '') {
                        skippedNoTimestamp++
                        continue
                    }

                    const uutData      = cleanFloat(uutVal)
                    const standardData = cleanFloat(standardVal)

                    // Skip rows with no UUT reading — they are meaningless
                    if (uutData === null) {
                        skippedNoUut++
                        continue
                    }

                    // Parse timestamp
                    let timestamp: string | null = null
                    try {
                        if (typeof timestampVal === 'number' && timestampVal > 20000) {
                            // Excel serial date conversion
                            const date = new Date((timestampVal - 25569) * 86400 * 1000)
                            timestamp = date.toISOString()
                        } else {
                            timestamp = new Date(timestampVal).toISOString()
                        }
                    } catch {
                        timestamp = new Date().toISOString()
                    }

                    kept++
                    rowsToInsert.push({
                        session_id,
                        timestamp: timestamp || new Date().toISOString(),
                        standard_data: standardData,  // null is OK — DB column is nullable
                        uut_data: uutData,
                        created_at: new Date().toISOString(),
                        sensor_id_uut: sensorIdUut || null,
                        sensor_id_std: sensorIdStd || null,
                        sheet_name: sheetName || null,
                        unit_std: unitStd,
                        unit_uut: unitUut,
                    })
                }
                console.log(`[raw-data] Sheet "${sheetName}": kept=${kept}, skipped_no_uut=${skippedNoUut}, skipped_no_timestamp=${skippedNoTimestamp}`)

            }
        }



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
