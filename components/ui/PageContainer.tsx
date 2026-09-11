'use client'

import React from 'react'

export type PageContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const MAX_WIDTH: Record<PageContainerSize, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[1600px]',
  full: 'max-w-none',
}

export interface PageContainerProps {
  children: React.ReactNode
  size?: PageContainerSize
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  contentClassName?: string
}

const PageContainer: React.FC<PageContainerProps> = ({
  children,
  size = 'xl',
  title,
  description,
  actions,
  className = '',
  contentClassName = '',
}) => (
  <div className={`w-full ${MAX_WIDTH[size]} mx-auto px-4 sm:px-6 py-6 ${className}`}>
    {(title || actions) && (
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          {title ? (
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{title}</h1>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        ) : null}
      </div>
    )}
    <div className={`space-y-6 ${contentClassName}`}>{children}</div>
  </div>
)

export default PageContainer
