import { parseMasterQcPayload } from '../../lib/master-qc-validation'

describe('Master QC payload validation', () => {
  it('normalizes a valid payload including numeric correction limits', () => {
    expect(
      parseMasterQcPayload({
        instrument_name_id: '10',
        unit_id: 2,
        nilai_batas_koreksi: 0,
        catatan: '  Catatan  ',
      }),
    ).toEqual({
      success: true,
      data: {
        instrumentNameId: 10,
        unitId: 2,
        correctionLimit: '0',
        notes: 'Catatan',
      },
    })
  })

  it('rejects malformed IDs and blank correction limits', () => {
    expect(parseMasterQcPayload({ instrument_name_id: 'x', unit_id: 2, nilai_batas_koreksi: '1' })).toMatchObject({ success: false })
    expect(parseMasterQcPayload({ instrument_name_id: 1, unit_id: 0, nilai_batas_koreksi: '1' })).toMatchObject({ success: false })
    expect(parseMasterQcPayload({ instrument_name_id: 1, unit_id: 2, nilai_batas_koreksi: '  ' })).toMatchObject({ success: false })
  })
})
