'use client'

import React from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import MasterCmcCRUD from '../ui/dashboard/master-cmc-crud'

export default function MasterCmcPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <main className="p-4 sm:p-6 mx-auto max-w-[1600px]">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Master CMC</h1>
              <p className="mt-1 text-gray-500">
                Kelola kemampuan kalibrasi dan pengukuran untuk rule MAX(U95,
                CMC).
              </p>
            </div>
            <MasterCmcCRUD />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
