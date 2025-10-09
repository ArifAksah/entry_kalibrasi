import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { token, email } = await request.json();

    if (!token || !email) {
      return NextResponse.json(
        { error: 'Token dan email diperlukan' },
        { status: 400 }
      );
    }

    // Verifikasi token dengan Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email'
    });

    if (error) {
      console.error('Email confirmation error:', error);
      return NextResponse.json(
        { 
          error: 'Token tidak valid atau telah kedaluwarsa',
          details: error.message
        },
        { status: 400 }
      );
    }

    if (data.user) {
      return NextResponse.json({
        success: true,
        message: 'Email berhasil dikonfirmasi',
        user: data.user
      });
    } else {
      return NextResponse.json(
        { error: 'Gagal mengkonfirmasi email' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Unexpected error in confirm-email:', error);
    return NextResponse.json(
      { 
        error: 'Terjadi kesalahan yang tidak terduga',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


