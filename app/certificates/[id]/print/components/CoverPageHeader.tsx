'use client'
import React from 'react'
import Image from 'next/image'
import type { TemplateConfig } from '../../../../../lib/pdf-service/types'
import bmkgLogo from '../../../../bmkg.png'

interface CoverPageHeaderProps {
  config: TemplateConfig
}

export const CoverPageHeader: React.FC<CoverPageHeaderProps> = ({ config }) => {
  const { header } = config
  const isNonDefault = config.type !== 'fc'

  return (
    <header className="cover-header flex flex-row justify-between border-b-[3px] border-double border-black">
      <div className="cover-logo-slot">
        <Image src={bmkgLogo} alt="BMKG" width={100} height={100} priority />
      </div>
      <div className="cover-agency-title text-center leading-tight">
        <h1 className="text-base font-bold">{header.agencyName}</h1>
        <h2 className="text-base font-bold">{header.labName}</h2>
        {/* Show Balai name if present */}
        {header.balaiName && (
          <h2 className="text-base font-bold">{header.balaiName}</h2>
        )}
        {/* Show accreditation for LC types */}
        {header.accreditationNumber && (
          <p className="text-sm mt-1">Terakreditasi / <span className="italic">Accredited</span> {header.accreditationBody} No. {header.accreditationNumber}</p>
        )}
        {/* Template marker — visible only for non-FC types to confirm template is active */}
        {isNonDefault && (
          <div style={{ marginTop: '2mm', padding: '1mm 3mm', backgroundColor: '#e0f2fe', border: '1px solid #0284c7', borderRadius: '2px', fontSize: '7pt', color: '#0369a1' }}>
            ✓ Template: <strong>{config.type.toUpperCase()}</strong>
          </div>
        )}
      </div>
      <div className="cover-header-spacer"></div>
    </header>
  )
}
