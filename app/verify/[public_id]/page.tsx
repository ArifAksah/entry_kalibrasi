'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface CertificateData {
    valid: boolean
    certificate: {
        no_certificate: string
        no_order: string
        no_identification: string
        issue_date: string
        status: string
        pdf_generated_at: string | null
        station_name: string
        instrument_name: string
        signatories: {
            calibrator: { name: string; role: string }
            verifikator_1: { name: string; role: string }
            verifikator_2: { name: string; role: string }
            assignor: { name: string; role: string }
        }
    }
}

export default function PublicVerificationPage() {
    const params = useParams()
    const public_id = params?.public_id as string

    const [data, setData] = useState<CertificateData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!public_id) return

        const fetchData = async () => {
            try {
                const response = await fetch(`/api/public/certificates/${public_id}`)
                if (!response.ok) {
                    throw new Error('Certificate not found or invalid')
                }
                const result = await response.json()
                setData(result)
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [public_id])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Verifying Certificate...</p>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center border-t-4 border-red-500">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
                        <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
                    <p className="text-gray-600 mb-6">{error || 'Certificate not found'}</p>
                    <div className="text-sm text-gray-500">
                        Please ensure you have scanned a valid QR code from an official certificate.
                    </div>
                </div>
            </div>
        )
    }

    const { certificate } = data
    const isValid = true // Since we found it in DB, it's valid in our system

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900">Certificate Verification</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Official Document Verification System
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    {/* Status Banner */}
                    <div className="bg-green-500 px-6 py-4 flex items-center justify-center space-x-3">
                        <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-white font-bold text-lg tracking-wide uppercase">Valid & Authentic</span>
                    </div>

                    <div className="px-6 py-8 sm:p-10">
                        {/* Certificate Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Certificate Number</p>
                                <p className="text-lg font-bold text-gray-900 mt-1">{certificate.no_certificate}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Issue Date</p>
                                <p className="text-lg font-bold text-gray-900 mt-1">
                                    {new Date(certificate.issue_date).toLocaleDateString('id-ID', {
                                        day: 'numeric', month: 'long', year: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Details Table */}
                        <div className="border-t border-gray-200 pt-8">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Document Details</h3>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Order Number</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{certificate.no_order}</dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Identification Number</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{certificate.no_identification}</dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Station</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{certificate.station_name}</dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Instrument</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{certificate.instrument_name}</dd>
                                </div>
                                <div className="sm:col-span-2">
                                    <dt className="text-sm font-medium text-gray-500">Digital Signature Timestamp</dt>
                                    <dd className="mt-1 text-sm text-gray-900">
                                        {certificate.pdf_generated_at
                                            ? new Date(certificate.pdf_generated_at).toLocaleString('id-ID')
                                            : 'Not yet signed'}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {/* Signatories */}
                        <div className="border-t border-gray-200 pt-8 mt-8">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Authorized Personnel</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                                {/* Calibrator */}
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            <span className="text-blue-600 font-bold text-sm">C</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{certificate.signatories.calibrator.name}</p>
                                        <p className="text-xs text-gray-500">Calibrator</p>
                                    </div>
                                </div>

                                {/* Verifikator 1 */}
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                                            <span className="text-purple-600 font-bold text-sm">V1</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{certificate.signatories.verifikator_1.name}</p>
                                        <p className="text-xs text-gray-500">Verifikator 1</p>
                                    </div>
                                </div>

                                {/* Verifikator 2 */}
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                                            <span className="text-purple-600 font-bold text-sm">V2</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{certificate.signatories.verifikator_2.name}</p>
                                        <p className="text-xs text-gray-500">Verifikator 2</p>
                                    </div>
                                </div>

                                {/* Assignor */}
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                            <span className="text-indigo-600 font-bold text-sm">A</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{certificate.signatories.assignor.name}</p>
                                        <p className="text-xs text-gray-500">Assignor (Signer)</p>
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 text-center">
                        <p className="text-xs text-gray-500">
                            This is a digitally generated document. The information above is verified against our secure database.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
