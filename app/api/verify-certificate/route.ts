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
    const no = searchParams.get('no')
    const id = searchParams.get('id')
    
    if (!no && !id) {
      return NextResponse.json({ error: 'Either "no" or "id" parameter is required' }, { status: 400 })
    }

    console.log('🔍 [API] Checking verification for certificate:', id ? `ID=${id}` : `NO=${no}`)

    // Find certificate by ID (preferred) or certificate number
    let cert, certErr
    if (id) {
      // Use ID - guaranteed unique
      const result = await supabaseAdmin
        .from('certificate')
        .select('id, no_certificate, no_order, issue_date, station, instrument, version, created_at')
        .eq('id', id)
        .maybeSingle()
      cert = result.data
      certErr = result.error
    } else {
      // Use certificate number - get the latest one if duplicates exist
      const result = await supabaseAdmin
        .from('certificate')
        .select('id, no_certificate, no_order, issue_date, station, instrument, version, created_at')
        .eq('no_certificate', no)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      cert = result.data
      certErr = result.error
    }

    if (certErr) {
      console.error('❌ [API] Error fetching certificate:', certErr)
      return NextResponse.json({ error: certErr.message }, { status: 500 })
    }
    if (!cert) {
      console.log('⚠️ [API] Certificate not found:', no)
      return NextResponse.json({ valid: false, message: 'Certificate not found' }, { status: 404 })
    }

    console.log('✅ [API] Certificate found, ID:', cert.id, 'Version:', cert.version ?? 1)

    // Check level 3 verification approved
    // Query ALL verification records for level 3 first, then filter by status
    const certVersion = cert.version ?? 1
    console.log(`🔍 [API] Checking verification for certificate ${cert.id}, version ${certVersion}...`)
    
    // First, get ALL verification records for level 3 (including any status)
    // This helps with race conditions where status might have just been updated
    // Query without ordering first to ensure we get all records, then sort in code
    // Ensure certificate_id is an integer (cert.id is already integer from database)
    const certId = typeof cert.id === 'string' ? parseInt(cert.id, 10) : cert.id
    console.log(`🔍 [API] Querying for certificate_id=${certId} (type: ${typeof certId}), verification_level=3`)
    console.log(`🔍 [API] Using Supabase admin client to query certificate_verification table`)
    
    let { data: allVerifs, error: vErr } = await supabaseAdmin
      .from('certificate_verification')
      .select('status, signed_at, signature_data, certificate_version, updated_at, created_at, id, certificate_id, verification_level')
      .eq('certificate_id', certId)
      .eq('verification_level', 3)

    if (vErr) {
      console.error('❌ [API] Error checking verification:', vErr)
      // Don't fail - just return invalid
      return NextResponse.json({
        valid: false,
        certificate: {
          number: cert.no_certificate,
          order: cert.no_order,
          issue_date: cert.issue_date,
          version: cert.version ?? 1,
        },
        verification: null,
      })
    }

    console.log(`📋 [API] Found ${allVerifs?.length || 0} verification record(s) for level 3`)
    if (allVerifs && allVerifs.length > 0) {
      allVerifs.forEach((v, idx) => {
        console.log(`📋 [API] Record ${idx + 1}: id=${v.id}, status=${v.status}, certificate_id=${v.certificate_id}, level=${v.verification_level}, version=${v.certificate_version}, updated=${v.updated_at}`)
      })
    } else {
      console.log(`📋 [API] No verification records found for certificate ${cert.id}, level 3`)
      // Double check with a direct query to ensure no cache issues
      // Try multiple query approaches to ensure we get fresh data
      // Use a fresh query without relying on previous results
      console.log(`🔍 [API] Double check: Querying for certificate_id=${certId}, verification_level=3`)
      const { data: doubleCheck, error: doubleCheckErr } = await supabaseAdmin
        .from('certificate_verification')
        .select('status, signed_at, signature_data, certificate_version, updated_at, created_at, id, certificate_id, verification_level')
        .eq('certificate_id', certId)
        .eq('verification_level', 3)
        .limit(10)
      
      if (doubleCheckErr) {
        console.error(`❌ [API] Double check query error:`, doubleCheckErr)
      } else {
        console.log(`📋 [API] Double check result: Found ${doubleCheck?.length || 0} record(s)`)
        if (doubleCheck && doubleCheck.length > 0) {
          doubleCheck.forEach((v, idx) => {
            console.log(`📋 [API] Double check record ${idx + 1}: id=${v.id}, status=${v.status}, certificate_id=${v.certificate_id}, level=${v.verification_level}, version=${v.certificate_version}, updated=${v.updated_at}`)
          })
          // Use double check data if main query failed
          if (!allVerifs || allVerifs.length === 0) {
            console.log(`📋 [API] Main query found no records, using double check data instead`)
            // Replace allVerifs with doubleCheck data
            allVerifs = doubleCheck
            console.log(`📋 [API] Updated allVerifs with ${allVerifs.length} record(s) from double check`)
          }
        } else {
          // Triple check: wait a bit and query again in case of race condition
          console.log(`📋 [API] Double check also found no records, waiting 2000ms and trying once more...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          console.log(`🔍 [API] Triple check: Querying for certificate_id=${certId}, verification_level=3`)
          // Try querying without any filters first to see if record exists at all
          const { data: allTripleCheck, error: allTripleCheckErr } = await supabaseAdmin
            .from('certificate_verification')
            .select('status, signed_at, signature_data, certificate_version, updated_at, created_at, id, certificate_id, verification_level')
            .eq('certificate_id', certId)
            .limit(20)
          
          if (allTripleCheckErr) {
            console.error(`❌ [API] Triple check (all levels) query error:`, allTripleCheckErr)
          } else {
            console.log(`📋 [API] Triple check (all levels) result: Found ${allTripleCheck?.length || 0} record(s) for certificate_id=${certId}`)
            if (allTripleCheck && allTripleCheck.length > 0) {
              allTripleCheck.forEach((v, idx) => {
                console.log(`📋 [API] Triple check (all levels) record ${idx + 1}: id=${v.id}, status=${v.status}, certificate_id=${v.certificate_id}, level=${v.verification_level}, version=${v.certificate_version}`)
              })
              // Filter for level 3 from all records
              const level3TripleCheck = allTripleCheck.filter(v => v.verification_level === 3)
              if (level3TripleCheck.length > 0) {
                console.log(`📋 [API] ✅ Triple check found ${level3TripleCheck.length} level 3 record(s) after delay`)
                level3TripleCheck.forEach((v, idx) => {
                  console.log(`📋 [API] Triple check record ${idx + 1}: id=${v.id}, status=${v.status}, certificate_id=${v.certificate_id}, level=${v.verification_level}, version=${v.certificate_version}, updated=${v.updated_at}`)
                })
                allVerifs = level3TripleCheck
                console.log(`📋 [API] Updated allVerifs with ${allVerifs.length} record(s) from triple check`)
              }
            }
          }
          
          // Final check with specific level 3 filter
          const { data: tripleCheck, error: tripleCheckErr } = await supabaseAdmin
            .from('certificate_verification')
            .select('status, signed_at, signature_data, certificate_version, updated_at, created_at, id, certificate_id, verification_level')
            .eq('certificate_id', certId)
            .eq('verification_level', 3)
            .limit(10)
          
          if (tripleCheckErr) {
            console.error(`❌ [API] Triple check (level 3) query error:`, tripleCheckErr)
          } else {
            console.log(`📋 [API] Triple check (level 3) result: Found ${tripleCheck?.length || 0} record(s)`)
            if (tripleCheck && tripleCheck.length > 0) {
              console.log(`📋 [API] ✅ Triple check (level 3) found ${tripleCheck.length} record(s) after delay`)
              tripleCheck.forEach((v, idx) => {
                console.log(`📋 [API] Triple check record ${idx + 1}: id=${v.id}, status=${v.status}, certificate_id=${v.certificate_id}, level=${v.verification_level}, version=${v.certificate_version}, updated=${v.updated_at}`)
              })
              allVerifs = tripleCheck
              console.log(`📋 [API] Updated allVerifs with ${allVerifs.length} record(s) from triple check`)
            } else {
              console.log(`📋 [API] ⚠️ Triple check (level 3) also found no records for certificate ${cert.id}, level 3`)
            }
          }
        }
      }
    }

    // Sort all verification records by updated_at descending to get the latest one first
    const sortedVerifs = allVerifs?.sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
      return bTime - aTime
    }) || []

    // Find the latest approved verification (prefer current version, but accept any)
    // Check the latest record first, then check others if needed
    const approvedVerif = sortedVerifs.find(v => v.status === 'approved')
    const valid = !!approvedVerif
    
    console.log(`🎯 [API] Verification status: ${valid ? 'APPROVED (Black)' : 'NOT APPROVED (Red)'}`)
    if (approvedVerif) {
      console.log(`📋 [API] Approved verification found:`, {
        id: approvedVerif.id,
        status: approvedVerif.status,
        certificate_version: approvedVerif.certificate_version,
        signed_at: approvedVerif.signed_at,
        updated_at: approvedVerif.updated_at
      })
      console.log(`📋 [API] Certificate version: ${certVersion}, Verification version: ${approvedVerif.certificate_version}`)
    } else {
      if (allVerifs && allVerifs.length > 0) {
        console.log(`⚠️ [API] Found ${allVerifs.length} verification record(s) but none are approved`)
        const latestVerif = allVerifs[0]
        console.log(`📋 [API] Latest verification record:`, {
          id: latestVerif.id,
          status: latestVerif.status,
          certificate_version: latestVerif.certificate_version
        })
      } else {
        console.log(`⚠️ [API] No verification record found at all for certificate ${cert.id}, level 3`)
      }
    }

    return NextResponse.json({
      valid,
      certificate: {
        number: cert.no_certificate,
        order: cert.no_order,
        issue_date: cert.issue_date,
        version: cert.version ?? 1,
      },
      verification: approvedVerif || null,
    })
  } catch (e: any) {
    console.error('💥 [API] Unexpected error:', e)
    return NextResponse.json({ 
      error: e?.message || 'Internal error',
      stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    }, { status: 500 })
  }
}
