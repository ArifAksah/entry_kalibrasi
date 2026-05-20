'use client'
import React from 'react'
import type { TemplateConfig } from '../../../../../lib/pdf-service/types'

interface CoverPageTitleProps {
  config: TemplateConfig
  certNumber: string
  orderNumber: string
}

export const CoverPageTitle: React.FC<CoverPageTitleProps> = ({ config, certNumber, orderNumber }) => {
  const isNonDefault = config.type !== 'fc'

  return (
    <div className="cover-title-block text-center">
      <h1 className="cert-title-id">{config.coverPage.titleId}</h1>
      <h2 className="cert-title-en">{config.coverPage.titleEn}</h2>
      <div className="cert-info-text mt-2">{certNumber}</div>
      {/* Show traceability marker for standar type */}
      {config.coverPage.showTraceability && (
        <div style={{ marginTop: '3mm', padding: '2mm 4mm', backgroundColor: '#fef3c7', border: '1px dashed #d97706', borderRadius: '3px', fontSize: '8pt', color: '#92400e' }}>
          📋 Section Ketertelusuran (Traceability) akan ditampilkan di sini
        </div>
      )}
      {/* Show validity dates marker for standar type */}
      {config.coverPage.showValidityDates && (
        <div style={{ marginTop: '2mm', padding: '2mm 4mm', backgroundColor: '#ecfdf5', border: '1px dashed #059669', borderRadius: '3px', fontSize: '8pt', color: '#065f46' }}>
          📅 Tanggal Validitas (DD-MM-YYYY) akan ditampilkan di sini
        </div>
      )}
      {/* Show accreditation marker for LC types */}
      {config.coverPage.showAccreditation && isNonDefault && (
        <div style={{ marginTop: '2mm', padding: '2mm 4mm', backgroundColor: '#ede9fe', border: '1px dashed #7c3aed', borderRadius: '3px', fontSize: '8pt', color: '#5b21b6' }}>
          🏅 Informasi Akreditasi KAN akan ditampilkan di sini
        </div>
      )}
    </div>
  )
}
