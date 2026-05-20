/**
 * FC Balai 4 (Field Calibration — Balai Besar MKG Wilayah IV) template configuration.
 *
 * Uses Balai 4 specific header (name, address, logo) with FC format.
 */

import type { TemplateConfig } from '../types'
import { DEFAULT_STYLING } from './shared/base-styles'
import { BALAI_DATA } from './shared/balai-data'

const balai = BALAI_DATA[4]

export const fcBalai4Template: TemplateConfig = {
  type: 'fc_balai_4',

  header: {
    agencyName: 'BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA',
    labName: 'LABORATORIUM KALIBRASI BMKG',
    logoPath: '/logos/bmkg.png',
    balaiName: balai.name,
    balaiAddress: balai.address,
    balaiLogoPath: balai.logoPath,
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
    officeAddress: balai.address,
    signatureNote: 'Dokumen ini ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh BSrE',
  },

  styling: DEFAULT_STYLING,
}
