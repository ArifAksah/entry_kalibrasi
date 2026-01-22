'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import CertificatesCRUD from '../ui/dashboard/certificates-crud';

import { useTour } from '../../hooks/useTour';
import { DriveStep } from 'driver.js';

const CertificatesPage: React.FC = () => {
  // Ref to hold the driver instance for access within step callbacks
  const driverRef = React.useRef<any>(null);

  const tourSteps: DriveStep[] = [
    {
      element: '#btn-add-certificate',
      popover: {
        title: 'Buat Sertifikat Baru',
        description: 'Klik tombol ini untuk memulai proses pembuatan sertifikat baru. <br/><br/><strong>PENTING: Tur akan otomatis membuka formulir untuk Anda saat Anda menekan tombol "Next" (->).</strong>',
        side: "left",
        align: 'start',
        // onNextClick callback to handle auto-opening the modal
        onNextClick: () => {
          const btn = document.getElementById('btn-add-certificate');
          if (btn) {
            btn.click();
            // Add a small delay to allow modal to render before moving to next step
            setTimeout(() => {
              driverRef.current?.moveNext();
            }, 500);
          } else {
            driverRef.current?.moveNext();
          }
        }
      }
    },
    {
      element: '#form-station',
      popover: {
        title: 'Pilih Stasiun',
        description: 'Pilih stasiun yang akan dikalibrasi dari daftar drop-down. Alamat akan terisi otomatis.',
        side: "right",
        align: 'start',
      }
    },
    {
      element: '#form-no-certificate',
      popover: {
        title: 'Nomor Sertifikat',
        description: 'Masukkan nomor sertifikat yang unik untuk dokumen ini.',
        side: "right",
        align: 'start',
      }
    },
    {
      element: '#form-no-order',
      popover: {
        title: 'Nomor Order',
        description: 'Masukkan nomor order terkait pekerjaan ini.',
        side: "right",
        align: 'start',
      }
    },
    {
      element: '#form-no-identification',
      popover: {
        title: 'Nomor Identifikasi',
        description: 'Masukkan nomor identifikasi alat atau dokumen.',
        side: "right",
        align: 'start',
      }
    },
    {
      element: '#form-issue-date',
      popover: {
        title: 'Tanggal Terbit',
        description: 'Tentukan tanggal penerbitan sertifikat.',
        side: "right",
        align: 'start',
      }
    },
    {
      element: '#form-authorized-by',
      popover: {
        title: 'Authorized By (Assignor)',
        description: 'Pilih pejabat yang memberikan otorisasi (Assignor).',
        side: "right",
        align: 'start',
      }
    },
    {
      element: '#form-verifikator-1',
      popover: {
        title: 'Verifikator 1',
        description: 'Pilih verifikator pertama yang akan memeriksa sertifikat.',
        side: "right",
        align: 'start',
      }
    },
    {
      element: '#form-verifikator-2',
      popover: {
        title: 'Verifikator 2',
        description: 'Pilih verifikator kedua yang akan memeriksa sertifikat.',
        side: "right",
        align: 'start',
      }
    },
    {
      element: '#form-instrument',
      popover: {
        title: 'Data Instrumen',
        description: 'Pilih instrumen yang dikalibrasi. Informasi detail instrumen akan muncul otomatis.',
        side: "right",
        align: 'start',
      }
    },
    {
      element: '#btn-add-result',
      popover: {
        title: 'Hasil Kalibrasi',
        description: 'Klik tombol ini untuk menambahkan data hasil kalibrasi untuk setiap sensor. <br/><br/><strong>PENTING: Tur akan otomatis menambahkan hasil kalibrasi saat Anda menekan tombol "Next" (->).</strong>',
        side: "top",
        align: 'start',
        onNextClick: () => {
          const btn = document.getElementById('btn-add-result');
          if (btn) {
            btn.click();
            setTimeout(() => {
              driverRef.current?.moveNext();
            }, 500);
          } else {
            driverRef.current?.moveNext();
          }
        }
      }
    },
    {
      element: '#btn-env-conditions',
      popover: {
        title: 'Kondisi Lingkungan',
        description: 'Klik tombol ini untuk mengisi data kondisi lingkungan. <br/><br/><strong>Tur akan membuka pop-up ini untuk Anda.</strong>',
        side: "top",
        align: 'start',
        onNextClick: () => {
          document.getElementById('btn-env-conditions')?.click();
          setTimeout(() => driverRef.current?.moveNext(), 500);
        }
      }
    },
    {
      element: '#btn-save-env-conditions',
      popover: {
        title: 'Isi Kondisi Lingkungan',
        description: 'Di sini Anda dapat mengisi suhu, kelembaban, dan parameter lingkungan lainnya. Klik "Simpan" (atau Next) untuk menyimpan dan lanjut.',
        side: "left",
        align: 'center',
        onNextClick: () => {
          document.getElementById('btn-save-env-conditions')?.click();
          setTimeout(() => driverRef.current?.moveNext(), 500);
        }
      }
    },
    {
      element: '#btn-result-table',
      popover: {
        title: 'Tabel Hasil',
        description: 'Tombol ini membuka tabel untuk input data pengukuran. <br/><br/><strong>Tur akan otomatis membukanya.</strong>',
        side: "top",
        align: 'start',
        onNextClick: () => {
          document.getElementById('btn-result-table')?.click();
          setTimeout(() => driverRef.current?.moveNext(), 500);
        }
      }
    },
    {
      element: '#btn-save-result-table',
      popover: {
        title: 'Input Data Tabel',
        description: 'Masukkan hasil pengukuran dan koreksi pada tabel ini. Anda bisa menambah baris sesuai kebutuhan.',
        side: "left",
        align: 'center',
        onNextClick: () => {
          document.getElementById('btn-save-result-table')?.click();
          setTimeout(() => driverRef.current?.moveNext(), 500);
        }
      }
    },
    {
      element: '#btn-calibration-notes',
      popover: {
        title: 'Catatan Kalibrasi',
        description: 'Tambahkan catatan metode, dokumen referensi, dan instrumen standar di sini. <br/><br/><strong>Tur akan otomatis membukanya.</strong>',
        side: "top",
        align: 'start',
        onNextClick: () => {
          document.getElementById('btn-calibration-notes')?.click();
          setTimeout(() => driverRef.current?.moveNext(), 500);
        }
      }
    },
    {
      element: '#btn-save-notes',
      popover: {
        title: 'Simpan Catatan',
        description: 'Isi detail catatan lalu klik Simpan.',
        side: "left",
        align: 'center',
        onNextClick: () => {
          document.getElementById('btn-save-notes')?.click();
          setTimeout(() => driverRef.current?.moveNext(), 500);
        }
      }
    },
    {
      element: '#btn-save-certificate',
      popover: {
        title: 'Simpan',
        description: 'Setelah semua data lengkap, klik tombol ini untuk menyimpan sertifikat baru.',
        side: "top",
        align: 'end',
      }
    }
  ];

  const { startTour, driverObj } = useTour({ steps: tourSteps });

  // Sync the driver instance
  React.useEffect(() => {
    if (driverObj.current) {
      driverRef.current = driverObj.current;
    }
  }, [driverObj, startTour]); // startTour dependency ensures re-sync if recreated

  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Certificate Management</h1>
              <button
                onClick={startTour}
                className="flex items-center gap-2 px-4 py-2 bg-white text-[#1e377c] border border-[#1e377c] rounded-lg hover:bg-blue-50 transition-all shadow-sm text-sm font-semibold"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                Mulai Tur Pengisian
              </button>
            </div>
            <CertificatesCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default CertificatesPage;









