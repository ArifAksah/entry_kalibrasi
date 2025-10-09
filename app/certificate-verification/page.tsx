'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import CertificateVerificationCRUD from '../ui/dashboard/certificate-verification-crud';
import Breadcrumb from '../../components/ui/Breadcrumb';

const CertificateVerificationPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Certificate Verification' }]} />
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Certificate Verification</h1>
            <CertificateVerificationCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default CertificateVerificationPage;

