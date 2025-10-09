'use client'

import React, { useEffect } from 'react'

export type ToastProps = {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose?: () => void
  durationMs?: number
}

const colors: Record<string, string> = {
  success: 'bg-green-50 text-green-700 border-green-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose, durationMs = 2500 }) => {
  useEffect(() => {
    const id = setTimeout(() => onClose && onClose(), durationMs)
    return () => clearTimeout(id)
  }, [durationMs, onClose])

  return (
    <div className={`fixed top-4 right-4 border rounded-lg shadow ${colors[type]} px-4 py-2 z-[60]`}> 
      <div className="flex items-center space-x-3">
        <span className="text-sm font-medium">{message}</span>
        {onClose && (
          <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default Toast












