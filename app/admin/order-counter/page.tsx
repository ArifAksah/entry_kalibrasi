'use client'

import React from 'react'
import AdminGuard from '../templates/components/AdminGuard'
import SideNav from '../../ui/dashboard/sidenav'
import Header from '../../ui/dashboard/header'
import OrderCounterCRUD from '../../ui/dashboard/order-counter-crud'

const OrderCounterPage: React.FC = () => {
  return (
    <AdminGuard>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-4 sm:p-6 mx-auto max-w-[1600px]">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Counter No. Order</h1>
              <p className="text-gray-500 mt-1">
                Kelola penomoran order dan hard reset yang aman (admin)
              </p>
            </div>
            <OrderCounterCRUD />
          </div>
        </div>
      </div>
    </AdminGuard>
  )
}

export default OrderCounterPage
