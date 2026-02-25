'use client'
import React, { useState, useRef, useEffect } from 'react'

interface DateRangePickerProps {
    startDate: string   // ISO date string 'YYYY-MM-DD'
    endDate: string     // ISO date string 'YYYY-MM-DD'
    onChange: (start: string, end: string) => void
    placeholder?: string
    className?: string
}

function isoToDate(iso: string): Date | null {
    if (!iso) return null
    const d = new Date(iso + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d
}

function dateToIso(d: Date): string {
    return d.toISOString().split('T')[0]
}

function formatDisplay(start: string, end: string): string {
    if (!start && !end) return ''
    if (!start) return end
    if (!end || start === end) return formatDate(start)
    return `${formatDate(start)} – ${formatDate(end)}`
}

function formatDate(iso: string): string {
    if (!iso) return ''
    const d = isoToDate(iso)
    if (!d) return iso
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export default function DateRangePicker({ startDate, endDate, onChange, placeholder = 'Pilih rentang tanggal', className = '' }: DateRangePickerProps) {
    const [open, setOpen] = useState(false)
    const [hoverDate, setHoverDate] = useState<string | null>(null)
    const [selecting, setSelecting] = useState<'start' | 'end'>('start')

    // Calendar view state
    const today = new Date()
    const [viewYear, setViewYear] = useState(today.getFullYear())
    const [viewMonth, setViewMonth] = useState(today.getMonth())

    const containerRef = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Reset selection state when picker opens
    useEffect(() => {
        if (open) {
            setSelecting(startDate ? 'end' : 'start')
            // Navigate to start date month if set
            if (startDate) {
                const d = isoToDate(startDate)
                if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }
            }
        }
    }, [open])

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

    const handleDayClick = (iso: string) => {
        if (selecting === 'start') {
            onChange(iso, '')
            setSelecting('end')
        } else {
            // Ensure start <= end
            if (startDate && iso < startDate) {
                onChange(iso, startDate)
            } else {
                onChange(startDate, iso)
            }
            setSelecting('start')
            setOpen(false)
        }
    }

    const isInRange = (iso: string): boolean => {
        const s = startDate
        const e = endDate || hoverDate
        if (!s || !e) return false
        const [lo, hi] = s <= e ? [s, e] : [e, s]
        return iso > lo && iso < hi
    }

    const isStart = (iso: string) => iso === startDate
    const isEnd = (iso: string) => iso === (endDate || (selecting === 'end' ? hoverDate : null))

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
        else setViewMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
        else setViewMonth(m => m + 1)
    }

    const renderCalendar = () => {
        const totalDays = getDaysInMonth(viewYear, viewMonth)
        const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
        const cells: React.ReactNode[] = []

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            cells.push(<div key={`empty-${i}`} />)
        }

        for (let day = 1; day <= totalDays; day++) {
            const d = new Date(viewYear, viewMonth, day)
            const iso = dateToIso(d)
            const isTodayDay = dateToIso(today) === iso
            const start = isStart(iso)
            const end = isEnd(iso)
            const inRange = isInRange(iso)

            cells.push(
                <button
                    key={iso}
                    type="button"
                    onMouseEnter={() => selecting === 'end' && setHoverDate(iso)}
                    onMouseLeave={() => setHoverDate(null)}
                    onClick={() => handleDayClick(iso)}
                    className={[
                        'relative h-8 w-full text-sm flex items-center justify-center transition-colors select-none',
                        start || end
                            ? 'bg-[#1e377c] text-white font-semibold rounded-full z-10'
                            : inRange
                                ? 'bg-blue-100 text-blue-800'
                                : 'hover:bg-gray-100 text-gray-800',
                        isTodayDay && !start && !end ? 'font-bold underline' : '',
                        start ? 'rounded-l-full' : '',
                        end ? 'rounded-r-full' : '',
                        // Range background extends edge-to-edge
                        inRange && !start && !end ? 'rounded-none' : '',
                    ].filter(Boolean).join(' ')}
                >
                    {day}
                </button>
            )
        }

        return cells
    }

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger input */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-left bg-white focus:ring-1 focus:ring-[#1e377c] focus:border-[#1e377c] transition-colors"
            >
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className={startDate || endDate ? 'text-gray-900' : 'text-gray-400'}>
                    {startDate || endDate ? formatDisplay(startDate, endDate) : placeholder}
                </span>
                {(startDate || endDate) && (
                    <span
                        role="button"
                        onMouseDown={e => { e.stopPropagation(); onChange('', ''); setSelecting('start'); }}
                        className="ml-auto text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </span>
                )}
            </button>

            {/* Calendar dropdown */}
            {open && (
                <div className="absolute z-50 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-72">
                    {/* Hint */}
                    <p className="text-[11px] text-center text-gray-400 mb-2">
                        {selecting === 'start' ? '🖱 Klik tanggal awal' : '🖱 Klik tanggal akhir'}
                    </p>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mb-2">
                        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span className="text-sm font-semibold text-gray-800">
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </span>
                        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                        {DAY_NAMES.map(d => (
                            <div key={d} className="text-[10px] font-semibold text-gray-400 text-center py-1">{d}</div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-y-0.5">
                        {renderCalendar()}
                    </div>

                    {/* Footer: quick actions */}
                    <div className="flex justify-between mt-3 pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => { onChange('', ''); setSelecting('start'); }}
                            className="text-xs text-gray-500 hover:text-gray-700"
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="text-xs bg-[#1e377c] text-white px-3 py-1 rounded-md"
                        >
                            Selesai
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
