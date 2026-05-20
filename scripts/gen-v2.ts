import { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType, BorderStyle } from 'docx'
import * as fs from 'fs'
import * as path from 'path'

const doc = new Document({
  sections: [{
    children: [
      // PAGE 1: COVER
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BADAN METEOROLOGI, KLIMATOLOGI, DAN GEOFISIKA', bold: true, size: 28, font: 'Arial' })], spacing: { after: 80 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'LABORATORIUM KALIBRASI', bold: true, size: 24, font: 'Arial' })], spacing: { after: 120 } }),
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } }, spacing: { after: 200 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SERTIFIKAT KALIBRASI', bold: true, size: 36, font: 'Arial' })], spacing: { before: 200, after: 80 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CALIBRATION CERTIFICATE', italics: true, size: 28, font: 'Arial' })], spacing: { after: 160 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nomor: ${nomor_sertifikat}', size: 22, font: 'Arial' })], spacing: { after: 240 } }),
      new Paragraph({ children: [new TextRun({ text: 'Nama Alat       : ${nama_alat}', size: 22, font: 'Arial' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: 'Merk/Tipe       : ${merk} / ${tipe}', size: 22, font: 'Arial' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: 'No. Seri        : ${no_seri}', size: 22, font: 'Arial' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: 'Kapasitas       : ${kapasitas}', size: 22, font: 'Arial' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: 'Resolusi        : ${resolusi}', size: 22, font: 'Arial' })], spacing: { after: 160 } }),
      new Paragraph({ children: [new TextRun({ text: 'Nama Stasiun    : ${nama_stasiun}', size: 22, font: 'Arial' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: 'Alamat          : ${alamat_stasiun}', size: 22, font: 'Arial' })], spacing: { after: 160 } }),
      new Paragraph({ children: [new TextRun({ text: 'Tanggal Kalibrasi : ${tanggal_kalibrasi}', size: 22, font: 'Arial' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: 'Metode            : ${metode_kalibrasi}', size: 22, font: 'Arial' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: 'Suhu              : ${suhu}', size: 22, font: 'Arial' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: 'Kelembaban        : ${kelembaban}', size: 22, font: 'Arial' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: 'Tempat            : ${tempat_kalibrasi}', size: 22, font: 'Arial' })], spacing: { after: 60 } }),
      // PAGE BREAK
      new Paragraph({ children: [new PageBreak()] }),
      // PAGE 2: RESULTS
      new Paragraph({ children: [new TextRun({ text: 'HASIL KALIBRASI', bold: true, size: 28, font: 'Arial' })], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: '${#each hasil_kalibrasi}', size: 18, font: 'Arial', color: '808080' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: '${no_urut}. Titik Ukur: ${titik_ukur} | Pembacaan: ${pembacaan} | Koreksi: ${koreksi} | Ketidakpastian: ${ketidakpastian}', size: 20, font: 'Arial' })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: '${/each}', size: 18, font: 'Arial', color: '808080' })], spacing: { after: 200 } }),
      // PAGE BREAK
      new Paragraph({ children: [new PageBreak()] }),
      // PAGE 3: SIGNATURE
      new Paragraph({ children: [new TextRun({ text: 'Tanggal Terbit: ${tanggal_terbit}', size: 22, font: 'Arial' })], spacing: { after: 600 } }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Kepala Laboratorium Kalibrasi', size: 22, font: 'Arial' })], spacing: { after: 600 } }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '${nama_penandatangan}', bold: true, size: 22, font: 'Arial' })], spacing: { after: 40 } }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'NIP. ${nip_penandatangan}', size: 20, font: 'Arial' })], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Teknisi: ${nama_teknisi} (NIP. ${nip_teknisi})', size: 18, font: 'Arial', color: '555555' })] }),
    ]
  }]
})

async function main() {
  const dir = path.resolve(__dirname, '..', 'public', 'templates')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const buf = await Packer.toBuffer(doc)
  const outPath = path.join(dir, 'contoh-template-v2.docx')
  fs.writeFileSync(outPath, buf)
  console.log(`Done: ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`)
}

main().catch(e => { console.error(e); process.exit(1) })
