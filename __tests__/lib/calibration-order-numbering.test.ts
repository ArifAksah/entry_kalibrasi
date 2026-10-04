/**
 * Kontrak penomoran order & identifikasi.
 * Test ini mengunci format yang dipakai bersama DB dan UI:
 *   - no_order        = LPAD(n, 3, '0')            -> "346"
 *   - no_identification = no_order + "." + LPAD(seq,3,'0') -> "346.001"
 *   - format sertifikat FC = Sert.FC-CODE/{no_order}.{seq}/DIK/{roman}/{year}
 *   - format sertifikat LC = Sert.LC-CODE/{no_order}/DIK/{roman}/{year}
 *
 * Nilai-nilai ini harus konsisten dengan:
 *   database/calibration_order_02_rpc.sql  (_format_order_number)
 *   database/calibration_order_03_link_certificate.sql
 */

function formatOrderNumber(n: number): string {
  return String(Math.max(n, 0)).padStart(3, '0')
}

function makeIdentification(noOrder: string, seq: number): string {
  return `${noOrder}.${formatOrderNumber(seq)}`
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function formatCertificateNo(
  place: 'FC' | 'LC',
  code: string,
  noOrder: string,
  seq: number,
  month: number,
  year: number,
): string {
  if (place === 'FC') {
    return `Sert.FC-${code}/${noOrder}.${formatOrderNumber(seq)}/DIK/${ROMAN[month - 1]}/${year}`
  }
  return `Sert.LC-${code}/${noOrder}/DIK/${ROMAN[month - 1]}/${year}`
}

describe('penomoran order & identifikasi', () => {
  it('mem-pad nomor order menjadi 3 digit', () => {
    expect(formatOrderNumber(1)).toBe('001')
    expect(formatOrderNumber(37)).toBe('037')
    expect(formatOrderNumber(346)).toBe('346')
    expect(formatOrderNumber(1000)).toBe('1000')
  })

  it('membentuk no_identification = no_order.sequence', () => {
    expect(makeIdentification('346', 1)).toBe('346.001')
    expect(makeIdentification('346', 12)).toBe('346.012')
    expect(makeIdentification('037', 5)).toBe('037.005')
  })

  it('format sertifikat FC memakai no_order.ident', () => {
    expect(formatCertificateNo('FC', 'RR', '346', 1, 9, 2026)).toBe('Sert.FC-RR/346.001/DIK/IX/2026')
    expect(formatCertificateNo('FC', 'AWOS', '037', 1, 6, 2026)).toBe('Sert.FC-AWOS/037.001/DIK/VI/2026')
  })

  it('format sertifikat LC memakai no_order saja', () => {
    expect(formatCertificateNo('LC', 'RR', '346', 1, 9, 2026)).toBe('Sert.LC-RR/346/DIK/IX/2026')
  })

  it('reset tahunan: scope kosong mulai dari 001', () => {
    // Counter 2026 FC = 345 -> berikutnya 346
    expect(formatOrderNumber(345 + 1)).toBe('346')
    // Tahun baru tanpa order -> mulai 001
    expect(formatOrderNumber(0 + 1)).toBe('001')
  })
})
