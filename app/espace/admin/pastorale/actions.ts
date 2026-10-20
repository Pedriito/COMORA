'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')
  return { admin: createAdminClient(), userId: user.id }
}

// ── Sujets de prière ─────────────────────────────────────────────────────────

export async function addPrayerRequest(formData: FormData) {
  const { admin, userId } = await requireAdmin()
  const profileId  = (formData.get('profile_id') as string) || null
  const personName = (formData.get('person_name') as string)?.trim() || null
  const subject    = (formData.get('subject') as string).trim()
  const notes      = (formData.get('notes') as string)?.trim() || null

  if (!subject) return { ok: false, error: 'Le sujet est obligatoire.' }

  const { error } = await admin.from('prayer_requests').insert({
    profile_id: profileId, person_name: personName,
    subject, notes, status: 'active', created_by: userId,
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function resolvePrayerRequest(id: string) {
  const { admin } = await requireAdmin()
  await admin.from('prayer_requests')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/espace/admin/pastorale')
}

export async function deletePrayerRequest(id: string) {
  const { admin } = await requireAdmin()
  await admin.from('prayer_requests').delete().eq('id', id)
  revalidatePath('/espace/admin/pastorale')
}

// ── Notes pastorales ─────────────────────────────────────────────────────────

export async function addPastoralNote(formData: FormData) {
  const { admin, userId } = await requireAdmin()
  const profileId = (formData.get('profile_id') as string)
  const noteDate  = (formData.get('note_date') as string) || new Date().toISOString().split('T')[0]
  const type      = (formData.get('type') as string) || 'visit'
  const notes     = (formData.get('notes') as string).trim()

  if (!notes) return { ok: false, error: 'La note est obligatoire.' }

  const { error } = await admin.from('pastoral_notes').insert({
    profile_id: profileId, note_date: noteDate, type, notes, created_by: userId,
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function deletePastoralNote(id: string) {
  const { admin } = await requireAdmin()
  await admin.from('pastoral_notes').delete().eq('id', id)
}
