'use client';

import React from 'react';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import RoleBasedDashboard from '../ui/dashboard/role-based-dashboard';

const DashboardPage: React.FC = () => {
  return (
    <div className="dashboard-container">
      <SideNav />
      <div className="main-content">
        <Header />
        <div className="p-6">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview 📊</h1>
            <p className="text-gray-600">Monitor your assigned tasks and system metrics.</p>
          </div>

          {/* Role-based Dashboard Content */}
          <RoleBasedDashboard />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;