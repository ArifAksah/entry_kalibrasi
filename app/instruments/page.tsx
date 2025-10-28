'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import InstrumentsCRUD from '../ui/dashboard/instruments-crud';

const InstrumentsPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Instrument Management</h1>
            <InstrumentsCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default InstrumentsPage;