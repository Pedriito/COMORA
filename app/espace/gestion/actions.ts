'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  return { supabase, userId: user.id }
}

// ── TÂCHES ────────────────────────────────────────────────────────────────────

export async function createTask(formData: FormData) {
  const { supabase, userId } = await getUser()
  const title = (formData.get('title') as string)?.trim()
  const teamId = formData.get('team_id') as string
  const assignedTo = (formData.get('assigned_to') as string) || null
  const dueDate = (formData.get('due_date') as string) || null

  if (!title || !teamId) return

  await supabase.from('tasks').insert({
    title,
    team_id: teamId,
    assigned_to: assignedTo || null,
    due_date: dueDate || null,
    created_by: userId,
  })

  revalidatePath(`/espace/gestion/${teamId}`)
}

export async function toggleTask(formData: FormData) {
  const { supabase } = await getUser()
  const taskId = formData.get('task_id') as string
  const teamId = formData.get('team_id') as string
  const currentStatus = formData.get('current_status') as string

  await supabase
    .from('tasks')
    .update({ status: currentStatus === 'done' ? 'todo' : 'done' })
    .eq('id', taskId)

  revalidatePath(`/espace/gestion/${teamId}`)
}

export async function deleteTask(formData: FormData) {
  const { supabase } = await getUser()
  const taskId = formData.get('task_id') as string
  const teamId = formData.get('team_id') as string

  await supabase.from('tasks').delete().eq('id', taskId)

  revalidatePath(`/espace/gestion/${teamId}`)
}

// ── DÉCISIONS ─────────────────────────────────────────────────────────────────

export async function createDecision(formData: FormData) {
  const { supabase, userId } = await getUser()
  const title = (formData.get('title') as string)?.trim()
  const context = (formData.get('context') as string)?.trim() || null
  const teamId = formData.get('team_id') as string

  if (!title || !teamId) return

  await supabase.from('decisions').insert({
    title,
    context: context || null,
    team_id: teamId,
    created_by: userId,
  })

  revalidatePath(`/espace/gestion/${teamId}`)
}

export async function resolveDecision(formData: FormData) {
  const { supabase, userId } = await getUser()
  const decisionId = formData.get('decision_id') as string
  const teamId = formData.get('team_id') as string
  const decisionNote = (formData.get('decision_note') as string)?.trim() || null
  const status = (formData.get('status') as string) || 'decided'

  await supabase
    .from('decisions')
    .update({
      status,
      decision_note: decisionNote,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', decisionId)

  revalidatePath(`/espace/gestion/${teamId}`)
}

export async function deleteDecision(formData: FormData) {
  const { supabase } = await getUser()
  const decisionId = formData.get('decision_id') as string
  const teamId = formData.get('team_id') as string | null

  await supabase.from('decisions').delete().eq('id', decisionId)

  if (teamId) revalidatePath(`/espace/gestion/${teamId}`)
  revalidatePath('/espace/gestion')
}

export async function assignDecision(formData: FormData) {
  const { supabase } = await getUser()
  const decisionId = formData.get('decision_id') as string
  const teamId = formData.get('team_id') as string

  await supabase
    .from('decisions')
    .update({ team_id: teamId })
    .eq('id', decisionId)

  revalidatePath('/espace/gestion')
}
