'use client'

import React, { useEffect, useMemo, useState } from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'
import { supabase } from '../../lib/supabase';
import Breadcrumb from '../../components/ui/Breadcrumb';

type Role = 'admin' | 'calibrator' | 'verifikator' | 'assignor' | 'user_station';
type Resource = 'certificate' | 'instrument' | 'sensor' | 'tte';

type Row = { role: Role; resource: Resource; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean };

const allRoles: Role[] = ['admin', 'calibrator', 'verifikator', 'assignor', 'user_station'];
const resources: Resource[] = ['certificate', 'instrument', 'sensor', 'tte'];
const actionDefs = [
  { key: 'can_create' as const, label: 'create' },
  { key: 'can_read' as const, label: 'read' },
  { key: 'can_update' as const, label: 'update' },
  { key: 'can_delete' as const, label: 'delete' },
];

const RolePermissionsPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const r = await fetch('/api/role-permissions');
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Failed to load permissions');
        const map = new Map<string, Row>();
        for (const role of allRoles) {
          for (const resource of resources) {
            map.set(`${role}:${resource}`, { role, resource, can_create: false, can_read: false, can_update: false, can_delete: false });
          }
        }
        for (const it of (Array.isArray(d) ? d : [])) {
          const key = `${it.role}:${it.resource}`;
          map.set(key, { 
            role: it.role, 
            resource: it.resource, 
            can_create: !!(it.can_create ?? it.create),
            can_read: !!(it.can_read ?? it.read),
            can_update: !!(it.can_update ?? it.update),
            can_delete: !!(it.can_delete ?? it.delete)
          });
        }
        setRows(Array.from(map.values()));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load permissions');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const grouped = useMemo(() => {
    const g: Record<Role, Row[]> = { admin: [], calibrator: [], verifikator: [], assignor: [], user_station: [] };
    for (const row of rows) g[row.role].push(row);
    return g;
  }, [rows]);

  const toggle = (role: Role, resource: Resource, key: keyof Row) => {
    setRows(prev => prev.map(r => (r.role === role && r.resource === resource ? { ...r, [key]: !(r as any)[key] } : r)));
  };

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const r = await fetch('/api/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(rows),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Failed to save');
      alert('Permissions updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 text-gray-600">Loading...</div>
        </div>
      </div>
    </ProtectedRoute>
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-6xl mx-auto">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Role Permissions' }]} />
            <h1 className="text-2xl font-bold mb-4">Role Permissions</h1>
            {error && <div className="mb-4 text-red-600">{error}</div>}
            <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Resource</th>
              {actionDefs.map(a => (
                <th key={a.key} className="px-4 py-2 text-left uppercase">{a.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRoles.map(role => (
              <React.Fragment key={role}>
                {grouped[role].map(row => (
                  <tr key={row.role + '-' + row.resource} className="border-t">
                    <td className="px-4 py-2 font-medium">{row.role}</td>
                    <td className="px-4 py-2">{row.resource}</td>
                    {actionDefs.map(a => (
                      <td key={a.key} className="px-4 py-2">
                        <input type="checkbox" checked={(row as any)[a.key]} onChange={() => toggle(row.role, row.resource, a.key as keyof Row)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default RolePermissionsPage;

