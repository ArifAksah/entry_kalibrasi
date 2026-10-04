'use client'

import React from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import CalibrationMethodCRUD from '../ui/dashboard/calibration-method-crud'

export default function CalibrationMethodsPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Master Metode Kalibrasi</h1>
              <p className="mt-1 text-gray-500">Kelola versi metode, dokumen acuan, dan aturan audit tanpa mengubah kode.</p>
            </div>
            <CalibrationMethodCRUD />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
