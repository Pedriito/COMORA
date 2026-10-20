'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath, refresh } from 'next/cache'
import { sendPlanAssignmentEmail, sendCancellationNotificationEmail, sendExternalGuestInvitationEmail } from '@/lib/email/espace'
import { sendPushToUser, sendPushToUsers } from '@/lib/pushNotifications'
import { parisLocalToUtcIso } from '@/lib/timezone'

const INVITE_EXT_ID = '00000000-0000-0000-0000-000000000001'

/** Ajoute un paramètre à une URL qui peut déjà en contenir un. */
function withParam(url: string, key: string, value: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${value}`
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: profile } = await supabase.from('profiles').select('permission, church_id').eq('id', user.id).single()
  if (!profile || !['admin', 'editor', 'super_admin'].includes(profile.permission)) redirect('/espace/dashboard')
  return { admin: createAdminClient(), church_id: profile.church_id as string }
}

/** Notifie par push les responsables (leaders) de l'équipe concernée qu'un bénévole a
 *  confirmé ou décliné une affectation. Non-bloquant : une erreur ici ne doit jamais faire
 *  échouer la réponse du bénévole, déjà enregistrée à ce stade. */
async function notifyTeamLeadersOfResponse(assignmentId: string, status: string) {
  if (status !== 'confirmed' && status !== 'declined') return
  try {
    const admin = createAdminClient()
    const { data: assignment } = await admin
      .from('plan_assignments')
      .select('user_id, team_id, plan_id, plans(id, title, service_date), positions(name, team_id), profiles(first_name, last_name)')
      .eq('id', assignmentId)
      .single()
    if (!assignment) return

    const position = assignment.positions as unknown as { name: string; team_id: string } | null
    const teamId = assignment.team_id ?? position?.team_id ?? null
    if (!teamId) return

    const { data: leaders } = await admin
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('role', 'leader')

    const leaderIds = (leaders ?? [])
      .map(l => l.user_id)
      .filter(id => id !== assignment.user_id)
    if (leaderIds.length === 0) return

    const plan = assignment.plans as unknown as { id: string; title: string; service_date: string } | null
    const profile = assignment.profiles as unknown as { first_name: string; last_name: string } | null
    const volunteerName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Un·e bénévole'
    const date = plan
      ? new Date(plan.service_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      : ''
    const verb = status === 'confirmed' ? 'a confirmé sa présence' : 'a décliné'

    await sendPushToUsers(leaderIds, {
      title: status === 'confirmed' ? '✅ Réponse reçue' : '❌ Réponse reçue',
      body: `${volunteerName} ${verb}${position ? ` · ${position.name}` : ''}${plan ? ` · ${plan.title} (${date})` : ''}`,
      url: plan ? `/espace/admin/plans/${plan.id}` : '/espace/dashboard',
      tag: `response-${assignmentId}`,
    })
  } catch (err) {
    console.error('[notifyTeamLeadersOfResponse] échec (non-bloquant):', err)
  }
}

export async function createPlan(formData: FormData) {
  const { admin, church_id } = await requireAdmin()
  const title     = formData.get('title') as string
  const serviceDate = formData.get('service_date') as string
  const notes     = formData.get('notes') as string || null
  const planType  = (formData.get('plan_type') as string) || 'sunday_service'
  const teamIds   = formData.getAll('team_ids[]') as string[]
  // Compatibilité : si aucun team_ids[], on lit le champ legacy team_id
  const legacyTeamId = formData.get('team_id') as string || null
  const resolvedTeamIds = teamIds.length > 0 ? teamIds : (legacyTeamId ? [legacyTeamId] : null)

  const { data, error } = await admin
    .from('plans')
    .insert({
      title,
      service_date: parisLocalToUtcIso(serviceDate),
      team_id:      resolvedTeamIds?.[0] ?? null,   // garde la colonne legacy
      team_ids:     resolvedTeamIds ?? null,
      notes,
      plan_type:    planType,
      church_id,
    })
    .select('id')
    .single()

  if (error) redirect(`/espace/admin/plans/nouveau?error=${encodeURIComponent(error.message)}`)
  redirect(`/espace/admin/plans/${data.id}`)
}

/** Met à jour la liste des équipes d'un plan (remplace complètement). */
export async function setPlanTeams(formData: FormData) {
  const { admin } = await requireAdmin()
  const planId  = formData.get('plan_id') as string
  const teamIds = formData.getAll('team_ids[]') as string[]
  await admin
    .from('plans')
    .update({ team_ids: teamIds.length > 0 ? teamIds : null })
    .eq('id', planId)
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
  const { admin } = await requireAdmin()

  const { data: plan, error: fetchError } = await admin
    .from('plans')
    .select('excluded_position_ids')
    .eq('id', planId)
    .single()
  if (fetchError) return { ok: false, error: fetchError.message }

  const current = (plan?.excluded_position_ids ?? []) as string[]
  const next = exclude
    ? [...new Set([...current, positionId])]
    : current.filter(id => id !== positionId)

  const { error } = await admin
    .from('plans')
    .update({ excluded_position_ids: next.length > 0 ? next : null })
    .eq('id', planId)
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
  const { admin, church_id } = await requireAdmin()
  const title      = formData.get('title') as string
  const dates      = formData.getAll('service_dates') as string[]
  const notes      = formData.get('notes') as string || null
  const planType   = (formData.get('plan_type') as string) || 'sunday_service'
  const teamIds    = formData.getAll('team_ids[]') as string[]
  const legacyTeamId = formData.get('team_id') as string || null
  const resolvedTeamIds = teamIds.length > 0 ? teamIds : (legacyTeamId ? [legacyTeamId] : null)

  if (!dates.length) redirect('/espace/admin/plans/nouveau?error=no_dates')

  const { error } = await admin
    .from('plans')
    .insert(dates.map(d => ({
      title,
      service_date: parisLocalToUtcIso(d),
      team_id:  resolvedTeamIds?.[0] ?? null,
      team_ids: resolvedTeamIds ?? null,
      notes,
      plan_type: planType,
      church_id,
    })))

  if (error) redirect(`/espace/admin/plans/nouveau?error=${encodeURIComponent(error.message)}`)
  redirect('/espace/admin/plans')
}

/** Crée un nouveau plan en copiant le titre, le type, l'équipe et les notes d'un plan existant,
 *  avec une nouvelle date. Redirige vers le nouveau plan. */
export async function duplicatePlanToDate(formData: FormData) {
  const { admin, church_id } = await requireAdmin()
  const fromPlanId  = formData.get('from_plan_id') as string
  const serviceDate = formData.get('service_date') as string

  const { data: source, error: srcError } = await admin
    .from('plans')
    .select('title, plan_type, team_id, team_ids, notes')
    .eq('id', fromPlanId)
    .single()

  if (srcError || !source) redirect('/espace/admin/plans?error=not_found')

  const { data, error } = await admin
    .from('plans')
    .insert({
      title:        source.title,
      plan_type:    source.plan_type,
      team_id:      source.team_id,
      team_ids:     (source as any).team_ids ?? null,
      notes:        source.notes,
      service_date: parisLocalToUtcIso(serviceDate),
      church_id,
    })
    .select('id')
    .single()

  if (error) redirect(`/espace/admin/plans?error=${encodeURIComponent(error.message)}`)
  redirect(`/espace/admin/plans/${data.id}`)
}

export async function deletePlan(formData: FormData) {
  const { admin } = await requireAdmin()
  const planId = formData.get('plan_id') as string
  await admin.from('plans').delete().eq('id', planId)
  redirect('/espace/admin/plans')
}

/** Déplace un service à une nouvelle date (glisser-déposer dans le calendrier). Appelé
 *  directement depuis le client (pas via <form>) — renvoie un résultat plutôt que de rediriger. */
export async function movePlan(
  planId: string,
  newServiceDate: string,
): Promise<{ ok: boolean; error?: string }> {
  const { admin } = await requireAdmin()
  const { error } = await admin.from('plans').update({ service_date: parisLocalToUtcIso(newServiceDate) }).eq('id', planId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/espace/admin/plans')
  return { ok: true }
}

/** Copie un service à une nouvelle date en dupliquant le plan (Ctrl+glisser). */
export async function copyPlan(
  planId: string,
  newServiceDate: string,
): Promise<{ ok: boolean; error?: string }> {
  const { admin } = await requireAdmin()
  const { data: original, error: fetchError } = await admin
    .from('plans')
    .select('title, plan_type, team_id, notes, church_id')
    .eq('id', planId)
    .single()
  if (fetchError || !original) return { ok: false, error: fetchError?.message ?? 'Plan introuvable.' }
  const { error } = await admin.from('plans').insert({
    title: original.title,
    service_date: parisLocalToUtcIso(newServiceDate),
    plan_type: original.plan_type,
    team_id: original.team_id,
    notes: original.notes,
    church_id: original.church_id,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/espace/admin/plans')
  return { ok: true }
}

export async function addAssignment(formData: FormData) {
  const { admin } = await requireAdmin()
  const planId = formData.get('plan_id') as string
  const userId = formData.get('user_id') as string
  const positionId = formData.get('position_id') as string || null
  const teamId = formData.get('team_id') as string || null
  const returnTo = (formData.get('return_to') as string) || `/espace/admin/plans/${planId}`

  if (!userId || userId === '') redirect(returnTo)

  if (userId === INVITE_EXT_ID) {
    const externalName = (formData.get('external_name') as string)?.trim() || null
    const externalEmail = (formData.get('external_email') as string)?.trim() || null
    await admin.from('plan_assignments').insert({
      plan_id: planId,
      user_id: userId,
      position_id: positionId,
      team_id: teamId,
      status: 'pending',
      external_name: externalName,
      external_email: externalEmail,
    })
  } else {
    await admin.from('plan_assignments').insert({
      plan_id: planId,
      user_id: userId,
      position_id: positionId,
      team_id: teamId,
      status: 'pending',
    })

    // Notification push si l'utilisateur a activé les notifs
    const [{ data: plan }, { data: position }] = await Promise.all([
      admin.from('plans').select('title, service_date').eq('id', planId).single(),
      positionId
        ? admin.from('positions').select('name').eq('id', positionId).single()
        : Promise.resolve({ data: null }),
    ])

    if (plan) {
      const date = new Date(plan.service_date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
      const role = (position as { name: string } | null)?.name ?? null
      await sendPushToUser(userId, {
        title: '📋 Tu as été planifié·e',
        body: role
          ? `${role} · ${date} — confirme ta présence !`
          : `${plan.title} · ${date} — confirme ta présence !`,
        url: '/espace/historique',
        tag: `assignment-${planId}`,
      })
    }
  }

  redirect(returnTo)
}

export async function removeAssignment(formData: FormData) {
  const { admin } = await requireAdmin()
  const assignmentId = formData.get('assignment_id') as string
  const planId = formData.get('plan_id') as string
  const returnTo = (formData.get('return_to') as string) || `/espace/admin/plans/${planId}`
  await admin.from('plan_assignments').delete().eq('id', assignmentId)
  redirect(returnTo)
}

/** Variante sans redirect, pour un appel direct depuis un composant client (mise à jour optimiste). */
export async function removeAssignmentAsync(
  assignmentId: string,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { admin } = await requireAdmin()
  const { error } = await admin.from('plan_assignments').delete().eq('id', assignmentId)
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
  const { admin } = await requireAdmin()

  const { error: deleteError } = await admin
    .from('plan_assignments')
    .delete()
    .eq('plan_id', planId)
    .eq('position_id', dmPositionId)
  if (deleteError) return { ok: false, error: deleteError.message }

  if (!sourcePositionId) {
    revalidatePath(`/espace/admin/plans/${planId}`)
    revalidatePath('/espace/admin/plans')
    return { ok: true }
  }

  const { data: sourceAssignment, error: fetchError } = await admin
    .from('plan_assignments')
    .select('user_id')
    .eq('plan_id', planId)
    .eq('position_id', sourcePositionId)
    .neq('user_id', INVITE_EXT_ID)
    .maybeSingle()

  if (fetchError) return { ok: false, error: fetchError.message }
  if (!sourceAssignment) return { ok: false, error: "Ce poste n'a personne d'affecté pour ce service." }

  const { error: insertError } = await admin.from('plan_assignments').insert({
    plan_id: planId,
    user_id: sourceAssignment.user_id,
    position_id: dmPositionId,
    team_id: teamId,
    status: 'pending',
  })
  if (insertError) return { ok: false, error: insertError.message }

  revalidatePath(`/espace/admin/plans/${planId}`)
  revalidatePath('/espace/admin/plans')
  return { ok: true }
}

/** Variante sans redirect de addAssignment, pour un appel direct depuis un composant client. */
export async function addAssignmentAsync(input: {
  planId: string
  userId: string
  positionId?: string | null
  teamId?: string | null
  externalName?: string | null
  externalEmail?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const { admin } = await requireAdmin()
  const { planId, userId, positionId = null, teamId = null, externalName = null, externalEmail = null } = input

  if (userId === INVITE_EXT_ID) {
    const { error } = await admin.from('plan_assignments').insert({
      plan_id: planId,
      user_id: userId,
      position_id: positionId,
      team_id: teamId,
      status: 'pending',
      external_name: externalName?.trim() || null,
      external_email: externalEmail?.trim() || null,
    })
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await admin.from('plan_assignments').insert({
      plan_id: planId,
      user_id: userId,
      position_id: positionId,
      team_id: teamId,
      status: 'pending',
    })
    if (error) return { ok: false, error: error.message }

    // La notification push est un bonus non-bloquant : l'affectation est déjà enregistrée
    // à ce stade, une erreur ici (VAPID, réseau...) ne doit jamais faire échouer l'action.
    try {
      const [{ data: plan }, { data: position }] = await Promise.all([
        admin.from('plans').select('title, service_date').eq('id', planId).single(),
        positionId
          ? admin.from('positions').select('name').eq('id', positionId).single()
          : Promise.resolve({ data: null }),
      ])

      if (plan) {
        const date = new Date(plan.service_date).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long',
        })
        const role = (position as { name: string } | null)?.name ?? null
        await sendPushToUser(userId, {
          title: '📋 Tu as été planifié·e',
          body: role
            ? `${role} · ${date} — confirme ta présence !`
            : `${plan.title} · ${date} — confirme ta présence !`,
          url: '/espace/historique',
          tag: `assignment-${planId}`,
        })
      }
    } catch (err) {
      console.error('[addAssignmentAsync] notification push échouée (non-bloquant):', err)
    }
  }

  revalidatePath(`/espace/admin/plans/${planId}`)
  revalidatePath('/espace/admin/plans')
  return { ok: true }
}

export async function sendSingleInvitation(formData: FormData) {
  const { admin } = await requireAdmin()
  const assignmentId = formData.get('assignment_id') as string
  const planId = formData.get('plan_id') as string
  const returnTo = (formData.get('return_to') as string) || `/espace/admin/plans/${planId}`

  const { data: a, error } = await admin
    .from('plan_assignments')
    .select('id, user_id, team_id, external_name, external_email, plans(title, service_date), positions(name), teams(name)')
    .eq('id', assignmentId)
    .single()

  if (error || !a) redirect(withParam(returnTo, 'error', 'Assignment+introuvable'))

  const plan = a.plans as any
  const position = a.positions as any
  const team = a.teams as any

  // Invité externe
  if (a.user_id === INVITE_EXT_ID) {
    if (!a.external_email) redirect(withParam(returnTo, 'error', 'Email+invité+manquant'))
    try {
      console.log('[sendSingleInvitation] external guest email to', a.external_email, 'plan:', plan.title)
      await sendExternalGuestInvitationEmail({
        to: a.external_email as string,
        guestName: a.external_name ?? 'Invité',
        planTitle: plan.title,
        serviceDate: plan.service_date,
        positionName: position?.name ?? null,
        teamName: team?.name ?? null,
        assignmentId,
      })
      console.log('[sendSingleInvitation] external guest email sent OK to', a.external_email)
      await admin.from('plan_assignments').update({ invitation_sent_at: new Date().toISOString() }).eq('id', assignmentId)
    } catch (err: any) {
      console.error('[sendSingleInvitation] Resend error (external):', err?.message, { email: a.external_email, assignmentId })
      redirect(withParam(returnTo, 'error', encodeURIComponent(err?.message ?? 'Erreur envoi email')))
    }
    redirect(withParam(returnTo, 'sent', '1'))
  }

  // Bénévole interne
  const [{ data: profile }, { data: authData }] = await Promise.all([
    admin.from('profiles').select('first_name').eq('id', a.user_id).single(),
    admin.auth.admin.getUserById(a.user_id),
  ])

  const email = authData?.user?.email

  console.log('[sendSingleInvitation] assignmentId:', assignmentId, 'userId:', a.user_id, 'email:', email ?? 'INTROUVABLE')

  if (!email || !plan || !profile) {
    console.error('[sendSingleInvitation] données manquantes', { email, plan: !!plan, profile: !!profile })
    redirect(withParam(returnTo, 'error', 'Données+manquantes'))
  }

  try {
    console.log('[sendSingleInvitation] sending plan email to', email, 'plan:', plan.title)
    await sendPlanAssignmentEmail({
      to: email,
      firstName: profile.first_name,
      planTitle: plan.title,
      serviceDate: plan.service_date,
      positionName: position?.name ?? null,
      teamName: team?.name ?? null,
      assignmentId,
    })
    console.log('[sendSingleInvitation] email sent OK to', email)
    await admin.from('plan_assignments').update({ invitation_sent_at: new Date().toISOString() }).eq('id', assignmentId)

    // Notification push en complément de l'email (non-bloquant)
    const dateStr = new Date(plan.service_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    sendPushToUser(a.user_id, {
      title: `📅 ${plan.title}`,
      body:  `Tu es planifié(e) le ${dateStr}${team?.name ? ` · ${team.name}` : ''}`,
      url:   '/espace/dashboard',
      tag:   `assignment-${assignmentId}`,
    }).catch(() => {})
  } catch (err: any) {
    console.error('[sendSingleInvitation] Resend error:', err?.message, { email, assignmentId })
    redirect(withParam(returnTo, 'error', encodeURIComponent(err?.message ?? 'Erreur envoi email')))
  }

  redirect(withParam(returnTo, 'sent', '1'))
}

export async function respondAssignment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const assignmentId = formData.get('assignment_id') as string
  const status = formData.get('status') as string

  await supabase
    .from('plan_assignments')
    .update({ status })
    .eq('id', assignmentId)
    .eq('user_id', user.id)

  await notifyTeamLeadersOfResponse(assignmentId, status)

  redirect('/espace/dashboard')
}

/** Variante sans redirect, pour un appel direct depuis un composant client (mise à jour optimiste).
 *  `planId` est optionnel : quand fourni, revalide aussi la page de détail du plan concerné. */
export async function respondAssignmentAsync(
  assignmentId: string,
  status: string,
  planId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non connecté' }

  const { error } = await supabase
    .from('plan_assignments')
    .update({ status })
    .eq('id', assignmentId)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  await notifyTeamLeadersOfResponse(assignmentId, status)

  revalidatePath('/espace/admin/plans')
  if (planId) revalidatePath(`/espace/admin/plans/${planId}`)
  return { ok: true }
}

export async function respondAssignmentOnHistorique(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const assignmentId = formData.get('assignment_id') as string
  const status = formData.get('status') as string

  await supabase
    .from('plan_assignments')
    .update({ status })
    .eq('id', assignmentId)
    .eq('user_id', user.id)

  await notifyTeamLeadersOfResponse(assignmentId, status)

  revalidatePath('/espace/historique')
  redirect('/espace/historique')
}

export async function cancelAssignment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const assignmentId = formData.get('assignment_id') as string

  // Récupère l'affectation + plan + poste + équipe
  const { data: assignment } = await supabase
    .from('plan_assignments')
    .select('id, user_id, plans(id, title, service_date), positions(name), teams(name)')
    .eq('id', assignmentId)
    .eq('user_id', user.id)
    .single()

  if (!assignment) redirect('/espace/dashboard')

  const plan = assignment.plans as unknown as { id: string; title: string; service_date: string } | null
  if (!plan || new Date(plan.service_date) <= new Date()) redirect('/espace/dashboard')

  // Met à jour le statut
  await supabase
    .from('plan_assignments')
    .update({ status: 'declined' })
    .eq('id', assignmentId)
    .eq('user_id', user.id)

  // Récupère le prénom/nom de l'utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single()

  const volunteerName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
  const position = assignment.positions as unknown as { name: string } | null
  const team = assignment.teams as unknown as { name: string } | null

  // Notifie les admins/éditeurs par email (via leur email dans profiles)
  const adminClient = createAdminClient()
  const { data: responsibles } = await adminClient
    .from('profiles')
    .select('email')
    .in('permission', ['admin', 'editor'])
    .not('email', 'is', null)

  console.log('[cancelAssignment] assignmentId:', assignmentId, 'volunteer:', volunteerName, 'plan:', plan.title)
  console.log('[cancelAssignment] notifying', responsibles?.length ?? 0, 'responsibles')

  for (const r of responsibles ?? []) {
    if (!r.email) continue
    try {
      await sendCancellationNotificationEmail({
        to: r.email,
        volunteerName,
        planTitle: plan.title,
        serviceDate: plan.service_date,
        positionName: position?.name ?? null,
        teamName: team?.name ?? null,
      })
      console.log('[cancelAssignment] notification sent to', r.email)
    } catch (err: any) {
      console.error('[cancelAssignment] Resend error for', r.email, ':', err?.message)
    }
  }

  redirect('/espace/dashboard')
}

// ── CHANTS DU PLAN ─────────────────────────────────────────────────────────

export async function addPlanSong(formData: FormData) {
  const { admin } = await requireAdmin()
  const planId     = formData.get('plan_id') as string
  const songId     = parseInt(formData.get('song_id') as string, 10)
  const arrId      = (formData.get('arrangement_id') as string) || null
  const keySelected = (formData.get('key_selected') as string) || null

  // Dernier order_index existant
  const { data: existing } = await admin
    .from('plan_songs')
    .select('order_index')
    .eq('plan_id', planId)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  const nextIndex = (existing?.order_index ?? -1) + 1

  // Toujours préférer un arrangement avec grille d'accords
  let finalArrId = arrId
  if (!finalArrId) {
    // Aucun arrangement spécifié → prendre le premier avec grille, sinon le premier dispo
    const { data: arrangements } = await admin
      .from('arrangements')
      .select('id, chord_chart')
      .eq('song_id', songId)
      .order('created_at')
    if (arrangements && arrangements.length > 0) {
      const withChart = arrangements.find(a => a.chord_chart)
      finalArrId = (withChart ?? arrangements[0]).id
    }
  } else {
    // Arrangement spécifié sans grille → vérifier s'il en existe un meilleur
    const { data: specifiedArr } = await admin
      .from('arrangements')
      .select('chord_chart')
      .eq('id', finalArrId)
      .single()
    if (!specifiedArr?.chord_chart) {
      const { data: better } = await admin
        .from('arrangements')
        .select('id')
        .eq('song_id', songId)
        .not('chord_chart', 'is', null)
        .order('created_at')
        .limit(1)
        .maybeSingle()
      if (better) finalArrId = better.id
    }
  }

  await admin.from('plan_songs').insert({
    plan_id:        planId,
    song_id:        songId,
    arrangement_id: finalArrId,
    key_selected:   keySelected,
    order_index:    nextIndex,
  })

  const { revalidatePath } = await import('next/cache')
  revalidatePath(`/espace/admin/plans/${planId}`)
}

export async function reorderPlanSongs(planId: string, orderedIds: string[]) {
  const { admin } = await requireAdmin()

  await Promise.all(
    orderedIds.map((id, index) =>
      admin.from('plan_songs').update({ order_index: index }).eq('id', id)
    )
  )

  revalidatePath(`/espace/admin/plans/${planId}`)
}

export async function removePlanSong(formData: FormData) {
  const { admin } = await requireAdmin()
  const planSongId = formData.get('plan_song_id') as string
  const planId     = formData.get('plan_id') as string

  await admin.from('plan_songs').delete().eq('id', planSongId)

  const { revalidatePath } = await import('next/cache')
  revalidatePath(`/espace/admin/plans/${planId}`)
}

export async function movePlanSong(formData: FormData) {
  const { admin } = await requireAdmin()
  const planSongId = formData.get('plan_song_id') as string
  const planId     = formData.get('plan_id') as string
  const direction  = formData.get('direction') as 'up' | 'down'

  const { data: songs } = await admin
    .from('plan_songs')
    .select('id, order_index')
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
    admin.from('plan_songs').update({ order_index: b.order_index }).eq('id', a.id),
    admin.from('plan_songs').update({ order_index: a.order_index }).eq('id', b.id),
  ])

  const { revalidatePath } = await import('next/cache')
  revalidatePath(`/espace/admin/plans/${planId}`)
}

/** Change l'arrangement sélectionné pour un chant dans un plan. */
export async function updatePlanSongArrangement(
  planSongId: string,
  arrangementId: string,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { admin } = await requireAdmin()
  const { error } = await admin
    .from('plan_songs')
    .update({ arrangement_id: arrangementId })
    .eq('id', planSongId)
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
  const { admin } = await requireAdmin()

  const { data: arr, error: fetchErr } = await admin
    .from('arrangements')
    .select('chord_chart')
    .eq('id', arrangementId)
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

  const { error: saveErr } = await admin
    .from('arrangements')
    .update({ chord_chart: updated })
    .eq('id', arrangementId)

  if (saveErr) return { ok: false, error: saveErr.message }

  revalidatePath(`/espace/admin/plans/${planId}/setlist`)
  return { ok: true }
}

// ── RECHERCHE DE CHANTS POUR LA PROJECTION ────────────────────────────────

export type SongSearchResult = {
  songId: number
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
  const { admin } = await requireAdmin()
  const q = query.trim()
  if (!q) return []

  // Recherche 1 : par titre
  const { data: byTitle } = await admin
    .from('songs')
    .select('id, title, arrangements(id, name, chord_chart, chord_chart_key)')
    .ilike('title', `%${q}%`)
    .order('title')
    .limit(8)

  // Recherche 2 : dans les paroles (chord_chart)
  const { data: byLyrics } = await admin
    .from('arrangements')
    .select('id, name, chord_chart, chord_chart_key, song_id, songs(id, title)')
    .ilike('chord_chart', `%${q}%`)
    .limit(8)

  const seen = new Set<number>()
  const results: SongSearchResult[] = []

  for (const s of (byTitle ?? [])) {
    seen.add(s.id)
    const arrs = s.arrangements as { id: string; name: string; chord_chart: string | null; chord_chart_key: string | null }[]
    results.push({
      songId: s.id,
      title: s.title,
      matchedInLyrics: false,
      arrangement: arrs.find(a => a.chord_chart) ?? arrs[0] ?? null,
    })
  }

  for (const arr of (byLyrics ?? [])) {
    const song = arr.songs as unknown as { id: number; title: string }
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
