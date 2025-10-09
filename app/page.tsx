'use client';

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import SideNav from './ui/dashboard/sidenav';
import Header from './ui/dashboard/header';
import StatsCards from './ui/dashboard/stats-cards';
import Chart from './ui/dashboard/chart';
// Removed non-essential widgets from dashboard

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const displayName = (user?.user_metadata as any)?.name || user?.email || 'User';

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {displayName}! 👋</h1>
            <p className="text-gray-600">Overview of SIKAP-MKG metrics and recent activity.</p>
          </div>

          {/* Stats Cards */}
          <StatsCards />

          {/* Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Chart />
          </div>

        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
};

export default HomePage;