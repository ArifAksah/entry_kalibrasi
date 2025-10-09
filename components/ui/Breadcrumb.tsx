'use client'

import React from 'react'

export type Crumb = { label: string; href?: string }

const Breadcrumb: React.FC<{ items: Crumb[] }> = ({ items }) => {
  if (!items?.length) return null
  return (
    <nav className="flex text-sm text-gray-500" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-2">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center">
              {idx > 0 && (
                <svg className="h-4 w-4 mx-1 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {item.href && !isLast ? (
                <a href={item.href} className="hover:text-gray-700 transition-colors">{item.label}</a>
              ) : (
                <span className="text-gray-700 font-medium">{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumb











