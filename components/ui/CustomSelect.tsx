'use client'

import React, { useState, useRef, useEffect } from 'react'

export interface SelectOption {
    value: string | number
    label: string
}

interface CustomSelectProps {
    options: SelectOption[]
    value: string | number | null | undefined
    onChange: (value: string | number | null) => void
    placeholder?: string
    disabled?: boolean
    required?: boolean
    className?: string
    /** If true, includes a "clear" option at the top */
    clearable?: boolean
    clearLabel?: string
}

const CustomSelect: React.FC<CustomSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = '-- Pilih --',
    disabled = false,
    required = false,
    className = '',
    clearable = true,
    clearLabel = '— Tidak dipilih',
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const selectedOption = options.find(o => String(o.value) === String(value ?? ''))

    const handleSelect = (optionValue: string | number | null) => {
        onChange(optionValue)
        setIsOpen(false)
    }

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(prev => !prev)}
                className={`
          w-full flex items-center justify-between
          px-4 py-3 rounded-xl border-2 text-left
          transition-all duration-200 cursor-pointer
          bg-white shadow-sm
          ${isOpen
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    }
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}
        `}
            >
                <span className={`text-sm truncate ${selectedOption ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg
                    className={`w-4 h-4 flex-shrink-0 ml-2 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown List */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden animate-in">
                    <div className="max-h-56 overflow-y-auto">
                        {/* Clear option */}
                        {clearable && (
                            <button
                                type="button"
                                onClick={() => handleSelect(null)}
                                className={`
                  w-full flex items-center px-4 py-2.5 text-left text-sm transition-colors duration-100
                  ${!value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-400 hover:bg-gray-50'}
                `}
                            >
                                <span className="italic">{clearLabel}</span>
                            </button>
                        )}

                        {/* Divider */}
                        {clearable && options.length > 0 && (
                            <div className="border-t border-gray-100 mx-3" />
                        )}

                        {/* Options */}
                        {options.length === 0 ? (
                            <div className="px-4 py-5 text-center text-sm text-gray-400">
                                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                Tidak ada data
                            </div>
                        ) : (
                            options.map((option) => {
                                const isSelected = String(option.value) === String(value ?? '')
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSelect(option.value)}
                                        className={`
                      w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-100
                      ${isSelected
                                                ? 'bg-blue-50 text-blue-700 font-semibold'
                                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                            }
                    `}
                                    >
                                        {/* Check indicator */}
                                        <span className={`w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full border-2 transition-all ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-200'}`}>
                                            {isSelected && (
                                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 8 8">
                                                    <path d="M6.5 1.5L3 5.5l-1.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                                </svg>
                                            )}
                                        </span>
                                        {option.label}
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default CustomSelect
