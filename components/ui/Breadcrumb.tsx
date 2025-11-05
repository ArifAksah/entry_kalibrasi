'use client'

import React from 'react'

export type Crumb = { label: string; href?: string }

type BreadcrumbProps = {
  items: Crumb[]
  className?: string
  size?: 'sm' | 'md'
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '', size = 'sm' }) => {
  if (!items?.length) return null
  const textSize = size === 'md' ? 'text-base' : 'text-sm'
  const iconSize = size === 'md' ? 'h-4 w-4' : 'h-4 w-4'

  return (
    <nav className={`flex ${textSize} text-gray-600 ${className}`} aria-label="Breadcrumb">
      <ol className="inline-flex items-center gap-1 md:gap-2">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center">
              {idx > 0 && (
                <svg className={`${iconSize} mx-1 text-gray-300`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {item.href && !isLast ? (
                <a href={item.href} className="text-gray-500 hover:text-gray-800 transition-colors">{item.label}</a>
              ) : (
                <span className="text-gray-900 font-medium">{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumb











