import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
import { sendPasswordResetEmail } from '../../../../lib/email'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Ensure we always return JSON
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 })
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email diperlukan' }, { status: 400 })
    }

    // For security reasons, we don't check if user exists
    // This prevents email enumeration attacks
    // We'll always return success message regardless

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Store token in database
    const { error: dbError } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        email: email.toLowerCase(),
        token: resetToken,
        expires_at: expiresAt.toISOString()
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Gagal menyimpan token reset' }, { status: 500 })
    }

    // Send email
    try {
      await sendPasswordResetEmail(email, resetToken)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Link reset password telah dikirim ke email Anda' 
      })
    } catch (emailError) {
      console.error('Email error:', emailError)
      
      // Clean up token if email fails
      await supabaseAdmin
        .from('password_reset_tokens')
        .delete()
        .eq('token', resetToken)

      return NextResponse.json({ 
        error: 'Gagal mengirim email. Silakan coba lagi.' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Password reset request error:', error)
    return NextResponse.json({ 
      error: 'Terjadi kesalahan server' 
    }, { status: 500 })
  }
}
