import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const cleanFloat = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null
    if (typeof val === 'number') return isNaN(val) ? null : val
    if (typeof val === 'string') {
        let s = val.trim()
        if (s === '') return null
        if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
            s = s.replace(/\./g, '').replace(',', '.')
        } else {
            s = s.replace(',', '.')
        }
        const n = parseFloat(s)
        return isNaN(n) ? null : n
    }
    return null
}

const isTimestampLike = (val: any): boolean => {
    if (val === null || val === undefined || val === '') return false
    if (typeof val === 'number') return val > 20000
    if (typeof val === 'string') {
        const s = val.trim()
        return s !== '' && !Number.isNaN(Date.parse(s))
    }
    return false
}

const selectBestColumn = (
    headers: string[],
    rows: any[][],
    keywords: string[],
    kind: 'numeric' | 'timestamp'
): number => {
    const candidates = headers
        .map((header, index) => ({ header, index }))
        .filter(({ header }) => keywords.some((kw) => header.includes(kw)))

    if (candidates.length === 0) return -1
    if (candidates.length === 1) return candidates[0].index

    const sampleRows = rows.slice(1, Math.min(rows.length, 201))
    let bestIndex = candidates[0].index
    let bestScore = Number.NEGATIVE_INFINITY

    for (const candidate of candidates) {
        const header = candidate.header
        let score = 0

        if (header === 'uut' || header.includes('uut')) score += 50
        if (header.includes('reading')) score += 20
        if (header.includes('standard') || header.includes('standar') || header.includes('std')) score += 30
        if (header.includes('timestamp') || header.includes('waktu') || header.includes('time') || header.includes('tanggal')) score += 30
        if (header.includes('alat') && !header.includes('uut')) score -= 15
        if (header.includes('name') || header.includes('nama')) score -= 20

        for (const row of sampleRows) {
            const value = row?.[candidate.index]
            if (kind === 'numeric') {
                if (cleanFloat(value) !== null) score += 2
            } else if (isTimestampLike(value)) {
                score += 2
            }
        }

        if (score > bestScore) {
            bestScore = score
            bestIndex = candidate.index
        }
    }

    return bestIndex
}

export async function POST(req: NextRequest) {
    return saveRawData(req, false)
}

export async function PUT(req: NextRequest) {
    return saveRawData(req, true)
}

async function saveRawData(req: NextRequest, replaceExisting: boolean) {
    try {
        const body = await req.json()
        const { session_id, data } = body

        if (!session_id || !data) {
            console.error('Validation failed: session_id or data missing', { session_id, hasData: !!data })
            return NextResponse.json({
                error: 'Missing session_id or data',
                details: { session_id, hasData: !!data }
            }, { status: 400 })
        }

        const rowsToInsert: any[] = []

        if (Array.isArray(data)) {
            for (const sheet of data) {
                const sheetName = sheet.name
                const sheetData = sheet.data
                const sensorIdUut = sheet.sensor_id_uut
                const sensorIdStd = sheet.sensor_id_std
                const unitStd = sheet.unit_std || null
                const unitUut = sheet.unit_uut || null

                if (!Array.isArray(sheetData) || sheetData.length < 2) continue

                const headers = sheetData[0].map((h: any) => String(h).toLowerCase().trim())

                const timestampIdx = selectBestColumn(headers, sheetData, ['timestamp', 'waktu', 'time', 'tanggal'], 'timestamp')
                const standardIdx = selectBestColumn(headers, sheetData, ['standar', 'standard', 'ref', 'master', 'std'], 'numeric')
                const uutIdx = selectBestColumn(headers, sheetData, ['uut', 'bacaan', 'reading', 'alat'], 'numeric')

                if (timestampIdx === -1 || standardIdx === -1 || uutIdx === -1) {
                    console.warn(`Skipping sheet ${sheetName}: Missing required columns. Found: ${headers.join(', ')}`)
                    continue
                }

                console.log(`[raw-data] Sheet "${sheetName}" columns: timestamp=${timestampIdx}(${headers[timestampIdx]}), std=${standardIdx}(${headers[standardIdx]}), uut=${uutIdx}(${headers[uutIdx]})`)

                let skippedNoUut = 0
                let skippedNoTimestamp = 0
                let kept = 0

                for (let i = 1; i < sheetData.length; i++) {
                    const row = sheetData[i]
                    if (!row || row.length === 0) continue

                    const timestampVal = row[timestampIdx]
                    const uutVal = uutIdx !== -1 ? row[uutIdx] : undefined
                    const standardVal = standardIdx !== -1 ? row[standardIdx] : undefined

                    const hasTimestamp = !(timestampVal === undefined || timestampVal === null || timestampVal === '')
                    if (!hasTimestamp) skippedNoTimestamp++

                    const uutData = cleanFloat(uutVal)
                    const standardData = cleanFloat(standardVal)

                    if (uutData === null) skippedNoUut++
                    // Skip baris tanpa data ukur: jika std DAN uut dua-duanya kosong,
                    // baris itu tidak berguna untuk kalibrasi (mis. baris sisa berisi
                    // hanya timestamp). Sebelumnya hanya di-skip bila timestamp juga
                    // kosong, sehingga baris "timestamp saja" lolos & menyimpan null
                    // yang merusak perhitungan min/max (Daerah Ukur & Kondisi Ruangan).
                    if (uutData === null && standardData === null) continue

                    let timestamp: string | null = null
                    try {
                        if (typeof timestampVal === 'number' && timestampVal > 20000) {
                            const date = new Date((timestampVal - 25569) * 86400 * 1000)
                            timestamp = date.toISOString()
                        } else if (hasTimestamp) {
                            timestamp = new Date(timestampVal).toISOString()
                        } else {
                            timestamp = null
                        }
                    } catch {
                        timestamp = null
                    }

                    kept++
                    rowsToInsert.push({
                        session_id,
                        timestamp,
                        standard_data: standardData,
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

        console.log('[raw-data] total rows prepared for insert:', rowsToInsert.length)

        if (replaceExisting) {
            const { error: deleteError } = await supabase
                .from('raw_data')
                .delete()
                .eq('session_id', session_id)

            if (deleteError) throw deleteError

            console.log('[raw-data] existing rows deleted for session:', session_id)
        }

        if (rowsToInsert.length === 0) {
            return NextResponse.json({
                message: replaceExisting
                    ? 'Existing rows cleared; no valid data rows found to insert'
                    : 'No valid data rows found to insert'
            }, { status: 200 })
        }

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

        const pageSize = 1000
        const allRows: any[] = []
        let from = 0

        while (true) {
            const { data, error } = await supabase
                .from('raw_data')
                .select('*')
                .eq('session_id', session_id)
                .order('created_at', { ascending: true })
                .range(from, from + pageSize - 1)

            if (error) throw error

            const batch = data ?? []
            allRows.push(...batch)

            if (batch.length < pageSize) break
            from += pageSize
        }

        const bySheet: Record<string, number> = {}
        for (const row of allRows) {
            const key = row.sheet_name || `sensor:${row.sensor_id_uut ?? 'unknown'}`
            bySheet[key] = (bySheet[key] || 0) + 1
        }
        console.log('[raw-data] fetched rows by sheet for session', session_id, bySheet)

        return NextResponse.json({ data: allRows })
    } catch (error: any) {
        console.error('Error fetching raw data:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
