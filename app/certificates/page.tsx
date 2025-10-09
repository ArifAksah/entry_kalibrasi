'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import CertificatesCRUD from '../ui/dashboard/certificates-crud';
import Breadcrumb from '../../components/ui/Breadcrumb';

const CertificatesPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Certificates' }]} />
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Certificate Management</h1>
            <CertificatesCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default CertificatesPage;










