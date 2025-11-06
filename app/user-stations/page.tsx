'use client'

import React, { useEffect, useState } from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'
import { supabase } from '../../lib/supabase'
import UserStationAssignment from '../ui/dashboard/user-station-assignment'

const UserStationsPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="flex h-screen">
        <SideNav />
        <div className="flex-1 overflow-auto">
          <Header />
          <main className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">User Station Assignment</h1>
              <p className="text-gray-600 mt-1">Assign multiple stations to users</p>
            </div>
            <UserStationAssignment />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default UserStationsPage