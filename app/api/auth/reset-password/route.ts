import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
import { sendPasswordResetConfirmationEmail } from '../../../../lib/email'

export async function POST(request: NextRequest) {
  try {
    // Ensure we always return JSON
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 })
    }

    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ 
        error: 'Token dan password diperlukan' 
      }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ 
        error: 'Password minimal 8 karakter' 
      }, { status: 400 })
    }

    // Verify token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json({ 
        error: 'Token tidak valid atau sudah kadaluarsa' 
      }, { status: 400 })
    }

    // Check if user exists by trying to update their password
    try {
      // First, get the user by email to get their ID
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000 // Get all users to find the one with matching email
      })

      if (listError) {
        console.error('List users error:', listError)
        return NextResponse.json({ 
          error: 'Gagal memverifikasi pengguna' 
        }, { status: 500 })
      }

      const user = users?.users?.find(u => u.email === tokenData.email.toLowerCase())
      
      if (!user) {
        return NextResponse.json({ 
          error: 'Email tidak terdaftar' 
        }, { status: 400 })
      }

      // Update the user's password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: password }
      )

      if (updateError) {
        console.error('Password update error:', updateError)
        return NextResponse.json({ 
          error: 'Gagal memperbarui password' 
        }, { status: 500 })
      }
    } catch (error) {
      console.error('User update error:', error)
      return NextResponse.json({ 
        error: 'Terjadi kesalahan saat memperbarui password' 
      }, { status: 500 })
    }

    // Mark token as used
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', token)

    // Send confirmation email
    try {
      await sendPasswordResetConfirmationEmail(tokenData.email)
    } catch (emailError) {
      console.error('Confirmation email error:', emailError)
      // Don't fail the request if confirmation email fails
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Password berhasil diperbarui' 
    })

  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json({ 
      error: 'Terjadi kesalahan server' 
    }, { status: 500 })
  }
}
