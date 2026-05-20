/**
 * Standar (Standard Calibration) template configuration.
 *
 * Used for standard calibration certificates that include traceability
 * information and validity dates. These certificates track the calibration
 * chain of reference standards used by the laboratory.
 */

import type { TemplateConfig } from '../types'
import { DEFAULT_STYLING } from './shared/base-styles'

export const standarTemplate: TemplateConfig = {
  type: 'standar',

  header: {
    agencyName: 'BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA',
    labName: 'LABORATORIUM KALIBRASI BMKG',
    logoPath: '/logos/bmkg.png',
  },

  coverPage: {
    titleId: 'SERTIFIKAT KALIBRASI STANDAR',
    titleEn: 'STANDARD CALIBRATION CERTIFICATE',
    showAccreditation: false,
    showTraceability: true,
    showValidityDates: true,
    sections: [
      {
        id: 'instrument-details',
        headingId: 'Yang Bertanda Tangan di Bawah Ini Menerangkan Bahwa',
        headingEn: 'The Undersigned Herewith Certifies That',
        fields: [
          {
            labelId: 'Nama Alat',
            labelEn: 'Instrument Name',
            dataKey: 'instrument_name',
          },
          {
            labelId: 'Merek Pabrik',
            labelEn: 'Manufacturer',
            dataKey: 'manufacturer',
          },
          {
            labelId: 'Tipe / Nomor Seri',
            labelEn: 'Type / Serial Number',
            dataKey: 'type_serial_number',
          },
          {
            labelId: 'Lain-lain',
            labelEn: 'Others',
            dataKey: 'others',
          },
        ],
      },
      {
        id: 'owner-identification',
        headingId: 'Milik',
        headingEn: 'Owned By',
        fields: [
          {
            labelId: 'Nama',
            labelEn: 'Designation',
            dataKey: 'owner_name',
          },
          {
            labelId: 'Alamat',
            labelEn: 'Address',
            dataKey: 'owner_address',
          },
        ],
      },
      {
        id: 'traceability',
        headingId: 'Ketertelusuran',
        headingEn: 'Traceability',
        fields: [
          {
            labelId: 'Nama Alat Standar',
            labelEn: 'Standard Instrument Name',
            dataKey: 'traceability_instrument_name',
          },
          {
            labelId: 'Nomor Seri',
            labelEn: 'Serial Number',
            dataKey: 'traceability_serial_number',
          },
          {
            labelId: 'Nomor Sertifikat Acuan',
            labelEn: 'Reference Certificate Number',
            dataKey: 'traceability_certificate_number',
          },
          {
            labelId: 'Tertelusur ke SI Melalui',
            labelEn: 'Traceable to SI Through',
            dataKey: 'traceable_to_si_through',
          },
        ],
      },
    ],
  },

  resultsPage: {
    headerRepeat: true,
    footerRepeat: true,
    showUncertainty: false,
    oneSensorPerPage: true,
  },

  footer: {
    formCode: 'F/IKK 7.8.4',
    showQRCode: true,
    qrPosition: 'bottom-left',
    officeAddress: 'Jl. Angkasa I No. 2, Kemayoran, Jakarta 10720',
    signatureNote: 'Dokumen ini ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh BSrE',
  },

  styling: DEFAULT_STYLING,
}
