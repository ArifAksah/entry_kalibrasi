import {
    calculateAuditRow,
    calculateAuditStats,
    convertUnitExcelLegacy,
} from '../../lib/calculation-audit';

describe('calculation audit profiles', () => {
    it('reproduces the workbook wind-speed conversion constant', () => {
        expect(convertUnitExcelLegacy(2.84234, 'm/s', 'knot'))
            .toBeCloseTo(5.5250669546436155, 12);
    });

    it('matches the official system and workbook profiles for the same inputs', () => {
        const audit = calculateAuditRow({
            standardReading: 2.47,
            standardCorrection: 0.37234,
            uutReading: 6,
            unitStd: 'm/s',
            unitUut: 'knot',
        });

        expect(audit.standardCorrected).toBeCloseTo(2.84234, 12);
        expect(audit.systemCorrection).toBeCloseTo(5.5250669546436155 - 6, 12);
        expect(audit.legacyCorrection).toBeCloseTo(5.5250669546436155 - 6, 12);
        expect(audit.correctionDifference).toBeCloseTo(0, 12);
    });

    it('uses the Excel boundary convention for an exact positive 180 degree delta', () => {
        const audit = calculateAuditRow({
            standardReading: 180,
            standardCorrection: 0,
            uutReading: 0,
            unitStd: '°',
            unitUut: '°',
            isWindDirection: true,
        });

        expect(audit.systemCorrection).toBe(-180);
        expect(audit.legacyCorrection).toBe(-180);
    });

    it('calculates sample standard deviation like Excel STDEV.S', () => {
        const stats = calculateAuditStats([1, 2, 3]);
        expect(stats.count).toBe(3);
        expect(stats.mean).toBe(2);
        expect(stats.standardDeviation).toBe(1);
    });

    it('reports stale persisted standard corrections separately', () => {
        const audit = calculateAuditRow({
            standardReading: 10,
            standardCorrection: 0.2,
            storedStandardCorrection: 0.1,
            uutReading: 10,
        });
        expect(audit.storedCorrectionDifference).toBeCloseTo(0.1, 12);
    });
});
