import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAssignmentResponseToken } from '@/lib/email/espace'
import { notifyTeamLeadersOfResponse } from '../admin/plans/notifyTeamLeaders'
import { resolveTimeZone } from '@/lib/timezone'

/*
 * Réponse à une affectation depuis un lien envoyé par e-mail.
 * Le lien porte un jeton signé (id de l'affectation + expiration) : aucun identifiant brut
 * n'est accepté. Lecture et écriture se font avec la clé secrète, toujours filtrées par l'id
 * contenu dans le jeton vérifié.
 */

export type ResponseKind = 'member' | 'external'
export type ResponseStatus = 'confirmed' | 'declined'

export function isResponseStatus(value: unknown): value is ResponseStatus {
  return value === 'confirmed' || value === 'declined'
}

export type AssignmentView = {
  id: string
  churchId: string
  status: string
  externalName: string | null
  planTitle: string
  serviceDate: string
  positionName: string | null
  teamName: string | null
  timeZone: string
}

/** Affectation d'un jeton valide, du bon type (interne : member_id renseigné ; externe : nul). */
export async function loadAssignmentByToken(token: string, kind: ResponseKind): Promise<AssignmentView | null> {
  const assignmentId = verifyAssignmentResponseToken(token)
  if (!assignmentId) return null

  // Clé secrète : page publique sans session ; l'accès est limité à l'id signé.
  const admin = createAdminClient()
  const { data } = await admin
    .from('plan_assignments')
    .select('id, church_id, member_id, status, external_name, plans(title, service_date), positions(name), teams(name)')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!data) return null
  if (kind === 'external' ? data.member_id !== null : data.member_id === null) return null

  const plan = data.plans as unknown as { title: string; service_date: string } | null
  if (!plan) return null
  const { data: church } = await admin.from('churches').select('timezone').eq('id', data.church_id).maybeSingle()

  return {
    id: data.id,
    churchId: data.church_id,
    status: data.status,
    externalName: data.external_name,
    planTitle: plan.title,
    serviceDate: plan.service_date,
    positionName: (data.positions as unknown as { name: string } | null)?.name ?? null,
    teamName: (data.teams as unknown as { name: string } | null)?.name ?? null,
    timeZone: resolveTimeZone(church?.timezone),
  }
}

/** Enregistre la réponse. Le jeton est revérifié ici (la Server Action ne fait pas confiance
 *  à la page qui l'a affichée). Renvoie false si le jeton, le statut ou l'affectation sont invalides. */
export async function recordResponse(token: string, status: unknown, kind: ResponseKind): Promise<boolean> {
  if (!isResponseStatus(status)) return false
  const assignment = await loadAssignmentByToken(token, kind)
  if (!assignment) return false

  // Clé secrète : filtrée par l'id signé et par l'église de l'affectation.
  const admin = createAdminClient()
  // Une église en lecture seule n'enregistre plus de réponses
  const { data: writable } = await admin.rpc('church_is_writable', { p_church: assignment.churchId })
  if (writable === false) return false
  const { error } = await admin
    .from('plan_assignments')
    .update({ status })
    .eq('id', assignment.id)
    .eq('church_id', assignment.churchId)
  if (error) return false

  await notifyTeamLeadersOfResponse(assignment.churchId, assignment.id, status, assignment.timeZone)
  return true
}
