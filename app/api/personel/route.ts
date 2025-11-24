import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { decryptRSA, encryptAES, decryptAES, createBlindIndex } from '../../../lib/crypto'

export async function GET() {
  try {
    // Use admin client to bypass RLS so dropdowns can list personel
    const { data: personelData, error: personelError } = await supabaseAdmin
      .from('personel')
      .select('*')
      .order('created_at', { ascending: false })

    if (personelError) {
      if ((personelError as any).message?.toLowerCase?.().includes('fetch failed')) {
        console.warn('[personel] Supabase unreachable, returning empty list fallback.')
        return NextResponse.json([], { status: 200 })
      }
      return NextResponse.json({ error: personelError.message }, { status: 500 })
    }

    // Fetch user roles to merge
    const { data: rolesData, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')

    if (rolesError) {
      console.warn('[personel] Failed to fetch roles, returning personel without roles.')
      return NextResponse.json(personelData)
    }

    // Merge role into personel data and decrypt NIK
    const mergedData = personelData.map((p: any) => {
      const roleInfo = rolesData.find((r: any) => r.user_id === p.id)

      // Decrypt NIK if it exists and looks encrypted (contains colon for IV)
      let clearNik = p.nik
      if (p.nik && p.nik.includes(':')) {
        try {
          clearNik = decryptAES(p.nik)
        } catch (e) {
          console.warn(`Failed to decrypt NIK for user ${p.id}`, e)
          clearNik = 'Error Decrypting'
        }
      }

      return {
        ...p,
        nik: clearNik, // Return clear NIK to frontend
        role: roleInfo?.role || null
      }
    })

    return NextResponse.json(mergedData)
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.toLowerCase().includes('fetch failed')) {
      console.warn('[personel] Supabase unreachable in catch, returning empty list fallback.')
      return NextResponse.json([], { status: 200 })
    }
    return NextResponse.json({ error: 'Failed to fetch personel' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, nip, nik, phone, email } = body
    if (!id || !name || !email) {
      return NextResponse.json({ error: 'id, name and email are required' }, { status: 400 })
    }

    // Handle NIK Security
    let encryptedNik = null
    let nikIndex = null

    if (nik) {
      try {
        // 1. Decrypt the RSA encrypted NIK from client
        let clearNik = nik

        try {
          clearNik = decryptRSA(nik)
        } catch (rsaError) {
          console.warn('RSA Decryption failed, assuming clear text for dev/legacy:', rsaError)
          // If strictly enforcing, we should throw. But for dev resilience:
          clearNik = nik
        }

        // 2. Create Blind Index (Hash)
        nikIndex = createBlindIndex(clearNik)

        // 3. Encrypt for Storage (AES)
        encryptedNik = encryptAES(clearNik)

      } catch (cryptoError) {
        console.error('Crypto processing failed:', cryptoError)
        return NextResponse.json({ error: 'Failed to process secure NIK' }, { status: 500 })
      }
    }

    // Use admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('personel')
      .insert({
        id,
        name,
        nip,
        nik: encryptedNik, // Store AES encrypted
        nik_index: nikIndex, // Store Hash
        phone,
        email
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('Create personel error:', e)
    return NextResponse.json({ error: 'Failed to create personel' }, { status: 500 })
  }
}