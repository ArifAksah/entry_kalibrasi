import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { parseCalculationSnapshots } from '../../../lib/calculation-snapshot'

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

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json()
        const rows = parseCalculationSnapshots(body?.calculation_snapshots)
        if (!rows) {
            return NextResponse.json({ error: 'Invalid or empty calculation snapshots' }, { status: 400 })
        }

        const batchSize = 25
        let updatedCount = 0
        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize)
            const results = await Promise.all(batch.map(async ({ id, ...values }) => {
                const { data, error } = await supabase
                    .from('raw_data')
                    .update(values)
                    .eq('id', id)
                    .select('id')

                if (error) throw error
                if (!data || data.length !== 1) {
                    throw new Error(`Raw data row ${id} was not updated`)
                }
                return data[0].id
            }))
            updatedCount += results.length
        }

        return NextResponse.json({ message: 'Calculation snapshots saved', updatedCount })
    } catch (error: any) {
        console.error('[raw-data] Error saving calculation snapshots:', error)
        return NextResponse.json({ error: error?.message || 'Failed to save calculation snapshots' }, { status: 500 })
    }
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
                const standardCertificateId = sheet.standard_certificate_id || null
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
                        } else if (typeof timestampVal === 'number') {
                            // Sequential row counters (1, 2, 3, ...) are not dates.
                            timestamp = null
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
                        standard_certificate_id: standardCertificateId,
                        source_row_index: i,
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

        const BATCH_SIZE = 500
        let insertedCount = 0
        for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
            const batch = rowsToInsert.slice(i, i + BATCH_SIZE)
            const { error } = await supabase
                .from('raw_data')
                .insert(batch)

            if (error) {
                console.error('[raw-data] Supabase INSERT error at batch', Math.floor(i / BATCH_SIZE), ':', JSON.stringify(error, null, 2))
                throw error
            }
            insertedCount += batch.length
            console.log(`[raw-data] batch ${Math.floor(i / BATCH_SIZE) + 1} inserted ${batch.length} rows (total: ${insertedCount}/${rowsToInsert.length})`)
        }

        return NextResponse.json({ message: `Successfully inserted ${insertedCount} rows` })
    } catch (error: any) {
        const errMessage = error?.message || String(error) || 'Unknown server error'
        const errCode = error?.code || error?.statusCode || ''
        const errDetails = error?.details || error?.hint || ''
        console.error('[raw-data] Error saving raw data:', {
            message: errMessage,
            code: errCode,
            details: errDetails,
            fullError: JSON.stringify(error, null, 2)
        })
        return NextResponse.json({
            error: errMessage,
            code: errCode,
            details: errDetails,
        }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const session_id = searchParams.get('session_id')
        // lean=true → hanya kolom yang dibutuhkan renderer (room condition suhu/RH,
        // rekonstruksi sheet). Menghindari select `*` yang menarik blob per baris
        // dan membuat sesi besar butuh 15-45 detik (meledakkan timeout halaman
        // print sehingga Suhu/Kelembaban tercetak '-').
        const lean = searchParams.get('lean') === 'true'
        const mode = searchParams.get('mode')

        if (!session_id) {
            return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
        }

        if (lean) {
            const { data, error } = await supabase
                .from('raw_data')
                .select('id, created_at, timestamp, standard_data, uut_data, sensor_id_uut, sensor_id_std, session_id, std_correction, std_corrected, sheet_name, unit_std, unit_uut, source_row_index')
                .eq('session_id', session_id)
                .order('id', { ascending: true })

            if (error) throw error
            console.log('[raw-data] lean fetched rows for session', session_id, (data ?? []).length)
            return NextResponse.json({ data: data ?? [] })
        }

        // mode=room → hanya baris suhu/kelembaban (rujuk lib/room-condition.ts).
        // Dipakai halaman print: Suhu/RH saja yang butuh raw_data, tidak perlu
        // menarik seluruh sesi (4-6 ribu baris = lambat & memboroskan timeout).
        if (mode === 'room') {
            const { data, error } = await supabase
                .from('raw_data')
                .select('id, timestamp, standard_data, sensor_id_uut, sensor_id_std, session_id, std_correction, std_corrected, sheet_name, unit_std, unit_uut')
                .eq('session_id', session_id)
                .or('sheet_name.ilike.*suhu*,sheet_name.ilike.*temp*,sheet_name.ilike.*termo*,sheet_name.ilike.*hygro*,sheet_name.ilike.*lembab*,sheet_name.ilike.*lambab*,sheet_name.ilike.*humid*,sheet_name.ilike.*rh*')
                .order('id', { ascending: true })

            if (error) throw error
            console.log('[raw-data] room-condition rows for session', session_id, (data ?? []).length)
            return NextResponse.json({ data: data ?? [] })
        }

        const pageSize = 1000
        const allRows: any[] = []
        let from = 0

        while (true) {
            const { data, error } = await supabase
                .from('raw_data')
                .select('*')
                .eq('session_id', session_id)
                .order('id', { ascending: true })
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
