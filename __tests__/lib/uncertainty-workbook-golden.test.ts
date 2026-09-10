import { calculateUncertaintyBudget } from '../../lib/uncertainty-utils';

function readingsWithSampleDeviation(count: number, standardDeviation: number): number[] {
    const magnitude = standardDeviation * Math.sqrt((count - 1) / 2);
    return [magnitude, -magnitude, ...Array(count - 2).fill(0)];
}

describe('uncertainty workbook golden results', () => {
    test.each([
        {
            name: 'Pressure', count: 1419, repeat: 0.002988063676921588,
            cert: 0.0008346237435652966, drift: 0.004214917159538484,
            resStd: 0.01, resUut: 0.01, expected: 0.00847694807437403,
        },
        {
            name: 'Temperature', count: 1419, repeat: 0.15278364724606455,
            cert: 0.1650825890559348, drift: 0.107834729,
            resStd: 0.01, resUut: 0.01, expected: 0.17660664106561713,
        },
        {
            name: 'Relative Humidity', count: 1419, repeat: 1.1060411790269542,
            cert: 1.1, drift: 2.150435294,
            resStd: 0.01, resUut: 0.1, expected: 1.6476984652908766,
        },
        {
            name: 'Wind Speed', count: 991, repeat: 0.8242124691235367,
            cert: 0.933045356371488, drift: 0.7512958963282919,
            resStd: 0.1, resUut: 1, expected: 1.1718865424949996,
        },
        {
            name: 'Wind Direction', count: 991, repeat: 52.3138662725273,
            cert: 1.01324561, drift: 0.7,
            resStd: 1, resUut: 1, expected: 3.5240001077491194,
        },
    ])('matches $name Hit sheet U95', ({ count, repeat, cert, drift, resStd, resUut, expected }) => {
        const result = calculateUncertaintyBudget({
            unit: '',
            uutReadings: readingsWithSampleDeviation(count, repeat),
            interpolatedCertU95: cert,
            driftStd: drift,
            resolusiStd: resStd,
            resolusiUut: resUut,
        });

        expect(result.components[0].u_a).toBeCloseTo(repeat, 10);
        expect(result.expanded_uncert_u95).toBeCloseTo(expected, 8);
    });
});
