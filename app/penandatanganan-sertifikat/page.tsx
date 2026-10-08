'use client'

import React from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import CertificateVerificationCRUD from '../ui/dashboard/certificate-verification-crud'

const CertificateSigningPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="dashboard-container">
        <SideNav />
        <div className="main-content">
          <Header />
          <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
            <div className="mb-6">
              <h1 className="mb-2 text-3xl font-bold text-gray-900">Penandatanganan Sertifikat</h1>
              <p className="text-gray-600">
                Tandatangani secara elektronik sertifikat yang telah selesai diverifikasi.
              </p>
            </div>
            <CertificateVerificationCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default CertificateSigningPage
