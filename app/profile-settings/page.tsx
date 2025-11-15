'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import { supabase } from '../../lib/supabase';
import { useAlert } from '../../hooks/useAlert';
import Alert from '../../components/ui/Alert';

const ProfileSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { alert, showSuccess, showError, hideAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    nip: '',
    nik: '',
    phone: ''
  });
  const [role, setRole] = useState<string>('');

  const formatRole = (role: string): string => {
    if (!role) return 'Not assigned';
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  useEffect(() => {
    const loadProfileData = async () => {
      if (!user?.id) return
      
      try {
        // Load from personel table to get latest data including NIK
        const res = await fetch(`/api/personel/${user.id}`)
        if (res.ok) {
          const personelData = await res.json()
          setFormData(prev => ({
            ...prev,
            name: personelData.name || user.user_metadata?.name || '',
            email: personelData.email || user.email || '',
            nip: personelData.nip || user.user_metadata?.nip || '',
            nik: personelData.nik || user.user_metadata?.nik || '',
            phone: personelData.phone || user.user_metadata?.phone || ''
          }))
        } else {
          // Fallback to user_metadata if personel not found
          setFormData(prev => ({
            ...prev,
            name: user.user_metadata?.name || '',
            email: user.email || '',
            nip: user.user_metadata?.nip || '',
            nik: user.user_metadata?.nik || '',
            phone: user.user_metadata?.phone || ''
          }))
        }

        // Load role from user_roles table
        const roleRes = await fetch(`/api/user-roles?user_id=${user.id}`)
        if (roleRes.ok) {
          const roleData = await roleRes.json()
          if (roleData?.role) {
            setRole(roleData.role)
          }
        }
      } catch (err) {
        // Fallback to user_metadata on error
        setFormData(prev => ({
          ...prev,
          name: user.user_metadata?.name || '',
          email: user.email || '',
          nip: user.user_metadata?.nip || '',
          nik: user.user_metadata?.nik || '',
          phone: user.user_metadata?.phone || ''
        }))
      }
    }
    
    if (user) {
      loadProfileData()
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!user?.id) {
        throw new Error('User not found')
      }

      // Update personel table
      const response = await fetch(`/api/personel/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          nip: formData.nip,
          nik: formData.nik,
          phone: formData.phone
        }),
      });

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      // Also update user metadata in auth
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        await supabase.auth.updateUser({
          data: {
            name: formData.name,
            nip: formData.nip,
            nik: formData.nik,
            phone: formData.phone
          }
        })
      }

      setSuccess('Profile berhasil diperbarui!');
      showSuccess('Profile berhasil diperbarui!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile'
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <ProtectedRoute>
      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      )}
      <div className="dashboard-container">
        <SideNav />
        <div className="main-content">
          <Header />
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
                <p className="text-gray-600 mt-2">Manage your personal information and profile details</p>
              </div>

              {/* Success/Error Messages */}
              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex">
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">{success}</p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Profile Form */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
                  <p className="text-sm text-gray-600 mt-1">Update your personal details and contact information</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        placeholder="Enter your full name"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        placeholder="Enter your email address"
                      />
                    </div>

                    {/* NIP */}
                    <div>
                      <label htmlFor="nip" className="block text-sm font-medium text-gray-700 mb-2">
                        NIP (Employee ID)
                      </label>
                      <input
                        type="text"
                        id="nip"
                        name="nip"
                        value={formData.nip}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        placeholder="Enter your NIP"
                      />
                    </div>

                    {/* NIK */}
                    <div>
                      <label htmlFor="nik" className="block text-sm font-medium text-gray-700 mb-2">
                        NIK (Nomor Induk Kependudukan)
                      </label>
                      <input
                        type="text"
                        id="nik"
                        name="nik"
                        value={formData.nik}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        placeholder="Enter your NIK"
                        maxLength={16}
                      />
                    </div>

                    {/* Position (Role) - Read Only */}
                    <div>
                      <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
                        Position (Role)
                      </label>
                      <input
                        type="text"
                        id="position"
                        name="position"
                        value={formatRole(role)}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                        placeholder="Role will be assigned by administrator"
                      />
                      <p className="mt-1 text-xs text-gray-500">Role dapat diubah oleh administrator di halaman Personel</p>
                    </div>

                    {/* Phone */}
                    <div className="md:col-span-2">
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        placeholder="Enter your phone number"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2 text-sm font-medium text-white bg-cyan-600 border border-transparent rounded-lg hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ProfileSettingsPage;