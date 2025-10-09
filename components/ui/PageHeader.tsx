'use client'

import React from 'react'
import Breadcrumb, { Crumb } from './Breadcrumb'

const PageHeader: React.FC<{ items: Crumb[]; action?: React.ReactNode }> = ({ items, action }) => {
  return (
    <div className="flex items-center justify-between">
      <Breadcrumb items={items} />
      {action}
    </div>
  )
}

export default PageHeader












