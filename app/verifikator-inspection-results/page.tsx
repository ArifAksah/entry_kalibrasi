'use client'

import React from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import VerifikatorInspectionResultsCRUD from '../ui/dashboard/verifikator-inspection-results-crud'
import ProtectedRoute from '../../components/ProtectedRoute'

const VerifikatorInspectionResultsPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6">
            <VerifikatorInspectionResultsCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default VerifikatorInspectionResultsPage











