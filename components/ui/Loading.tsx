'use client'

import React from 'react'

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
export type SpinnerTone =
  'blue' | 'teal' | 'slate' | 'red' | 'emerald' | 'white' | 'current'

const SIZE_MAP: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border-2',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
  xl: 'h-12 w-12 border-4',
  xxl: 'h-16 w-16 border-4',
}

const TONE_MAP: Record<SpinnerTone, string> = {
  blue: 'border-blue-200 border-t-blue-600',
  teal: 'border-teal-200 border-t-teal-600',
  slate: 'border-slate-200 border-t-slate-700',
  red: 'border-red-200 border-t-red-600',
  emerald: 'border-emerald-200 border-t-emerald-600',
  white: 'border-white/30 border-t-white',
  current: 'border-transparent border-t-current',
}

export interface SpinnerProps {
  size?: SpinnerSize
  tone?: SpinnerTone
  className?: string
  label?: string
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  tone = 'blue',
  className = '',
  label = 'Memuat',
}) => (
  <div
    className={`animate-spin rounded-full box-border shrink-0 ${SIZE_MAP[size]} ${TONE_MAP[tone]} ${className}`}
    role="status"
    aria-label={label}
  />
)

const BACKDROP_MAP: Record<'dark' | 'light' | 'none', string> = {
  dark: 'bg-black/60 backdrop-blur-sm text-white',
  light: 'bg-white/85 backdrop-blur-sm text-slate-700',
  none: 'text-slate-700',
}

export interface LoadingOverlayProps {
  open?: boolean
  label?: React.ReactNode
  size?: SpinnerSize
  tone?: SpinnerTone
  backdrop?: 'dark' | 'light' | 'none'
  zIndex?: number
  className?: string
  spinnerClassName?: string
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  open = true,
  label,
  size = 'xl',
  tone = 'white',
  backdrop = 'dark',
  zIndex = 60,
  className = '',
  spinnerClassName = '',
}) => {
  if (!open) return null
  const toneFallback: SpinnerTone =
    backdrop === 'light' || backdrop === 'none'
      ? tone === 'white'
        ? 'blue'
        : tone
      : tone
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center ${BACKDROP_MAP[backdrop]} ${className}`}
      style={{ zIndex }}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size={size} tone={toneFallback} className={spinnerClassName} />
        {label ? <p className="text-sm opacity-90">{label}</p> : null}
      </div>
    </div>
  )
}

export interface LoadingStateProps {
  label?: React.ReactNode
  size?: SpinnerSize
  tone?: SpinnerTone
  className?: string
  spinnerClassName?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Memuat data…',
  size = 'lg',
  tone = 'blue',
  className = '',
  spinnerClassName = '',
}) => (
  <div
    className={`flex flex-col items-center justify-center gap-3 py-12 text-slate-500 ${className}`}
    role="status"
    aria-live="polite"
  >
    <Spinner size={size} tone={tone} className={spinnerClassName} />
    {label ? <p className="text-sm">{label}</p> : null}
  </div>
)

type LegacyLoadingProps = {
  fullScreen?: boolean
  size?: number
  label?: React.ReactNode
  className?: string
}

const Loading: React.FC<LegacyLoadingProps> = ({
  fullScreen = true,
  size = 40,
  label,
  className = '',
}) => {
  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur-sm'
    : 'flex flex-col items-center justify-center gap-3 py-12'

  const pxSpinner: React.CSSProperties = { width: size, height: size }
  return (
    <div
      className={`${containerClass} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
        style={pxSpinner}
        aria-label="Memuat"
      />
      {label ? <p className="text-sm text-slate-600">{label}</p> : null}
    </div>
  )
}

export default Loading
