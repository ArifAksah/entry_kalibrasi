'use client'

import React from 'react'

type LoadingProps = {
  fullScreen?: boolean
  size?: number
  className?: string
}

const Loading: React.FC<LoadingProps> = ({ fullScreen = true, size = 40, className = '' }) => {
  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-white/60'
    : 'flex items-center justify-center'

  const spinnerStyle: React.CSSProperties = { width: size, height: size }

  return (
    <div className={`${containerClass} ${className}`}>
      <div
        className="animate-spin rounded-full border-2 border-gray-300 border-t-2 border-t-blue-600"
        style={spinnerStyle}
        aria-label="Loading"
      />
    </div>
  )
}

export default Loading
