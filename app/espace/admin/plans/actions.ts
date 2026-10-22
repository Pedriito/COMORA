'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath, refresh } from 'next/cache'
import { requireChurch, type ChurchContext } from '@/lib/auth/church'
import { sendPlanAssignmentEmail, sendCancellationNotificationEmail, sendExternalGuestInvitationEmail } from '@/lib/email/espace'
import { sendPushToUser } from '@/lib/pushNotifications'
import { localToUtcIso, resolveTimeZone } from '@/lib/timezone'
import { notifyTeamLeadersOfResponse, churchTimeZone } from './notifyTeamLeaders'
import { TYPE_LABELS } from './planTypeStyles'

const RESPONSE_STATUSES = ['confirmed', 'declined'] as const
type ResponseStatus = typeof RESPONSE_STATUSES[number]

function isResponseStatus(value: unknown): value is ResponseStatus {
  return typeof value === 'string' && (RESPONSE_STATUSES as readonly string[]).includes(value)
}

/** Ajoute un paramètre à une URL qui peut déjà en contenir un. */
function withParam(url: string, key: string, value: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${value}`
}

/** Retour après une action : uniquement un chemin interne à l'espace. */
function safeReturnTo(value: FormDataEntryValue | null, fallback: string) {
  const v = typeof value === 'string' ? value : ''
  return v.startsWith('/espace/') && !v.startsWith('//') ? v : fallback
}

/** Responsable (ou admin) de l'église courante. */
async function requireManager() {
  const ctx = await requireChurch('responsable')
  return { ctx, supabase: ctx.supabase, churchId: ctx.church.churchId }
}

function planTypeOrDefault(value: FormDataEntryValue | null): string {
  const v = typeof value === 'string' ? value : ''
  return v in TYPE_LABELS ? v : 'sunday_service'
}

/** Ne garde que les équipes qui appartiennent à l'église courante. */
async function ownTeamIds(ctx: ChurchContext, teamIds: string[]): Promise<string[]> {
  if (teamIds.length === 0) return []
  const { data } = await ctx.supabase
    .from('teams')
    .select('id')
    .eq('church_id', ctx.church.churchId)
    .in('id', teamIds)
  const allowed = new Set((data ?? []).map(t => t.id))
  return teamIds.filter(id => allowed.has(id))
}

/** Compte lié à une personne de l'église (pour les notifications push). */
async function memberUserId(ctx: ChurchContext, memberId: string): Promise<string | null> {
  const { data } = await ctx.supabase
    .from('members')
    .select('user_id')
    .eq('id', memberId)
    .eq('church_id', ctx.church.churchId)
    .maybeSingle()
  return data?.user_id ?? null
}

/** Notification push « tu as été planifié·e ». Non bloquante. */
async function pushAssigned(ctx: ChurchContext, memberId: string, planId: string, positionId: string | null) {
  try {
    const churchId = ctx.church.churchId
    const [userId, timeZone, { data: plan }, { data: position }] = await Promise.all([
      memberUserId(ctx, memberId),
      churchTimeZone(ctx.supabase, churchId),
      ctx.supabase.from('plans').select('title, service_date').eq('id', planId).eq('church_id', churchId).maybeSingle(),
      positionId
        ? ctx.supabase.from('positions').select('name').eq('id', positionId).eq('church_id', churchId).maybeSingle()
        : Promise.resolve({ data: null as { name: string } | null }),
    ])
    if (!userId || !plan) return
    const date = new Date(plan.service_date).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone,
    })
    const role = position?.name ?? null
    await sendPushToUser(userId, {
      title: '📋 Tu as été planifié·e',
      body: role
        ? `${role} · ${date} — confirme ta présence !`
        : `${plan.title} · ${date} — confirme ta présence !`,
      url: '/espace/historique',
      tag: `assignment-${planId}`,
    })
  } catch (err) {
    console.error('[pushAssigned] notification push échouée (non bloquant) :', (err as Error)?.message)
  }
}

export async function createPlan(formData: FormData) {
  const { ctx, supabase, churchId } = await requireManager()
  const title       = ((formData.get('title') as string) ?? '').trim()
  const serviceDate = formData.get('service_date') as string
  const notes       = formData.get('notes') as string || null
  const planType    = planTypeOrDefault(formData.get('plan_type'))
  const teamIds     = formData.getAll('team_ids[]') as string[]
  // Compatibilité : si aucun team_ids[], on lit le champ legacy team_id
  const legacyTeamId = formData.get('team_id') as string || null
  const resolvedTeamIds = await ownTeamIds(ctx, teamIds.length > 0 ? teamIds : (legacyTeamId ? [legacyTeamId] : []))

  if (!title || !serviceDate) redirect('/espace/admin/plans/nouveau?error=missing_fields')
  const timeZone = await churchTimeZone(supabase, churchId)

  const { data, error } = await supabase
    .from('plans')
    .insert({
      church_id:    churchId,
      title,
      service_date: localToUtcIso(serviceDate, timeZone),
      team_id:      resolvedTeamIds[0] ?? null,   // garde la colonne legacy
      team_ids:     resolvedTeamIds.length > 0 ? resolvedTeamIds : null,
      notes,
      plan_type:    planType,
    })
    .select('id')
    .single()

  if (error || !data) redirect(`/espace/admin/plans/nouveau?error=${encodeURIComponent(error?.message ?? 'Erreur')}`)
  redirect(`/espace/admin/plans/${data.id}`)
}

/** Met à jour la liste des équipes d'un plan (remplace complètement). */
export async function setPlanTeams(formData: FormData) {
  const { ctx, supabase, churchId } = await requireManager()
  const planId  = formData.get('plan_id') as string
  const teamIds = await ownTeamIds(ctx, formData.getAll('team_ids[]') as string[])
  await supabase
    .from('plans')
    .update({ team_ids: teamIds.length > 0 ? teamIds : null })
    .eq('id', planId)
    .eq('church_id', churchId)
  revalidatePath(`/espace/admin/plans/${planId}`)
  revalidatePath('/espace/admin/plans')
}

/** Exclut ou réintègre un poste pour un plan donné (sans le supprimer de l'équipe).
 *  Relit `excluded_position_ids` juste avant d'écrire (plutôt que de faire confiance à la
 *  valeur connue du client) : si deux clics se suivent avant que le premier rafraîchissement
 *  soit revenu, un tableau client obsolète écraserait silencieusement le changement précédent. */
export async function excludePlanPositionAsync(
  planId: string,
  positionId: string,
  exclude: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, churchId } = await requireManager()

  const { data: plan, error: fetchError } = await supabase
    .from('plans')
    .select('excluded_position_ids')
    .eq('id', planId)
    .eq('church_id', churchId)
    .single()
  if (fetchError) return { ok: false, error: fetchError.message }

  const current = (plan?.excluded_position_ids ?? []) as string[]
  const next = exclude
    ? [...new Set([...current, positionId])]
    : current.filter(id => id !== positionId)

  const { error } = await supabase
    .from('plans')
    .update({ excluded_position_ids: next.length > 0 ? next : null })
    .eq('id', planId)
    .eq('church_id', churchId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/espace/admin/plans/${planId}`)
  revalidatePath('/espace/admin/plans')
  // `revalidatePath` seul ne garantit pas que le composant déjà monté (bloc d'équipe replié/
  // déplié) reçoive la donnée fraîche dans la même transition que le `router.refresh()` client
  // — `refresh()` force le "read-your-writes" immédiat sur cette requête.
  refresh()
  return { ok: true }
}

/** Crée un ou plusieurs plans depuis un formulaire unifié (champ date_mode = "single" | "multi"). */
export async function createPlanUnified(formData: FormData) {
  const dateMode = formData.get('date_mode') as string
  if (dateMode === 'multi') {
    return createPlans(formData)
  }
  return createPlan(formData)
}

export async function createPlans(formData: FormData) {
  const { ctx, supabase, churchId } = await requireManager()
  const title      = ((formData.get('title') as string) ?? '').trim()
  const dates      = (formData.getAll('service_dates') as string[]).filter(Boolean)
  const notes      = formData.get('notes') as string || null
  const planType   = planTypeOrDefault(formData.get('plan_type'))
  const teamIds    = formData.getAll('team_ids[]') as string[]
  const legacyTeamId = formData.get('team_id') as string || null
  const resolvedTeamIds = await ownTeamIds(ctx, teamIds.length > 0 ? teamIds : (legacyTeamId ? [legacyTeamId] : []))

  if (!dates.length) redirect('/espace/admin/plans/nouveau?error=no_dates')
  if (!title) redirect('/espace/admin/plans/nouveau?error=missing_fields')
  const timeZone = await churchTimeZone(supabase, churchId)

  const { error } = await supabase
    .from('plans')
    .insert(dates.map(d => ({
      church_id: churchId,
      title,
      service_date: localToUtcIso(d, timeZone),
      team_id:  resolvedTeamIds[0] ?? null,
      team_ids: resolvedTeamIds.length > 0 ? resolvedTeamIds : null,
      notes,
      plan_type: planType,
    })))

  if (error) redirect(`/espace/admin/plans/nouveau?error=${encodeURIComponent(error.message)}`)
  redirect('/espace/admin/plans')
}

/** Crée un nouveau plan en copiant le titre, le type, l'équipe et les notes d'un plan existant,
 *  avec une nouvelle date. Redirige vers le nouveau plan. */
export async function duplicatePlanToDate(formData: FormData) {
  const { supabase, churchId } = await requireManager()
  const fromPlanId  = formData.get('from_plan_id') as string
  const serviceDate = formData.get('service_date') as string

  const { data: source, error: srcError } = await supabase
    .from('plans')
    .select('title, plan_type, team_id, team_ids, notes')
    .eq('id', fromPlanId)
    .eq('church_id', churchId)
    .single()

  if (srcError || !source || !serviceDate) redirect('/espace/admin/plans?error=not_found')
  const timeZone = await churchTimeZone(supabase, churchId)

  const { data, error } = await supabase
    .from('plans')
    .insert({
      church_id:    churchId,
      title:        source.title,
      plan_type:    source.plan_type,
      team_id:      source.team_id,
      team_ids:     source.team_ids ?? null,
      notes:        source.notes,
      service_date: localToUtcIso(serviceDate, timeZone),
    })
    .select('id')
    .single()

  if (error || !data) redirect(`/espace/admin/plans?error=${encodeURIComponent(error?.message ?? 'Erreur')}`)
  redirect(`/espace/admin/plans/${data.id}`)
}

export async function deletePlan(formData: FormData) {
  const { supabase, churchId } = await requireManager()
  const planId = formData.get('plan_id') as string
  await supabase.from('plans').delete().eq('id', planId).eq('church_id', churchId)
  redirect('/espace/admin/plans')
}

/** Déplace un service à une nouvelle date (glisser-déposer dans le calendrier). Appelé
 *  directement depuis le client (pas via <form>) — renvoie un résultat plutôt que de rediriger. */
export async function movePlan(
  planId: string,
  newServiceDate: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, churchId } = await requireManager()
  const timeZone = await churchTimeZone(supabase, churchId)
  const { error } = await supabase
    .from('plans')
    .update({ service_date: localToUtcIso(newServiceDate, timeZone) })
    .eq('id', planId)
    .eq('church_id', churchId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/espace/admin/plans')
  return { ok: true }
}

/** Copie un service à une nouvelle date en dupliquant le plan (Ctrl+glisser). */
export async function copyPlan(
  planId: string,
  newServiceDate: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, churchId } = await requireManager()
  const { data: original, error: fetchError } = await supabase
    .from('plans')
    .select('title, plan_type, team_id, team_ids, notes')
    .eq('id', planId)
    .eq('church_id', churchId)
    .single()
  if (fetchError || !original) return { ok: false, error: fetchError?.message ?? 'Plan introuvable.' }
  const timeZone = await churchTimeZone(supabase, churchId)
  const { error } = await supabase.from('plans').insert({
    church_id: churchId,
    title: original.title,
    service_date: localToUtcIso(newServiceDate, timeZone),
    plan_type: original.plan_type,
    team_id: original.team_id,
    team_ids: original.team_ids ?? null,
    notes: original.notes,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/espace/admin/plans')
  return { ok: true }
}

/** Valeur du champ `member_id` qui désigne un invité externe (pas de fiche dans l'église). */
const EXTERNAL_CHOICE = 'external'

type NewAssignment = {
  planId: string
  memberId: string | null
  positionId: string | null
  teamId: string | null
  externalName: string | null
  externalEmail: string | null
}

/** Insère une affectation dans l'église courante. Les clés étrangères composites
 *  (plan, personne, équipe, poste → même église) refusent tout id d'une autre église. */
async function insertAssignment(ctx: ChurchContext, a: NewAssignment): Promise<{ error?: string }> {
  const isExternal = a.memberId === null
  const externalName = a.externalName?.trim() || null
  const externalEmail = a.externalEmail?.trim() || null
  if (isExternal && !externalName) return { error: "Nom de l'invité manquant." }
  if (externalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(externalEmail)) return { error: 'E-mail invalide.' }

  const { error } = await ctx.supabase.from('plan_assignments').insert({
    church_id: ctx.church.churchId,
    plan_id: a.planId,
    member_id: a.memberId,
    position_id: a.positionId,
    team_id: a.teamId,
    status: 'pending',
    external_name: isExternal ? externalName : null,
    external_email: isExternal ? externalEmail : null,
  })
  return error ? { error: error.message } : {}
}

export async function addAssignment(formData: FormData) {
  const { ctx } = await requireManager()
  const planId = formData.get('plan_id') as string
  const memberChoice = (formData.get('member_id') as string) || ''
  const positionId = formData.get('position_id') as string || null
  const teamId = formData.get('team_id') as string || null
  const returnTo = safeReturnTo(formData.get('return_to'), `/espace/admin/plans/${planId}`)

  if (!memberChoice) redirect(returnTo)

  const memberId = memberChoice === EXTERNAL_CHOICE ? null : memberChoice
  const { error } = await insertAssignment(ctx, {
    planId,
    memberId,
    positionId,
    teamId,
    externalName: formData.get('external_name') as string | null,
    externalEmail: formData.get('external_email') as string | null,
  })
  if (error) redirect(withParam(returnTo, 'error', encodeURIComponent(error)))

  if (memberId) await pushAssigned(ctx, memberId, planId, positionId)

  redirect(returnTo)
}

export async function removeAssignment(formData: FormData) {
  const { supabase, churchId } = await requireManager()
  const assignmentId = formData.get('assignment_id') as string
  const planId = formData.get('plan_id') as string
  const returnTo = safeReturnTo(formData.get('return_to'), `/espace/admin/plans/${planId}`)
  await supabase.from('plan_assignments').delete().eq('id', assignmentId).eq('church_id', churchId)
  redirect(returnTo)
}

/** Variante sans redirect, pour un appel direct depuis un composant client (mise à jour optimiste). */
export async function removeAssignmentAsync(
  assignmentId: string,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, churchId } = await requireManager()
  const { error } = await supabase.from('plan_assignments').delete().eq('id', assignmentId).eq('church_id', churchId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/espace/admin/plans/${planId}`)
  revalidatePath('/espace/admin/plans')
  return { ok: true }
}

/** Fait porter le rôle "DM" par la personne actuellement affectée à l'un des postes
 *  instrumentaux (Piano/Basse/Batterie), plutôt que de créer deux affectations manuelles
 *  distinctes et indépendantes. `sourcePositionId = null` retire l'affectation DM en cours
 *  sans la remplacer (désélection). */
export async function setDmHolder(
  planId: string,
  teamId: string,
  dmPositionId: string,
  sourcePositionId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, churchId } = await requireManager()

  const { error: deleteError } = await supabase
    .from('plan_assignments')
    .delete()
    .eq('church_id', churchId)
    .eq('plan_id', planId)
    .eq('position_id', dmPositionId)
  if (deleteError) return { ok: false, error: deleteError.message }

  if (!sourcePositionId) {
    revalidatePath(`/espace/admin/plans/${planId}`)
    revalidatePath('/espace/admin/plans')
    return { ok: true }
  }

  const { data: sourceAssignment, error: fetchError } = await supabase
    .from('plan_assignments')
    .select('member_id')
    .eq('church_id', churchId)
    .eq('plan_id', planId)
    .eq('position_id', sourcePositionId)
    .not('member_id', 'is', null)
    .maybeSingle()

  if (fetchError) return { ok: false, error: fetchError.message }
  if (!sourceAssignment?.member_id) return { ok: false, error: "Ce poste n'a personne d'affecté pour ce service." }

  const { error: insertError } = await supabase.from('plan_assignments').insert({
    church_id: churchId,
    plan_id: planId,
    member_id: sourceAssignment.member_id,
    position_id: dmPositionId,
    team_id: teamId,
    status: 'pending',
  })
  if (insertError) return { ok: false, error: insertError.message }

  revalidatePath(`/espace/admin/plans/${planId}`)
  revalidatePath('/espace/admin/plans')
  return { ok: true }
}

/** Variante sans redirect de addAssignment, pour un appel direct depuis un composant client.
 *  `memberId = null` : invité externe (nom obligatoire, e-mail facultatif). */
export async function addAssignmentAsync(input: {
  planId: string
  memberId: string | null
  positionId?: string | null
  teamId?: string | null
  externalName?: string | null
  externalEmail?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const { ctx } = await requireManager()
  const { planId, memberId, positionId = null, teamId = null, externalName = null, externalEmail = null } = input

  const { error } = await insertAssignment(ctx, { planId, memberId, positionId, teamId, externalName, externalEmail })
  if (error) return { ok: false, error }

  // La notification push est un bonus non bloquant : l'affectation est déjà enregistrée.
  if (memberId) await pushAssigned(ctx, memberId, planId, positionId)

  revalidatePath(`/espace/admin/plans/${planId}`)
  revalidatePath('/espace/admin/plans')
  return { ok: true }
}

export async function sendSingleInvitation(formData: FormData) {
  const { ctx, supabase, churchId } = await requireManager()
  const assignmentId = formData.get('assignment_id') as string
  const planId = formData.get('plan_id') as string
  const returnTo = safeReturnTo(formData.get('return_to'), `/espace/admin/plans/${planId}`)

  const { data: a, error } = await supabase
    .from('plan_assignments')
    .select('id, member_id, team_id, external_name, external_email, plans(title, service_date), positions(name), teams(name), members(first_name, user_id)')
    .eq('id', assignmentId)
    .eq('church_id', churchId)
    .single()

  if (error || !a) redirect(withParam(returnTo, 'error', 'Affectation+introuvable'))

  const plan = a.plans as unknown as { title: string; service_date: string } | null
  const position = a.positions as unknown as { name: string } | null
  const team = a.teams as unknown as { name: string } | null
  const member = a.members as unknown as { first_name: string; user_id: string | null } | null
  if (!plan) redirect(withParam(returnTo, 'error', 'Données+manquantes'))

  const timeZone = await churchTimeZone(supabase, churchId)

  // Invité externe
  if (!a.member_id) {
    if (!a.external_email) redirect(withParam(returnTo, 'error', 'Email+invité+manquant'))
    try {
      await sendExternalGuestInvitationEmail({
        to: a.external_email as string,
        guestName: a.external_name ?? 'Invité',
        planTitle: plan.title,
        serviceDate: plan.service_date,
        positionName: position?.name ?? null,
        teamName: team?.name ?? null,
        assignmentId,
        timeZone,
        churchName: ctx.church.churchName,
      })
      await supabase.from('plan_assignments').update({ invitation_sent_at: new Date().toISOString() }).eq('id', assignmentId).eq('church_id', churchId)
    } catch (err) {
      console.error('[sendSingleInvitation] envoi impossible (invité externe) :', (err as Error)?.message)
      redirect(withParam(returnTo, 'error', encodeURIComponent((err as Error)?.message ?? 'Erreur envoi email')))
    }
    redirect(withParam(returnTo, 'sent', '1'))
  }

  // Personne de l'église : e-mail du compte, sinon e-mail de contact de sa fiche
  let email: string | null = null
  if (member?.user_id) {
    // Clé secrète : l'e-mail d'un compte n'est lisible que par l'API d'administration Auth ;
    // le compte vient de la fiche relue ci-dessus dans l'église courante.
    const { data: authData } = await createAdminClient().auth.admin.getUserById(member.user_id)
    email = authData?.user?.email ?? null
  }
  if (!email) {
    const { data: contact } = await supabase
      .from('member_contacts')
      .select('email')
      .eq('member_id', a.member_id)
      .eq('church_id', churchId)
      .maybeSingle()
    email = contact?.email ?? null
  }

  if (!email || !member) redirect(withParam(returnTo, 'error', 'Email+introuvable'))

  try {
    await sendPlanAssignmentEmail({
      to: email,
      firstName: member.first_name,
      planTitle: plan.title,
      serviceDate: plan.service_date,
      positionName: position?.name ?? null,
      teamName: team?.name ?? null,
      assignmentId,
      timeZone,
      churchName: ctx.church.churchName,
    })
    await supabase.from('plan_assignments').update({ invitation_sent_at: new Date().toISOString() }).eq('id', assignmentId).eq('church_id', churchId)

    // Notification push en complément de l'email (non bloquante)
    if (member.user_id) {
      const dateStr = new Date(plan.service_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone })
      sendPushToUser(member.user_id, {
        title: `📅 ${plan.title}`,
        body:  `Tu es planifié(e) le ${dateStr}${team?.name ? ` · ${team.name}` : ''}`,
        url:   '/espace/dashboard',
        tag:   `assignment-${assignmentId}`,
      }).catch(() => {})
    }
  } catch (err) {
    console.error('[sendSingleInvitation] envoi impossible :', (err as Error)?.message)
    redirect(withParam(returnTo, 'error', encodeURIComponent((err as Error)?.message ?? 'Erreur envoi email')))
  }

  void ctx
  redirect(withParam(returnTo, 'sent', '1'))
}

/** La personne courante confirme ou décline sa propre affectation. Renvoie false si rien
 *  n'a été modifié (statut invalide, affectation d'une autre personne ou d'une autre église). */
async function updateOwnAssignment(assignmentId: string, status: unknown): Promise<boolean> {
  const ctx = await requireChurch('membre')
  if (!ctx.memberId || !isResponseStatus(status) || !assignmentId) return false
  const churchId = ctx.church.churchId

  const { data, error } = await ctx.supabase
    .from('plan_assignments')
    .update({ status })
    .eq('id', assignmentId)
    .eq('church_id', churchId)
    .eq('member_id', ctx.memberId)
    .select('id')
  if (error || !data || data.length === 0) return false

  const timeZone = await churchTimeZone(ctx.supabase, churchId)
  await notifyTeamLeadersOfResponse(churchId, assignmentId, status, timeZone)
  return true
}

export async function respondAssignment(formData: FormData) {
  await updateOwnAssignment(formData.get('assignment_id') as string, formData.get('status'))
  redirect('/espace/dashboard')
}

/** Variante sans redirect, pour un appel direct depuis un composant client (mise à jour optimiste).
 *  `planId` est optionnel : quand fourni, revalide aussi la page de détail du plan concerné. */
export async function respondAssignmentAsync(
  assignmentId: string,
  status: string,
  planId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isResponseStatus(status)) return { ok: false, error: 'Statut invalide.' }
  const updated = await updateOwnAssignment(assignmentId, status)
  if (!updated) return { ok: false, error: 'Affectation introuvable.' }

  revalidatePath('/espace/admin/plans')
  if (planId) revalidatePath(`/espace/admin/plans/${planId}`)
  return { ok: true }
}

export async function respondAssignmentOnHistorique(formData: FormData) {
  await updateOwnAssignment(formData.get('assignment_id') as string, formData.get('status'))
  revalidatePath('/espace/historique')
  redirect('/espace/historique')
}

export async function cancelAssignment(formData: FormData) {
  const ctx = await requireChurch('membre')
  if (!ctx.memberId) redirect('/espace/dashboard')
  const churchId = ctx.church.churchId
  const assignmentId = formData.get('assignment_id') as string

  // Affectation de la personne courante, dans l'église courante
  const { data: assignment } = await ctx.supabase
    .from('plan_assignments')
    .select('id, plans(id, title, service_date), positions(name), teams(name), members(first_name, last_name)')
    .eq('id', assignmentId)
    .eq('church_id', churchId)
    .eq('member_id', ctx.memberId)
    .maybeSingle()

  if (!assignment) redirect('/espace/dashboard')

  const plan = assignment.plans as unknown as { id: string; title: string; service_date: string } | null
  if (!plan || new Date(plan.service_date) <= new Date()) redirect('/espace/dashboard')

  await ctx.supabase
    .from('plan_assignments')
    .update({ status: 'declined' })
    .eq('id', assignmentId)
    .eq('church_id', churchId)
    .eq('member_id', ctx.memberId)

  const member = assignment.members as unknown as { first_name: string; last_name: string } | null
  const volunteerName = `${member?.first_name ?? ''} ${member?.last_name ?? ''}`.trim() || 'Un·e bénévole'
  const position = assignment.positions as unknown as { name: string } | null
  const team = assignment.teams as unknown as { name: string } | null
  const timeZone = await churchTimeZone(ctx.supabase, churchId)

  await notifyTeamLeadersOfResponse(churchId, assignmentId, 'declined', timeZone)

  // Clé secrète : un membre ne lit pas les appartenances des autres comptes, et les e-mails
  // des comptes ne sont accessibles que par l'API d'administration Auth. Filtré sur l'église courante.
  try {
    const admin = createAdminClient()
    const { data: managers } = await admin
      .from('church_memberships')
      .select('user_id')
      .eq('church_id', churchId)
      .eq('status', 'active')
      .in('role', ['admin', 'responsable'])

    const recipients = (managers ?? []).filter(m => m.user_id !== ctx.userId)
    for (const m of recipients) {
      try {
        const { data } = await admin.auth.admin.getUserById(m.user_id)
        const email = data?.user?.email
        if (!email) continue
        await sendCancellationNotificationEmail({
          to: email,
          volunteerName,
          planTitle: plan.title,
          serviceDate: plan.service_date,
          positionName: position?.name ?? null,
          teamName: team?.name ?? null,
          timeZone,
          churchName: ctx.church.churchName,
        })
      } catch (err) {
        console.error('[cancelAssignment] envoi impossible :', (err as Error)?.message)
      }
    }
  } catch (err) {
    console.error('[cancelAssignment] notification des responsables impossible :', (err as Error)?.message)
  }

  redirect('/espace/dashboard')
}

// ── CHANTS DU PLAN ─────────────────────────────────────────────────────────

export async function addPlanSong(formData: FormData) {
  const { supabase, churchId } = await requireManager()
  const planId      = formData.get('plan_id') as string
  const songId      = formData.get('song_id') as string
  const arrId       = (formData.get('arrangement_id') as string) || null
  const keySelected = (formData.get('key_selected') as string) || null
  if (!planId || !songId) return

  // Dernier order_index existant
  const { data: existing } = await supabase
    .from('plan_songs')
    .select('order_index')
    .eq('church_id', churchId)
    .eq('plan_id', planId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextIndex = (existing?.order_index ?? -1) + 1

  // Toujours préférer un arrangement avec grille d'accords
  let finalArrId = arrId
  if (!finalArrId) {
    // Aucun arrangement spécifié → prendre le premier avec grille, sinon le premier dispo
    const { data: arrangements } = await supabase
      .from('arrangements')
      .select('id, chord_chart')
      .eq('church_id', churchId)
      .eq('song_id', songId)
      .order('created_at')
    if (arrangements && arrangements.length > 0) {
      const withChart = arrangements.find(a => a.chord_chart)
      finalArrId = (withChart ?? arrangements[0]).id
    }
  } else {
    // Arrangement spécifié sans grille → vérifier s'il en existe un meilleur
    const { data: specifiedArr } = await supabase
      .from('arrangements')
      .select('chord_chart')
      .eq('church_id', churchId)
      .eq('id', finalArrId)
      .maybeSingle()
    if (!specifiedArr?.chord_chart) {
      const { data: better } = await supabase
        .from('arrangements')
        .select('id')
        .eq('church_id', churchId)
        .eq('song_id', songId)
        .not('chord_chart', 'is', null)
        .order('created_at')
        .limit(1)
        .maybeSingle()
      if (better) finalArrId = better.id
    }
  }

  await supabase.from('plan_songs').insert({
    church_id:      churchId,
    plan_id:        planId,
    song_id:        songId,
    arrangement_id: finalArrId,
    key_selected:   keySelected,
    order_index:    nextIndex,
  })

  revalidatePath(`/espace/admin/plans/${planId}`)
}

export async function reorderPlanSongs(planId: string, orderedIds: string[]) {
  const { supabase, churchId } = await requireManager()

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('plan_songs').update({ order_index: index }).eq('id', id).eq('church_id', churchId).eq('plan_id', planId)
    )
  )

  revalidatePath(`/espace/admin/plans/${planId}`)
}

export async function removePlanSong(formData: FormData) {
  const { supabase, churchId } = await requireManager()
  const planSongId = formData.get('plan_song_id') as string
  const planId     = formData.get('plan_id') as string

  await supabase.from('plan_songs').delete().eq('id', planSongId).eq('church_id', churchId)

  revalidatePath(`/espace/admin/plans/${planId}`)
}

export async function movePlanSong(formData: FormData) {
  const { supabase, churchId } = await requireManager()
  const planSongId = formData.get('plan_song_id') as string
  const planId     = formData.get('plan_id') as string
  const direction  = formData.get('direction') === 'up' ? 'up' : 'down'

  const { data: songs } = await supabase
    .from('plan_songs')
    .select('id, order_index')
    .eq('church_id', churchId)
    .eq('plan_id', planId)
    .order('order_index')

  if (!songs || songs.length < 2) return

  const idx = songs.findIndex(s => s.id === planSongId)
  if (idx === -1) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= songs.length) return

  const a = songs[idx]
  const b = songs[swapIdx]

  await Promise.all([
    supabase.from('plan_songs').update({ order_index: b.order_index }).eq('id', a.id).eq('church_id', churchId),
    supabase.from('plan_songs').update({ order_index: a.order_index }).eq('id', b.id).eq('church_id', churchId),
  ])

  revalidatePath(`/espace/admin/plans/${planId}`)
}

/** Change l'arrangement sélectionné pour un chant dans un plan. */
export async function updatePlanSongArrangement(
  planSongId: string,
  arrangementId: string,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, churchId } = await requireManager()
  const { error } = await supabase
    .from('plan_songs')
    .update({ arrangement_id: arrangementId })
    .eq('id', planSongId)
    .eq('church_id', churchId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/espace/admin/plans/${planId}/setlist`)
  return { ok: true }
}

/**
 * Sauvegarde permanente d'une modification de paroles en live.
 * Remplace les lignes identifiées par chartLineNums dans le chord_chart de l'arrangement.
 */
export async function updateSlideLyrics(
  arrangementId: string,
  chartLineNums: number[],   // indices des lignes à remplacer dans le chord_chart
  newLines: string[],        // nouvelles paroles
  planId: string,            // pour revalider la page setlist
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, churchId } = await requireManager()
  if (chartLineNums.length === 0) return { ok: false, error: 'Aucune ligne à remplacer.' }

  const { data: arr, error: fetchErr } = await supabase
    .from('arrangements')
    .select('chord_chart')
    .eq('id', arrangementId)
    .eq('church_id', churchId)
    .single()

  if (fetchErr || !arr?.chord_chart) {
    return { ok: false, error: fetchErr?.message ?? 'Arrangement introuvable' }
  }

  const lines = arr.chord_chart.split('\n')

  // Remplace les lignes ciblées par les nouvelles paroles
  const startIdx = chartLineNums[0]
  const endIdx   = chartLineNums[chartLineNums.length - 1]
  const updated  = [
    ...lines.slice(0, startIdx),
    ...newLines,
    ...lines.slice(endIdx + 1),
  ].join('\n')

  const { error: saveErr } = await supabase
    .from('arrangements')
    .update({ chord_chart: updated })
    .eq('id', arrangementId)
    .eq('church_id', churchId)

  if (saveErr) return { ok: false, error: saveErr.message }

  revalidatePath(`/espace/admin/plans/${planId}/setlist`)
  return { ok: true }
}

// ── RECHERCHE DE CHANTS POUR LA PROJECTION ────────────────────────────────

export type SongSearchResult = {
  songId: string
  title: string
  matchedInLyrics: boolean
  arrangement: {
    id: string
    name: string
    chord_chart: string | null
    chord_chart_key: string | null
  } | null
}

export async function searchSongsForProjection(query: string): Promise<SongSearchResult[]> {
  const { supabase, churchId } = await requireManager()
  // Les jokers de ILIKE (% et _) saisis par l'utilisateur sont pris littéralement
  const q = query.trim().replace(/[%_\\]/g, m => `\\${m}`)
  if (!q) return []

  // Recherche 1 : par titre
  const { data: byTitle } = await supabase
    .from('songs')
    .select('id, title, arrangements(id, name, chord_chart, chord_chart_key)')
    .eq('church_id', churchId)
    .ilike('title', `%${q}%`)
    .order('title')
    .limit(8)

  // Recherche 2 : dans les paroles (chord_chart)
  const { data: byLyrics } = await supabase
    .from('arrangements')
    .select('id, name, chord_chart, chord_chart_key, song_id, songs(id, title)')
    .eq('church_id', churchId)
    .ilike('chord_chart', `%${q}%`)
    .limit(8)

  const seen = new Set<string>()
  const results: SongSearchResult[] = []

  for (const s of (byTitle ?? [])) {
    seen.add(s.id)
    const arrs = (s.arrangements ?? []) as { id: string; name: string; chord_chart: string | null; chord_chart_key: string | null }[]
    results.push({
      songId: s.id,
      title: s.title,
      matchedInLyrics: false,
      arrangement: arrs.find(a => a.chord_chart) ?? arrs[0] ?? null,
    })
  }

  for (const arr of (byLyrics ?? [])) {
    const song = arr.songs as unknown as { id: string; title: string } | null
    if (!song || seen.has(song.id)) continue
    seen.add(song.id)
    results.push({
      songId: song.id,
      title: song.title,
      matchedInLyrics: true,
      arrangement: { id: arr.id, name: arr.name, chord_chart: arr.chord_chart, chord_chart_key: arr.chord_chart_key },
    })
  }

  return results.slice(0, 10)
}

/** Fuseau de l'église courante, pour les composants qui convertissent des heures saisies. */
export async function currentChurchTimeZone(): Promise<string> {
  const ctx = await requireChurch('membre')
  return resolveTimeZone(await churchTimeZone(ctx.supabase, ctx.church.churchId))
}
