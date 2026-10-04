'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type SearchableOption = {
  id: string | number
  name: string
  description?: string
  disabled?: boolean
}

type SearchableDropdownProps = {
  value: string | number | null
  onChange: (value: string | number | null) => void
  options: SearchableOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  className?: string
}

const MENU_MAX_HEIGHT = 320

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  emptyLabel = 'Tidak ada data ditemukan',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const selectedOption = options.find((option) => String(option.id) === String(value ?? ''))

  const filteredOptions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    if (!search) return options

    return options.filter((option) =>
      option.name.toLowerCase().includes(search) ||
      (option.description || '').toLowerCase().includes(search)
    )
  }, [options, searchTerm])

  // Menu dirender lewat portal (ke document.body) + posisi fixed, sehingga
  // tidak terpotong oleh `overflow` container induk. Auto-flip: buka ke atas
  // bila ruang di bawah kurang.
  const updatePosition = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < 240 && rect.top > spaceBelow
    const width = rect.width
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const style: React.CSSProperties = {
      position: 'fixed',
      left,
      width,
      zIndex: 9999,
    }
    if (openUp) {
      style.bottom = window.innerHeight - rect.top + 4
      style.maxHeight = Math.min(MENU_MAX_HEIGHT, Math.max(160, rect.top - 8))
    } else {
      style.top = rect.bottom + 4
      style.maxHeight = Math.min(MENU_MAX_HEIGHT, Math.max(160, spaceBelow - 8))
    }
    setMenuStyle(style)
  }

  useEffect(() => {
    if (!isOpen) return
    updatePosition()
    const handler = () => updatePosition()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const menu = isOpen ? (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
      <div
        style={menuStyle}
        className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 p-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            name={`searchable-dropdown-${String(value ?? 'empty')}`}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) return
                  onChange(option.id)
                  setIsOpen(false)
                  setSearchTerm('')
                }}
                className={`w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 ${
                  option.disabled
                    ? 'cursor-not-allowed bg-gray-50 opacity-55'
                    : 'hover:bg-blue-50'
                }`}
              >
                <div className="font-medium text-black">{option.name}</div>
                {option.description && (
                  <div className="mt-0.5 text-xs text-gray-500">{option.description}</div>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-sm text-gray-500">{emptyLabel}</div>
          )}
        </div>
      </div>
    </>
  ) : null

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="w-full rounded-lg border border-gray-400 bg-white px-3.5 py-2.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={selectedOption ? 'font-medium text-black' : 'text-gray-500'}>
          {selectedOption?.name || placeholder}
        </span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">▼</span>
      </button>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  )
}

export default SearchableDropdown
