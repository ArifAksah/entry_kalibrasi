import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../lib/supabase';
import { getCaller, unauthorized } from '../../../lib/api-auth';
import { clientSafeMessage } from '../../../lib/api-error'

export async function GET(request: NextRequest) {
  try {
    // Previously this used supabase.auth.getUser() without ever passing the
    // request's Bearer token, so it always failed with 401.
    const caller = await getCaller(request);
    if (!caller) return unauthorized();
    const user = { id: caller.user.id };

    // Get user settings from a user_settings table (create if doesn't exist)
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine for new users
      return NextResponse.json({ error: settingsError.message }, { status: 500 });
    }

    // Return default settings if none exist
    const defaultSettings = {
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      privacy: {
        profileVisibility: 'private',
        showEmail: false,
        showPhone: false,
      },
    };

    return NextResponse.json(settings?.settings || defaultSettings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller) return unauthorized();
    const user = { id: caller.user.id };

    const body = await request.json();
    const { notifications, privacy } = body;

    // Upsert user settings
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        settings: {
          notifications: notifications || {},
          privacy: privacy || {},
        },
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: clientSafeMessage(error) }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user settings' }, { status: 500 });
  }
}
