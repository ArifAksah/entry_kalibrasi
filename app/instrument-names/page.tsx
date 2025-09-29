"use client";

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import InstrumentNamesCRUD from '../ui/dashboard/instrument-names-crud';

export default function InstrumentNamesPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Instrument Names Management</h1>
            <InstrumentNamesCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
