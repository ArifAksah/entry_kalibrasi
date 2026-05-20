import {
  replaceWordVariables,
  combineWordPages,
  getSupportedTags,
  detectTags,
} from '@/lib/rich-text-editor/word-template-processor'
import type { CertificateData, PageSettings } from '@/lib/rich-text-editor/types'
import { DEFAULT_PAGE_SETTINGS } from '@/lib/rich-text-editor/types'

const mockData: CertificateData = {
  instrument: {
    nama_alat: 'Timbangan Digital',
    merk: 'Mettler Toledo',
    tipe: 'ML3002',
    no_seri: 'SN-12345',
    kapasitas: '3200 g',
    resolusi: '0.01 g',
  },
  calibration: {
    nomor_sertifikat: 'CERT-2024-001',
    tanggal_kalibrasi: '15 Januari 2024',
    tanggal_terbit: '20 Januari 2024',
    metode_kalibrasi: 'OIML R76',
    suhu: '23 °C',
    kelembaban: '55 %RH',
    tempat_kalibrasi: 'Lab Kalibrasi Pusat',
  },
  station: {
    nama_stasiun: 'Stasiun Klimatologi Bogor',
    alamat_stasiun: 'Jl. Raya Bogor No. 1',
  },
  personnel: {
    nama_penandatangan: 'Dr. Budi Santoso',
    nip_penandatangan: '198501012010011001',
    jabatan_penandatangan: 'Kepala Laboratorium',
    nama_teknisi: 'Ahmad Teknisi',
    nip_teknisi: '199001012015011001',
  },
  results: [
    { no_urut: 1, titik_ukur: '100 g', pembacaan: '100.01 g', koreksi: '-0.01 g', ketidakpastian: '0.02 g' },
    { no_urut: 2, titik_ukur: '500 g', pembacaan: '500.02 g', koreksi: '-0.02 g', ketidakpastian: '0.03 g' },
    { no_urut: 3, titik_ukur: '1000 g', pembacaan: '1000.05 g', koreksi: '-0.05 g', ketidakpastian: '0.05 g' },
  ],
}

describe('Word Template Processor', () => {
  describe('replaceWordVariables', () => {
    it('should replace simple ${variable} tags with data values', () => {
      const html = '<p>Alat: ${nama_alat}, Merk: ${merk}</p>'
      const result = replaceWordVariables(html, mockData)
      expect(result).toBe('<p>Alat: Timbangan Digital, Merk: Mettler Toledo</p>')
    })

    it('should replace calibration variables', () => {
      const html = '<p>No. Sertifikat: ${nomor_sertifikat}</p>'
      const result = replaceWordVariables(html, mockData)
      expect(result).toBe('<p>No. Sertifikat: CERT-2024-001</p>')
    })

    it('should replace station variables', () => {
      const html = '<p>${nama_stasiun} - ${alamat_stasiun}</p>'
      const result = replaceWordVariables(html, mockData)
      expect(result).toBe('<p>Stasiun Klimatologi Bogor - Jl. Raya Bogor No. 1</p>')
    })

    it('should replace personnel variables', () => {
      const html = '<p>${nama_penandatangan} (${nip_penandatangan})</p>'
      const result = replaceWordVariables(html, mockData)
      expect(result).toBe('<p>Dr. Budi Santoso (198501012010011001)</p>')
    })

    it('should replace unknown variables with empty string', () => {
      const html = '<p>Unknown: ${unknown_var}</p>'
      const result = replaceWordVariables(html, mockData)
      expect(result).toBe('<p>Unknown: </p>')
    })

    it('should expand ${#each hasil_kalibrasi}...${/each} loops', () => {
      const html = '<table>${#each hasil_kalibrasi}<tr><td>${no_urut}</td><td>${titik_ukur}</td></tr>${/each}</table>'
      const result = replaceWordVariables(html, mockData)
      expect(result).toContain('<td>1</td><td>100 g</td>')
      expect(result).toContain('<td>2</td><td>500 g</td>')
      expect(result).toContain('<td>3</td><td>1000 g</td>')
    })

    it('should handle empty results array in loop', () => {
      const emptyData = { ...mockData, results: [] }
      const html = '<table>${#each hasil_kalibrasi}<tr><td>${no_urut}</td></tr>${/each}</table>'
      const result = replaceWordVariables(html, emptyData)
      expect(result).toBe('<table></table>')
    })

    it('should not confuse ${} syntax with {{}} syntax', () => {
      const html = '<p>{{nama_alat}} vs ${nama_alat}</p>'
      const result = replaceWordVariables(html, mockData)
      // {{}} should remain untouched, ${} should be replaced
      expect(result).toBe('<p>{{nama_alat}} vs Timbangan Digital</p>')
    })
  })

  describe('combineWordPages', () => {
    it('should combine all 3 pages with page breaks', () => {
      const cover = '<h1>Cover: ${nama_alat}</h1>'
      const results = '<table><tr><td>Results</td></tr></table>'
      const end = '<p>Signed by: ${nama_penandatangan}</p>'

      const result = combineWordPages(cover, results, end, mockData, DEFAULT_PAGE_SETTINGS)

      expect(result).toContain('<!DOCTYPE html>')
      expect(result).toContain('Cover: Timbangan Digital')
      expect(result).toContain('Results')
      expect(result).toContain('Signed by: Dr. Budi Santoso')
      expect(result).toContain('page-break-after: always')
    })

    it('should handle missing end page', () => {
      const cover = '<h1>Cover</h1>'
      const results = '<p>Results</p>'

      const result = combineWordPages(cover, results, '', mockData, DEFAULT_PAGE_SETTINGS)

      expect(result).toContain('Cover')
      expect(result).toContain('Results')
      // Should have page break between cover and results
      expect(result).toContain('page-break-after: always')
    })

    it('should include correct page size in CSS', () => {
      const result = combineWordPages('<p>test</p>', '', '', mockData, DEFAULT_PAGE_SETTINGS)
      expect(result).toContain('size: 210mm 297mm')
    })

    it('should handle landscape orientation', () => {
      const landscapeSettings: PageSettings = {
        ...DEFAULT_PAGE_SETTINGS,
        orientation: 'landscape',
      }
      const result = combineWordPages('<p>test</p>', '', '', mockData, landscapeSettings)
      expect(result).toContain('size: 297mm 210mm')
    })
  })

  describe('getSupportedTags', () => {
    it('should return all variable tags plus loop syntax', () => {
      const tags = getSupportedTags()
      expect(tags.length).toBeGreaterThan(20)

      // Check some specific tags exist
      const tagNames = tags.map((t) => t.tag)
      expect(tagNames).toContain('${nama_alat}')
      expect(tagNames).toContain('${nomor_sertifikat}')
      expect(tagNames).toContain('${#each hasil_kalibrasi}')
      expect(tagNames).toContain('${/each}')
    })

    it('should include category for each tag', () => {
      const tags = getSupportedTags()
      for (const tag of tags) {
        expect(tag.category).toBeTruthy()
      }
    })
  })

  describe('detectTags', () => {
    it('should detect all ${...} patterns in HTML', () => {
      const html = '<p>${nama_alat} and ${merk}</p><p>${nomor_sertifikat}</p>'
      const tags = detectTags(html)
      expect(tags).toContain('${nama_alat}')
      expect(tags).toContain('${merk}')
      expect(tags).toContain('${nomor_sertifikat}')
    })

    it('should not include duplicates', () => {
      const html = '<p>${nama_alat} ${nama_alat}</p>'
      const tags = detectTags(html)
      expect(tags.filter((t) => t === '${nama_alat}').length).toBe(1)
    })

    it('should detect loop syntax', () => {
      const html = '${#each hasil_kalibrasi}${no_urut}${/each}'
      const tags = detectTags(html)
      expect(tags).toContain('${#each hasil_kalibrasi}')
      expect(tags).toContain('${no_urut}')
      expect(tags).toContain('${/each}')
    })
  })
})
