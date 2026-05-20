/**
 * FC (Field Calibration) template configuration.
 *
 * Used for field calibration certificates issued by BMKG pusat (Jakarta).
 * No accreditation info, no uncertainty column.
 */

import type { TemplateConfig } from '../types'
import { DEFAULT_STYLING } from './shared/base-styles'

export const fcTemplate: TemplateConfig = {
  type: 'fc',

  header: {
    agencyName: 'BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA',
    labName: 'LABORATORIUM KALIBRASI BMKG',
    logoPath: '/logos/bmkg.png',
  },

  coverPage: {
    titleId: 'SERTIFIKAT KALIBRASI',
    titleEn: 'CALIBRATION CERTIFICATE',
    showAccreditation: false,
    showTraceability: false,
    showValidityDates: false,
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
    ],
  },

  resultsPage: {
    headerRepeat: true,
    footerRepeat: true,
    showUncertainty: false,
    oneSensorPerPage: true,
  },

  footer: {
    formCode: 'F/IKK 7.8.2',
    showQRCode: true,
    qrPosition: 'bottom-left',
    officeAddress: 'Jl. Angkasa I No. 2, Kemayoran, Jakarta 10720',
    signatureNote: 'Dokumen ini ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh BSrE',
  },

  styling: DEFAULT_STYLING,
}
