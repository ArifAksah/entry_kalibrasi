'use client'

import React from 'react'
import Image from 'next/image'
import QRCode from 'react-qr-code'
import bmkgLogo from '../../app/bmkg.png'
import { QRCodeWithLogo } from '../ui/QRCodeWithLogo'
import { formatTanggalIndonesia } from '../../lib/format-date-id'

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

function hasHtmlMarkup(value?: string | null): boolean {
  return typeof value === 'string' && /<\/?[a-z][\s\S]*>/i.test(value)
}

/**
 * Hasil pemeriksaan bisa berupa rich text (HTML) — baris baru menyimpan HTML di
 * kolom `hasil` (parameter kosong). Bila ada, blok hasil dirender sebagai rich
 * text; bila tidak ada (data lama), tetap dirender sebagai tabel parameter/hasil.
 */
function richResultHtml(rows: SuratKeteranganRow[]): string | null {
  const parts = rows
    .map((r) => r.hasil || '')
    .filter((html) => hasHtmlMarkup(html))
  return parts.length ? parts.join('') : null
}

/**
 * QR kecil untuk footer halaman 2+ — SVG (react-qr-code) + logo BMKG di tengah.
 * Sengaja SVG (bukan canvas) agar pasti ikut ter-render di view, print, dan PDF.
 */
const SmallQR: React.FC<{ value: string; fgColor?: string }> = ({ value, fgColor = '#000000' }) => (
  <div style={{ width: '100%', height: '100%', position: 'relative', background: '#fff' }}>
    <QRCode
      value={value || ' '}
      size={44}
      bgColor="#FFFFFF"
      fgColor={fgColor}
      level="H"
      style={{ width: '100%', height: '100%' }}
    />
    <img
      src={bmkgLogo.src}
      alt=""
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '28%',
        height: '28%',
        transform: 'translate(-50%, -50%)',
        background: '#fff',
        padding: 1,
      }}
    />
  </div>
)

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
        .sk-inner { padding: 16mm 20mm 26mm 20mm; box-sizing: border-box; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 11pt; line-height: 1.25; }
        .sk-watermark {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-repeat: no-repeat; background-position: center; background-size: 620px 620px;
          opacity: 0.12;
        }
        .sk-content { position: relative; z-index: 1; min-height: 297mm; }
        .sk-header {
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 3px double #111; padding-bottom: 4mm; margin-bottom: 6mm;
        }
        .sk-logo-slot { width: 32mm; flex: 0 0 32mm; display: flex; justify-content: center; }
        .sk-logo-slot img { width: 32mm; height: auto; object-fit: contain; }
        .sk-agency { flex: 1; text-align: center; line-height: 1.25; }
        .sk-agency h1, .sk-agency h2 { font-size: 11.5pt; font-weight: 700; margin: 0; }
        .sk-title { text-align: center; font-weight: 700; font-size: 20pt; text-decoration: underline; margin: 4mm 0 1mm; }
        .sk-num { text-align: center; font-size: 11pt; font-weight: 700; margin-bottom: 6mm; }
        .sk-sec { font-weight: 700; text-decoration: underline; margin: 4mm 0 0.5mm; font-size: 11pt; }
        .sk-sec-en { font-style: italic; font-size: 9pt; margin-bottom: 1.5mm; }
        .sk-tbl { width: 100%; border-collapse: collapse; }
        .sk-tbl td { border: none; vertical-align: top; padding: 0.6mm 0; }
        .sk-tbl .idx { width: 30%; }
        .sk-tbl .col { width: 5%; }
        .sk-grid { width: 100%; border-collapse: collapse; font-size: 11pt; margin-top: 2mm; }
        .sk-grid th, .sk-grid td { border: 1px solid #111; padding: 1.5mm 2mm; vertical-align: top; text-align: left; }
        .sk-grid th { background: #f3f4f6; font-weight: 700; text-align: center; }
        .sk-rich { border: 1px solid #111; padding: 2mm; font-size: 11pt; line-height: 1.4; }
        .sk-rich p { margin: 0 0 1mm; }
        .sk-rich ul { list-style: disc; padding-left: 5mm; margin: 0 0 1mm; }
        .sk-rich ol { list-style: decimal; padding-left: 5mm; margin: 0 0 1mm; }
        .sk-rich a { color: #1d4ed8; text-decoration: underline; }
        .sk-rich table { width: 100%; border-collapse: collapse; }
        .sk-rich th, .sk-rich td { border: 1px solid #111; padding: 1.5mm 2mm; vertical-align: top; text-align: left; }
        .sk-rich th { background: #f3f4f6; font-weight: 700; text-align: center; }
        /* Bila konten rich text berupa tabel, buang bingkai pembungkus agar
           tidak menghasilkan garis dobel dengan border sel tabel. */
        .sk-rich:has(table) { border: none; padding: 0; }
        .sk-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-top: 8mm; }
        .sk-foot { position: absolute; bottom: 10mm; left: 20mm; right: 20mm; font-size: 9pt; color: #111; }
        /* Blok "Lampiran": menjorok ke kanan tapi teks tetap rata kiri
           (margin-left:auto menggeser seluruh blok, bukan text-align:right). */
        .sk-lampiran { width: fit-content; margin-left: auto; text-align: left; font-size: 11pt; font-weight: 700; line-height: 1.3; margin-bottom: 3mm; }
        .sk-foot .addr { text-align: center; }
        .sk-foot .codes { display: flex; justify-content: space-between; margin-top: 1mm; font-weight: 700; }
        .sk-foot .foot-qr { display: flex; align-items: center; justify-content: space-between; gap: 3mm; }
        .sk-qr-foot-col { display: flex; flex-direction: column; align-items: flex-start; gap: 0.8mm; }
        .sk-qr-foot-box { width: 12mm; height: 12mm; }
        .sk-qr-foot-col .form-code { font-size: 7.5pt; font-weight: 700; white-space: nowrap; }
        .sk-foot .foot-qr .note { flex: 1; text-align: center; font-size: 8.2pt; line-height: 1.18; font-weight: 700; padding: 0 3mm; }
        .sk-foot .foot-qr .edition { font-size: 9pt; font-weight: 700; white-space: nowrap; }
        .sk-note { font-size: 9pt; text-align: justify; }
        /* Penanda akhir dokumen: garis tebal + teks di bawahnya. */
        .sk-end { margin-top: 4mm; }
        .sk-end-line { border-top: 3px solid #000; width: 100%; }
        .sk-end-text { text-align: center; font-weight: 700; font-size: 11pt; margin-top: 1mm; }
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
          </header>

          <div className="sk-title">SURAT KETERANGAN</div>
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
              <div className="sk-lampiran">
                <div>Lampiran</div>
                <div>Surat Keterangan No. : {letter.no_letter || '-'}</div>
                <div>Tanggal : {formatTanggalIndonesia(letter.issue_date)}</div>
              </div>

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

              <div className="sk-sec" style={{ marginTop: '4mm', textAlign: 'center' }}>
                HASIL PEMERIKSAAN / <span className="italic" style={{ fontWeight: 400 }}>TEST RESULT</span>
              </div>
              {richResultHtml(sheet.rows) ? (
                <div
                  className="sk-rich"
                  dangerouslySetInnerHTML={{ __html: richResultHtml(sheet.rows) as string }}
                />
              ) : (
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
              )}

              {letter.notes ? (
                <div style={{ marginTop: '3mm' }}>
                  <span style={{ fontWeight: 700 }}>Catatan /</span>{' '}
                  <span className="italic">Notes</span> : {letter.notes}
                </div>
              ) : null}

              {sheetIndex === sheets.length - 1 && (
                <div className="sk-end">
                  <div className="sk-end-line" />
                  <div className="sk-end-text">Akhir dari Surat Keterangan</div>
                </div>
              )}

              <div className="sk-foot">
                <div className="foot-qr">
                  <div className="sk-qr-foot-col">
                    <div className="sk-qr-foot-box">
                      {verifyUrl ? (
                        <SmallQR value={verifyUrl} fgColor={signed ? '#000000' : '#b91c1c'} />
                      ) : null}
                    </div>
                    <div className="form-code">F/IKK 7.8.2</div>
                  </div>
                  <div className="note">
                    Dokumen ini telah ditandatangani secara elektronik menggunakan
                    sertifikat elektronik yang diterbitkan oleh Balai Sertifikasi
                    Elektronik (BSrE), Badan Siber dan Sandi Negara.
                  </div>
                  <div className="edition">{editionRevision}</div>
                </div>
              </div>
            </div>
          </div>
        ))
      ) : (
      <div className="sk-page">
        <div className="sk-inner">
          <div className="sk-lampiran">
            <div>Lampiran</div>
            <div>Surat Keterangan No. : {letter.no_letter || '-'}</div>
            <div>Tanggal : {formatTanggalIndonesia(letter.issue_date)}</div>
          </div>

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

          <div className="sk-sec" style={{ marginTop: '4mm', textAlign: 'center' }}>
            HASIL PEMERIKSAAN / <span className="italic" style={{ fontWeight: 400 }}>TEST RESULT</span>
          </div>
          {richResultHtml(rows) ? (
            <div
              className="sk-rich"
              dangerouslySetInnerHTML={{ __html: richResultHtml(rows) as string }}
            />
          ) : (
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
          )}

          {letter.notes ? (
            <div style={{ marginTop: '3mm' }}>
              <span style={{ fontWeight: 700 }}>Catatan /</span>{' '}
              <span className="italic">Notes</span> : {letter.notes}
            </div>
          ) : null}

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

          <div className="sk-end" style={{ marginTop: '6mm' }}>
            <div className="sk-end-line" />
            <div className="sk-end-text">Akhir dari Surat Keterangan</div>
          </div>

          <div className="sk-foot">
            <div className="foot-qr">
              <div className="sk-qr-foot-col">
                <div className="sk-qr-foot-box">
                  {verifyUrl ? (
                    <SmallQR value={verifyUrl} fgColor={signed ? '#000000' : '#b91c1c'} />
                  ) : null}
                </div>
                <div className="form-code">F/IKK 7.8.2</div>
              </div>
              <div className="note">
                Dokumen ini telah ditandatangani secara elektronik menggunakan
                sertifikat elektronik yang diterbitkan oleh Balai Sertifikasi
                Elektronik (BSrE), Badan Siber dan Sandi Negara.
              </div>
              <div className="edition">{editionRevision}</div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

export default SuratKeteranganDocument
