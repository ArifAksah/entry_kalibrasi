'use client';

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import SideNav from './ui/dashboard/sidenav';
import Header from './ui/dashboard/header';
import RoleBasedDashboard from './ui/dashboard/role-based-dashboard';
import { useTour } from '../hooks/useTour';

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const displayName = (user?.user_metadata as any)?.name || user?.email || 'User';

  /* eslint-disable react/no-unescaped-entities */
  const { startTour } = useTour({
    steps: [
      {
        element: '#welcome-header',
        popover: {
          title: 'Selamat Datang di Sistem Kalibrasi BMKG! 👋',
          description: 'Halo! Ini adalah dashboard utama Anda. Di sini Anda dapat memantau status notifikasi sertifikat dan aktivitas terbaru yang memerlukan perhatian Anda.',
          side: "bottom",
          align: 'start'
        }
      },
      {
        element: '#sidenav-container',
        popover: {
          title: 'Menu Navigasi Utama',
          description: 'Gunakan panel ini untuk berpindah antar halaman. Anda dapat mengakses menu Alat (Instruments), Stasiun, dan Manajemen Sertifikat dari sini sesuai dengan hak akses Anda.',
          side: "right",
          align: 'start'
        }
      },
      {
        element: '#role-based-dashboard',
        popover: {
          title: 'Area Kerja & Statistik',
          description: 'Ini adalah area kerja utama Anda. Tergantung peran Anda (Verifikator, Kalibrator, dll), Anda akan melihat kartu statistik, daftar tugas yang tertunda, dan grafik kinerja di sini.',
          side: "top",
          align: 'start'
        }
      }
    ]
  });

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            {/* Welcome Section */}
            <div id="welcome-header" className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {displayName}! 👋</h1>
                <p className="text-gray-600">Overview of certificate verification status and recent activity.</p>
              </div>
              <button
                onClick={startTour}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                Mulai Tur
              </button>
            </div>

            {/* Role-based Dashboard Content */}
            <div id="role-based-dashboard">
              <RoleBasedDashboard />
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default HomePage;