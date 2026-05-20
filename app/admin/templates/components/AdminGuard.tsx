'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { role, loading: roleLoading } = usePermissions()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (authLoading || roleLoading) return

    if (!user) {
      router.replace('/login')
      return
    }

    if (role !== 'admin') {
      router.replace('/dashboard')
      return
    }

    setAuthorized(true)
  }, [user, role, authLoading, roleLoading, router])

  if (authLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!authorized) {
    return null
  }

  return <>{children}</>
}
