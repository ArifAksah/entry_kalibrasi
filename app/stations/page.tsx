'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import StationsCRUD from '../ui/dashboard/stations-crud';

const StationsPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Station Management</h1>
            <StationsCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StationsPage;
