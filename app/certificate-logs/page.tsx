'use client'

import React, { useState, useEffect } from 'react'
import SideNav from '../ui/dashboard/sidenav'
import Header from '../ui/dashboard/header'
import ProtectedRoute from '../../components/ProtectedRoute'
import { CertificateLog } from '../../lib/supabase'
import { useAlert } from '../../hooks/useAlert'
import { usePermissions } from '../../hooks/usePermissions'
import { useRouter } from 'next/navigation'
import Alert from '../../components/ui/Alert'

const CertificateLogsPage: React.FC = () => {
  const { alert, showError, hideAlert } = useAlert()
  const [logs, setLogs] = useState<CertificateLog[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState<string>('')
  const [filterCertificateId, setFilterCertificateId] = useState<string>('')
  const itemsPerPage = 20

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('pageSize', String(itemsPerPage))
      if (searchTerm) params.set('search', searchTerm)
      if (filterAction) params.set('action', filterAction)
      if (filterCertificateId) params.set('certificate_id', filterCertificateId)

      const res = await fetch(`/api/certificate-logs?${params.toString()}`)
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to fetch certificate logs')
      }

      const data = await res.json()
      setLogs(Array.isArray(data.data) ? data.data : [])
      setTotalPages(data.totalPages || 1)
      setTotalItems(data.totalItems || 0)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch logs'
      showError(errorMessage)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const { role, loading: roleLoading } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    if (!roleLoading && role !== 'admin' && role !== 'assignor') {
      router.push('/')
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    if (role === 'admin' || role === 'assignor') {
      fetchLogs()
    }
  }, [currentPage, searchTerm, filterAction, filterCertificateId, role])

  const getActionBadgeColor = (action: string) => {
    if (action.includes('approved')) return 'bg-green-100 text-green-800 border-green-200'
    if (action.includes('rejected')) return 'bg-red-100 text-red-800 border-red-200'
    if (action === 'created') return 'bg-blue-100 text-blue-800 border-blue-200'
    if (action === 'sent') return 'bg-purple-100 text-purple-800 border-purple-200'
    if (action === 'updated') return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    if (action === 'deleted') return 'bg-gray-100 text-gray-800 border-gray-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'created': 'Dibuat',
      'sent': 'Dikirim',
      'approved_v1': 'Disetujui V1',
      'approved_v2': 'Disetujui V2',
      'approved_assignor': 'Disahkan',
      'rejected_v1': 'Ditolak V1',
      'rejected_v2': 'Ditolak V2',
      'rejected_assignor': 'Ditolak Assignor',
      'updated': 'Diupdate',
      'deleted': 'Dihapus'
    }
    return labels[action] || action
  }

  const getVerificationLevelLabel = (level: number | null | undefined) => {
    if (!level) return '-'
    const labels: Record<number, string> = {
      1: 'Verifikator 1',
      2: 'Verifikator 2',
      3: 'Assignor'
    }
    return labels[level] || `Level ${level}`
  }

  return (
    <ProtectedRoute>
      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      )}
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50/50">
          <Header />
          <main className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Certificate Logs</h1>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                {/* Filters */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cari</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setCurrentPage(1)
                      }}
                      placeholder="Cari nama user, notes..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Filter Action</label>
                    <select
                      value={filterAction}
                      onChange={(e) => {
                        setFilterAction(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    >
                      <option value="">Semua Action</option>
                      <option value="created">Dibuat</option>
                      <option value="sent">Dikirim</option>
                      <option value="approved_v1">Disetujui V1</option>
                      <option value="approved_v2">Disetujui V2</option>
                      <option value="approved_assignor">Disahkan</option>
                      <option value="rejected_v1">Ditolak V1</option>
                      <option value="rejected_v2">Ditolak V2</option>
                      <option value="rejected_assignor">Ditolak Assignor</option>
                      <option value="updated">Diupdate</option>
                      <option value="deleted">Dihapus</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Certificate ID</label>
                    <input
                      type="number"
                      value={filterCertificateId}
                      onChange={(e) => {
                        setFilterCertificateId(e.target.value)
                        setCurrentPage(1)
                      }}
                      placeholder="Filter by Certificate ID"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setSearchTerm('')
                        setFilterAction('')
                        setFilterCertificateId('')
                        setCurrentPage(1)
                      }}
                      className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Reset Filter
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left text-gray-700">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-medium">
                      <tr>
                        <th className="px-6 py-3">Waktu</th>
                        <th className="px-6 py-3">Certificate ID</th>
                        <th className="px-6 py-3">Action</th>
                        <th className="px-6 py-3">User</th>
                        <th className="px-6 py-3">Level</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        [...Array(10)].map((_, i) => (
                          <tr key={i} className="border-b border-gray-200 animate-pulse">
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                          </tr>
                        ))
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                            Tidak ada log ditemukan
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-gray-900">
                                {new Date(log.created_at).toLocaleDateString('id-ID', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(log.created_at).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <a
                                href={`/certificates?edit=${log.certificate_id}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              >
                                #{log.certificate_id}
                              </a>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getActionBadgeColor(log.action)}`}>
                                {getActionLabel(log.action)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-gray-900">{log.performed_by_name || 'Unknown'}</div>
                              <div className="text-xs text-gray-500">{log.performed_by.slice(0, 8)}...</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                              {getVerificationLevelLabel(log.verification_level)}
                            </td>
                            <td className="px-6 py-4">
                              {log.previous_status && log.new_status ? (
                                <div className="text-xs">
                                  <div className="text-gray-500 line-through">{log.previous_status}</div>
                                  <div className="text-gray-900 font-medium">→ {log.new_status}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="max-w-md">
                                {log.approval_notes && (
                                  <div className="text-xs text-green-700 mb-1">
                                    <span className="font-medium">Approval:</span> {log.approval_notes}
                                  </div>
                                )}
                                {log.rejection_reason && (
                                  <div className="text-xs text-red-700 mb-1">
                                    <span className="font-medium">Rejection:</span> {log.rejection_reason}
                                  </div>
                                )}
                                {log.notes && (
                                  <div className="text-xs text-gray-600">
                                    {log.notes}
                                  </div>
                                )}
                                {!log.approval_notes && !log.rejection_reason && !log.notes && (
                                  <span className="text-gray-400 text-xs">-</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {!loading && totalItems > 0 && (
                  <div className="flex items-center justify-between pt-4 mt-4 border-t">
                    <span className="text-sm text-gray-600">
                      Menampilkan {logs.length} dari {totalItems} log
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border rounded-md bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Sebelumnya
                      </button>
                      <span className="text-sm font-medium">Halaman {currentPage} dari {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border rounded-md bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default CertificateLogsPage

