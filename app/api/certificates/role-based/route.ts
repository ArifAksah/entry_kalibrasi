import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Helper function to get user role
async function getUserRole(userId: string) {
  const { data: roleData, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (roleError || !roleData) {
    return null;
  }

  return roleData.role;
}

// Helper function to authenticate user
async function authenticateUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return { user: null, error: 'Authorization header required' };
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    return { user: null, error: 'Invalid token' };
  }

  return { user, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError || !user) return NextResponse.json({ error: authError || 'Authentication failed' }, { status: 401 });

    const userRole = await getUserRole(user.id);
    if (!userRole) return NextResponse.json({ error: 'User role not found' }, { status: 404 });

    // Get certificates based on role
    let certificates;
    
    if (userRole === 'verifikator') {
      // Verifikator only sees certificates assigned to them
      const { data, error } = await supabaseAdmin
        .from('certificate')
        .select('*')
        .or(`verifikator_1.eq.${user.id},verifikator_2.eq.${user.id},authorized_by.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      certificates = data;
    } else if (userRole === 'admin') {
      // Admin sees all certificates but with limited actions
      const { data, error } = await supabaseAdmin
        .from('certificate')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      certificates = data;
    } else {
      // Other roles see all certificates
      const { data, error } = await supabaseAdmin
        .from('certificate')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      certificates = data;
    }

    // Get verification status for each certificate
    const certificateIds = certificates?.map(c => c.id) || [];
    let verifications: Array<{ certificate_id: number; verification_level: number; status: string; certificate_version?: number }> = [];

    if (certificateIds.length) {
      try {
        const { data: v, error: verifError } = await supabaseAdmin
          .from('certificate_verification')
          .select('certificate_id, verification_level, status, certificate_version')
          .in('certificate_id', certificateIds);

        if (!verifError && v) {
          verifications = v;
        }
      } catch {}
    }

    // Combine certificates with verification status and role-based permissions
    const certificatesWithStatus = (certificates || []).map(cert => {
      const certVersion = (cert as any).version ?? 1;
      const verif1 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 1 && (v.certificate_version ?? 1) === certVersion);
      const verif2 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 2 && (v.certificate_version ?? 1) === certVersion);
      
      return {
        ...cert,
        verifikator_1_status: verif1?.status || 'pending',
        verifikator_2_status: verif2?.status || 'pending',
        // Add role-based permissions
        canEdit: userRole !== 'admin', // Admin cannot edit
        canDelete: userRole !== 'admin', // Admin cannot delete
        canVerify: userRole === 'verifikator' && (
          cert.verifikator_1 === user.id || 
          cert.verifikator_2 === user.id || 
          cert.authorized_by === user.id
        ),
        userRole: userRole
      };
    });

    return NextResponse.json(certificatesWithStatus);
  } catch (error) {
    console.error('Certificates API error:', error);
    return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError || !user) return NextResponse.json({ error: authError || 'Authentication failed' }, { status: 401 });

    const userRole = await getUserRole(user.id);
    if (!userRole) return NextResponse.json({ error: 'User role not found' }, { status: 404 });

    // Block admin from editing certificates
    if (userRole === 'admin') {
      return NextResponse.json({ 
        error: 'Admin cannot edit certificates to maintain data integrity' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('certificate')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Certificate update error:', error);
    return NextResponse.json({ error: 'Failed to update certificate' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError || !user) return NextResponse.json({ error: authError || 'Authentication failed' }, { status: 401 });

    const userRole = await getUserRole(user.id);
    if (!userRole) return NextResponse.json({ error: 'User role not found' }, { status: 404 });

    // Block admin from deleting certificates
    if (userRole === 'admin') {
      return NextResponse.json({ 
        error: 'Admin cannot delete certificates to maintain data integrity' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('certificate')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    console.error('Certificate deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete certificate' }, { status: 500 });
  }
}
