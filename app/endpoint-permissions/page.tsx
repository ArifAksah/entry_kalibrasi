'use client'

import React, { useEffect, useMemo, useState } from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute';
import Breadcrumb from '../../components/ui/Breadcrumb';

type Role = 'admin' | 'calibrator' | 'verifikator' | 'assignor' | 'user_station';

type Endpoint = { id: string; resource: string; method: string; path: string; description?: string | null; enabled: boolean };
type PermRow = { role: Role; endpoint_id: string; allow: boolean };

const roles: Role[] = ['admin','calibrator','verifikator','assignor','user_station'];

const EndpointPermissionsPage: React.FC = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Endpoint | null>(null);
  const [epForm, setEpForm] = useState<Partial<Endpoint>>({ resource: '', method: 'GET', path: '', description: '', enabled: true });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const r1 = await fetch('/api/endpoint-catalog');
        const d1 = await r1.json();
        if (!r1.ok) throw new Error(d1?.error || 'Failed to load endpoint catalog');
        setEndpoints(Array.isArray(d1) ? d1 : []);

        const r2 = await fetch('/api/role-endpoint-permissions');
        const d2 = await r2.json();
        if (!r2.ok) throw new Error(d2?.error || 'Failed to load permissions');
        setPerms(Array.isArray(d2) ? d2.map((x:any)=>({ role:x.role, endpoint_id:x.endpoint_id, allow:!!x.allow })) : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const permMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const p of perms) m.set(`${p.role}:${p.endpoint_id}`, p.allow);
    return m;
  }, [perms]);

  const toggle = (role: Role, endpoint_id: string) => {
    setPerms(prev => {
      const key = `${role}:${endpoint_id}`;
      const exists = prev.find(p => p.role===role && p.endpoint_id===endpoint_id);
      if (exists) return prev.map(p => p===exists ? { ...p, allow: !p.allow } : p);
      return [...prev, { role, endpoint_id, allow: true }];
    });
  };

  const save = async () => {
    try {
      setSaving(true);
      const r = await fetch('/api/role-endpoint-permissions', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(perms) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Failed to save');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  const refreshCatalog = async () => {
    const r1 = await fetch('/api/endpoint-catalog');
    const d1 = await r1.json();
    if (!r1.ok) throw new Error(d1?.error || 'Failed to load endpoint catalog');
    setEndpoints(Array.isArray(d1) ? d1 : []);
  };

  const openModal = (ep?: Endpoint) => {
    if (ep) { setEditing(ep); setEpForm({ ...ep }); }
    else { setEditing(null); setEpForm({ resource: '', method: 'GET', path: '', description: '', enabled: true }); }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const saveEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!epForm.method || !epForm.path || !epForm.resource) return;
      const body = { resource: epForm.resource, method: epForm.method, path: epForm.path, description: epForm.description || '', enabled: epForm.enabled !== false, id: (epForm as any).id };
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch('/api/endpoint-catalog', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing ? [body] : body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Failed to save endpoint');
      await refreshCatalog();
      closeModal();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save endpoint');
    }
  };

  const removeEndpoint = async (id: string) => {
    if (!confirm('Delete this endpoint?')) return;
    const r = await fetch(`/api/endpoint-catalog?id=${id}`, { method: 'DELETE' });
    const d = await r.json().catch(()=>null);
    if (!r.ok) { alert(d?.error || 'Failed to delete'); return; }
    await refreshCatalog();
  };

  if (loading) return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50"><Header /><div className="p-6">Loading...</div></div>
      </div>
    </ProtectedRoute>
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Endpoint Permissions' }]} />
              <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Endpoint Permissions</h1>
              <div className="flex items-center gap-2">
                  <button onClick={async()=>{ const r = await fetch('/api/endpoint-catalog/scan', { method: 'POST' }); const d = await r.json(); if (!r.ok) alert(d?.error||'Scan failed'); else { await refreshCatalog(); alert(`Scanned ${d?.count ?? 0} endpoints`) } }} className="px-3 py-2 border rounded">Scan from codebase</button>
                <button onClick={()=>openModal()} className="px-3 py-2 border rounded">Add Endpoint</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
            {error && <div className="mb-3 text-red-600">{error}</div>}
            <div className="overflow-x-auto border rounded bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Method</th>
                    <th className="px-4 py-2 text-left">Path</th>
                    <th className="px-4 py-2 text-left">Resource</th>
                    {roles.map(r => <th key={r} className="px-4 py-2 text-left">{r}</th>)}
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map(ep => (
                    <tr key={ep.id} className="border-t">
                      <td className="px-4 py-2 font-medium"><span className={`inline-block px-2 py-0.5 rounded text-white ${ep.method==='GET'?'bg-emerald-600':ep.method==='POST'?'bg-blue-600':ep.method==='PUT'?'bg-amber-600':'bg-rose-600'}`}>{ep.method}</span></td>
                      <td className="px-4 py-2">{ep.path}</td>
                      <td className="px-4 py-2">{ep.resource}</td>
                      {roles.map(r => (
                        <td key={r} className="px-4 py-2">
                          <input type="checkbox" checked={!!permMap.get(`${r}:${ep.id}`)} onChange={()=>toggle(r, ep.id)} />
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button onClick={()=>openModal(ep)} className="text-blue-600 mr-3">Edit</button>
                        <button onClick={()=>removeEndpoint(ep.id)} className="text-red-600">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default EndpointPermissionsPage;
