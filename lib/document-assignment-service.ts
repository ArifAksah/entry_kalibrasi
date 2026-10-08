import { supabaseAdmin } from './supabase'
import { isUserInCalibrationOrderTeam } from './certificate-access'

export async function getDocumentAssignment(itemId: number) {
  const { data: assignment, error } = await supabaseAdmin
    .from('order_item_document_assignments')
    .select('*')
    .eq('calibration_order_item_id', itemId)
    .maybeSingle()
  if (error) throw error
  if (!assignment) return null

  const [{ data: checkerRows }, { data: snapshot }, { data: conflict }] = await Promise.all([
    supabaseAdmin
      .from('order_item_document_checkers')
      .select('id, personel_id, sort_order')
      .eq('assignment_id', assignment.id)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('order_item_document_assignment_snapshots')
      .select('*')
      .eq('assignment_id', assignment.id)
      .eq('revision', assignment.revision)
      .maybeSingle(),
    supabaseAdmin
      .from('order_item_document_assignment_conflicts')
      .select('id, certificate_assignment, letter_assignment, detected_at, resolved_at')
      .eq('calibration_order_item_id', itemId)
      .is('resolved_at', null)
      .maybeSingle(),
  ])

  const personColumns = 'id, name, nip, position, signer_title, is_active'
  const checkerIds = Array.from(
    new Set((checkerRows || []).map((row: any) => row.personel_id).filter(Boolean)),
  )
  const slotIds = [
    assignment.verifikator_1,
    assignment.verifikator_2,
    assignment.verifikator_3,
    assignment.authorized_by,
  ].filter(Boolean)
  const allIds = Array.from(new Set([...slotIds, ...checkerIds]))

  // Ambil personel tanpa embed: tabel pemeriksa punya dua FK ke personel
  // (personel_id & assigned_by) sehingga embed PostgREST ambigu.
  const { data: people } = allIds.length
    ? await supabaseAdmin.from('personel').select(personColumns).in('id', allIds)
    : { data: [] as any[] }
  const byId = new Map((people || []).map((person: any) => [person.id, person]))

  // Diperiksa Oleh: pakai pemeriksa yang tersimpan; bila kosong, pakai Tim Order.
  let checkedBy = (checkerRows || []).map((row: any, index: number) => ({
    ...row,
    sort_order: row.sort_order ?? index,
    personel: byId.get(row.personel_id) || null,
  }))

  if (checkedBy.length === 0) {
    const { data: itemRow } = await supabaseAdmin
      .from('calibration_order_items')
      .select('order_id')
      .eq('id', itemId)
      .maybeSingle()
    if (itemRow?.order_id) {
      const [{ data: orderRow }, { data: teamRows }] = await Promise.all([
        supabaseAdmin
          .from('calibration_orders')
          .select('created_by')
          .eq('id', itemRow.order_id)
          .maybeSingle(),
        supabaseAdmin
          .from('calibration_order_personnel')
          .select('personel_id')
          .eq('order_id', itemRow.order_id),
      ])
      const teamIds = Array.from(
        new Set(
          [orderRow?.created_by, ...(teamRows || []).map((row: any) => row.personel_id)].filter(Boolean),
        ),
      )
      const { data: teamPeople } = teamIds.length
        ? await supabaseAdmin.from('personel').select(personColumns).in('id', teamIds)
        : { data: [] as any[] }
      checkedBy = (teamPeople || []).map((person: any, index: number) => ({
        id: `team-${person.id}`,
        personel_id: person.id,
        sort_order: index,
        personel: person,
      }))
    }
  }

  return {
    ...assignment,
    checked_by: checkedBy,
    verifikator_1_person: byId.get(assignment.verifikator_1) || null,
    verifikator_2_person: byId.get(assignment.verifikator_2) || null,
    verifikator_3_person: byId.get(assignment.verifikator_3) || null,
    authorized_person: byId.get(assignment.authorized_by) || null,
    snapshot: snapshot || null,
    conflict: conflict || null,
  }
}

export async function canAccessDocumentAssignment(
  userId: string,
  role: string | null,
  itemId: number,
) {
  if (role === 'admin') return { allowed: true, orderId: null as number | null }
  const { data: item } = await supabaseAdmin
    .from('calibration_order_items')
    .select('order_id')
    .eq('id', itemId)
    .maybeSingle()
  if (!item) return { allowed: false, orderId: null }
  const inTeam = await isUserInCalibrationOrderTeam(userId, Number(item.order_id))
  if (inTeam) return { allowed: true, orderId: Number(item.order_id) }

  const assignment = await getDocumentAssignment(itemId)
  const isAssigned = assignment
    ? [assignment.verifikator_1, assignment.verifikator_2, assignment.verifikator_3, assignment.authorized_by]
        .some((id) => id === userId)
    : false
  return { allowed: isAssigned, orderId: Number(item.order_id) }
}

