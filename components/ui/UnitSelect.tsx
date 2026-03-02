'use client'

import React, { useEffect, useRef, useState } from 'react'

// Detect LaTeX syntax
const hasLatex = (s: string) => /[\\^_{}]|\$/.test(s)

let katexInstance: any = null
async function getKatex() {
    if (katexInstance) return katexInstance
    katexInstance = (await import('katex')).default
    if (!document.getElementById('katex-css')) {
        const link = document.createElement('link')
        link.id = 'katex-css'
        link.rel = 'stylesheet'
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'
        document.head.appendChild(link)
    }
    return katexInstance
}

/** Inline rendered unit (uses KaTeX if LaTeX detected, otherwise plain text) */
export const RenderedUnit = ({ value, className = '' }: { value: string; className?: string }) => {
    const ref = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        if (!ref.current || !value.trim() || !hasLatex(value)) return
        getKatex().then(katex => {
            if (ref.current) {
                ref.current.innerHTML = katex.renderToString(value, {
                    throwOnError: false,
                    displayMode: false,
                    output: 'html',
                })
            }
        }).catch(() => {
            if (ref.current) ref.current.textContent = value
        })
    }, [value])

    if (!value.trim()) return null
    if (!hasLatex(value)) return <span className={className}>{value}</span>
    return <span ref={ref} className={className} />
}

interface UnitOption {
    id: number
    unit: string
}

interface UnitSelectProps {
    value: string
    onChange: (val: string) => void
    units: UnitOption[]
    placeholder?: string
    inputClassName?: string
}

/**
 * Dropdown unit selector yang menampilkan rendering LaTeX di setiap pilihan.
 * Nilai yang disimpan tetap berupa string LaTeX.
 */
export const UnitSelect: React.FC<UnitSelectProps> = ({
    value,
    onChange,
    units,
    placeholder = 'Unit',
    inputClassName = '',
}) => {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
                setSearch('')
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const filtered = search.trim()
        ? units.filter(u => u.unit.toLowerCase().includes(search.toLowerCase()))
        : units

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => { setOpen(o => !o); setSearch('') }}
                className={`w-full flex items-center justify-between px-3 py-3 border border-gray-300 rounded-lg bg-gray-50 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm ${inputClassName}`}
            >
                <span className="min-w-0 truncate">
                    {value ? (
                        <RenderedUnit value={value} />
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </span>
                <svg className={`w-4 h-4 ml-1 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute z-50 mt-1 w-full min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                    {/* Search */}
                    <div className="p-2 border-b border-gray-100">
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari satuan..."
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                    </div>

                    {/* Clear option */}
                    <div
                        onClick={() => { onChange(''); setOpen(false); setSearch('') }}
                        className="px-3 py-2 text-xs text-gray-400 italic cursor-pointer hover:bg-gray-50 border-b border-gray-100"
                    >
                        — Kosongkan
                    </div>

                    {/* Unit list */}
                    <div className="overflow-y-auto max-h-52">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-gray-400 text-center">Tidak ditemukan</div>
                        ) : (
                            filtered.map(u => (
                                <div
                                    key={u.id}
                                    onClick={() => { onChange(u.unit); setOpen(false); setSearch('') }}
                                    className={`px-3 py-2 cursor-pointer hover:bg-blue-50 flex items-center gap-2 ${value === u.unit ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                >
                                    <RenderedUnit value={u.unit} className="text-sm" />
                                    {hasLatex(u.unit) && (
                                        <span className="text-[10px] text-gray-300 font-mono ml-auto truncate max-w-[80px]">{u.unit}</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default UnitSelect
