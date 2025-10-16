'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';

interface DashboardData {
  assignedCertificates?: number;
  pendingVerifications?: number;
  completedVerifications?: number;
  totalCertificates?: number;
  recentCertificates?: any[];
  certificateStats?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  verificationStats?: {
    level1: { pending: number; approved: number; rejected: number };
    level2: { pending: number; approved: number; rejected: number };
    level3: { pending: number; approved: number; rejected: number };
  };
}

// Chart Component untuk menampilkan status certificate
const CertificateStatusChart: React.FC<{ stats: DashboardData['certificateStats'] }> = ({ stats }) => {
  if (!stats) return null;

  const total = stats.total || 1; // Avoid division by zero
  const pendingPercent = (stats.pending / total) * 100;
  const approvedPercent = (stats.approved / total) * 100;
  const rejectedPercent = (stats.rejected / total) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Status Overview</h3>
      
      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-yellow-700">Pending</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          <div className="text-sm text-green-700">Approved</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          <div className="text-sm text-red-700">Rejected</div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Pending</span>
            <span className="text-gray-900">{pendingPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-yellow-500 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${pendingPercent}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Approved</span>
            <span className="text-gray-900">{approvedPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${approvedPercent}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Rejected</span>
            <span className="text-gray-900">{rejectedPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-red-500 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${rejectedPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Verification Level Chart untuk verifikator
const VerificationLevelChart: React.FC<{ stats: DashboardData['verificationStats'] }> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Levels</h3>
      
      <div className="space-y-4">
        {/* Level 1 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Level 1 (Verifikator 1)</span>
            <span className="text-xs text-gray-500">
              P: {stats.level1.pending} | A: {stats.level1.approved} | R: {stats.level1.rejected}
            </span>
          </div>
          <div className="flex space-x-1">
            <div className="flex-1 bg-yellow-200 rounded h-2" style={{ width: `${(stats.level1.pending / (stats.level1.pending + stats.level1.approved + stats.level1.rejected || 1)) * 100}%` }}></div>
            <div className="flex-1 bg-green-200 rounded h-2" style={{ width: `${(stats.level1.approved / (stats.level1.pending + stats.level1.approved + stats.level1.rejected || 1)) * 100}%` }}></div>
            <div className="flex-1 bg-red-200 rounded h-2" style={{ width: `${(stats.level1.rejected / (stats.level1.pending + stats.level1.approved + stats.level1.rejected || 1)) * 100}%` }}></div>
          </div>
        </div>

        {/* Level 2 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Level 2 (Verifikator 2)</span>
            <span className="text-xs text-gray-500">
              P: {stats.level2.pending} | A: {stats.level2.approved} | R: {stats.level2.rejected}
            </span>
          </div>
          <div className="flex space-x-1">
            <div className="flex-1 bg-yellow-200 rounded h-2" style={{ width: `${(stats.level2.pending / (stats.level2.pending + stats.level2.approved + stats.level2.rejected || 1)) * 100}%` }}></div>
            <div className="flex-1 bg-green-200 rounded h-2" style={{ width: `${(stats.level2.approved / (stats.level2.pending + stats.level2.approved + stats.level2.rejected || 1)) * 100}%` }}></div>
            <div className="flex-1 bg-red-200 rounded h-2" style={{ width: `${(stats.level2.rejected / (stats.level2.pending + stats.level2.approved + stats.level2.rejected || 1)) * 100}%` }}></div>
          </div>
        </div>

        {/* Level 3 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Level 3 (Authorized By)</span>
            <span className="text-xs text-gray-500">
              P: {stats.level3.pending} | A: {stats.level3.approved} | R: {stats.level3.rejected}
            </span>
          </div>
          <div className="flex space-x-1">
            <div className="flex-1 bg-yellow-200 rounded h-2" style={{ width: `${(stats.level3.pending / (stats.level3.pending + stats.level3.approved + stats.level3.rejected || 1)) * 100}%` }}></div>
            <div className="flex-1 bg-green-200 rounded h-2" style={{ width: `${(stats.level3.approved / (stats.level3.pending + stats.level3.approved + stats.level3.rejected || 1)) * 100}%` }}></div>
            <div className="flex-1 bg-red-200 rounded h-2" style={{ width: `${(stats.level3.rejected / (stats.level3.pending + stats.level3.approved + stats.level3.rejected || 1)) * 100}%` }}></div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center space-x-4 text-xs text-gray-500">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-200 rounded mr-1"></div>
          Pending
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-200 rounded mr-1"></div>
          Approved
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-200 rounded mr-1"></div>
          Rejected
        </div>
      </div>
    </div>
  );
};

const RoleBasedDashboard: React.FC = () => {
  const { user } = useAuth();
  const { role } = usePermissions();
  const [dashboardData, setDashboardData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || !role) return;
      
      try {
        setLoading(true);
        
        // Get session token for API calls
        const { data: { session } } = await import('../../../lib/supabase').then(m => m.supabase.auth.getSession());
        if (!session) {
          setError('No active session');
          return;
        }

        const response = await fetch('/api/dashboard/role-based', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        } else {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to load dashboard data');
        }
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, role]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  const renderVerifikatorDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards for Verifikator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Assigned Certificates</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.assignedCertificates || 0}</p>
              <p className="text-sm text-gray-500 mt-1">Total assigned to you</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Pending Verification</p>
              <p className="text-2xl font-bold text-yellow-600">{dashboardData.pendingVerifications || 0}</p>
              <p className="text-sm text-gray-500 mt-1">Awaiting your review</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⏳</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Completed</p>
              <p className="text-2xl font-bold text-green-600">{dashboardData.completedVerifications || 0}</p>
              <p className="text-sm text-gray-500 mt-1">Verified by you</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Certificate Status Chart */}
        {dashboardData.certificateStats ? (
          <CertificateStatusChart stats={dashboardData.certificateStats} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Status Overview</h3>
            <div className="text-center text-gray-500 py-8">
              <p>No certificate data available</p>
            </div>
          </div>
        )}
        
        {/* Verification Level Chart */}
        {dashboardData.verificationStats ? (
          <VerificationLevelChart stats={dashboardData.verificationStats} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Levels</h3>
            <div className="text-center text-gray-500 py-8">
              <p>No verification data available</p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Certificates for Verifikator */}
      {dashboardData.recentCertificates && dashboardData.recentCertificates.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Assigned Certificates</h3>
          <div className="space-y-3">
            {dashboardData.recentCertificates.map((cert: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Certificate #{cert.id} - {cert.no_certificate || 'Unknown Certificate'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Status: {cert.userVerificationStatus || 'pending'} | 
                    Level: {cert.userVerificationLevel || 'N/A'}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <a 
                    href={`/certificate-verification`}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Review
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards for Admin */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Certificates</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.totalCertificates || 0}</p>
              <p className="text-sm text-gray-500 mt-1">All certificates in system</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📄</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">View Only</p>
              <p className="text-2xl font-bold text-gray-500">👁️</p>
              <p className="text-sm text-gray-500 mt-1">Limited admin actions</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔒</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section for Admin */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Certificate Status Chart */}
        {dashboardData.certificateStats ? (
          <CertificateStatusChart stats={dashboardData.certificateStats} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Status Overview</h3>
            <div className="text-center text-gray-500 py-8">
              <p>No certificate data available</p>
            </div>
          </div>
        )}
        
        {/* System Overview Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Total Certificates</span>
              </div>
              <span className="text-lg font-bold text-blue-600">{dashboardData.totalCertificates || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Pending Verification</span>
              </div>
              <span className="text-lg font-bold text-yellow-600">{dashboardData.certificateStats?.pending || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Approved</span>
              </div>
              <span className="text-lg font-bold text-green-600">{dashboardData.certificateStats?.approved || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Rejected</span>
              </div>
              <span className="text-lg font-bold text-red-600">{dashboardData.certificateStats?.rejected || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Admin Access Limited</h3>
            <p className="text-sm text-yellow-700 mt-1">
              As an admin, you have view-only access to certificates to maintain data integrity. 
              You cannot edit or delete certificates directly to preserve originalitas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAssignorDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards for Assignor */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Certificates</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.totalCertificates || 0}</p>
              <p className="text-sm text-gray-500 mt-1">Certificates you can assign</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Assignment Only</p>
              <p className="text-2xl font-bold text-gray-500">🎯</p>
              <p className="text-sm text-gray-500 mt-1">Limited to assignment tasks</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section for Assignor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Certificate Status Chart */}
        {dashboardData.certificateStats ? (
          <CertificateStatusChart stats={dashboardData.certificateStats} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Status Overview</h3>
            <div className="text-center text-gray-500 py-8">
              <p>No certificate data available</p>
            </div>
          </div>
        )}
        
        {/* Assignment Overview Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Total Certificates</span>
              </div>
              <span className="text-lg font-bold text-blue-600">{dashboardData.totalCertificates || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Pending Assignment</span>
              </div>
              <span className="text-lg font-bold text-yellow-600">{dashboardData.certificateStats?.pending || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Assigned</span>
              </div>
              <span className="text-lg font-bold text-green-600">{dashboardData.certificateStats?.approved || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Assignor Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-2xl">🎯</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Assignor Access</h3>
            <p className="text-sm text-blue-700 mt-1">
              As an assignor, you have access to certificate assignment functions. 
              You can view and assign certificates to verifikators.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUserStationDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards for User Station */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Certificates</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.totalCertificates || 0}</p>
              <p className="text-sm text-gray-500 mt-1">Station certificates</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📄</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Instruments</p>
              <p className="text-2xl font-bold text-gray-500">🔧</p>
              <p className="text-sm text-gray-500 mt-1">Station instruments</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⚙️</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Sensors</p>
              <p className="text-2xl font-bold text-gray-500">📡</p>
              <p className="text-sm text-gray-500 mt-1">Station sensors</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Calibration</p>
              <p className="text-2xl font-bold text-gray-500">⚖️</p>
              <p className="text-sm text-gray-500 mt-1">Calibration tasks</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔬</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section for User Station */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Certificate Status Chart */}
        {dashboardData.certificateStats ? (
          <CertificateStatusChart stats={dashboardData.certificateStats} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Status Overview</h3>
            <div className="text-center text-gray-500 py-8">
              <p>No certificate data available</p>
            </div>
          </div>
        )}
        
        {/* Station Overview Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Station Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Total Certificates</span>
              </div>
              <span className="text-lg font-bold text-blue-600">{dashboardData.totalCertificates || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Pending Verification</span>
              </div>
              <span className="text-lg font-bold text-yellow-600">{dashboardData.certificateStats?.pending || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Approved</span>
              </div>
              <span className="text-lg font-bold text-green-600">{dashboardData.certificateStats?.approved || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Rejected</span>
              </div>
              <span className="text-lg font-bold text-red-600">{dashboardData.certificateStats?.rejected || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Station Access Notice */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-2xl">🏢</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">Station Access</h3>
            <p className="text-sm text-green-700 mt-1">
              As a station user, you have access to certificates, instruments, and sensors. 
              You can also perform calibration tasks for your station.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCalibratorDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards for Calibrator */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Certificates</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.totalCertificates || 0}</p>
              <p className="text-sm text-gray-500 mt-1">Calibration certificates</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📄</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Instruments</p>
              <p className="text-2xl font-bold text-gray-500">🔧</p>
              <p className="text-sm text-gray-500 mt-1">Calibration instruments</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⚙️</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Sensors</p>
              <p className="text-2xl font-bold text-gray-500">📡</p>
              <p className="text-sm text-gray-500 mt-1">Calibration sensors</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Calibration</p>
              <p className="text-2xl font-bold text-gray-500">⚖️</p>
              <p className="text-sm text-gray-500 mt-1">Calibration tasks</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔬</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section for Calibrator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Certificate Status Chart */}
        {dashboardData.certificateStats ? (
          <CertificateStatusChart stats={dashboardData.certificateStats} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Status Overview</h3>
            <div className="text-center text-gray-500 py-8">
              <p>No certificate data available</p>
            </div>
          </div>
        )}
        
        {/* Calibration Overview Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Calibration Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Total Certificates</span>
              </div>
              <span className="text-lg font-bold text-blue-600">{dashboardData.totalCertificates || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Pending Calibration</span>
              </div>
              <span className="text-lg font-bold text-yellow-600">{dashboardData.certificateStats?.pending || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Calibrated</span>
              </div>
              <span className="text-lg font-bold text-green-600">{dashboardData.certificateStats?.approved || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Failed Calibration</span>
              </div>
              <span className="text-lg font-bold text-red-600">{dashboardData.certificateStats?.rejected || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calibrator Access Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-2xl">🔬</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-purple-800">Calibrator Access</h3>
            <p className="text-sm text-purple-700 mt-1">
              As a calibrator, you have access to certificates, instruments, and sensors. 
              You can perform calibration tasks and manage calibration data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDefaultDashboard = () => (
    <div className="space-y-6">
      {/* Default stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Certificates</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.totalCertificates || 0}</p>
              <p className="text-sm text-gray-500 mt-1">In the system</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📄</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section for Default Role */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Certificate Status Chart */}
        {dashboardData.certificateStats ? (
          <CertificateStatusChart stats={dashboardData.certificateStats} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Status Overview</h3>
            <div className="text-center text-gray-500 py-8">
              <p>No certificate data available</p>
            </div>
          </div>
        )}
        
        {/* System Overview Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Total Certificates</span>
              </div>
              <span className="text-lg font-bold text-blue-600">{dashboardData.totalCertificates || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Pending Verification</span>
              </div>
              <span className="text-lg font-bold text-yellow-600">{dashboardData.certificateStats?.pending || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Approved</span>
              </div>
              <span className="text-lg font-bold text-green-600">{dashboardData.certificateStats?.approved || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Rejected</span>
              </div>
              <span className="text-lg font-bold text-red-600">{dashboardData.certificateStats?.rejected || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Certificates */}
      {dashboardData.recentCertificates && dashboardData.recentCertificates.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Certificates</h3>
          <div className="space-y-3">
            {dashboardData.recentCertificates.map((cert: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Certificate #{cert.id} - {cert.no_certificate || 'Unknown Certificate'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Created: {new Date(cert.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {role === 'verifikator' && renderVerifikatorDashboard()}
      {role === 'admin' && renderAdminDashboard()}
      {role === 'assignor' && renderAssignorDashboard()}
      {role === 'user_station' && renderUserStationDashboard()}
      {role === 'calibrator' && renderCalibratorDashboard()}
      {role !== 'verifikator' && role !== 'admin' && role !== 'assignor' && role !== 'user_station' && role !== 'calibrator' && renderDefaultDashboard()}
    </div>
  );
};

export default RoleBasedDashboard;