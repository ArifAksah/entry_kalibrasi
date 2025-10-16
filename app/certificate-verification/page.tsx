'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import CertificateVerificationCRUD from '../ui/dashboard/certificate-verification-crud';

const CertificateVerificationPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="dashboard-container">
        <SideNav />
        <div className="main-content">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Certificate Verification</h1>
              <p className="text-gray-600">Review and verify certificates assigned to you</p>
            </div>
            <CertificateVerificationCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default CertificateVerificationPage;