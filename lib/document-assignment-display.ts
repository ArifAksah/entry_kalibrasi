export function assignmentDisplay(assignment: any) {
  const snapshot = assignment?.snapshot
  if (snapshot) {
    return {
      checkedBy: Array.isArray(snapshot.checked_by) ? snapshot.checked_by : [],
      verifiedBy: [snapshot.verifikator_1, snapshot.verifikator_2, snapshot.verifikator_3],
      authorized: snapshot.authorized_by,
      locked: true,
    }
  }
  return {
    checkedBy: (assignment?.checked_by || []).map((row: any) => row.personel).filter(Boolean),
    verifiedBy: [
      assignment?.verifikator_1_person,
      assignment?.verifikator_2_person,
      assignment?.verifikator_3_person,
    ].filter(Boolean),
    authorized: assignment?.authorized_person || null,
    locked: Boolean(assignment?.locked_at),
  }
}
