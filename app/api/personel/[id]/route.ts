import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
import { decryptRSA, encryptAES, decryptAES, createBlindIndex } from '../../../../lib/crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Use admin to bypass RLS if needed, or just standard client if RLS allows
    // Using admin to be consistent with main route
    const { data, error } = await supabaseAdmin
      .from('personel')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Decrypt NIK if needed
    if (data && data.nik && data.nik.includes(':')) {
      try {
        data.nik = decryptAES(data.nik)
      } catch (e) {
        console.warn(`Failed to decrypt NIK for user ${id}`, e)
        data.nik = 'Error Decrypting'
      }
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch personel' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, nip, nik, phone, email } = body

    // Prepare update object
    const updateData: any = { name, nip, phone, email }

    // Handle NIK Security
    if (nik) {
      try {
        // 1. Decrypt RSA (if encrypted)
        let clearNik = nik
        try {
          clearNik = decryptRSA(nik)
        } catch (rsaError) {
          console.warn('RSA Decryption failed, assuming clear text or already processed:', rsaError)
          clearNik = nik
        }

        // 2. Create Blind Index
        updateData.nik_index = createBlindIndex(clearNik)

        // 3. Encrypt AES
        updateData.nik = encryptAES(clearNik)

      } catch (cryptoError) {
        console.error('Crypto processing failed:', cryptoError)
        return NextResponse.json({ error: 'Failed to process secure NIK' }, { status: 500 })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('personel')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update personel' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabaseAdmin
      .from('personel')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: 'Personel deleted' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete personel' }, { status: 500 })
  }
}
