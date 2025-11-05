'use client'

import React, { useEffect, useMemo, useState } from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'
import Loading from '../../components/ui/Loading'
import Alert from '../../components/ui/Alert'
import { useAlert } from '../../hooks/useAlert'
import Breadcrumb from '../../components/ui/Breadcrumb'

type Role = 'admin' | 'calibrator' | 'verifikator' | 'assignor' | 'user_station'

type Endpoint = { id: string; resource: string; method: string; path: string; description?: string | null; enabled: boolean }
type PermRow = { role: Role; endpoint_id: string; allow: boolean }

const roles: Role[] = ['admin','calibrator','verifikator','assignor','user_station']

const EndpointPermissionsPage: React.FC = () => {
  const { alert, showSuccess, showError, hideAlert } = useAlert()
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [perms, setPerms] = useState<PermRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Endpoint | null>(null)
  const [epForm, setEpForm] = useState<Partial<Endpoint>>({ resource: '', method: 'GET', path: '', description: '', enabled: true })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const resourceLabels: Record<string, string> = {
    certificate: 'Sertifikat',
    certificates: 'Sertifikat',
    instrument: 'Instrumen',
    instruments: 'Instrumen',
    sensor: 'Sensor',
    sensors: 'Sensor',
    station: 'Stasiun',
    stations: 'Stasiun',
    tte: 'TTE',
    user: 'Pengguna',
    users: 'Pengguna',
  }

  const toTitle = (s: string) => s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (m) => m.toUpperCase())
  const getResourceLabel = (key: string) => resourceLabels[key] || toTitle(key)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const r1 = await fetch('/api/endpoint-catalog')
        const d1 = await r1.json()
        if (!r1.ok) throw new Error(d1?.error || 'Failed to load endpoint catalog')
        setEndpoints(Array.isArray(d1) ? d1 : [])

        const r2 = await fetch('/api/role-endpoint-permissions')
        const d2 = await r2.json()
        if (!r2.ok) throw new Error(d2?.error || 'Failed to load permissions')
        setPerms(Array.isArray(d2) ? d2.map((x:any)=>({ role:x.role, endpoint_id:x.endpoint_id, allow:!!x.allow })) : [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [search])

  const permMap = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const p of perms) m.set(`${p.role}:${p.endpoint_id}`, p.allow)
    return m
  }, [perms])

  const filteredEndpoints = useMemo(() => {
    if (!debouncedSearch) return endpoints
    return endpoints.filter(ep => {
      const label = getResourceLabel(ep.resource).toLowerCase()
      return ep.resource.toLowerCase().includes(debouncedSearch)
        || label.includes(debouncedSearch)
        || ep.path.toLowerCase().includes(debouncedSearch)
    })
  }, [endpoints, debouncedSearch])

  const resources = useMemo(() => {
    const set = new Set<string>()
    for (const ep of filteredEndpoints) set.add(ep.resource)
    return Array.from(set).sort()
  }, [filteredEndpoints])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(resources.length / pageSize)), [resources])
  const pagedResources = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return resources.slice(start, start + pageSize)
  }, [resources, currentPage])

  const resourceEndpoints = useMemo(() => {
    const map = new Map<string, Endpoint[]>()
    for (const ep of filteredEndpoints) {
      const list = map.get(ep.resource) || []
      list.push(ep)
      map.set(ep.resource, list)
    }
    return map
  }, [filteredEndpoints])

  const roleResourceState = (role: Role, resource: string) => {
    const eps = resourceEndpoints.get(resource) || []
    if (eps.length === 0) return { all: false, some: false }
    const vals = eps.map(ep => !!permMap.get(`${role}:${ep.id}`))
    const all = vals.every(Boolean)
    const some = vals.some(Boolean)
    return { all, some }
  }

  const toggleResource = (role: Role, resource: string, value: boolean) => {
    const eps = resourceEndpoints.get(resource) || []
    setPerms(prev => {
      const next = [...prev]
      for (const ep of eps) {
        const idx = next.findIndex(p => p.role === role && p.endpoint_id === ep.id)
        if (idx >= 0) next[idx] = { ...next[idx], allow: value }
        else next.push({ role, endpoint_id: ep.id, allow: value })
      }
      return next
    })
  }

  const resourceAllState = (resource: string) => {
    const eps = resourceEndpoints.get(resource) || []
    if (eps.length === 0) return { all: false, some: false }
    const flags: boolean[] = []
    for (const ep of eps) {
      for (const role of roles) {
        flags.push(!!permMap.get(`${role}:${ep.id}`))
      }
    }
    const all = flags.length > 0 && flags.every(Boolean)
    const some = flags.some(Boolean) && !all
    return { all, some }
  }

  const toggleResourceAll = (resource: string, value: boolean) => {
    const eps = resourceEndpoints.get(resource) || []
    setPerms(prev => {
      const next = [...prev]
      for (const ep of eps) {
        for (const role of roles) {
          const idx = next.findIndex(p => p.role === role && p.endpoint_id === ep.id)
          if (idx >= 0) next[idx] = { ...next[idx], allow: value }
          else next.push({ role, endpoint_id: ep.id, allow: value })
        }
      }
      return next
    })
  }

  const toggle = (role: Role, endpoint_id: string) => {
    setPerms(prev => {
      const key = `${role}:${endpoint_id}`
      const exists = prev.find(p => p.role===role && p.endpoint_id===endpoint_id)
      if (exists) return prev.map(p => p===exists ? { ...p, allow: !p.allow } : p)
      return [...prev, { role, endpoint_id, allow: true }]
    })
  }

  const save = async () => {
    try {
      setSaving(true)
      const r = await fetch('/api/role-endpoint-permissions', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(perms) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to save')
      showSuccess('Endpoint permissions updated')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  const refreshCatalog = async () => {
    const r1 = await fetch('/api/endpoint-catalog', { cache: 'no-store' })
    const d1 = await r1.json()
    if (r1.ok) {
      setEndpoints(Array.isArray(d1) ? d1 : [])
      showSuccess('Catalog refreshed')
    } else {
      showError(d1?.error || 'Failed to refresh catalog')
    }
  }

  const openModal = (ep?: Endpoint) => {
    if (ep) { setEditing(ep); setEpForm({ ...ep }) }
    else { setEditing(null); setEpForm({ resource: '', method: 'GET', path: '', description: '', enabled: true }) }
    setIsModalOpen(true)
  }

  const closeModal = () => { setIsModalOpen(false); setEditing(null) }

  const saveEndpoint = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!epForm.method || !epForm.path || !epForm.resource) return
      const body = { resource: epForm.resource, method: epForm.method, path: epForm.path, description: epForm.description || '', enabled: epForm.enabled !== false, id: (epForm as any).id }
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch('/api/endpoint-catalog', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing ? [body] : body) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to save endpoint')
      await refreshCatalog()
      closeModal()
      showSuccess(editing ? 'Endpoint updated' : 'Endpoint created')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to save endpoint')
    }
  }

  const removeEndpoint = async (id: string) => {
    if (!confirm('Delete this endpoint?')) return
    const r = await fetch(`/api/endpoint-catalog?id=${id}`, { method: 'DELETE' })
    const d = await r.json().catch(()=>null)
    if (!r.ok) { showError(d?.error || 'Failed to delete'); return }
    await refreshCatalog()
    showSuccess('Endpoint deleted')
  }

  if (loading) return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50"><Header /><div className="p-6"><Loading /></div></div>
      </div>
    </ProtectedRoute>
  )

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <Breadcrumb items={[{ label: 'Permissions', href: '#' }, { label: 'Endpoints' }]} />
            </div>
            {alert.show && (
              <Alert type={alert.type} message={alert.message} onClose={hideAlert} autoHide={alert.autoHide} duration={alert.duration} />
            )}
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Endpoint Permissions</h1>
              <div className="flex items-center gap-2">
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                  placeholder="Search by resource or path..."
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button onClick={async()=>{ const r = await fetch('/api/endpoint-catalog/scan', { method: 'POST' }); const d = await r.json(); if (!r.ok) { showError(d?.error||'Scan failed') } else { await refreshCatalog(); showSuccess(`Scanned ${d?.count ?? 0} endpoints`) } }} className="px-3 py-2 border rounded">Scan from codebase</button>
                <button onClick={refreshCatalog} className="px-3 py-2 border rounded">Refresh</button>
                <button onClick={()=>openModal()} className="px-3 py-2 border rounded">Add Endpoint</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
            {error && <div className="mb-3 text-red-600">{error}</div>}
            <div className="overflow-x-auto border rounded bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Resource</th>
                    <th className="px-4 py-2 text-left">All</th>
                    {roles.map(r => (
                      <th key={r} className="px-4 py-2 text-left">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedResources.map(resource => (
                    <tr key={resource} className="border-t">
                      <td className="px-4 py-2 font-medium">{getResourceLabel(resource)}</td>
                      <td className="px-4 py-2">
                        {(() => {
                          const state = resourceAllState(resource)
                          return (
                            <input
                              type="checkbox"
                              checked={state.all}
                              ref={el => { if (el) el.indeterminate = state.some && !state.all }}
                              onChange={e => toggleResourceAll(resource, e.target.checked)}
                            />
                          )
                        })()}
                      </td>
                      {roles.map(r => {
                        const state = roleResourceState(r, resource)
                        return (
                          <td key={r} className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={state.all}
                              ref={el => { if (el) el.indeterminate = !state.all && state.some }}
                              onChange={e => toggleResource(r, resource, e.target.checked)}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {pagedResources.length === 0 && (
                    <tr>
                      <td colSpan={2 + roles.length} className="px-4 py-6 text-center text-gray-500">No resources found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <button className={`px-3 py-1 rounded border ${currentPage===1?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===1} onClick={()=>setCurrentPage(1)}>First</button>
                <button className={`px-3 py-1 rounded border ${currentPage===1?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===1} onClick={()=>setCurrentPage(p=>Math.max(1,p-1))}>Prev</button>
                <button className={`px-3 py-1 rounded border ${currentPage===totalPages?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))}>Next</button>
                <button className={`px-3 py-1 rounded border ${currentPage===totalPages?'text-gray-400 border-gray-200 cursor-not-allowed':'text-gray-700 border-gray-300 hover:bg-gray-50'}`} disabled={currentPage===totalPages} onClick={()=>setCurrentPage(totalPages)}>Last</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-xl rounded-lg shadow-lg p-6 mx-4">
            <h3 className="text-lg font-semibold mb-4">{editing ? 'Edit Endpoint' : 'Add Endpoint'}</h3>
            <form onSubmit={saveEndpoint} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resource</label>
                <input value={epForm.resource as any} onChange={e=>setEpForm({ ...epForm, resource: e.target.value })} required className="w-full px-3 py-2 border rounded" placeholder="sensor / instrument / certificate / station" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                <select value={epForm.method as any} onChange={e=>setEpForm({ ...epForm, method: e.target.value })} required className="w-full px-3 py-2 border rounded">
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Path</label>
                <input value={epForm.path as any} onChange={e=>setEpForm({ ...epForm, path: e.target.value })} required className="w-full px-3 py-2 border rounded" placeholder="/api/sensors or /api/sensors/:id" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea value={epForm.description as any} onChange={e=>setEpForm({ ...epForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="md:col-span-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={epForm.enabled !== false} onChange={e=>setEpForm({ ...epForm, enabled: e.target.checked })} /> Enabled
                </label>
                <div className="space-x-2">
                  <button type="button" onClick={closeModal} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">{editing ? 'Save Changes' : 'Create'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

export default EndpointPermissionsPage
