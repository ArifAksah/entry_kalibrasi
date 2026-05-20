/**
 * Script to generate a sample Word (.docx) calibration certificate template.
 * 
 * Usage: npx tsx scripts/generate-sample-template.ts
 * 
 * Output: public/templates/contoh-template-sertifikat-v2.docx
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  PageBreak,
  AlignmentType,
  BorderStyle,
  WidthType,
  TableLayoutType,
  HeadingLevel,
} from 'docx'
import * as fs from 'fs'
import * as path from 'path'

// Helper: create a bordered table cell
function createCell(text: string, options?: { bold?: boolean; width?: number; shading?: string }): TableCell {
  return new TableCell({
    width: options?.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options?.shading ? { fill: options.shading } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: options?.bold ?? false,
            size: 20, // 10pt
            font: 'Arial',
          }),
        ],
        spacing: { before: 40, after: 40 },
      }),
    ],
  })
}

// Helper: create a table with label-value rows
function createDataTable(title: string, rows: [string, string][]): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 22, // 11pt
          font: 'Arial',
        }),
      ],
      spacing: { before: 240, after: 120 },
    }),
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(
        ([label, value]) =>
          new TableRow({
            children: [
              createCell(label, { bold: true, width: 35 }),
              createCell(value, { width: 65 }),
            ],
          })
      ),
    }),
  ]
  return elements
}

// Helper: horizontal line paragraph
function horizontalLine(): Paragraph {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    },
    spacing: { before: 120, after: 120 },
  })
}

// ============================================================
// PAGE 1: Cover Page
// ============================================================
const page1Children: (Paragraph | Table)[] = [
  // Header
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: 'BADAN METEOROLOGI, KLIMATOLOGI, DAN GEOFISIKA',
        bold: true,
        size: 28, // 14pt
        font: 'Arial',
      }),
    ],
    spacing: { after: 80 },
  }),
  // Sub-header
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: 'LABORATORIUM KALIBRASI',
        bold: true,
        size: 24, // 12pt
        font: 'Arial',
      }),
    ],
    spacing: { after: 120 },
  }),
  // Horizontal line
  horizontalLine(),
  // Title
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: 'SERTIFIKAT KALIBRASI',
        bold: true,
        size: 36, // 18pt
        font: 'Arial',
      }),
    ],
    spacing: { before: 240, after: 80 },
  }),
  // Subtitle
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: 'CALIBRATION CERTIFICATE',
        italics: true,
        size: 28, // 14pt
        font: 'Arial',
      }),
    ],
    spacing: { after: 200 },
  }),
  // Nomor sertifikat
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: 'Nomor: ${nomor_sertifikat}',
        size: 22,
        font: 'Arial',
      }),
    ],
    spacing: { after: 200 },
  }),
  // Blank line
  new Paragraph({ children: [], spacing: { after: 200 } }),
  // Data Alat table
  ...createDataTable('Data Alat', [
    ['Nama Alat', '${nama_alat}'],
    ['Merk/Tipe', '${merk} / ${tipe}'],
    ['No. Seri', '${no_seri}'],
    ['Kapasitas', '${kapasitas}'],
    ['Resolusi', '${resolusi}'],
  ]),
  // Data Pemilik table
  ...createDataTable('Data Pemilik', [
    ['Nama Stasiun', '${nama_stasiun}'],
    ['Alamat', '${alamat_stasiun}'],
  ]),
  // Data Kalibrasi table
  ...createDataTable('Data Kalibrasi', [
    ['Tanggal Kalibrasi', '${tanggal_kalibrasi}'],
    ['Metode', '${metode_kalibrasi}'],
    ['Suhu', '${suhu}'],
    ['Kelembaban', '${kelembaban}'],
    ['Tempat', '${tempat_kalibrasi}'],
  ]),
  // Page break
  new Paragraph({ children: [new PageBreak()] }),
]

// ============================================================
// PAGE 2: Results Page
// ============================================================
const page2Children: (Paragraph | Table)[] = [
  // Header
  new Paragraph({
    children: [
      new TextRun({
        text: 'HASIL KALIBRASI',
        bold: true,
        size: 28, // 14pt
        font: 'Arial',
      }),
    ],
    spacing: { before: 120, after: 240 },
  }),
  // Results table
  new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Header row
      new TableRow({
        children: [
          createCell('No', { bold: true, width: 8, shading: 'D9E2F3' }),
          createCell('Titik Ukur', { bold: true, width: 23, shading: 'D9E2F3' }),
          createCell('Pembacaan', { bold: true, width: 23, shading: 'D9E2F3' }),
          createCell('Koreksi', { bold: true, width: 23, shading: 'D9E2F3' }),
          createCell('Ketidakpastian', { bold: true, width: 23, shading: 'D9E2F3' }),
        ],
      }),
      // Loop start marker row
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 5,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: '${#each hasil_kalibrasi}',
                    size: 18,
                    font: 'Arial',
                    color: '808080',
                  }),
                ],
                spacing: { before: 20, after: 20 },
              }),
            ],
          }),
        ],
      }),
      // Template data row
      new TableRow({
        children: [
          createCell('${no_urut}', { width: 8 }),
          createCell('${titik_ukur}', { width: 23 }),
          createCell('${pembacaan}', { width: 23 }),
          createCell('${koreksi}', { width: 23 }),
          createCell('${ketidakpastian}', { width: 23 }),
        ],
      }),
      // Loop end marker row
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 5,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: '${/each}',
                    size: 18,
                    font: 'Arial',
                    color: '808080',
                  }),
                ],
                spacing: { before: 20, after: 20 },
              }),
            ],
          }),
        ],
      }),
    ],
  }),
  // Page break
  new Paragraph({ children: [new PageBreak()] }),
]

// ============================================================
// PAGE 3: End Page (Signature)
// ============================================================
const page3Children: (Paragraph | Table)[] = [
  // Tanggal terbit
  new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({
        text: 'Tanggal Terbit: ${tanggal_terbit}',
        size: 22,
        font: 'Arial',
      }),
    ],
    spacing: { before: 240, after: 400 },
  }),
  // Spacing
  new Paragraph({ children: [], spacing: { after: 400 } }),
  new Paragraph({ children: [], spacing: { after: 400 } }),
  // Signature block - right aligned
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({
        text: 'Kepala Laboratorium Kalibrasi',
        size: 22,
        font: 'Arial',
      }),
    ],
    spacing: { after: 120 },
  }),
  // Blank lines for signature space
  new Paragraph({ children: [], spacing: { after: 200 } }),
  new Paragraph({ children: [], spacing: { after: 200 } }),
  new Paragraph({ children: [], spacing: { after: 200 } }),
  // Name
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({
        text: '${nama_penandatangan}',
        bold: true,
        size: 22,
        font: 'Arial',
      }),
    ],
    spacing: { after: 40 },
  }),
  // NIP
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({
        text: 'NIP. ${nip_penandatangan}',
        size: 20,
        font: 'Arial',
      }),
    ],
    spacing: { after: 600 },
  }),
  // Footer: Teknisi
  new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({
        text: 'Teknisi: ${nama_teknisi} (NIP. ${nip_teknisi})',
        size: 18, // 9pt
        font: 'Arial',
        color: '555555',
      }),
    ],
    spacing: { before: 400 },
  }),
]

// ============================================================
// Build Document
// ============================================================
const doc = new Document({
  sections: [
    {
      children: [...page1Children, ...page2Children, ...page3Children],
    },
  ],
})

// ============================================================
// Write to file
// ============================================================
async function main() {
  const outputDir = path.resolve(__dirname, '..', 'public', 'templates')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, 'contoh-template-sertifikat.docx')
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)

  console.log(`✅ Template berhasil dibuat: ${outputPath}`)
  console.log(`   Ukuran: ${(buffer.length / 1024).toFixed(1)} KB`)
}

main().catch((err) => {
  console.error('❌ Gagal membuat template:', err)
  process.exit(1)
})
