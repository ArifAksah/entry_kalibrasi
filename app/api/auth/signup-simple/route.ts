import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

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

    return NextResponse.json({
      success: true,
      message: 'User berhasil dibuat (tanpa email)',
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


