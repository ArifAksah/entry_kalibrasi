import React from 'react'

// Action Icons - Seragam untuk semua CRUD pages
// Menggunakan Heroicons (Tailwind CSS compatible)

export const EditIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

export const DeleteIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

export const ViewIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

export const PlusIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

export const CloseIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export const CheckIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

export const XIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export const InfoIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export const RefreshIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

// Action Button Components - Pre-styled buttons with icons
export const EditButton = ({ 
  onClick, 
  className = "", 
  title = "Edit",
  disabled = false 
}: { 
  onClick: () => void
  className?: string
  title?: string
  disabled?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    title={title}
  >
    <EditIcon className="w-4 h-4" />
  </button>
)

export const DeleteButton = ({ 
  onClick, 
  className = "", 
  title = "Delete",
  disabled = false,
  isLoading = false
}: { 
  onClick: () => void
  className?: string
  title?: string
  disabled?: boolean
  isLoading?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`inline-flex items-center p-1.5 rounded-lg transition-all duration-200 border border-transparent ${
      disabled || isLoading
        ? 'text-gray-400 cursor-not-allowed bg-gray-50'
        : 'text-red-600 hover:text-red-800 hover:bg-red-50 hover:border-red-200'
    } ${className}`}
    title={isLoading ? "Deleting..." : title}
  >
    {isLoading ? (
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
    ) : (
      <DeleteIcon className="w-4 h-4" />
    )}
  </button>
)

export const ViewButton = ({ 
  onClick, 
  className = "", 
  title = "View",
  disabled = false 
}: { 
  onClick: () => void
  className?: string
  title?: string
  disabled?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all duration-200 border border-transparent hover:border-green-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    title={title}
  >
    <ViewIcon className="w-4 h-4" />
  </button>
)

export const VerifyIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export const RejectIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export const VerifyButton = ({ 
  onClick, 
  className = "", 
  title = "Verify",
  disabled = false,
  isLoading = false
}: { 
  onClick: () => void
  className?: string
  title?: string
  disabled?: boolean
  isLoading?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    title={isLoading ? "Verifying..." : title}
  >
    {isLoading ? (
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
    ) : (
      <VerifyIcon className="w-4 h-4" />
    )}
    <span>{title}</span>
  </button>
)

export const RejectButton = ({ 
  onClick, 
  className = "", 
  title = "Reject",
  disabled = false,
  isLoading = false
}: { 
  onClick: () => void
  className?: string
  title?: string
  disabled?: boolean
  isLoading?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200 border border-transparent hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    title={isLoading ? "Rejecting..." : title}
  >
    {isLoading ? (
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
    ) : (
      <RejectIcon className="w-4 h-4" />
    )}
    <span>{title}</span>
  </button>
)

