'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

type CertificateDetails = {
    id: number;
    no_certificate: string;
    nama_alat: string;
    customer_name: string;
    station_name: string;
    scope_name: string;
    calibration_date: string;
    status: string;
    authorized_by_name: string;
    authorized_date: string;
    created_at: string;
    qr_link: string;
    verifikator_1_name: string;
    verifikator_2_name: string;
    calibrator_name: string;
};

export default function PublicVerificationPage() {
    const params = useParams();
    const public_id = params.public_id as string;

    const [certificate, setCertificate] = useState<CertificateDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCertificate = async () => {
            if (!public_id) return;

            try {
                setLoading(true);
                const response = await fetch(`/api/public/certificates/${public_id}`);

                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Sertifikat tidak ditemukan');
                    }
                    throw new Error('Gagal memuat data sertifikat');
                }

                const data = await response.json();
                setCertificate(data.data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchCertificate();
    }, [public_id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
                <p className="text-gray-600 font-medium">Memverifikasi sertifikat...</p>
            </div>
        );
    }

    if (error || !certificate) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Sertifikat Tidak Ditemukan</h1>
                    <p className="text-gray-600 mb-6">
                        {error || 'Data sertifikat tidak dapat ditemukan atau URL tidak valid.'}
                    </p>
                    <div className="text-sm text-gray-500">
                        ID: {public_id}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-xl overflow-hidden">
                {/* Header Status - Valid */}
                <div className="bg-teal-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-white p-2 rounded-full">
                            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Sertifikat Valid & Otentik</h1>
                            <p className="text-teal-100 text-sm">Terdaftar di Sistem Kalibrasi BMKG</p>
                        </div>
                    </div>
                    <div className="hidden sm:block">
                        <Image
                            src="/logo_bmkg.png"
                            alt="BMKG Logo"
                            width={50}
                            height={50}
                            className="opacity-90"
                        />
                    </div>
                </div>

                <div className="p-6 sm:p-8">
                    {/* Main Certificate Info */}
                    <div className="border-b border-gray-200 pb-6 mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">{certificate.no_certificate}</h2>
                        <p className="text-gray-500">Nomor Sertifikat</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Informasi Alat</h3>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-400">Nama Alat</p>
                                    <p className="font-semibold text-gray-900">{certificate.nama_alat}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Lingkup Kalibrasi</p>
                                    <p className="font-semibold text-gray-900">{certificate.scope_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Pelanggan / Pemilik</p>
                                    <p className="font-semibold text-gray-900">{certificate.customer_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Lokasi / Stasiun</p>
                                    <p className="font-semibold text-gray-900">{certificate.station_name}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Status & Tanggal</h3>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-400">Status Sertifikat</p>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {certificate.status}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Tanggal Kalibrasi</p>
                                    <p className="font-semibold text-gray-900">
                                        {new Date(certificate.calibration_date).toLocaleDateString('id-ID', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Tanggal Terbit</p>
                                    <p className="font-semibold text-gray-900">
                                        {certificate.authorized_date ? new Date(certificate.authorized_date).toLocaleDateString('id-ID', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        }) : '-'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Signatories */}
                    <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Tim Kalibrasi</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Kalibrator</p>
                                <div className="flex items-center">
                                    <div className="w-2 h-2 bg-teal-500 rounded-full mr-2"></div>
                                    <p className="text-sm font-medium text-gray-900">{certificate.calibrator_name || '-'}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Verifikator</p>
                                <div className="space-y-1">
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                        <p className="text-sm font-medium text-gray-900">{certificate.verifikator_1_name || '-'}</p>
                                    </div>
                                    {certificate.verifikator_2_name && (
                                        <div className="flex items-center">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                            <p className="text-sm font-medium text-gray-900">{certificate.verifikator_2_name}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Disetujui Oleh</p>
                                <div className="flex items-center">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                                    <p className="text-sm font-medium text-gray-900">{certificate.authorized_by_name || '-'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-gray-400">
                            Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh BSrE.
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Scan QR Code pada fisik sertifikat untuk memastikan keaslian dokumen.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
