import {
    calculateUncertaintyBudget,
    normalizeStdUncertaintyComponents,
} from '../../lib/uncertainty-utils';

describe('uncertainty component unit normalization', () => {
    it('converts all Wind Speed STD components from m/s to knot', () => {
        const normalized = normalizeStdUncertaintyComponents({
            interpolatedCertU95: 0.48,
            driftStd: 0.3865,
            resolusiStd: 0.1,
            unitStd: 'm/s',
            unitUut: 'knot',
        });

        expect(normalized.converted).toBe(true);
        expect(normalized.interpolatedCertU95).toBeCloseTo(0.933045356371488, 12);
        expect(normalized.driftStd).toBeCloseTo(0.7512958963282919, 12);
        expect(normalized.resolusiStd).toBeCloseTo(0.1, 12);

        const result = calculateUncertaintyBudget({
            unit: 'knot',
            uutReadings: [0, 0],
            interpolatedCertU95: normalized.interpolatedCertU95,
            driftStd: normalized.driftStd,
            resolusiStd: normalized.resolusiStd,
            resolusiUut: 1,
        });

        expect(result.components.find(component => component.name === 'Sertifikat Std')?.u_a)
            .toBeCloseTo(0.933045356371488, 12);
        expect(result.components.find(component => component.name === 'Drift Std')?.u_a)
            .toBeCloseTo(0.37564794816414593, 12);
        expect(result.components.find(component => component.name === 'Resolusi Std')?.u_a)
            .toBeCloseTo(0.05, 12);
        expect(result.components.every(component => component.unit === 'knot')).toBe(true);
    });

    it('converts pressure U95 to the UUT unit', () => {
        const normalized = normalizeStdUncertaintyComponents({
            interpolatedCertU95: 0.027918955,
            driftStd: 0,
            resolusiStd: 0,
            unitStd: 'hPa',
            unitUut: 'inHg',
        });
        expect(normalized.interpolatedCertU95).toBeCloseTo(0.0008244462685224347, 12);
    });

    it('does not claim an unsupported conversion succeeded', () => {
        const normalized = normalizeStdUncertaintyComponents({
            interpolatedCertU95: 1,
            driftStd: 1,
            resolusiStd: 1,
            unitStd: 'foo',
            unitUut: 'bar',
        });
        expect(normalized.needsUnitConversion).toBe(true);
        expect(normalized.converted).toBe(false);
    });
});
