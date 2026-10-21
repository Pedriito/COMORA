'use server'

import { requireChurch, type ChurchContext } from '@/lib/auth/church'
import { revalidatePath } from 'next/cache'

// Client de session : la RLS limite un membre aux équipes dont il fait partie ;
// chaque requête filtre en plus par l'église courante.
async function getCtx(required: 'membre' | 'responsable' = 'membre') {
  const ctx = await requireChurch(required)
  return { ctx, supabase: ctx.supabase, userId: ctx.userId, churchId: ctx.church.churchId }
}

/** L'équipe existe-t-elle dans l'église courante (et est-elle visible par ce compte) ? */
async function teamExists(ctx: ChurchContext, teamId: string) {
  if (!teamId) return false
  const { data } = await ctx.supabase.from('teams').select('id').eq('church_id', ctx.church.churchId).eq('id', teamId).maybeSingle()
  return !!data
}

// ── TÂCHES ────────────────────────────────────────────────────────────────────

export async function createTask(formData: FormData) {
  const { ctx, supabase, userId, churchId } = await getCtx()
  const title = (formData.get('title') as string)?.trim()
  const teamId = formData.get('team_id') as string
  const assignedTo = (formData.get('assigned_to') as string) || null
  const dueDate = (formData.get('due_date') as string) || null

  if (!title || !teamId || !(await teamExists(ctx, teamId))) return

  // Le bénévole désigné doit être une personne de l'église
  let assignee: string | null = null
  if (assignedTo) {
    const { data } = await supabase.from('members').select('id').eq('church_id', churchId).eq('id', assignedTo).maybeSingle()
    assignee = data?.id ?? null
  }

  await supabase.from('tasks').insert({
    church_id: churchId,
    title,
    team_id: teamId,
    assigned_to: assignee,
    due_date: dueDate || null,
    created_by: userId,
  })

  revalidatePath(`/espace/gestion/${teamId}`)
}

export async function toggleTask(formData: FormData) {
  const { supabase, churchId } = await getCtx()
  const taskId = formData.get('task_id') as string
  const teamId = formData.get('team_id') as string
  const currentStatus = formData.get('current_status') as string

  await supabase
    .from('tasks')
    .update({ status: currentStatus === 'done' ? 'todo' : 'done' })
    .eq('church_id', churchId)
    .eq('id', taskId)

  revalidatePath(`/espace/gestion/${teamId}`)
}

export async function deleteTask(formData: FormData) {
  const { supabase, churchId } = await getCtx()
  const taskId = formData.get('task_id') as string
  const teamId = formData.get('team_id') as string

  await supabase.from('tasks').delete().eq('church_id', churchId).eq('id', taskId)

  revalidatePath(`/espace/gestion/${teamId}`)
}

// ── DÉCISIONS ─────────────────────────────────────────────────────────────────

export async function createDecision(formData: FormData) {
  const { ctx, supabase, userId, churchId } = await getCtx()
  const title = (formData.get('title') as string)?.trim()
  const context = (formData.get('context') as string)?.trim() || null
  const teamId = formData.get('team_id') as string

  if (!title || !teamId || !(await teamExists(ctx, teamId))) return

  await supabase.from('decisions').insert({
    church_id: churchId,
    title,
    context: context || null,
    team_id: teamId,
    created_by: userId,
  })

  revalidatePath(`/espace/gestion/${teamId}`)
}

export async function resolveDecision(formData: FormData) {
  const { supabase, userId, churchId } = await getCtx()
  const decisionId = formData.get('decision_id') as string
  const teamId = formData.get('team_id') as string
  const decisionNote = (formData.get('decision_note') as string)?.trim() || null
  const status = formData.get('status') === 'rejected' ? 'rejected' : 'decided'

  await supabase
    .from('decisions')
    .update({
      status,
      decision_note: decisionNote,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq('church_id', churchId)
    .eq('id', decisionId)

  revalidatePath(`/espace/gestion/${teamId}`)
}

export async function deleteDecision(formData: FormData) {
  const { supabase, churchId } = await getCtx()
  const decisionId = formData.get('decision_id') as string
  const teamId = formData.get('team_id') as string | null

  await supabase.from('decisions').delete().eq('church_id', churchId).eq('id', decisionId)

  if (teamId) revalidatePath(`/espace/gestion/${teamId}`)
  revalidatePath('/espace/gestion')
}

export async function assignDecision(formData: FormData) {
  const { ctx, supabase, churchId } = await getCtx('responsable')
  const decisionId = formData.get('decision_id') as string
  const teamId = formData.get('team_id') as string

  if (!(await teamExists(ctx, teamId))) return

  await supabase
    .from('decisions')
    .update({ team_id: teamId })
    .eq('church_id', churchId)
    .eq('id', decisionId)

  revalidatePath('/espace/gestion')
}
