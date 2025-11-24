'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import bmkgLogo from '../logo-bmkg-w.png';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Alert from '../../components/ui/Alert';
import { useAlert } from '../../hooks/useAlert';

const LoginPage: React.FC = () => {
  const router = useRouter();
  const { alert, showError, showSuccess, hideAlert } = useAlert();
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/');
      }
    };
    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    hideAlert();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        showError(error.message)
        return
      }

      if (data.user) {
        const { data: personelData, error: personelError } = await supabase
          .from('personel')
          .select('id, name')
          .eq('id', data.user.id)
          .single();

        if (personelError || !personelData) {
          showError('User not found in system. Please contact administrator.')
          await supabase.auth.signOut();
          return;
        }

        showSuccess(`Welcome back, ${personelData.name}!`)
        setTimeout(() => {
          router.push('/')
        }, 2000)
      }
    } catch (e) {
      showError('An unexpected error occurred')
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Alert Component */}
      {alert.show && (
        <div className="fixed top-4 right-4 z-50">
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={hideAlert}
            autoHide={alert.autoHide}
            duration={alert.duration}
          />
        </div>
      )}
      {/* Animated Background Elements - Theme Peralatan BMKG */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Radar Scan Animation */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 border-2 border-blue-400/30 rounded-full animate-ping-slow"></div>
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 border-2 border-cyan-400/30 rounded-full animate-ping-slower"></div>

        {/* Weather Icons Floating */}
        <div className="absolute top-20 left-20 text-blue-400/20 animate-float">
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 3a1 1 0 000 2c5.523 0 10 4.477 10 10a1 1 0 102 0C17 8.373 11.627 3 5 3z" />
            <path d="M5 7a1 1 0 000 2 5 5 0 015 5 1 1 0 102 0 7 7 0 00-7-7z" />
            <path d="M5 11a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
        </div>

        <div className="absolute top-40 right-32 text-cyan-400/20 animate-float-delayed">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
        </div>

        <div className="absolute bottom-40 left-32 text-green-400/20 animate-float-slow">
          <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]"></div>
      </div>

      <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
        {/* Elegant Colored Card */}
        <div className="bg-gradient-to-br from-slate-800/90 to-blue-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 transform transition-all duration-500 hover:shadow-3xl">
          <div className="py-12 px-8">
            {/* Logo Section - Larger */}
            <div className="flex flex-col items-center mb-8">
              <div className="mb-6 transform transition-all duration-500 hover:scale-110 hover:rotate-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-lg animate-pulse-gentle"></div>
                  <Image
                    src={bmkgLogo}
                    alt="BMKG"
                    width={80}
                    height={80}
                    className="relative z-10 drop-shadow-2xl"
                  />
                </div>
              </div>

              <p className="text-blue-200 text-lg font-semibold text-center">
                Sistem Informasi Kalibrasi
              </p>
              <p className="text-slate-400 text-sm text-center mt-1">
                Badan Meteorologi, Klimatologi, dan Geofisika
              </p>
            </div>

            {/* Login Form */}
            <form className="space-y-6" method="post" onSubmit={handleSubmit}>

              {/* Email Input with Floating Animation */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-bold text-white">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500 animate-float-input"></div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="relative w-full px-4 py-4 bg-slate-900/80 border border-slate-600/50 rounded-2xl placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm transition-all duration-300 group-hover:bg-slate-900/90"
                    placeholder="Enter your email"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-hover:text-blue-400 transition-colors duration-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Password Input with Floating Animation */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-bold text-white">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500 animate-float-input-delayed"></div>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="relative w-full px-4 py-4 bg-slate-900/80 border border-slate-600/50 rounded-2xl placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent backdrop-blur-sm transition-all duration-300 group-hover:bg-slate-900/90"
                    placeholder="Enter your password"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-hover:text-cyan-400 transition-colors duration-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Submit Button with Enhanced Animation */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full relative group"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 rounded-2xl blur opacity-50 group-hover:opacity-75 transition duration-500 animate-gradient-x"></div>
                  <div className="relative w-full flex justify-center items-center py-4 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl text-lg font-bold text-white hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-300 group-hover:scale-[1.02] active:scale-[0.98]">
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-3 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Access System
                      </>
                    )}
                  </div>
                </button>
              </div>
            </form>

            {/* BSrE Logo Section - Below Access System Button */}
            <div className="mt-12 flex flex-col items-center justify-center">
              <div className="mb-2">
                <Image
                  src="/bsre-logo.png"
                  alt="Balai Besar Sertifikasi Elektronik"
                  width={150}
                  height={45}
                  className="opacity-90 hover:opacity-100 transition-opacity duration-300"
                  priority
                />
              </div>
            </div>

            {/* Links */}
            <div className="mt-6 flex items-center justify-between">
              <a href="/forgot-password" className="text-sm text-blue-300 hover:text-white">Lupa password?</a>
              <div />
            </div>
            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <p className="text-center text-sm text-slate-400">© 2025 BMKG - Direktorat Data dan Komputasi</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-3deg); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.1); }
        }
        @keyframes float-input {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.02); opacity: 0.5; }
        }
        @keyframes float-input-delayed {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.02); opacity: 0.5; }
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes ping-slow {
          0% { transform: scale(0.8); opacity: 0.8; }
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes ping-slower {
          0% { transform: scale(0.8); opacity: 0.6; }
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes pulse-gentle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 7s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        .animate-float-input {
          animation: float-input 3s ease-in-out infinite;
        }
        .animate-float-input-delayed {
          animation: float-input-delayed 3s ease-in-out infinite;
          animation-delay: 1s;
        }
        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
          background-size: 200% 200%;
        }
        .animate-ping-slow {
          animation: ping-slow 4s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-ping-slower {
          animation: ping-slower 5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-pulse-gentle {
          animation: pulse-gentle 2s ease-in-out infinite;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;