'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'
import { supabase } from '../../lib/supabase'
import Loading from '../../components/ui/Loading'
import Alert from '../../components/ui/Alert'
import { useAlert } from '../../hooks/useAlert'

type Role = 'admin' | 'calibrator' | 'verifikator' | 'assignor' | 'user_station'
type Resource = string

type Row = { role: Role; resource: Resource; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }

const allRoles: Role[] = ['admin', 'calibrator', 'verifikator', 'assignor', 'user_station']
// resources are resolved dynamically from /api/resources
const actionDefs = [
  { key: 'can_create' as const, label: 'create' },
  { key: 'can_read' as const, label: 'read' },
  { key: 'can_update' as const, label: 'update' },
  { key: 'can_delete' as const, label: 'delete' },
]

const RolePermissionsPage: React.FC = () => {
  const { alert, showSuccess, showError, hideAlert } = useAlert()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshIntervalMs] = useState(30000)
  const [resources, setResources] = useState<Resource[]>([])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      // fetch dynamic resources
      const rr = await fetch('/api/resources', { cache: 'no-store' })
      const resList = await rr.json()
      if (!rr.ok) throw new Error(resList?.error || 'Failed to load resources')
      const resourceNames: string[] = Array.isArray(resList) ? resList : []
      setResources(resourceNames)

      // fetch current role permissions
      const r = await fetch('/api/role-permissions', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to load permissions')
      const map = new Map<string, Row>()
      for (const role of allRoles) {
        for (const resource of resourceNames) {
          map.set(`${role}:${resource}`, { role, resource, can_create: false, can_read: false, can_update: false, can_delete: false })
        }
      }
      for (const it of (Array.isArray(d) ? d : [])) {
        const key = `${it.role}:${it.resource}`
        map.set(key, { 
          role: it.role, 
          resource: it.resource, 
          can_create: !!(it.can_create ?? it.create),
          can_read: !!(it.can_read ?? it.read),
          can_update: !!(it.can_update ?? it.update),
          can_delete: !!(it.can_delete ?? it.delete)
        })
      }
      setRows(Array.from(map.values()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => { load() }, refreshIntervalMs)
    return () => clearInterval(id)
  }, [autoRefresh, load, refreshIntervalMs])

  const filteredRows = useMemo(() => {
    if (!debouncedSearch) return rows
    return rows.filter(r =>
      r.role.toLowerCase().includes(debouncedSearch) ||
      r.resource.toLowerCase().includes(debouncedSearch)
    )
  }, [rows, debouncedSearch])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / pageSize)), [filteredRows])
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage])

  const pageKeys = useMemo(() => new Set(pagedRows.map(r => `${r.role}:${r.resource}`)), [pagedRows])
  const pageStateFor = useCallback((key: keyof Row) => {
    if (pagedRows.length === 0) return { all: false, some: false }
    const vals = pagedRows.map(r => Boolean((r as any)[key]))
    const all = vals.every(Boolean)
    const some = vals.some(Boolean)
    return { all, some }
  }, [pagedRows])
  const toggleAllOnPage = useCallback((key: keyof Row, value: boolean) => {
    setRows(prev => prev.map(r => (
      pageKeys.has(`${r.role}:${r.resource}`)
        ? { ...r, [key]: value }
        : r
    )))
  }, [pageKeys])

  const toggle = (role: Role, resource: Resource, key: keyof Row) => {
    setRows(prev => prev.map(r => (r.role === role && r.resource === resource ? { ...r, [key]: !(r as any)[key] } : r)))
  }

  const save = async () => {
    try {
      setSaving(true)
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      const r = await fetch('/api/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(rows),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to save')
      showSuccess('Permissions updated')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save'
      setError(msg)
      showError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6">
            <Loading />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-6xl mx-auto">
            {alert.show && (
              <Alert
                type={alert.type}
                message={alert.message}
                onClose={hideAlert}
                autoHide={alert.autoHide}
                duration={alert.duration}
              />
            )}
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Role Permissions</h1>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-4">
                  <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                    placeholder="Search role/resource..."
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <label className="flex items-center gap-1 text-sm text-gray-600">
                    <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                    Auto refresh (30s)
                  </label>
                </div>
                <button onClick={load} className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Refresh</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>

            {error && <div className="mb-4 text-red-600">{error}</div>}

            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Role</th>
                    <th className="px-4 py-2 text-left">Resource</th>
                    {actionDefs.map(a => {
                      const state = pageStateFor(a.key)
                      return (
                        <th key={a.key} className="px-4 py-2 text-left">
                          <div className="flex items-center gap-2 uppercase text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={state.all}
                              ref={el => { if (el) el.indeterminate = !state.all && state.some }}
                              onChange={e => toggleAllOnPage(a.key as keyof Row, e.target.checked)}
                            />
                            {a.label}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map(row => (
                    <tr key={`${row.role}-${row.resource}`} className="border-t">
                      <td className="px-4 py-2 font-medium">{row.role}</td>
                      <td className="px-4 py-2">{row.resource}</td>
                      {actionDefs.map(a => (
                        <td key={a.key} className="px-4 py-2">
                          <input type="checkbox" checked={(row as any)[a.key]} onChange={() => toggle(row.role, row.resource, a.key as keyof Row)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {pagedRows.length === 0 && (
                    <tr>
                      <td colSpan={2 + actionDefs.length} className="px-4 py-6 text-center text-gray-500">No data</td>
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
    </ProtectedRoute>
  )
}

export default RolePermissionsPage


