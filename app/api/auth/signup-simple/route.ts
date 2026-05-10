import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabase';
import { sendEmail } from '../../../../lib/brevo';
import { buildAccountConfirmationHtml } from '../../../../lib/email-templates';

async function sendAccountConfirmationEmail(email: string, name: string): Promise<void> {
  try {
    const html = buildAccountConfirmationHtml({ userName: name });
    const result = await sendEmail({
      to: email,
      subject: 'Konfirmasi Akun - Sistem Kalibrasi BMKG',
      htmlContent: html,
    });
    if (!result.success) {
      console.error(`[signup] Failed to send confirmation email to ${email}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[signup] Unexpected error sending confirmation email to ${email}:`, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Starting simple signup process...');
    
    const { email, password, userData } = await request.json();
    console.log('Received data:', { email, userData });

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password diperlukan' },
        { status: 400 }
      );
    }

    console.log('Creating user in Supabase...');
    
    // Buat user di Supabase
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      },
    });

    console.log('Supabase signup result:', { signUpData, signUpError });

    if (signUpError) {
      console.error('Supabase signup error:', signUpError);
      return NextResponse.json(
        { 
          error: 'Gagal membuat user',
          details: signUpError.message
        },
        { status: 400 }
      );
    }

    if (!signUpData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 400 }
      );
    }

    // Send account confirmation email (awaited to ensure delivery before response)
    console.log(`[signup] Sending confirmation email to ${email}...`);
    await sendAccountConfirmationEmail(email, userData?.name || '');

    return NextResponse.json({
      success: true,
      message: 'User berhasil dibuat',
      user: {
        id: signUpData.user.id,
        email: signUpData.user.email,
        email_confirmed_at: signUpData.user.email_confirmed_at
      }
    });

  } catch (error) {
    console.error('Error in simple signup:', error);
    return NextResponse.json(
      { 
        error: 'Gagal melakukan registrasi',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


