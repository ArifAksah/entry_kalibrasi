'use client'

import React from 'react'
import Image from 'next/image'
import bmkgLogo from '../../app/bmkg.png'
import { QRCodeWithLogo } from '../ui/QRCodeWithLogo'

export type SuratKeteranganRow = {
  parameter: string
  hasil?: string | null
}

export type SuratKeteranganProps = {
  letter: {
    no_letter?: string | null
    no_order?: string | null
    issue_date?: string | null
    inspection_date?: string | null
    inspection_place?: string | null
    reference_document?: string | null
    notes?: string | null
  }
  results: SuratKeteranganRow[]
  instrument?: {
    name?: string | null
    manufacturer?: string | null
    type?: string | null
    serial_number?: string | null
    others?: string | null
  } | null
  sensor?: {
    name?: string | null
    manufacturer?: string | null
    type?: string | null
    serial_number?: string | null
  } | null
  owner?: { name?: string | null; address?: string | null } | null
  authorized?: { name?: string | null; title?: string | null } | null
  /** Diperiksa Oleh — tim order. */
  checkedBy?: string[]
  /** Diverifikasi Oleh — verifikator 1/2/3. */
  verifiedBy?: string[]
  totalPages?: number
  editionRevision?: string
  /** URL verifikasi QR (halaman /verify-surat/<public_id>). */
  verifyUrl?: string | null
  /** Sudah ditandatangani elektronik? Menentukan warna QR. */
  signed?: boolean
  /** Lembar pemeriksaan per sensor. Bila diisi, dibuat satu halaman per sensor. */
  sensorSheets?: Array<{
    sensor: {
      id?: number
      name?: string | null
      manufacturer?: string | null
      type?: string | null
      serial_number?: string | null
    } | null
    rows: SuratKeteranganRow[]
  }>
}

function fmtDate(value?: string | null): string {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

const Label: React.FC<{ indo: string; eng?: string }> = ({ indo, eng }) => (
  <span>
    {indo}
    {eng ? (
      <>
        {' / '}
        <span className="italic">{eng}</span>
      </>
    ) : null}
  </span>
)

export const SuratKeteranganDocument: React.FC<SuratKeteranganProps> = ({
  letter,
  results,
  instrument,
  sensor,
  owner,
  authorized,
  checkedBy = [],
  verifiedBy = [],
  totalPages = 2,
  editionRevision = 'Edisi/Revisi : 12/1',
  verifyUrl = null,
  signed = false,
  sensorSheets = [],
}) => {
  const sheets = Array.isArray(sensorSheets) ? sensorSheets : []
  const pages = sheets.length > 0 ? sheets.length + 1 : Math.max(2, totalPages)
  const rows = Array.isArray(results) ? results : []

  return (
    <div className="sk-wrapper">
      <style jsx global>{`
        .sk-wrapper { background: #f5f6f8; color: #000; }
        @media print {
          @page { size: A4; margin: 0; }
          .sk-no-print { display: none !important; }
          .sk-page { box-shadow: none !important; margin: 0 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .sk-page {
          width: 210mm; min-height: 297mm; margin: 16px auto; background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1); position: relative;
        }
        .sk-inner { padding: 16mm 20mm 26mm 20mm; box-sizing: border-box; font-size: 11px; }
        .sk-watermark {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-repeat: no-repeat; background-position: center; background-size: 620px 620px;
          opacity: 0.12;
        }
        .sk-content { position: relative; z-index: 1; }
        .sk-header {
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 3px double #111; padding-bottom: 4mm; margin-bottom: 6mm;
        }
        .sk-logo-slot { width: 32mm; flex: 0 0 32mm; display: flex; justify-content: center; }
        .sk-logo-slot img { width: 29mm; height: auto; }
        .sk-header-spacer { width: 32mm; flex: 0 0 32mm; }
        .sk-agency { flex: 1; text-align: center; line-height: 1.25; }
        .sk-agency h1, .sk-agency h2 { font-size: 11.5pt; font-weight: 700; margin: 0; }
        .sk-title { text-align: center; font-weight: 700; font-size: 15px; text-decoration: underline; margin: 4mm 0 1mm; }
        .sk-title-en { text-align: center; font-style: italic; font-size: 11px; margin-bottom: 3mm; }
        .sk-num { text-align: center; font-size: 12px; font-weight: 700; margin-bottom: 6mm; }
        .sk-sec { font-weight: 700; text-decoration: underline; margin: 4mm 0 0.5mm; font-size: 11px; }
        .sk-sec-en { font-style: italic; font-size: 10px; margin-bottom: 1.5mm; }
        .sk-tbl { width: 100%; border-collapse: collapse; }
        .sk-tbl td { border: none; vertical-align: top; padding: 0.6mm 0; }
        .sk-tbl .idx { width: 30%; }
        .sk-tbl .col { width: 5%; }
        .sk-grid { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 2mm; }
        .sk-grid th, .sk-grid td { border: 1px solid #111; padding: 1.5mm 2mm; vertical-align: top; text-align: left; }
        .sk-grid th { background: #f3f4f6; font-weight: 700; text-align: center; }
        .sk-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-top: 8mm; }
        .sk-foot { position: absolute; bottom: 10mm; left: 20mm; right: 20mm; font-size: 9px; color: #111; }
        .sk-foot .addr { text-align: center; }
        .sk-foot .codes { display: flex; justify-content: space-between; margin-top: 1mm; font-weight: 700; }
        .sk-note { font-size: 9.5px; text-align: justify; }
        .sk-qr-row { display: flex; align-items: center; gap: 6mm; margin-top: 5mm; }
        .sk-qr-box { width: 26mm; height: 26mm; flex: 0 0 26mm; }
      `}</style>

      {/* PAGE 1 */}
      <div className="sk-page">
        <div className="sk-watermark" style={{ backgroundImage: `url(${bmkgLogo.src})` }} />
        <div className="sk-inner sk-content">
          <header className="sk-header">
            <div className="sk-logo-slot">
              <Image src={bmkgLogo} alt="BMKG" width={160} height={160} priority />
            </div>
            <div className="sk-agency">
              <h1>BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA</h1>
              <h2>LABORATORIUM KALIBRASI BMKG</h2>
            </div>
            <div className="sk-header-spacer" />
          </header>

          <div className="sk-title">SURAT KETERANGAN</div>
          <div className="sk-title-en">TEST CERTIFICATE</div>
          <div className="sk-num">{letter.no_letter || '-'}</div>

          {/* IDENTITAS ALAT */}
          <div className="sk-sec">IDENTITAS ALAT</div>
          <div className="sk-sec-en">Instrument Details</div>
          <table className="sk-tbl">
            <tbody>
              <tr>
                <td className="idx"><Label indo="Nama Alat" eng="Instrument Name" /></td>
                <td className="col">:</td>
                <td style={{ fontWeight: 600 }}>{(instrument?.name || '-') as string}</td>
              </tr>
              <tr>
                <td><Label indo="Merek Pabrik" eng="Manufacturer" /></td>
                <td>:</td>
                <td style={{ fontWeight: 600 }}>{instrument?.manufacturer || '-'}</td>
              </tr>
              <tr>
                <td><Label indo="Tipe / Nomor Seri" eng="Type / Serial Number" /></td>
                <td>:</td>
                <td style={{ fontWeight: 600 }}>
                  {instrument?.type || '-'} / {instrument?.serial_number || '-'}
                </td>
              </tr>
              <tr>
                <td><Label indo="Lain-lain" eng="Others" /></td>
                <td>:</td>
                <td style={{ fontWeight: 600, whiteSpace: 'pre-line' }}>
                  {instrument?.others || '-'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* IDENTITAS PEMILIK */}
          <div className="sk-sec">IDENTITAS PEMILIK</div>
          <div className="sk-sec-en">Owner&apos;s Identification</div>
          <table className="sk-tbl">
            <tbody>
              <tr>
                <td className="idx"><Label indo="Nama" eng="Designation" /></td>
                <td className="col">:</td>
                <td style={{ fontWeight: 600 }}>{owner?.name || '-'}</td>
              </tr>
              <tr>
                <td><Label indo="Alamat" eng="Address" /></td>
                <td>:</td>
                <td style={{ fontWeight: 600, whiteSpace: 'pre-line' }}>{owner?.address || '-'}</td>
              </tr>
            </tbody>
          </table>

          {/* PENGESAHAN */}
          <div className="sk-sec">PENGESAHAN</div>
          <div className="sk-sec-en">Authorization</div>
          <table className="sk-tbl">
            <tbody>
              <tr>
                <td className="idx"><Label indo="Pejabat Pengesahan" eng="Authorizing officer" /></td>
                <td className="col">:</td>
                <td style={{ fontWeight: 700 }}>{authorized?.title || 'Direktur Instrumentasi dan Kalibrasi BMKG'}</td>
              </tr>
              <tr>
                <td><Label indo="Nama" eng="Name" /></td>
                <td>:</td>
                <td style={{ fontWeight: 700 }}>{authorized?.name || '-'}</td>
              </tr>
              <tr>
                <td><Label indo="Tanggal Pengesahan" eng="Date of issue" /></td>
                <td>:</td>
                <td style={{ fontWeight: 700 }}>{fmtDate(letter.issue_date)}</td>
              </tr>
              <tr>
                <td><Label indo="Jumlah halaman" eng="Total number of pages" /></td>
                <td>:</td>
                <td style={{ fontWeight: 700 }}>{pages}</td>
              </tr>
            </tbody>
          </table>

          <div className="sk-qr-row">
            <div className="sk-qr-box">
              {verifyUrl ? (
                <div className="qr-code-container" style={{ width: '26mm', height: '26mm' }}>
                  <QRCodeWithLogo
                    value={verifyUrl}
                    size={98}
                    logoSize={16}
                    fgColor={signed ? '#000000' : '#b91c1c'}
                    className="h-full w-full"
                  />
                </div>
              ) : null}
            </div>
            <div className="sk-note" style={{ flex: 1 }}>
              Dokumen ini telah ditandatangani secara elektronik menggunakan Sertifikat
              Elektronik yang diterbitkan oleh Balai Sertifikasi Elektronik (BSrE) dan tidak
              memerlukan tanda tangan atau cap. Dokumen asli dapat diperoleh dengan memindai
              kode QR di samping ini.
              <br />
              <span className="italic">
                This document is digitally signed. No signature or seal is required. The
                original document can be obtained by scanning the QR on the left.
              </span>
            </div>
          </div>

          <div className="sk-foot">
            <div className="addr">
              JL. Angkasa I No. 02 Kemayoran Jakarta Pusat
              <br />
              Tlp. 021-4246321-ext 5125; P.O. Box 3540 Jkt; Website : http://www.bmkg.go.id
            </div>
            <div className="codes">
              <span>F/IKK 7.8.1</span>
              <span>{editionRevision}</span>
            </div>
          </div>
        </div>
      </div>

      {/* HALAMAN PER SENSOR */}
      {sheets.length > 0 ? (
        sheets.map((sheet, sheetIndex) => (
          <div className="sk-page" key={sheet.sensor?.id ?? sheetIndex}>
            <div className="sk-inner">
              <table style={{ width: '100%', fontSize: 11, marginBottom: '3mm' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '50%' }}>
                      <span style={{ fontWeight: 700 }}>No. Surat /</span>{' '}
                      <span className="italic">Reference Number</span>
                    </td>
                    <td>: {letter.no_letter || '-'}</td>
                  </tr>
                  <tr>
                    <td>
                      <span style={{ fontWeight: 700 }}>No. Order /</span>{' '}
                      <span className="italic">Order Number</span>
                    </td>
                    <td>: {letter.no_order || '-'}</td>
                  </tr>
                  <tr>
                    <td>
                      <span style={{ fontWeight: 700 }}>Halaman /</span>{' '}
                      <span className="italic">Page</span>
                    </td>
                    <td>: {sheetIndex + 2} dari {pages}</td>
                  </tr>
                </tbody>
              </table>

              <table className="sk-tbl" style={{ marginTop: '3mm' }}>
                <tbody>
                  <tr>
                    <td className="idx"><Label indo="Nama Sensor" eng="Sensor Name" /></td>
                    <td className="col">:</td>
                    <td style={{ fontWeight: 600 }}>{sheet.sensor?.name || instrument?.name || '-'}</td>
                  </tr>
                  <tr>
                    <td><Label indo="Merek Alat" eng="Manufacturer" /></td>
                    <td>:</td>
                    <td style={{ fontWeight: 600 }}>{sheet.sensor?.manufacturer || instrument?.manufacturer || '-'}</td>
                  </tr>
                  <tr>
                    <td><Label indo="Tipe & No. Seri" eng="Type & Serial Number" /></td>
                    <td>:</td>
                    <td style={{ fontWeight: 600 }}>
                      {(sheet.sensor?.type || instrument?.type || '-')} / {(sheet.sensor?.serial_number || instrument?.serial_number || '-')}
                    </td>
                  </tr>
                  <tr>
                    <td><Label indo="Tanggal Pemeriksaan" eng="Test Date" /></td>
                    <td>:</td>
                    <td style={{ fontWeight: 600 }}>{fmtDate(letter.inspection_date)}</td>
                  </tr>
                  <tr>
                    <td><Label indo="Tempat Pemeriksaan" eng="Test Location" /></td>
                    <td>:</td>
                    <td style={{ fontWeight: 600 }}>{letter.inspection_place || owner?.name || '-'}</td>
                  </tr>
                </tbody>
              </table>

              {letter.notes ? (
                <div style={{ marginTop: '3mm' }}>
                  <span style={{ fontWeight: 700 }}>Catatan /</span>{' '}
                  <span className="italic">Notes</span> : {letter.notes}
                </div>
              ) : null}

              <div className="sk-sec" style={{ marginTop: '4mm', textAlign: 'center' }}>
                HASIL PEMERIKSAAN / <span className="italic" style={{ fontWeight: 400 }}>TEST RESULT</span>
              </div>
              <table className="sk-grid">
                <thead>
                  <tr>
                    <th style={{ width: '55%' }}>PARAMETER</th>
                    <th>HASIL / RESULT</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.length > 0 ? (
                    sheet.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.parameter || '-'}</td>
                        <td style={{ textAlign: 'center' }}>{r.hasil || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', fontStyle: 'italic' }}>
                        Belum ada item pemeriksaan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <table className="sk-tbl" style={{ marginTop: '4mm' }}>
                <tbody>
                  <tr>
                    <td className="idx"><Label indo="Dokumen Acuan" eng="Reference Document" /></td>
                    <td className="col">:</td>
                    <td style={{ fontWeight: 600 }}>{letter.reference_document || '-'}</td>
                  </tr>
                </tbody>
              </table>

              <div className="sk-foot">
                <div className="codes">
                  <span>F/IKK 7.8.2</span>
                  <span>{editionRevision}</span>
                </div>
              </div>
            </div>
          </div>
        ))
      ) : (
      <div className="sk-page">
        <div className="sk-inner">
          <table style={{ width: '100%', fontSize: 11, marginBottom: '3mm' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%' }}>
                  <span style={{ fontWeight: 700 }}>No. Surat /</span>{' '}
                  <span className="italic">Reference Number</span>
                </td>
                <td>: {letter.no_letter || '-'}</td>
              </tr>
              <tr>
                <td>
                  <span style={{ fontWeight: 700 }}>No. Order /</span>{' '}
                  <span className="italic">Order Number</span>
                </td>
                <td>: {letter.no_order || '-'}</td>
              </tr>
              <tr>
                <td>
                  <span style={{ fontWeight: 700 }}>Halaman /</span>{' '}
                  <span className="italic">Page</span>
                </td>
                <td>: 2 dari {pages}</td>
              </tr>
            </tbody>
          </table>

          <table className="sk-tbl" style={{ marginTop: '3mm' }}>
            <tbody>
              <tr>
                <td className="idx"><Label indo="Nama Sensor" eng="Sensor Name" /></td>
                <td className="col">:</td>
                <td style={{ fontWeight: 600 }}>{sensor?.name || instrument?.name || '-'}</td>
              </tr>
              <tr>
                <td><Label indo="Merek Alat" eng="Manufacturer" /></td>
                <td>:</td>
                <td style={{ fontWeight: 600 }}>{sensor?.manufacturer || instrument?.manufacturer || '-'}</td>
              </tr>
              <tr>
                <td><Label indo="Tipe & No. Seri" eng="Type & Serial Number" /></td>
                <td>:</td>
                <td style={{ fontWeight: 600 }}>
                  {(sensor?.type || instrument?.type || '-')} / {(sensor?.serial_number || instrument?.serial_number || '-')}
                </td>
              </tr>
              <tr>
                <td><Label indo="Tanggal Pemeriksaan" eng="Test Date" /></td>
                <td>:</td>
                <td style={{ fontWeight: 600 }}>{fmtDate(letter.inspection_date)}</td>
              </tr>
              <tr>
                <td><Label indo="Tempat Pemeriksaan" eng="Test Location" /></td>
                <td>:</td>
                <td style={{ fontWeight: 600 }}>{letter.inspection_place || owner?.name || '-'}</td>
              </tr>
            </tbody>
          </table>

          {letter.notes ? (
            <div style={{ marginTop: '3mm' }}>
              <span style={{ fontWeight: 700 }}>Catatan /</span>{' '}
              <span className="italic">Notes</span> : {letter.notes}
            </div>
          ) : null}

          <div className="sk-sec" style={{ marginTop: '4mm', textAlign: 'center' }}>
            HASIL PEMERIKSAAN / <span className="italic" style={{ fontWeight: 400 }}>TEST RESULT</span>
          </div>
          <table className="sk-grid">
            <thead>
              <tr>
                <th style={{ width: '55%' }}>PARAMETER</th>
                <th>HASIL / RESULT</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.parameter || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{r.hasil || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', fontStyle: 'italic' }}>
                    Belum ada item pemeriksaan
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <table className="sk-tbl" style={{ marginTop: '4mm' }}>
            <tbody>
              <tr>
                <td className="idx"><Label indo="Dokumen Acuan" eng="Reference Document" /></td>
                <td className="col">:</td>
                <td style={{ fontWeight: 600 }}>{letter.reference_document || '-'}</td>
              </tr>
            </tbody>
          </table>

          <table className="sk-tbl" style={{ marginTop: '3mm' }}>
            <tbody>
              <tr>
                <td className="idx"><Label indo="Diperiksa Oleh" eng="Checked By" /></td>
                <td className="col">:</td>
                <td style={{ fontWeight: 600 }}>
                  {checkedBy.length
                    ? checkedBy.map((n, i) => <div key={i}>{i + 1}. {n}</div>)
                    : '-'}
                </td>
              </tr>
              <tr>
                <td><Label indo="Diverifikasi Oleh" eng="Verified By" /></td>
                <td>:</td>
                <td style={{ fontWeight: 600 }}>
                  {verifiedBy.length
                    ? verifiedBy.map((n, i) => <div key={i}>{i + 1}. {n}</div>)
                    : '-'}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="sk-note" style={{ marginTop: '6mm' }}>
            Akhir dari Dokumen. Dokumen ini telah ditandatangani secara elektronik
            menggunakan Sertifikat Elektronik yang diterbitkan oleh Balai Sertifikasi
            Elektronik (BSrE), Badan Siber dan Sandi Negara.
          </div>

          <div className="sk-foot">
            <div className="codes">
              <span>F/IKK 7.8.2</span>
              <span>{editionRevision}</span>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

export default SuratKeteranganDocument
