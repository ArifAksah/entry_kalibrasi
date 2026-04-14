'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import CertificatesCRUD from '../ui/dashboard/certificates-crud';



const CertificatesPage: React.FC = () => {


  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Certificate Management</h1>

            </div>
            <CertificatesCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default CertificatesPage;









