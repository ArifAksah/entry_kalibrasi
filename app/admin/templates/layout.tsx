import React from 'react'
import SideNav from '../../ui/dashboard/sidenav'
import AdminGuard from './components/AdminGuard'

export default function AdminTemplatesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <div className="flex h-screen">
        <SideNav />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AdminGuard>
  )
}
