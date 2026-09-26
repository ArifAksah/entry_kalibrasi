import {
  interpolateCorrectionFromPoints,
  parseCertCorrectionPoints,
} from '../../lib/qc-utils'
import { interpolateU95FromPoints } from '../../lib/uncertainty-utils'

describe('standard certificate correction points', () => {
  it('parses comma decimals and uses u95_general when per-point U95 is empty', () => {
    expect(
      parseCertCorrectionPoints({
        setpoint: ['10,5', '20,5'],
        correction_std: ['0,1', '0,2'],
        u95_std: ['', null],
        u95_general: '0,3',
      }),
    ).toEqual([
      { setpoint: 10.5, correction: 0.1, u95: 0.3 },
      { setpoint: 20.5, correction: 0.2, u95: 0.3 },
    ])
  })

  it('drops invalid points instead of converting them to zero', () => {
    expect(
      parseCertCorrectionPoints({
        setpoint: ['10', 'invalid', '30'],
        correction_std: ['0.1', '0.2', 'invalid'],
        u95_std: ['1', '1', '1'],
      }),
    ).toEqual([{ setpoint: 10, correction: 0.1, u95: 1 }])
  })

  it('rejects arrays with different lengths and duplicate setpoints', () => {
    expect(
      parseCertCorrectionPoints({
        setpoint: [10, 20],
        correction_std: [0.1],
      }),
    ).toEqual([])
    expect(
      parseCertCorrectionPoints({
        setpoint: [10, 10],
        correction_std: [0.1, 0.2],
      }),
    ).toEqual([])
  })

  it('guards duplicate x-values in correction and U95 interpolation', () => {
    const points = [
      { setpoint: 10, correction: 0.1, u95: 1 },
      { setpoint: 10, correction: 0.2, u95: 2 },
    ]
    expect(interpolateCorrectionFromPoints(points, 10)).toBe(0.1)
    expect(interpolateU95FromPoints(points, 10)).toBe(1)
  })
})
