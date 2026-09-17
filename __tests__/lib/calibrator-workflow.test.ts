import {
  ageInDays,
  getCalibratorWorkflowStage,
  isCalibratorOwnedCertificate,
} from '../../lib/dashboard/calibrator-workflow'

const base = {
  id: 1,
  created_at: '2026-09-10T00:00:00.000Z',
  created_by: 'calibrator-1',
  status: 'draft',
  version: 1,
  rejection_history: [],
  verifikator_1: 'v1',
  verifikator_2: 'v2',
  verifikator_3: 'v3',
  authorized_by: 'signer',
}

describe('calibrator dashboard workflow', () => {
  it('uses creator ownership and only falls back to sender for legacy rows', () => {
    expect(isCalibratorOwnedCertificate(base, 'calibrator-1')).toBe(true)
    expect(
      isCalibratorOwnedCertificate(
        { ...base, created_by: 'other', sent_by: 'calibrator-1' },
        'calibrator-1',
      ),
    ).toBe(false)
    expect(
      isCalibratorOwnedCertificate(
        { ...base, created_by: null, sent_by: 'calibrator-1' },
        'calibrator-1',
      ),
    ).toBe(true)
  })

  it('keeps draft stages mutually exclusive', () => {
    expect(getCalibratorWorkflowStage(base, [], false)).toBe('draft')
    expect(getCalibratorWorkflowStage(base, [], true)).toBe('ready')
    expect(
      getCalibratorWorkflowStage(
        { ...base, rejection_history: [{ rejection_timestamp: '2026-09-15' }] },
        [],
        true,
      ),
    ).toBe('revision')
  })

  it('derives the current verification level from current-version approvals', () => {
    const sent = { ...base, status: 'sent' }
    expect(getCalibratorWorkflowStage(sent, [])).toBe('verification_1')
    expect(
      getCalibratorWorkflowStage(sent, [
        { certificate_id: 1, verification_level: 1, status: 'approved', certificate_version: 1 },
      ]),
    ).toBe('verification_2')
    expect(
      getCalibratorWorkflowStage(sent, [1, 2, 3].map((level) => ({
        certificate_id: 1,
        verification_level: level,
        status: 'approved',
        certificate_version: 1,
      }))),
    ).toBe('signature')
  })

  it('calculates non-negative queue age', () => {
    expect(ageInDays('2026-09-10T00:00:00.000Z', new Date('2026-09-17T12:00:00.000Z'))).toBe(7)
    expect(ageInDays('2026-09-20T00:00:00.000Z', new Date('2026-09-17T12:00:00.000Z'))).toBe(0)
  })
})
