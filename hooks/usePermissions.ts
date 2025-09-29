import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Role = 'admin' | 'calibrator' | 'verifikator' | 'assignor' | 'user_station'
export type Resource = 'certificate' | 'instrument' | 'sensor' | 'tte'
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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setRole(null); setRows([]); return }
        const rRole = await fetch(`/api/user-roles?user_id=${user.id}`)
        const dRole = await rRole.json().catch(() => null)
        const theRole: Role | null = rRole.ok && dRole?.role ? dRole.role : null
        setRole(theRole)

        const r = await fetch('/api/role-permissions')
        const d = await r.json()
        if (r.ok && Array.isArray(d)) {
          const filtered = (d as Row[]).filter(x => !theRole || x.role === theRole)
          setRows(filtered)
        } else {
          setRows([])
        }

        // endpoint-level
        const c = await fetch('/api/endpoint-catalog')
        const cd = await c.json()
        if (c.ok && Array.isArray(cd)) setEndpointCatalog(cd)
        const ep = await fetch(theRole ? `/api/role-endpoint-permissions?role=${theRole}` : '/api/role-endpoint-permissions')
        const epd = await ep.json()
        if (ep.ok && Array.isArray(epd)) setEndpointPerms(epd.map((x:any)=>({ endpoint_id:x.endpoint_id, allow: !!x.allow })))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const map = useMemo(() => {
    const m = new Map<Resource, { create: boolean; read: boolean; update: boolean; delete: boolean }>()
    for (const r of rows) {
      m.set(r.resource, { create: !!r.can_create, read: !!r.can_read, update: !!r.can_update, delete: !!r.can_delete })
    }
    return m
  }, [rows])

  const can = (resource: Resource, action: Action): boolean => {
    if (role === 'admin') return true
    const p = map.get(resource)
    if (!p) return false
    return (p as any)[action] === true
  }

  // Endpoint-level permission
  const toRegex = (pattern: string): RegExp => {
    // support '/api/sensors/:id' and '/api/sensors/[id]'
    const escaped = pattern
      .replace(/\./g, '\\.')
      .replace(/\[\w+\]/g, '[^/]+')
      .replace(/:([A-Za-z0-9_]+)/g, '[^/]+')
    return new RegExp('^' + escaped + '$')
  }

  const canEndpoint = (method: string, path: string): boolean => {
    if (role === 'admin') return true
    const m = method.toUpperCase()
    const matches = endpointCatalog.filter(e => e.method?.toUpperCase() === m && toRegex(e.path).test(path))
    if (matches.length === 0) return true // if not cataloged, don't block UI
    // require at least one allowed mapping
    const allowed = matches.some(e => endpointPerms.find(p => p.endpoint_id === e.id)?.allow)
    return !!allowed
  }

  return { role, loading, can, canEndpoint, rows, endpointCatalog }
}


