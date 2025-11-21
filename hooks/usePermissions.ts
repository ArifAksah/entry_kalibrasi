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

        // Permission checks enabled
        // console.log('⏩ Skipping permission checks for debugging')

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

  // Permission logic implementation
  const can = useCallback((resource: Resource, action: Action): boolean => {
    if (!role) return false

    // Admin has full access to manage system, but typically doesn't create operational data (certificates)
    // unless necessary. Based on "admin bagian manajemen sistem", let's allow most things but maybe warn on creation?
    // For now, giving Admin full power for management.
    if (role === 'admin') return true

    // Calibrator: The one who makes certificates.
    if (role === 'calibrator') {
      if (resource === 'certificate') {
        return ['create', 'read', 'update', 'delete'].includes(action)
      }
      if (resource === 'instrument' || resource === 'sensor') {
        return ['create', 'read', 'update', 'delete'].includes(action)
      }
      return action === 'read'
    }

    // Verifikator: The checker.
    if (role === 'verifikator') {
      if (resource === 'certificate') {
        // Can read and "update" (which covers verification actions in some contexts, 
        // but strictly they shouldn't edit the certificate data itself).
        // For UI buttons like "Edit", we might want to return false if it means "Edit Content".
        // However, the verification flow might check 'update' permission.
        // Let's be strict: Verifikator cannot CREATE or DELETE certificates.
        return action === 'read' || action === 'update' // Update needed for verification status?
      }
      if (resource === 'instrument' || resource === 'sensor') {
        return ['read', 'update'].includes(action)
      }
      return action === 'read'
    }

    // Assignor: The signer.
    if (role === 'assignor') {
      if (resource === 'certificate') {
        // Can read and sign (update status). Cannot create.
        return action === 'read' || action === 'update'
      }
      return action === 'read'
    }

    // User Station: Read only (or manage own station settings?)
    if (role === 'user_station') {
      if (resource === 'instrument' || resource === 'sensor') {
        return ['create', 'read', 'update'].includes(action)
      }
      return action === 'read'
    }

    return false
  }, [role])

  const canEndpoint = useCallback((method: string, path: string): boolean => {
    if (!role) return false
    if (role === 'admin') return true

    const m = method.toUpperCase()

    // Calibrator can POST/PUT to certificates
    if (role === 'calibrator') {
      if (path.startsWith('/api/certificates') || path.startsWith('/api/instruments') || path.startsWith('/api/sensors')) {
        return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m)
      }
    }

    // Verifikator/Assignor can only update specific endpoints (verification/signing)
    // But for general resources, they are mostly read-only
    if (role === 'verifikator' || role === 'assignor') {
      if (m === 'GET') return true
      // Allow specific verification endpoints if needed (usually handled by specific route checks)
      if (path.includes('/verify') || path.includes('/sign')) return true
    }

    if (role === 'user_station') {
      return m === 'GET'
    }

    return m === 'GET' // Default to allow read for authenticated users? Or strict false?
  }, [role])

  return {
    role,
    loading,
    can,
    canEndpoint,
    rows,
    endpointCatalog
  }
}