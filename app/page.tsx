'use client';

import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import SideNav from './ui/dashboard/sidenav';
import Header from './ui/dashboard/header';
import RoleBasedDashboard from './ui/dashboard/role-based-dashboard';

const HomePage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
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
