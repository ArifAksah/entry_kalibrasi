'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const ConfirmEmailPage: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading')
  const [message, setMessage] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const token = searchParams.get('token')
        const email = searchParams.get('email')

        if (!token || !email) {
          setStatus('error')
          setMessage('Token atau email tidak ditemukan')
          return
        }

        // Verifikasi token dengan Supabase
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email'
        })

        if (error) {
          console.error('Email confirmation error:', error)
          if (error.message.includes('expired') || error.message.includes('invalid')) {
            setStatus('expired')
            setMessage('Link konfirmasi telah kedaluwarsa atau tidak valid. Silakan minta link baru.')
          } else {
            setStatus('error')
            setMessage('Gagal mengkonfirmasi email. Silakan coba lagi.')
          }
          return
        }

        if (data.user) {
          setStatus('success')
          setMessage('Email berhasil dikonfirmasi! Anda akan diarahkan ke halaman login.')
          
          // Redirect ke login setelah 3 detik
          setTimeout(() => {
            router.push('/login')
          }, 3000)
        } else {
          setStatus('error')
          setMessage('Gagal mengkonfirmasi email.')
        }

      } catch (error) {
        console.error('Unexpected error:', error)
        setStatus('error')
        setMessage('Terjadi kesalahan yang tidak terduga.')
      }
    }

    confirmEmail()
  }, [searchParams, router])

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
        )
      case 'success':
        return (
          <div className="rounded-full h-16 w-16 bg-green-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="rounded-full h-16 w-16 bg-red-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      case 'expired':
        return (
          <div className="rounded-full h-16 w-16 bg-yellow-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        )
    }
  }

  const getStatusTitle = () => {
    switch (status) {
      case 'loading':
        return 'Memverifikasi Email...'
      case 'success':
        return 'Email Berhasil Dikonfirmasi!'
      case 'error':
        return 'Gagal Mengkonfirmasi Email'
      case 'expired':
        return 'Link Kedaluwarsa'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'expired':
        return 'text-yellow-600'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex justify-center mb-6">
            {getStatusIcon()}
          </div>
          
          <h2 className={`text-3xl font-bold ${getStatusColor()}`}>
            {getStatusTitle()}
          </h2>
          
          <p className="mt-4 text-gray-600">
            {message}
          </p>

          {status === 'success' && (
            <div className="mt-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  Anda akan diarahkan ke halaman login dalam beberapa detik...
                </p>
              </div>
            </div>
          )}

          {status === 'expired' && (
            <div className="mt-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 mb-4">
                  Link konfirmasi telah kedaluwarsa. Silakan minta link konfirmasi baru.
                </p>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Kembali ke Login
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 mb-4">
                  Terjadi kesalahan saat mengkonfirmasi email. Silakan coba lagi atau hubungi administrator.
                </p>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Kembali ke Login
                </button>
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className="mt-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Mohon tunggu sebentar, kami sedang memverifikasi email Anda...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConfirmEmailPage


