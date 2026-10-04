'use client'

import React from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import CalibrationOrdersCRUD from '../ui/dashboard/calibration-orders-crud'

const CalibrationOrdersPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-4 sm:p-6 mx-auto max-w-[1600px]">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Order Kalibrasi</h1>
              <p className="text-gray-500 mt-1">
                Booking nomor order sebelum keberangkatan dan kelola identifikasi alat
              </p>
            </div>
            <CalibrationOrdersCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default CalibrationOrdersPage
