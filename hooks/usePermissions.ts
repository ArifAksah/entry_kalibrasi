// hooks/usePermissions.ts - Temporary debug version
import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type Role = 'admin' | 'calibrator' | 'verifikator' | 'assignor' | 'user_station'
export type Resource = 'certificate' | 'instrument' | 'sensor' | 'tte' | 'station'
export type Action = 'create' | 'read' | 'update' | 'delete'

type Row = { role: Role; resource: Resource; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }

export const usePermissions = () => {
  const [role, setRole] = useState<Role | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [endpointCatalog, setEndpointCatalog] = useState<Array<{ id: string; resource: string; method: string; path: string }>>([])
  const [endpointPerms, setEndpointPerms] = useState<Array<{ endpoint_id: string; allow: boolean }>>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        console.log('🔍 Loading permissions...')
        
        const { data: { user } } = await supabase.auth.getUser()
        console.log('👤 User:', user?.id)
        
        if (!user) { 
          console.log('❌ No user found')
          setRole(null); 
          setRows([]); 
          return 
        }

        const rRole = await fetch(`/api/user-roles?user_id=${user.id}`)
        const dRole = await rRole.json().catch(() => null)
        const theRole: Role | null = rRole.ok && dRole?.role ? dRole.role : null
        console.log('🎭 User role:', theRole)
        setRole(theRole)

        // Untuk testing, skip permission check dan return true untuk semua
        console.log('⏩ Skipping permission checks for debugging')
        
        setRows([])
        setEndpointCatalog([])
        setEndpointPerms([])

      } catch (error) {
        console.error('❌ Failed to load permissions:', error)
        setRows([])
      } finally {
        setLoading(false)
        console.log('✅ Permissions loading completed')
      }
    }
    load()
  }, [])

  // Untuk debugging, return true untuk semua permission
  const can = useCallback((resource: Resource, action: Action): boolean => {
    console.log(`🔐 Permission check: ${action} on ${resource} -> ALLOWED (debug mode)`)
    return true
  }, [])

  const canEndpoint = useCallback((method: string, path: string): boolean => {
    console.log(`🔐 Endpoint permission: ${method} ${path} -> ALLOWED (debug mode)`)
    return true
  }, [])

  return { 
    role, 
    loading, 
    can, 
    canEndpoint, 
    rows, 
    endpointCatalog 
  }
}