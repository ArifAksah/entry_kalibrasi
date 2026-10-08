'use client'

import React, { useEffect, useRef } from 'react'
import QRCodeStyling from 'qr-code-styling'
import bmkgLogo from '../../app/bmkg.png'

type Props = {
  value: string
  size: number
  logoSize?: number
  className?: string
  fgColor?: string
}

/**
 * QR code dengan logo BMKG di tengah — bentuk yang sama dengan yang dipakai
 * pada Sertifikat. Dirender sebagai canvas agar ikut terekam saat PDF dibuat.
 */
export const QRCodeWithLogo: React.FC<Props> = ({
  value,
  size,
  logoSize = 16,
  className = '',
  fgColor = '#000000',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const qrRef = useRef<QRCodeStyling | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const options = {
      width: size,
      height: size,
      type: 'canvas' as const,
      data: value || ' ',
      backgroundOptions: { color: '#FFFFFF' },
      dotsOptions: { color: fgColor || '#000000', type: 'square' as const },
      cornersSquareOptions: { color: '#000000', type: 'square' as const },
      cornersDotOptions: { color: '#000000' },
      image: bmkgLogo.src,
      imageOptions: {
        crossOrigin: 'anonymous' as const,
        margin: 4,
        imageSize: logoSize / size,
      },
      margin: 6,
    }

    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(options)
      qrRef.current.append(containerRef.current)
    } else {
      qrRef.current.update(options)
    }
  }, [value, size, fgColor, logoSize])

  return <div className={className} ref={containerRef} />
}

export default QRCodeWithLogo
