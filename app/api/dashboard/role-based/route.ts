import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // Get user role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData) {
      return NextResponse.json({ error: 'User role not found' }, { status: 404 });
    }

    const userRole = roleData.role;

    if (userRole === 'verifikator') {
      // Get certificates assigned to this verifikator
      const { data: certificates, error: certError } = await supabaseAdmin
        .from('certificate')
        .select('*')
        .or(`verifikator_1.eq.${user.id},verifikator_2.eq.${user.id},authorized_by.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (certError) return NextResponse.json({ error: certError.message }, { status: 500 });

      // Get verification status for these certificates
      const certificateIds = certificates?.map(c => c.id) || [];
      let verifications: Array<{ certificate_id: number; verification_level: number; status: string; certificate_version?: number }> = [];

      if (certificateIds.length) {
        try {
          const { data: v, error: verifError } = await supabaseAdmin
            .from('certificate_verification')
            .select('certificate_id, verification_level, status, certificate_version')
            .in('certificate_id', certificateIds);

          if (!verifError && v) verifications = v;
        } catch { }
      }

      // Calculate stats for verifikator
      const assignedCertificates = certificates?.length || 0;
      let pendingVerifications = 0;
      let completedVerifications = 0;
      let rejectedVerifications = 0;

      // Calculate verification level stats
      const verificationStats = {
        level1: { pending: 0, approved: 0, rejected: 0 },
        level2: { pending: 0, approved: 0, rejected: 0 },
        level3: { pending: 0, approved: 0, rejected: 0 }
      };

      certificates?.forEach(cert => {
        const certVersion = (cert as any).version ?? 1;
        const isVerifikator1 = cert.verifikator_1 === user.id;
        const isVerifikator2 = cert.verifikator_2 === user.id;
        const isAuthorizedBy = cert.authorized_by === user.id;

        let userVerificationStatus = null;
        let userVerificationLevel = null;

        if (isVerifikator1) {
          const verif1 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 1 && (v.certificate_version ?? 1) === certVersion);
          userVerificationStatus = verif1?.status || 'pending';
          userVerificationLevel = 1;
        } else if (isVerifikator2) {
          const verif2 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 2 && (v.certificate_version ?? 1) === certVersion);
          userVerificationStatus = verif2?.status || 'pending';
          userVerificationLevel = 2;
        } else if (isAuthorizedBy) {
          const verif3 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 3 && (v.certificate_version ?? 1) === certVersion);
          userVerificationStatus = verif3?.status || 'pending';
          userVerificationLevel = 3;
        }

        if (userVerificationStatus === 'pending') {
          pendingVerifications++;
        } else if (userVerificationStatus === 'approved') {
          completedVerifications++;
        } else if (userVerificationStatus === 'rejected') {
          rejectedVerifications++;
        }

        // Update verification level stats
        if (userVerificationLevel === 1) {
          if (userVerificationStatus === 'pending') verificationStats.level1.pending++;
          else if (userVerificationStatus === 'approved') verificationStats.level1.approved++;
          else if (userVerificationStatus === 'rejected') verificationStats.level1.rejected++;
        } else if (userVerificationLevel === 2) {
          if (userVerificationStatus === 'pending') verificationStats.level2.pending++;
          else if (userVerificationStatus === 'approved') verificationStats.level2.approved++;
          else if (userVerificationStatus === 'rejected') verificationStats.level2.rejected++;
        } else if (userVerificationLevel === 3) {
          if (userVerificationStatus === 'pending') verificationStats.level3.pending++;
          else if (userVerificationStatus === 'approved') verificationStats.level3.approved++;
          else if (userVerificationStatus === 'rejected') verificationStats.level3.rejected++;
        }
      });

      // Calculate certificate stats
      const certificateStats = {
        total: assignedCertificates || 0,
        pending: pendingVerifications || 0,
        approved: completedVerifications || 0,
        rejected: rejectedVerifications || 0
      };

      // If no data, provide sample data for testing
      if (assignedCertificates === 0) {
        const sampleData = {
          role: userRole,
          assignedCertificates: 5,
          pendingVerifications: 2,
          completedVerifications: 2,
          rejectedVerifications: 1,
          certificateStats: {
            total: 5,
            pending: 2,
            approved: 2,
            rejected: 1
          },
          verificationStats: {
            level1: { pending: 1, approved: 1, rejected: 0 },
            level2: { pending: 1, approved: 1, rejected: 1 },
            level3: { pending: 0, approved: 0, rejected: 0 }
          },
          recentCertificates: [
            { id: 1, no_certificate: 'CERT-001', no_order: 'ORD-001', created_at: new Date().toISOString() },
            { id: 2, no_certificate: 'CERT-002', no_order: 'ORD-002', created_at: new Date().toISOString() }
          ]
        };

        console.log('Verifikator API response (sample data):', sampleData);
        return NextResponse.json(sampleData);
      }

      const responseData = {
        role: userRole,
        assignedCertificates,
        pendingVerifications,
        completedVerifications,
        certificateStats,
        verificationStats,
        recentCertificates: certificates?.slice(0, 5) || []
      };

      console.log('Verifikator API response:', responseData);
      return NextResponse.json(responseData);

    } else if (userRole === 'admin') {
      // Admin gets limited view - total count only
      const { data: certificates, error: certError } = await supabaseAdmin
        .from('certificate')
        .select('id, created_at, no_certificate, no_order, instrument')
        .order('created_at', { ascending: false });

      if (certError) return NextResponse.json({ error: certError.message }, { status: 500 });

      // Get verification status for all certificates
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
        } catch { }
      }

      // Calculate overall certificate stats
      let pendingCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;

      certificates?.forEach(cert => {
        const certVersion = (cert as any).version ?? 1;
        const verif1 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 1 && (v.certificate_version ?? 1) === certVersion);
        const verif2 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 2 && (v.certificate_version ?? 1) === certVersion);
        const verif3 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 3 && (v.certificate_version ?? 1) === certVersion);

        // Determine overall status based on verification levels
        if (verif3?.status === 'approved') {
          approvedCount++;
        } else if (verif1?.status === 'rejected' || verif2?.status === 'rejected' || verif3?.status === 'rejected') {
          rejectedCount++;
        } else {
          pendingCount++;
        }
      });

      const certificateStats = {
        total: certificates?.length || 0,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      };

      // If no data, provide sample data for testing
      if ((certificates?.length || 0) === 0) {
        const sampleData = {
          role: userRole,
          totalCertificates: 10,
          certificateStats: {
            total: 10,
            pending: 3,
            approved: 5,
            rejected: 2
          },
          recentCertificates: [
            { id: 1, instrument_name: 'Sample Admin Instrument 1', created_at: new Date().toISOString() },
            { id: 2, instrument_name: 'Sample Admin Instrument 2', created_at: new Date().toISOString() }
          ],
          adminLimited: true
        };

        console.log('Admin API response (sample data):', sampleData);
        return NextResponse.json(sampleData);
      }

      const responseData = {
        role: userRole,
        totalCertificates: certificates?.length || 0,
        certificateStats,
        recentCertificates: certificates?.slice(0, 5) || [],
        adminLimited: true
      };

      console.log('Admin API response:', responseData);
      return NextResponse.json(responseData);

    } else if (userRole === 'assignor') {
      // Assignor role - limited to assignment functions
      const { data: certificates, error: certError } = await supabaseAdmin
        .from('certificate')
        .select('id, created_at, no_certificate, no_order, instrument, verifikator_1, verifikator_2, authorized_by, status')
        .eq('authorized_by', user.id)
        .order('created_at', { ascending: false });

      if (certError) return NextResponse.json({ error: certError.message }, { status: 500 });

      // Get verification status for all certificates to determine "Ready for Signature"
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
        } catch { }
      }

      let pendingAssignmentCount = 0;
      let readyForSignatureCount = 0;
      let signedCount = 0;

      certificates?.forEach(cert => {
        // Check pending assignment
        if (!cert.verifikator_1 || !cert.verifikator_2) {
          pendingAssignmentCount++;
        }

        // Check ready for signature (Level 1 & 2 Approved, Level 3 Pending)
        // We assume version 1 for simplicity in dashboard overview, or take the latest if available
        const certVersion = (cert as any).version ?? 1;
        const verif1 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 1 && (v.certificate_version ?? 1) === certVersion);
        const verif2 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 2 && (v.certificate_version ?? 1) === certVersion);
        const verif3 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 3 && (v.certificate_version ?? 1) === certVersion);

        if (verif1?.status === 'approved' && verif2?.status === 'approved' && (!verif3 || verif3.status === 'pending')) {
          readyForSignatureCount++;
        }

        if (verif3?.status === 'approved') {
          signedCount++;
        }
      });

      const totalCertificates = certificates?.length || 0;
      const certificateStats = {
        total: totalCertificates,
        pending: pendingAssignmentCount, // Reusing pending for "Pending Assignment"
        approved: signedCount,
        rejected: 0 // Not primarily tracked for assignor overview
      };

      const responseData = {
        role: userRole,
        totalCertificates: totalCertificates,
        certificateStats,
        pendingAssignment: pendingAssignmentCount,
        readyForSignature: readyForSignatureCount,
        recentCertificates: certificates?.slice(0, 5) || [],
        assignorLimited: true
      };

      console.log('Assignor API response:', responseData);
      return NextResponse.json(responseData);

    } else if (userRole === 'user_station' || userRole === 'calibrator') {
      // User station and calibrator roles - access to certificates, instruments, sensors
      const { data: certificates, error: certError } = await supabaseAdmin
        .from('certificate')
        .select('id, created_at, no_certificate, no_order, instrument, status')
        .order('created_at', { ascending: false });

      if (certError) return NextResponse.json({ error: certError.message }, { status: 500 });

      // Get instruments count
      const { count: instrumentCount, error: instrError } = await supabaseAdmin
        .from('instrument')
        .select('*', { count: 'exact', head: true });

      const totalCertificates = certificates?.length || 0;

      let draftsCount = 0;
      let returnedCount = 0;
      let completedCount = 0;

      certificates?.forEach(cert => {
        if (cert.status === 'draft') draftsCount++;
        else if (cert.status === 'rejected') returnedCount++;
        else if (cert.status === 'completed' || cert.status === 'verified') completedCount++;
      });

      const certificateStats = {
        total: totalCertificates,
        pending: draftsCount, // Using pending for Drafts
        approved: completedCount,
        rejected: returnedCount
      };

      const responseData = {
        role: userRole,
        totalCertificates: totalCertificates,
        activeInstruments: instrumentCount || 0,
        certificateStats,
        drafts: draftsCount,
        returned: returnedCount,
        recentCertificates: certificates?.slice(0, 5) || [],
        stationAccess: true
      };

      console.log(`${userRole} API response:`, responseData);
      return NextResponse.json(responseData);

    } else {
      // Other roles get general stats
      const { data: certificates, error: certError } = await supabaseAdmin
        .from('certificate')
        .select('id, created_at, no_certificate, no_order, instrument')
        .order('created_at', { ascending: false });

      if (certError) return NextResponse.json({ error: certError.message }, { status: 500 });

      // Get verification status for all certificates
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
        } catch { }
      }

      // Calculate overall certificate stats
      let pendingCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;

      certificates?.forEach(cert => {
        const certVersion = (cert as any).version ?? 1;
        const verif1 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 1 && (v.certificate_version ?? 1) === certVersion);
        const verif2 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 2 && (v.certificate_version ?? 1) === certVersion);
        const verif3 = verifications.find(v => v.certificate_id === cert.id && v.verification_level === 3 && (v.certificate_version ?? 1) === certVersion);

        // Determine overall status based on verification levels
        if (verif3?.status === 'approved') {
          approvedCount++;
        } else if (verif1?.status === 'rejected' || verif2?.status === 'rejected' || verif3?.status === 'rejected') {
          rejectedCount++;
        } else {
          pendingCount++;
        }
      });

      const certificateStats = {
        total: certificates?.length || 0,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      };

      // If no data, provide sample data for testing
      if ((certificates?.length || 0) === 0) {
        const sampleData = {
          role: userRole,
          totalCertificates: 8,
          certificateStats: {
            total: 8,
            pending: 2,
            approved: 4,
            rejected: 2
          },
          recentCertificates: [
            { id: 1, no_certificate: 'CERT-001', no_order: 'ORD-001', created_at: new Date().toISOString() },
            { id: 2, no_certificate: 'CERT-002', no_order: 'ORD-002', created_at: new Date().toISOString() }
          ]
        };

        console.log('Default role API response (sample data):', sampleData);
        return NextResponse.json(sampleData);
      }

      const responseData = {
        role: userRole,
        totalCertificates: certificates?.length || 0,
        certificateStats,
        recentCertificates: certificates?.slice(0, 5) || []
      };

      console.log('Default role API response:', responseData);
      return NextResponse.json(responseData);
    }

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
