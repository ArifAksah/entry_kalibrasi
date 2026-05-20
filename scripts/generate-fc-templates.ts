/**
 * Generate 2 sample Word templates for FC (Field Calibration) certificates:
 * 1. Cover page template (halaman 1)
 * 2. Results per sensor template (halaman 2+, looped per sensor)
 *
 * Usage: npx tsx scripts/generate-fc-templates.ts
 * Output: public/templates/fc-cover-template.docx
 *         public/templates/fc-results-template.docx
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, TableLayoutType, VerticalAlign,
} from 'docx'
import * as fs from 'fs'
import * as path from 'path'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cell(text: string, opts?: { bold?: boolean; width?: number; italic?: boolean; size?: number; color?: string; alignment?: typeof AlignmentType[keyof typeof AlignmentType] }): TableCell {
  return new TableCell({
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: opts?.alignment,
        children: [
          new TextRun({
            text,
            bold: opts?.bold ?? false,
            italics: opts?.italic ?? false,
            size: opts?.size ?? 20,
            font: 'Arial',
            color: opts?.color,
          }),
        ],
        spacing: { before: 40, after: 40 },
      }),
    ],
  })
}

function labelValueRow(label: string, labelEn: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Arial' })], spacing: { before: 30, after: 0 } }),
          new Paragraph({ children: [new TextRun({ text: labelEn, italic: true, size: 18, font: 'Arial', color: '555555' })], spacing: { before: 0, after: 30 } }),
        ],
      }),
      cell(':', { width: 3 }),
      cell(value, { width: 62 }),
    ],
  })
}

function sectionTitle(id: string, en: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: id, bold: true, size: 22, font: 'Arial' }),
      new TextRun({ text: '\n' + en, italic: true, size: 18, font: 'Arial', color: '555555' }),
    ],
    spacing: { before: 300, after: 120 },
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 1: COVER PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const coverDoc = new Document({
  sections: [{
    properties: {
      page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } },
    },
    children: [
      // ─── HEADER (in body) ────────────────────────────────────────────
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '[LOGO BMKG]', size: 20, font: 'Arial', color: '999999' })], spacing: { after: 80 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA', bold: true, size: 24, font: 'Arial' })], spacing: { after: 40 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'LABORATORIUM KALIBRASI BMKG', bold: true, size: 22, font: 'Arial' })], spacing: { after: 120 } }),
      new Paragraph({ border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: '000000' } }, spacing: { after: 200 } }),

      // ─── TITLE ───────────────────────────────────────────────────────
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SERTIFIKAT KALIBRASI', bold: true, size: 32, font: 'Arial' })], spacing: { before: 200, after: 40 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CALIBRATION CERTIFICATE', italic: true, size: 22, font: 'Arial' })], spacing: { after: 80 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '${nomor_sertifikat}', size: 22, font: 'Arial' })], spacing: { after: 200 } }),

      // ─── IDENTITAS ALAT ──────────────────────────────────────────────
      sectionTitle('IDENTITAS ALAT', 'Instrument Details'),
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [
          labelValueRow('Nama Alat', 'Instrument Name', '${nama_alat}'),
          labelValueRow('Merek Pabrik', 'Manufacturer', '${merk}'),
          labelValueRow('Tipe / Nomor Seri', 'Type / Serial Number', '${tipe} / ${no_seri}'),
          labelValueRow('Lain-lain', 'Others', '${lain_lain}'),
        ],
      }),

      // ─── IDENTITAS PEMILIK ───────────────────────────────────────────
      sectionTitle('IDENTITAS PEMILIK', "Owner's Identification"),
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [
          labelValueRow('Nama', 'Designation', '${nama_pemilik}'),
          labelValueRow('Alamat', 'Address', '${alamat_stasiun}'),
        ],
      }),

      // ─── PENGESAHAN ──────────────────────────────────────────────────
      sectionTitle('PENGESAHAN', 'Authorization'),
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [
          labelValueRow('Pejabat Pengesahan', 'Authorizing officer', '${jabatan_penandatangan}'),
          labelValueRow('Nama', 'Name', '${nama_penandatangan}'),
          labelValueRow('Tanggal Pengesahan', 'Date of issue', '${tanggal_terbit}'),
          labelValueRow('Jumlah halaman', 'Total number of pages', '${jumlah_halaman}'),
        ],
      }),

      // ─── FOOTER (in body) ────────────────────────────────────────────
      new Paragraph({ children: [], spacing: { before: 400 } }),
      new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: '000000' } }, spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: '[QR CODE]  Dokumen ini telah ditandatangani secara elektronik menggunakan Sertifikat Elektronik yang diterbitkan oleh Balai Besar Sertifikasi Elektronik (BSrE), BSSN dan tidak memerlukan tanda tangan atau cap.', size: 16, font: 'Arial' })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: 'This document is digitally signed. No signature or seal is required.', italic: true, size: 14, font: 'Arial', color: '555555' })], spacing: { after: 120 } }),
      new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000' } }, spacing: { after: 40 } }),
      new Paragraph({
        children: [
          new TextRun({ text: 'F/IKK 7.8.1', size: 16, font: 'Arial' }),
          new TextRun({ text: '          JL. Angkasa I No. 02 Kemayoran Jakarta Pusat', size: 16, font: 'Arial' }),
          new TextRun({ text: '          Edisi/Revisi : ${edisi_revisi}', size: 16, font: 'Arial' }),
        ],
      }),
    ],
  }],
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 2: RESULTS PER SENSOR (halaman 2+)
// ═══════════════════════════════════════════════════════════════════════════════

const resultsDoc = new Document({
  sections: [{
    properties: {
      page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } },
    },
    children: [
      // ─── HEADER (in body) — Logo + info table ────────────────────────
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: '[LOGO BMKG]', size: 18, font: 'Arial', color: '999999' })] })],
              }),
              new TableCell({
                width: { size: 80, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'No. Sertifikat / Certificate Number : ${nomor_sertifikat}', size: 18, font: 'Arial' })], spacing: { after: 30 } }),
                  new Paragraph({ children: [new TextRun({ text: 'No. Order / Order Number : ${no_order}', size: 18, font: 'Arial' })], spacing: { after: 30 } }),
                  new Paragraph({ children: [new TextRun({ text: 'Halaman / Page : ${halaman} dari ${jumlah_halaman}', size: 18, font: 'Arial' })] }),
                ],
              }),
            ],
          }),
        ],
      }),

      new Paragraph({ children: [], spacing: { after: 120 } }),

      // ─── SENSOR INFO ─────────────────────────────────────────────────
      // Note: This entire section is looped per sensor
      new Paragraph({ children: [new TextRun({ text: '${#each sensors}', size: 16, font: 'Arial', color: '808080' })], spacing: { after: 80 } }),

      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [
          labelValueRow('Nama Sensor', 'Sensor Name', '${sensor_nama}'),
          labelValueRow('Merek Sensor', 'Manufacturer', '${sensor_merk}'),
          labelValueRow('Tipe & No. Seri', 'Type & Serial Number', '${sensor_tipe} / ${sensor_no_seri}'),
          labelValueRow('Tanggal Masuk', 'Date of Entry', '${tanggal_masuk}'),
          labelValueRow('Tanggal Kalibrasi', 'Calibration Date', '${tanggal_kalibrasi}'),
          labelValueRow('Tempat Kalibrasi', 'Calibration Place', '${tempat_kalibrasi}'),
        ],
      }),

      // ─── KONDISI LINGKUNGAN ──────────────────────────────────────────
      new Paragraph({ children: [new TextRun({ text: 'Kondisi Lingkungan / Environment condition', bold: true, size: 20, font: 'Arial' })], spacing: { before: 200, after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: 'Suhu / Temperature : ${suhu}', size: 20, font: 'Arial' })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: 'Kelembaban / Relative Humidity : ${kelembaban}', size: 20, font: 'Arial' })], spacing: { after: 160 } }),

      // ─── HASIL KALIBRASI ─────────────────────────────────────────────
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Hasil Kalibrasi / Calibration Result', bold: true, size: 20, font: 'Arial' })], spacing: { after: 120 } }),

      // Results table with unit in header
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          // Header row with unit
          new TableRow({
            children: [
              cell('Penunjukan Alat / Instrument Reading (${unit})', { bold: true, width: 40 }),
              cell('Koreksi / Correction (${unit})', { bold: true, width: 30 }),
              cell('Ketidakpastian / Uncertainty (${unit})', { bold: true, width: 30 }),
            ],
          }),
          // Loop start for result rows
          new TableRow({
            children: [
              cell('${#each hasil_kalibrasi}', { width: 100, color: '808080', size: 16 }),
            ],
          }),
          // Data row (repeated per result)
          new TableRow({
            children: [
              cell('${titik_ukur}', { width: 40 }),
              cell('${koreksi}', { width: 30 }),
              cell('${ketidakpastian}', { width: 30 }),
            ],
          }),
          // Loop end
          new TableRow({
            children: [
              cell('${/each}', { width: 100, color: '808080', size: 16 }),
            ],
          }),
        ],
      }),

      // Catatan hasil (komentar)
      new Paragraph({ children: [new TextRun({ text: '${catatan}', italic: true, size: 18, font: 'Arial', color: '555555' })], spacing: { before: 80, after: 120 } }),

      // ─── CATATAN ─────────────────────────────────────────────────────
      new Paragraph({ children: [new TextRun({ text: 'Catatan / Notes :', bold: true, size: 20, font: 'Arial' })], spacing: { before: 200, after: 80 } }),
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [
          labelValueRow('Standar Kalibrasi', 'Calibration Standard', '${standar_kalibrasi}'),
          labelValueRow('Tertelusur Ke SI melalui', 'Traceable to SI through', '${ketertelusuran}'),
          labelValueRow('Metode Kalibrasi', 'Calibration Methode', '${metode_kalibrasi}'),
          labelValueRow('Dokumen Acuan', 'Reference Document', '${dokumen_acuan}'),
        ],
      }),

      // ─── DISCLAIMER ──────────────────────────────────────────────────
      new Paragraph({ children: [new TextRun({ text: 'Penunjukan nilai sebenarnya didapat dari penunjukan alat ditambah koreksi.', size: 18, font: 'Arial' })], spacing: { before: 160, after: 20 } }),
      new Paragraph({ children: [new TextRun({ text: 'The true value is determined from the instrument reading added by its correction.', italic: true, size: 16, font: 'Arial', color: '555555' })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: 'Sertifikat ini hanya berlaku untuk peralatan dengan identitas yang dinyatakan di atas.', size: 18, font: 'Arial' })], spacing: { after: 20 } }),
      new Paragraph({ children: [new TextRun({ text: 'This certificate only applies to equipment with the identity stated above.', italic: true, size: 16, font: 'Arial', color: '555555' })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: 'Ketidakpastian pengukuran dinyatakan pada tingkat kepercayaan tidak kurang dari 95 % dengan faktor cakupan k = 2', size: 18, font: 'Arial' })], spacing: { after: 20 } }),
      new Paragraph({ children: [new TextRun({ text: 'Uncertainty of measurement is expressed at a confidence level of no less than 95 % with coverage factor k = 2', italic: true, size: 16, font: 'Arial', color: '555555' })], spacing: { after: 120 } }),

      new Paragraph({ children: [new TextRun({ text: 'Diverifikasi Oleh / Verified by : ${nama_verifikator}', bold: true, size: 20, font: 'Arial' })], spacing: { before: 120, after: 80 } }),

      // End of sensor loop
      new Paragraph({ children: [new TextRun({ text: '${/each}', size: 16, font: 'Arial', color: '808080' })], spacing: { after: 120 } }),

      // ─── FOOTER (in body) ────────────────────────────────────────────
      new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000' } }, spacing: { before: 200, after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: '[QR CODE]  Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh Balai Sertifikasi Elektronik (BSrE), Badan Siber dan Sandi Negara (BSSN)', size: 14, font: 'Arial' })], spacing: { after: 40 } }),
      new Paragraph({
        children: [
          new TextRun({ text: 'F/IKK 7.8.2', size: 16, font: 'Arial' }),
          new TextRun({ text: '                                                                          Edisi/Revisi : ${edisi_revisi}', size: 16, font: 'Arial' }),
        ],
      }),
    ],
  }],
})

// ═══════════════════════════════════════════════════════════════════════════════
// Write files
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const dir = path.resolve(__dirname, '..', 'public', 'templates')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const coverBuf = await Packer.toBuffer(coverDoc)
  const coverPath = path.join(dir, 'fc-cover-template.docx')
  fs.writeFileSync(coverPath, coverBuf)
  console.log(`✅ Cover template: ${coverPath} (${(coverBuf.length / 1024).toFixed(1)} KB)`)

  const resultsBuf = await Packer.toBuffer(resultsDoc)
  const resultsPath = path.join(dir, 'fc-results-template.docx')
  fs.writeFileSync(resultsPath, resultsBuf)
  console.log(`✅ Results template: ${resultsPath} (${(resultsBuf.length / 1024).toFixed(1)} KB)`)
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1) })
