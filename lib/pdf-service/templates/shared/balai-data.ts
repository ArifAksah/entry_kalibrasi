/**
 * Shared Balai (UPT) data for certificate templates.
 *
 * Contains official names, addresses, and logo paths for all 5 Balai Besar MKG.
 * Used by both FC and LC Balai template variants.
 */

/**
 * Information about a single Balai (Unit Pelaksana Teknis).
 */
export interface BalaiInfo {
  id: number
  name: string
  address: string
  logoPath: string
  signerTitle: string
}

/**
 * Default signer title for BMKG Pusat (when no Balai is selected).
 */
export const DEFAULT_SIGNER_TITLE = 'Direktur Instrumentasi dan Kalibrasi BMKG'

/**
 * Complete data for all 5 Balai Besar MKG.
 * Keyed by Balai number (1–5).
 */
export const BALAI_DATA: Record<number, BalaiInfo> = {
  1: {
    id: 1,
    name: 'BALAI BESAR MKG WILAYAH I',
    address: 'Jl. Ngumban Surbakti No. 15, Sempakata, Medan Selayang, Kota Medan, Sumatera Utara 20131',
    logoPath: '/logos/balai-1.png',
    signerTitle: 'Kepala Balai Besar MKG Wilayah I',
  },
  2: {
    id: 2,
    name: 'BALAI BESAR MKG WILAYAH II',
    address: 'Jl. Raya Serpong Km. 1, Ciputat, Tangerang Selatan, Banten 15412',
    logoPath: '/logos/balai-2.png',
    signerTitle: 'Kepala Balai Besar MKG Wilayah II',
  },
  3: {
    id: 3,
    name: 'BALAI BESAR MKG WILAYAH III',
    address: 'Jl. Raya Tuban, Kuta, Badung, Bali 80361',
    logoPath: '/logos/balai-3.png',
    signerTitle: 'Kepala Balai Besar MKG Wilayah III',
  },
  4: {
    id: 4,
    name: 'BALAI BESAR MKG WILAYAH IV',
    address: 'Jl. Racing Centre No. 4, Panakkukang, Makassar, Sulawesi Selatan 90231',
    logoPath: '/logos/balai-4.png',
    signerTitle: 'Kepala Balai Besar MKG Wilayah IV',
  },
  5: {
    id: 5,
    name: 'BALAI BESAR MKG WILAYAH V',
    address: 'Jl. Baru Angkasapura, Jayapura Utara, Kota Jayapura, Papua 99117',
    logoPath: '/logos/balai-5.png',
    signerTitle: 'Kepala Balai Besar MKG Wilayah V',
  },
}

/**
 * Retrieves Balai info by ID. Throws if ID is invalid.
 */
export function getBalaiInfo(balaiId: number): BalaiInfo {
  const info = BALAI_DATA[balaiId]
  if (!info) {
    throw new Error(
      `Invalid balai_id: ${balaiId}. Must be between 1 and 5.`
    )
  }
  return info
}
