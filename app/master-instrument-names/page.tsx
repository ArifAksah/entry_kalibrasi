'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import MasterInstrumentNamesCRUD from '../ui/dashboard/master-instrument-names-crud';

const MasterInstrumentNamesPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Master Instrumen</h1>
              <p className="text-gray-500 mt-1">Kelola kode instrumen dan nama instrumen turunannya</p>
            </div>
            <MasterInstrumentNamesCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default MasterInstrumentNamesPage;
