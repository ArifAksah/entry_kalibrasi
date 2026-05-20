'use client'
import React from 'react'
import type { TemplateConfig } from '../../../../../lib/pdf-service/types'

interface ResultsPageFooterProps {
  config: TemplateConfig
  qrCodeElement?: React.ReactNode
}

export const ResultsPageFooter: React.FC<ResultsPageFooterProps> = ({ config, qrCodeElement }) => {
  const { footer } = config
  const isNonDefault = config.type !== 'fc'

  return (
    <div className="results-footer-shell">
      <table className="results-footer-grid">
        <tbody>
          <tr>
            <td className="results-footer-qr-cell">
              <div className="results-footer-qr-wrap">
                {qrCodeElement || <div className="results-footer-qr-box" />}
                <div className="results-footer-form-code">{footer.formCode}</div>
              </div>
            </td>
            <td className="results-footer-note-cell">
              <div className="results-footer-note-copy">
                {footer.signatureNote}
              </div>
              {/* Template marker in footer for non-FC types */}
              {isNonDefault && (
                <div style={{ marginTop: '1mm', fontSize: '6pt', color: '#0369a1', fontWeight: 400 }}>
                  [Template: {config.type}]
                </div>
              )}
            </td>
            <td className="results-footer-meta-cell">
              Edisi/Revisi : 11/1
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
