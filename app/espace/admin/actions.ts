'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { churchOrNull, requireChurch, type ChurchContext, type ChurchRole } from '@/lib/auth/church'
import { redirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import { sendInviteEmail } from '@/lib/email/espace'
import { frequencyLabels, roleLabels, statusLabels } from '@/lib/labels'
import { activationUrl, createActivation, findOrCreateAccount, isEmail } from '../activer/activation'

/** Rôles d'église proposés (liste fermée). */
const CHURCH_ROLES: readonly ChurchRole[] = ['admin', 'responsable', 'membre']

function churchRole(value: FormDataEntryValue | null): ChurchRole | null {
  return CHURCH_ROLES.includes(value as ChurchRole) ? (value as ChurchRole) : null
}

function pick(value: FormDataEntryValue | null, allowed: Record<string, unknown>): string | null {
  const v = typeof value === 'string' ? value.trim() : ''
  return v && Object.prototype.hasOwnProperty.call(allowed, v) ? v : null
}

function text(formData: FormData, name: string): string {
  return ((formData.get(name) as string | null) ?? '').trim()
}

/** La base refuse de retirer le dernier administrateur d'une église. */
function isLastAdminError(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === '23514' || /administrateur/i.test(error.message ?? ''))
}

/** Personne de l'église courante (relue avec la session : la RLS et le filtre d'église font foi). */
async function findMember(ctx: ChurchContext, memberId: string) {
  if (!memberId) return null
  const { data } = await ctx.supabase
    .from('members')
    .select('id, user_id, first_name, last_name, status')
    .eq('church_id', ctx.church.churchId)
    .eq('id', memberId)
    .maybeSingle()
  return data
}

/** Crée le lien d'activation et envoie l'e-mail d'invitation. */
async function sendActivation(churchId: string, userId: string, email: string, firstName: string): Promise<boolean> {
  const token = await createActivation(createAdminClient(), churchId, userId)
  if (!token) return false
  try {
    await sendInviteEmail({ to: email, firstName, inviteLink: activationUrl(token) })
    return true
  } catch {
    console.error('[invitation] envoi de l’e-mail impossible')
    return false
  }
}

/** E-mail de connexion d'une personne qui a un compte (API d'administration Auth). */
async function accountEmail(userId: string): Promise<string | null> {
  // Clé secrète : lecture de l'adresse du compte Auth (le compte est relu par la session avant)
  const { data } = await createAdminClient().auth.admin.getUserById(userId)
  return data?.user?.email ?? null
}

export async function inviteBenevole(formData: FormData) {
  const ctx = await requireChurch('admin')
  const churchId = ctx.church.churchId

  const firstName = text(formData, 'first_name')
  const lastName  = text(formData, 'last_name')
  const email     = text(formData, 'email').toLowerCase()
  const role      = churchRole(formData.get('role')) ?? 'membre'
  const teamIds   = (formData.getAll('team_ids') as string[]).filter(Boolean)

  if (!firstName || !isEmail(email)) redirect('/espace/admin/inviter?error=invalid')

  // Clé secrète : création (ou recherche) du compte Auth, sans modifier un compte existant
  const account = await findOrCreateAccount(createAdminClient(), { email, firstName, lastName })
  if (!account) redirect('/espace/admin/inviter?error=failed')
  const userId = account.userId

  const { data: existingMembership } = await ctx.supabase
    .from('church_memberships')
    .select('id')
    .eq('church_id', churchId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existingMembership) redirect('/espace/admin/inviter?error=already_member')

  // Personne déjà connue de l'église (sans compte) avec cette adresse : on la relie au compte
  const { data: known } = await ctx.supabase
    .from('member_contacts')
    .select('member_id, members!inner(id, user_id)')
    .eq('church_id', churchId)
    .eq('email', email)
    .is('members.user_id', null)
    .limit(1)
    .maybeSingle()

  let memberId: string
  if (known) {
    memberId = known.member_id
    const { error } = await ctx.supabase
      .from('members')
      .update({ user_id: userId, status: 'invited' })
      .eq('church_id', churchId)
      .eq('id', memberId)
    if (error) redirect('/espace/admin/inviter?error=failed')
  } else {
    const { data: member, error } = await ctx.supabase
      .from('members')
      .insert({ church_id: churchId, user_id: userId, first_name: firstName, last_name: lastName, status: 'invited' })
      .select('id')
      .single()
    if (error || !member) redirect('/espace/admin/inviter?error=failed')
    memberId = member.id
    await ctx.supabase.from('member_contacts').insert({ member_id: memberId, church_id: churchId, email })
  }

  const { error: membershipError } = await ctx.supabase
    .from('church_memberships')
    .insert({ church_id: churchId, user_id: userId, role, status: 'invited' })
  if (membershipError) redirect('/espace/admin/inviter?error=failed')

  revalidateTag('profiles', 'max')

  if (teamIds.length > 0) {
    // Seules les équipes de l'église courante sont retenues
    const { data: teams } = await ctx.supabase
      .from('teams')
      .select('id')
      .eq('church_id', churchId)
      .in('id', teamIds)
    if (teams && teams.length > 0) {
      await ctx.supabase.from('team_members').insert(
        teams.map(t => ({
          church_id: churchId,
          member_id: memberId,
          team_id: t.id,
          role: pick(formData.get(`role_${t.id}`), roleLabels) ?? 'member',
          frequency: pick(formData.get(`frequency_${t.id}`), frequencyLabels),
        }))
      )
      revalidateTag('team-members', 'max')
    }
  }

  const sent = await sendActivation(churchId, userId, email, firstName)
  redirect(sent ? '/espace/admin?success=invited' : '/espace/admin?error=email_failed')
}

/** Renvoie l'invitation d'une personne qui a un compte dans l'église. Renvoie un message d'erreur, ou null. */
async function resend(ctx: ChurchContext, memberId: string): Promise<string | null> {
  const member = await findMember(ctx, memberId)
  if (!member?.user_id) return 'Cette personne n’a pas de compte.'

  const { data: membership } = await ctx.supabase
    .from('church_memberships')
    .select('status')
    .eq('church_id', ctx.church.churchId)
    .eq('user_id', member.user_id)
    .maybeSingle()
  if (!membership || membership.status === 'inactive') return 'Cette personne n’a pas accès à l’espace.'

  const email = await accountEmail(member.user_id)
  if (!email) return 'Adresse e-mail introuvable.'

  const sent = await sendActivation(ctx.church.churchId, member.user_id, email, member.first_name)
  return sent ? null : 'L’e-mail n’a pas pu être envoyé. Réessaie plus tard.'
}

export async function resendInviteFromList(_: unknown, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const ctx = await churchOrNull('admin')
  if (!ctx) return { ok: false, error: 'Accès refusé' }
  const error = await resend(ctx, formData.get('member_id') as string)
  return error ? { ok: false, error } : { ok: true }
}

export async function resendInvite(formData: FormData) {
  const ctx = await requireChurch('admin')
  const memberId = formData.get('member_id') as string
  const error = await resend(ctx, memberId)
  redirect(`/espace/admin/benevoles/${encodeURIComponent(memberId)}?${error ? 'error=resend' : 'sent=1'}`)
}

export async function updateBenevoleAdmin(formData: FormData) {
  const ctx = await requireChurch('responsable')
  const churchId = ctx.church.churchId
  const isAdmin = ctx.church.role === 'admin'

  const memberId = formData.get('member_id') as string
  const member = await findMember(ctx, memberId)
  if (!member) redirect('/espace/admin')

  const editUrl = `/espace/admin/benevoles/${member.id}/modifier`
  const firstName = text(formData, 'first_name')
  const lastName  = text(formData, 'last_name')
  const email     = text(formData, 'email').toLowerCase() || null
  const phone     = text(formData, 'phone') || null
  const city      = text(formData, 'city') || null
  const birthdate = /^\d{4}-\d{2}-\d{2}$/.test(text(formData, 'birthdate')) ? text(formData, 'birthdate') : null

  if (!firstName || (email && !isEmail(email))) redirect(`${editUrl}?error=invalid`)

  // Statut et accès : réservés aux administrateurs
  const status = isAdmin ? pick(formData.get('status'), statusLabels) : null

  const { error: memberError } = await ctx.supabase
    .from('members')
    .update({ first_name: firstName, last_name: lastName, ...(status ? { status } : {}) })
    .eq('church_id', churchId)
    .eq('id', member.id)
  if (memberError) redirect(`${editUrl}?error=failed`)

  const { error: contactError } = await ctx.supabase
    .from('member_contacts')
    .upsert(
      { member_id: member.id, church_id: churchId, email, phone, city, birthdate, updated_at: new Date().toISOString() },
      { onConflict: 'member_id' }
    )
  if (contactError) redirect(`${editUrl}?error=failed`)

  if (isAdmin && member.user_id) {
    const role = churchRole(formData.get('role'))
    const isPastoral = formData.get('is_pastoral') === 'on'
    if (role) {
      const { error } = await ctx.supabase
        .from('church_memberships')
        .update({
          role,
          is_pastoral: isPastoral,
          // Le statut du compte suit celui de la personne (invité tant qu'il n'a pas activé)
          ...(status === 'inactive' ? { status: 'inactive' } : status === 'active' ? { status: 'active' } : {}),
        })
        .eq('church_id', churchId)
        .eq('user_id', member.user_id)
      if (isLastAdminError(error)) redirect(`${editUrl}?error=last_admin`)
      if (error) redirect(`${editUrl}?error=failed`)
    }
  }

  revalidateTag('profiles', 'max')
  redirect(`/espace/admin/benevoles/${member.id}?updated=1`)
}

/** Retire une personne de l'église (son compte, s'il existe, est conservé pour ses autres églises). */
export async function deleteBenevole(formData: FormData) {
  const ctx = await requireChurch('admin')
  const churchId = ctx.church.churchId

  const member = await findMember(ctx, formData.get('member_id') as string)
  if (!member) redirect('/espace/admin')
  if (member.user_id === ctx.userId) redirect('/espace/admin?error=self')

  if (member.user_id) {
    const { error } = await ctx.supabase
      .from('church_memberships')
      .delete()
      .eq('church_id', churchId)
      .eq('user_id', member.user_id)
    if (isLastAdminError(error)) redirect('/espace/admin?error=last_admin')
    if (error) redirect('/espace/admin?error=failed')

    // Clé secrète : account_activations n'a aucune policy ; liens de cette église seulement
    await createAdminClient()
      .from('account_activations')
      .delete()
      .eq('church_id', churchId)
      .eq('user_id', member.user_id)
      .is('used_at', null)
  }

  const { error } = await ctx.supabase.from('members').delete().eq('church_id', churchId).eq('id', member.id)
  if (error) redirect('/espace/admin?error=failed')

  revalidateTag('profiles', 'max')
  revalidateTag('team-members', 'max')
  revalidateTag('member-positions', 'max')

  redirect('/espace/admin')
}
