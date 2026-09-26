import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(
  join(__dirname, '../../database/create_calibration_function.sql'),
  'utf8',
)

describe('calibration SQL trigger unit awareness', () => {
  it('defines unit conversion helpers with workbook constants', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.convert_unit_absolute')
    expect(sql).toContain('0.029529983071445')
    expect(sql).toContain('1.9438444924406')
    expect(sql).toContain('0.750062')
  })

  it('supports locked standard_certificate_id in hitung_koreksi', () => {
    expect(sql).toContain('p_certificate_id BIGINT DEFAULT NULL')
    expect(sql).toContain('NEW.standard_certificate_id')
  })

  it('converts corrected standard to the UUT unit before subtracting UUT', () => {
    expect(sql).toContain('public.convert_unit_absolute(')
    expect(sql).toContain('v_std_corrected_uut - NEW.uut_data')
    // Trigger lama yang salah secara dimensi tidak boleh dipakai lagi.
    expect(sql).not.toContain('v_delta := NEW.std_corrected - NEW.uut_data')
  })

  it('keeps the wind-direction wrap formula', () => {
    expect(sql).toContain('MOD(MOD(v_delta + 180, 360) + 360, 360) - 180')
  })
})
