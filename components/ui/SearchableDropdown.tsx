'use client'

import React, { useMemo, useState } from 'react'

type SearchableOption = {
  id: string | number
  name: string
  description?: string
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

  const selectedOption = options.find((option) => String(option.id) === String(value ?? ''))

  const filteredOptions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    if (!search) return options

    return options.filter((option) =>
      option.name.toLowerCase().includes(search) ||
      (option.description || '').toLowerCase().includes(search)
    )
  }, [options, searchTerm])

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption?.name || placeholder}
        </span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">▼</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full z-50 mt-1 max-h-72 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
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
            <div className="max-h-56 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    className="w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-blue-50 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{option.name}</div>
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
      )}
    </div>
  )
}

export default SearchableDropdown
