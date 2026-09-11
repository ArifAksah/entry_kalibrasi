'use client'

import React from 'react'

type TableProps = {
  headers: React.ReactNode[]
  children: React.ReactNode
  columnClasses?: string[]
  tableClassName?: string
}

const Table: React.FC<TableProps> = ({
  headers,
  children,
  columnClasses = [],
  tableClassName,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
      <div className="overflow-x-auto">
        <table
          className={
            tableClassName
              ? tableClassName
              : 'min-w-full table-fixed divide-y divide-slate-200 text-sm'
          }
        >
          <thead className="bg-slate-50">
            <tr>
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  className={`px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap ${columnClasses[idx] || ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </div>
  )
}

export default Table
