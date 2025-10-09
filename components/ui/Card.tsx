'use client'

import React from 'react'

const Card: React.FC<{ title?: string; actions?: React.ReactNode; children: React.ReactNode }>=({ title, actions, children })=>{
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {(title || actions) && (
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center space-x-2">{actions}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

export default Card






