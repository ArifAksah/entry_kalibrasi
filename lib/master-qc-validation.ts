export type MasterQcPayload = {
  instrumentNameId: number
  unitId: number
  correctionLimit: string
  notes: string | null
}

export function parseMasterQcPayload(body: any):
  | { success: true; data: MasterQcPayload }
  | { success: false; error: string } {
  const instrumentNameId = Number(body?.instrument_name_id)
  const unitId = Number(body?.unit_id)
  const correctionLimit = String(body?.nilai_batas_koreksi ?? '').trim()
  const notes = String(body?.catatan ?? '').trim() || null

  if (!Number.isInteger(instrumentNameId) || instrumentNameId <= 0) {
    return { success: false, error: 'Nama instrumen wajib dipilih.' }
  }
  if (!Number.isInteger(unitId) || unitId <= 0) {
    return { success: false, error: 'Satuan wajib dipilih.' }
  }
  if (!correctionLimit) {
    return { success: false, error: 'Nilai batas koreksi wajib diisi.' }
  }

  return {
    success: true,
    data: { instrumentNameId, unitId, correctionLimit, notes },
  }
}
