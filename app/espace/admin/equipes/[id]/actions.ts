'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { churchOrNull, requireChurch, type ChurchContext } from '@/lib/auth/church'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { frequencyLabels, roleLabels } from '@/lib/labels'

function pick(value: FormDataEntryValue | null, allowed: Record<string, unknown>): string | null {
  const v = typeof value === 'string' ? value.trim() : ''
  return v && Object.prototype.hasOwnProperty.call(allowed, v) ? v : null
}

/**
 * Peut modifier l'équipe : coordinateur (ou admin) de l'église, ou responsable
 * de cette équipe. Renvoie le client à utiliser pour l'écriture, ou null.
 */
async function teamWriter(ctx: ChurchContext, teamId: string) {
  if (!teamId) return null
  const { data: team } = await ctx.supabase
    .from('teams')
    .select('id')
    .eq('church_id', ctx.church.churchId)
    .eq('id', teamId)
    .maybeSingle()
  if (!team) return null

  if (ctx.church.role === 'admin' || ctx.church.role === 'responsable') return ctx.supabase

  if (!ctx.memberId) return null
  const { data: me } = await ctx.supabase
    .from('team_members')
    .select('role')
    .eq('church_id', ctx.church.churchId)
    .eq('team_id', teamId)
    .eq('member_id', ctx.memberId)
    .maybeSingle()
  if (me?.role !== 'leader') return null

  // Clé secrète : la RLS ne donne l'écriture qu'aux coordinateurs ; un responsable
  // d'équipe vérifié ci-dessus agit sur cette équipe seulement, ids relus par la session.
  return createAdminClient()
}

/** Personne de l'église courante (relue avec la session). */
async function memberOfChurch(ctx: ChurchContext, memberId: string) {
  if (!memberId) return null
  const { data } = await ctx.supabase
    .from('members')
    .select('id')
    .eq('church_id', ctx.church.churchId)
    .eq('id', memberId)
    .maybeSingle()
  return data
}

export async function addTeamMember(_prevState: { error?: string } | null, formData: FormData) {
  const ctx = await churchOrNull('membre')
  if (!ctx) return { error: 'Accès refusé.' }
  const teamId = formData.get('team_id') as string
  const db = await teamWriter(ctx, teamId)
  if (!db) return { error: 'Accès refusé.' }

  const member = await memberOfChurch(ctx, formData.get('member_id') as string)
  if (!member) return { error: 'Personne introuvable.' }
  const role = pick(formData.get('role'), roleLabels) ?? 'member'
  const frequency = pick(formData.get('frequency'), frequencyLabels)

  const { error } = await db
    .from('team_members')
    .upsert(
      { church_id: ctx.church.churchId, member_id: member.id, team_id: teamId, role, frequency },
      { onConflict: 'member_id,team_id' }
    )
  if (error) return { error: 'L’ajout n’a pas pu être enregistré. Réessaie.' }

  revalidatePath(`/espace/admin/equipes/${teamId}`)
  revalidateTag('team-members', 'max')
  return null
}

export async function removeTeamMember(formData: FormData) {
  const ctx = await requireChurch('membre')
  const teamId = formData.get('team_id') as string
  const db = await teamWriter(ctx, teamId)
  if (!db) redirect('/espace/dashboard')
  const churchId = ctx.church.churchId
  const memberId = formData.get('member_id') as string

  await db.from('team_members').delete().eq('church_id', churchId).eq('member_id', memberId).eq('team_id', teamId)

  const { data: positions } = await ctx.supabase
    .from('positions')
    .select('id')
    .eq('church_id', churchId)
    .eq('team_id', teamId)
  if (positions?.length) {
    await db
      .from('member_positions')
      .delete()
      .eq('church_id', churchId)
      .eq('member_id', memberId)
      .in('position_id', positions.map(p => p.id))
    revalidateTag('member-positions', 'max')
  }
  revalidatePath(`/espace/admin/equipes/${teamId}`)
  revalidateTag('team-members', 'max')
}

/** Rôle dans l'équipe : réservé aux coordinateurs et administrateurs. */
export async function updateMemberRole(formData: FormData) {
  const ctx = await requireChurch('responsable')
  const teamId = formData.get('team_id') as string
  const role = pick(formData.get('role'), roleLabels)
  if (!role) return

  await ctx.supabase
    .from('team_members')
    .update({ role })
    .eq('church_id', ctx.church.churchId)
    .eq('member_id', formData.get('member_id') as string)
    .eq('team_id', teamId)

  revalidatePath(`/espace/admin/equipes/${teamId}`)
  revalidateTag('team-members', 'max')
}

export async function toggleMemberPosition(formData: FormData) {
  const ctx = await requireChurch('membre')
  const teamId = formData.get('team_id') as string
  const db = await teamWriter(ctx, teamId)
  if (!db) redirect('/espace/dashboard')
  const churchId = ctx.church.churchId
  const action = formData.get('action') as string

  // Le poste et la personne doivent appartenir à cette équipe de l'église courante
  const [{ data: position }, { data: membership }] = await Promise.all([
    ctx.supabase
      .from('positions')
      .select('id')
      .eq('church_id', churchId)
      .eq('team_id', teamId)
      .eq('id', formData.get('position_id') as string)
      .maybeSingle(),
    ctx.supabase
      .from('team_members')
      .select('member_id')
      .eq('church_id', churchId)
      .eq('team_id', teamId)
      .eq('member_id', formData.get('member_id') as string)
      .maybeSingle(),
  ])
  if (!position || !membership) return

  if (action === 'add') {
    await db
      .from('member_positions')
      .upsert(
        { church_id: churchId, member_id: membership.member_id, position_id: position.id },
        { onConflict: 'member_id,position_id' }
      )
  } else {
    await db
      .from('member_positions')
      .delete()
      .eq('church_id', churchId)
      .eq('member_id', membership.member_id)
      .eq('position_id', position.id)
  }
  revalidatePath(`/espace/admin/equipes/${teamId}`)
  revalidateTag('member-positions', 'max')
}
