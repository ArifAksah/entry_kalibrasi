import { finalizeCertificateUncertainty, resolveCmc } from '../../lib/cmc-config';

describe('certificate uncertainty CMC workflow', () => {
  it('raises temperature U95 to the workbook CMC', () => {
    const result = finalizeCertificateUncertainty(0.17660664106561713, {
      sheetName: 'Termometer',
      calibrationMethod: 'MK 01 - Suhu',
      unitStd: '°C',
      unitUut: '°C',
    });
    expect(result.cmc?.cmcOutput).toBe(0.3);
    expect(result.finalU95).toBe(0.3);
  });

  it.each([
    ['Barometer', 'MK 02 - Tekanan Udara', 'hPa', 'inHg', 0.00847694807437403],
    ['Hygrometer', 'MK 03 - Kelembapan Udara Relatif', '%', '%', 1.6476984652908766],
    ['Wind Speed', 'MK 04 - Anemometer (Kecepatan Angin)', 'm/s', 'knot', 1.1718865424949996],
    ['Wind Direction', 'MK 05 - Anemometer (Arah Angin)', '°', '°', 3.5240001077491194],
  ])('keeps %s U95 when it is above CMC', (sheetName, calibrationMethod, unitStd, unitUut, rawU95) => {
    const result = finalizeCertificateUncertainty(rawU95 as number, {
      sheetName: sheetName as string,
      calibrationMethod: calibrationMethod as string,
      unitStd: unitStd as string,
      unitUut: unitUut as string,
    });
    expect(result.finalU95).toBeCloseTo(rawU95 as number, 12);
  });

  it('converts pressure and wind-speed CMC to the UUT unit', () => {
    expect(resolveCmc({ sheetName: 'Barometer', unitStd: 'hPa', unitUut: 'inHg' })?.cmcOutput)
      .toBeCloseTo(0.00076777955985757, 14);
    expect(resolveCmc({ sheetName: 'Wind Speed', unitStd: 'm/s', unitUut: 'knot' })?.cmcOutput)
      .toBeCloseTo(0.933045356371488, 12);
  });

  it('does not apply a CMC to an unknown parameter', () => {
    const result = finalizeCertificateUncertainty(0.25, {
      sheetName: 'Unknown Sensor',
      unitStd: 'foo',
      unitUut: 'foo',
    });
    expect(result.cmc).toBeNull();
    expect(result.finalU95).toBe(0.25);
  });

  it('resolves workbook rain-gauge profiles', () => {
    expect(resolveCmc({ sheetName: 'Penakar Hujan Analog', unitStd: 'mm', unitUut: 'mm' })?.cmcOutput).toBe(0.29);
    expect(resolveCmc({ sheetName: 'Tipping Bucket', unitStd: 'mm', unitUut: 'mm' })?.cmcOutput).toBe(0.19);
  });

  it('classifies Termometer HygroClip2 as temperature, not humidity', () => {
    const result = finalizeCertificateUncertainty(0.1766, {
      uutSensor: { name: 'Termometer', type: 'HygroClip2' },
      sheetName: 'Termometer',
      unitStd: '°C',
      unitUut: '°C',
    });
    expect(result.cmc?.cmcValueNative ?? result.cmc?.cmcNative).toBe(0.3);
    expect(result.finalU95).toBe(0.3);
  });
});
