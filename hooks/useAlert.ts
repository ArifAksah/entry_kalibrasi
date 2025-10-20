'use client'

import { useState, useCallback } from 'react'
import { AlertProps } from '../components/ui/Alert'

interface AlertState extends AlertProps {
  show: boolean
}

export const useAlert = () => {
  const [alert, setAlert] = useState<AlertState>({
    show: false,
    type: 'info',
    message: '',
    autoHide: true,
    duration: 3000
  })

  const showAlert = useCallback((props: Omit<AlertProps, 'onClose'>) => {
    setAlert({
      ...props,
      show: true
    })
  }, [])

  const hideAlert = useCallback(() => {
    setAlert(prev => ({ ...prev, show: false }))
  }, [])

  const showSuccess = useCallback((message: string, duration?: number) => {
    showAlert({ type: 'success', message, duration })
  }, [showAlert])

  const showError = useCallback((message: string, duration?: number) => {
    showAlert({ type: 'error', message, duration })
  }, [showAlert])

  const showWarning = useCallback((message: string, duration?: number) => {
    showAlert({ type: 'warning', message, duration })
  }, [showAlert])

  const showInfo = useCallback((message: string, duration?: number) => {
    showAlert({ type: 'info', message, duration })
  }, [showAlert])

  return {
    alert,
    showAlert,
    hideAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}
