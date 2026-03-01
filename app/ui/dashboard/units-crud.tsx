'use client'

import React, { useState, useEffect, useRef } from 'react'
import Breadcrumb from '../../../components/ui/Breadcrumb'
import Loading from '../../../components/ui/Loading'
import { useAlert } from '../../../hooks/useAlert'
import Alert from '../../../components/ui/Alert'
import { EditButton, DeleteButton } from '../../../components/ui/ActionIcons'

// Dynamic KaTeX import to avoid SSR issues
let katex: any = null

// Detect if a string likely contains LaTeX syntax
const hasLatexSyntax = (str: string): boolean => {
    return /[\\^_{}]|\$/.test(str)
}

// LaTeX Preview Component
const LaTeXPreview = ({ latex, className = '' }: { latex: string; className?: string }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!ref.current || !latex.trim()) return

        const render = async () => {
            try {
                if (!katex) {
                    katex = (await import('katex')).default
                    // Inject KaTeX CSS if not already present
                    if (!document.getElementById('katex-css')) {
                        const link = document.createElement('link')
                        link.id = 'katex-css'
                        link.rel = 'stylesheet'
                        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'
                        document.head.appendChild(link)
                    }
                }
                const html = katex.renderToString(latex, {
                    throwOnError: false,
                    displayMode: false,
                    output: 'html',
                })
                if (ref.current) {
                    ref.current.innerHTML = html
                    setError(false)
                }
            } catch (e) {
                setError(true)
                if (ref.current) {
                    ref.current.textContent = latex
                }
            }
        }

        render()
    }, [latex])

    if (!latex.trim()) return null
    if (error || !hasLatexSyntax(latex)) {
        return <span className={className}>{latex}</span>
    }

    return <span ref={ref} className={className} />
}

// Smart render: if LaTeX detected → use LaTeXPreview, else plain text
const SmartUnit = ({ value, className = '' }: { value: string; className?: string }) => {
    if (!hasLatexSyntax(value)) {
        return <span className={className}>{value}</span>
    }
    return <LaTeXPreview latex={value} className={className} />
}

// LaTeX quick-insert buttons for common physics/math units
const LATEX_SNIPPETS = [
    { label: 'x²', insert: '^2' },
    { label: 'xⁿ', insert: '^{}' },
    { label: 'x₂', insert: '_{2}' },
    { label: 'μ', insert: '\\mu ' },
    { label: 'Ω', insert: '\\Omega ' },
    { label: 'α', insert: '\\alpha ' },
    { label: 'β', insert: '\\beta ' },
    { label: 'λ', insert: '\\lambda ' },
    { label: '°', insert: '^\\circ' },
    { label: '·', insert: '\\cdot ' },
    { label: '÷', insert: '\\div ' },
    { label: '±', insert: '\\pm ' },
    { label: '√', insert: '\\sqrt{}' },
    { label: 'frac', insert: '\\frac{}{}' },
    { label: '×10³', insert: '\\times 10^{3}' },
    { label: 'Σ', insert: '\\Sigma ' },
]

interface Unit {
    id: number
    created_at: string
    unit: string
}

export default function UnitsCRUD() {
    const [units, setUnits] = useState<Unit[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editing, setEditing] = useState<Unit | null>(null)
    const [formUnitName, setFormUnitName] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [latexMode, setLatexMode] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const { alert, showSuccess, showError, hideAlert } = useAlert()

    const fetchUnits = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/units?q=${search}`)
            if (res.ok) {
                const data = await res.json()
                setUnits(data)
            } else {
                throw new Error('Failed to fetch units')
            }
        } catch (e) {
            console.error(e)
            showError('Gagal memuat data satuan')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUnits()
        }, 500)
        return () => clearTimeout(timer)
    }, [search])

    // Auto-detect LaTeX when editing an existing unit
    useEffect(() => {
        if (editing) {
            setLatexMode(hasLatexSyntax(editing.unit))
        }
    }, [editing])

    const insertSnippet = (snippet: string) => {
        const input = inputRef.current
        if (!input) return
        const start = input.selectionStart ?? formUnitName.length
        const end = input.selectionEnd ?? formUnitName.length
        const newVal = formUnitName.slice(0, start) + snippet + formUnitName.slice(end)
        setFormUnitName(newVal)
        // Move cursor inside braces if snippet ends with {}
        setTimeout(() => {
            const cursorPos = start + snippet.length - (snippet.endsWith('{}') ? 1 : snippet.endsWith('{}{}') ? 3 : 0)
            input.focus()
            input.setSelectionRange(cursorPos, cursorPos)
        }, 0)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formUnitName) return

        setSubmitting(true)
        try {
            const url = '/api/units'
            const method = editing ? 'PUT' : 'POST'
            const body = editing ? { id: editing.id, unit: formUnitName } : { unit: formUnitName }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                showSuccess(editing ? 'Satuan berhasil diperbarui' : 'Satuan berhasil ditambahkan')
                closeModal()
                fetchUnits()
            } else {
                const err = await res.json()
                throw new Error(err.error || 'Terjadi kesalahan')
            }
        } catch (e: any) {
            showError(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Apakah Anda yakin ingin menghapus satuan ini?')) return

        try {
            const res = await fetch(`/api/units?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                showSuccess('Satuan berhasil dihapus')
                fetchUnits()
            } else {
                const err = await res.json()
                throw new Error(err.error || 'Gagal menghapus')
            }
        } catch (e: any) {
            showError(e.message)
        }
    }

    const openModal = (unit?: Unit) => {
        if (unit) {
            setEditing(unit)
            setFormUnitName(unit.unit)
            setLatexMode(hasLatexSyntax(unit.unit))
        } else {
            setEditing(null)
            setFormUnitName('')
            setLatexMode(false)
        }
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setEditing(null)
        setFormUnitName('')
        setLatexMode(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Breadcrumb items={[{ label: 'Master Data', href: '#' }, { label: 'Master Satuan' }]} />
            </div>

            {alert.show && (
                <Alert
                    type={alert.type}
                    message={alert.message}
                    onClose={hideAlert}
                    autoHide={alert.autoHide}
                    duration={alert.duration}
                />
            )}

            <div className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800">Daftar Satuan</h2>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari satuan..."
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                    <button
                        onClick={() => openModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow font-medium text-sm flex items-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Tambah Baru
                    </button>
                </div>
            </div>

            {loading ? (
                <Loading />
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Satuan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LaTeX Source</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dibuat Pada</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {units.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                        Tidak ada data ditemukan
                                    </td>
                                </tr>
                            ) : (
                                units.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 w-12">
                                            {index + 1}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {/* Rendered: show LaTeX formula if applicable */}
                                            <SmartUnit value={item.unit} className="text-base" />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                                            {/* Raw source string */}
                                            {hasLatexSyntax(item.unit) ? (
                                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-500">{item.unit}</span>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(item.created_at).toLocaleDateString('id-ID', {
                                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2">
                                                <EditButton onClick={() => openModal(item)} />
                                                <DeleteButton onClick={() => handleDelete(item.id)} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg transform transition-all">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {editing ? 'Edit Satuan' : 'Tambah Satuan Baru'}
                            </h3>
                            <button onClick={closeModal} className="text-white/80 hover:text-white focus:outline-none transition-colors">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="p-6 space-y-5">
                                {/* LaTeX Mode Toggle */}
                                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">∑</span>
                                        <div>
                                            <p className="text-sm font-semibold text-amber-800">Mode LaTeX</p>
                                            <p className="text-xs text-amber-600">Gunakan formula matematika/fisika</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setLatexMode(v => !v)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${latexMode ? 'bg-amber-500' : 'bg-gray-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${latexMode ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Input Field */}
                                <div>
                                    <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">
                                        Nama Satuan {latexMode && <span className="text-amber-600 font-mono text-xs ml-1">(LaTeX)</span>}
                                    </label>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        id="unit"
                                        required
                                        className={`block w-full border rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-2 sm:text-sm transition-colors font-mono ${latexMode
                                            ? 'border-amber-300 focus:ring-amber-400 focus:border-amber-400 bg-amber-50/30'
                                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                            }`}
                                        value={formUnitName}
                                        onChange={(e) => setFormUnitName(e.target.value)}
                                        placeholder={latexMode
                                            ? 'Contoh: m/s^2   atau   \\mu g/m^3   atau   kg \\cdot m^{-3}'
                                            : 'Contoh: kg, mm, °C'
                                        }
                                    />

                                    {/* LaTeX Quick Insert Buttons */}
                                    {latexMode && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-500 mb-1.5">Sisipan cepat:</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {LATEX_SNIPPETS.map((s) => (
                                                    <button
                                                        key={s.label}
                                                        type="button"
                                                        onClick={() => insertSnippet(s.insert)}
                                                        className="px-2.5 py-1 text-xs font-mono bg-white border border-gray-300 rounded-md hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700 transition-colors shadow-sm"
                                                        title={s.insert}
                                                    >
                                                        {s.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Live Preview */}
                                {latexMode && formUnitName.trim() && (
                                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            Pratinjau
                                        </p>
                                        <div className="flex items-center justify-center min-h-10">
                                            <LaTeXPreview
                                                latex={formUnitName}
                                                className="text-xl text-gray-800"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Tips */}
                                {latexMode && (
                                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                        <p className="text-xs font-semibold text-blue-700 mb-1.5">Contoh format LaTeX satuan:</p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                            {[
                                                ['m/s^2', 'm/s²'],
                                                ['\\mu g/m^3', 'μg/m³'],
                                                ['kg \\cdot m^{-3}', 'kg·m⁻³'],
                                                ['W/m^2', 'W/m²'],
                                                ['\\Omega', 'Ohm (Ω)'],
                                                ['mm\\ Hg', 'mmHg'],
                                            ].map(([src, desc]) => (
                                                <div key={src} className="flex items-center gap-1.5">
                                                    <code className="text-[10px] bg-white border border-blue-200 px-1 py-0.5 rounded text-blue-800 font-mono">{src}</code>
                                                    <span className="text-[10px] text-gray-500">→ {desc}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end space-x-3 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="bg-white py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 transition-colors"
                                >
                                    {submitting ? 'Menyimpan...' : (editing ? 'Simpan Perubahan' : 'Simpan')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
