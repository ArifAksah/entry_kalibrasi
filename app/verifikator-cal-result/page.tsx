'use client'

import React from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import VerifikatorCalResultCRUD from '../ui/dashboard/verifikator-cal-result-crud';
import Breadcrumb from '../../components/ui/Breadcrumb';
import ProtectedRoute from '../../components/ProtectedRoute';

const VerifikatorCalResultPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Verifikator Cal Result' }]} />
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Verifikator Cal Result Management</h1>
            <VerifikatorCalResultCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default VerifikatorCalResultPage;












