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
          <RoleBasedDashboard />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
