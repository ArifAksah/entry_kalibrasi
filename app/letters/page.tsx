'use client'

import React from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import LettersCRUD from '../ui/dashboard/letters-crud'
import ProtectedRoute from '../../components/ProtectedRoute'

const LettersPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6">
            <LettersCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default LettersPage











