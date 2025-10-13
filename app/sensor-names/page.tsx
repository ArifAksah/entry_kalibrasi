'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import SensorNamesCRUD from '../ui/dashboard/sensor-names-crud';

const SensorNamesPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Sensor Names Management 🔧</h1>
              <p className="text-gray-600">Manage your sensor names and configurations.</p>
            </div>

            {/* Sensor Names CRUD */}
            <SensorNamesCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default SensorNamesPage;
