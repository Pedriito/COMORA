'use server'

import { requireChurch } from '@/lib/auth/church'
import { revalidatePath } from 'next/cache'

// Pastorale : rôle « pastoral » exigé partout, jamais l'administration seule.
// Client de session uniquement : la RLS pastorale est la garantie.
async function requirePastoral() {
  const ctx = await requireChurch('pastoral')
  return { db: ctx.supabase, churchId: ctx.church.churchId, userId: ctx.userId }
}

// ── Sujets de prière ─────────────────────────────────────────────────────────

export async function addPrayerRequest(formData: FormData) {
  const { db, churchId, userId } = await requirePastoral()
  const memberId   = (formData.get('member_id') as string) || null
  const personName = (formData.get('person_name') as string)?.trim() || null
  const subject    = (formData.get('subject') as string).trim()
  const notes      = (formData.get('notes') as string)?.trim() || null

  if (!subject) return { ok: false, error: 'Le sujet est obligatoire.' }

  const { error } = await db.from('prayer_requests').insert({
    church_id: churchId, member_id: memberId, person_name: personName,
    subject, notes, status: 'active', created_by: userId,
  })
  return error ? { ok: false, error: 'L’enregistrement a échoué. Réessaie.' } : { ok: true }
}

export async function resolvePrayerRequest(id: string) {
  const { db, churchId } = await requirePastoral()
  await db.from('prayer_requests')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('church_id', churchId).eq('id', id)
  revalidatePath('/espace/admin/pastorale')
}

export async function deletePrayerRequest(id: string) {
  const { db, churchId } = await requirePastoral()
  await db.from('prayer_requests').delete().eq('church_id', churchId).eq('id', id)
  revalidatePath('/espace/admin/pastorale')
}

// ── Notes pastorales ─────────────────────────────────────────────────────────

export async function addPastoralNote(formData: FormData) {
  const { db, churchId, userId } = await requirePastoral()
  const memberId  = (formData.get('member_id') as string)
  const noteDate  = (formData.get('note_date') as string) || new Date().toISOString().split('T')[0]
  const type      = (formData.get('type') as string) || 'visit'
  const notes     = (formData.get('notes') as string).trim()

  if (!notes) return { ok: false, error: 'La note est obligatoire.' }

  const { error } = await db.from('pastoral_notes').insert({
    church_id: churchId, member_id: memberId, note_date: noteDate, type, notes, created_by: userId,
  })
  return error ? { ok: false, error: 'L’enregistrement a échoué. Réessaie.' } : { ok: true }
}

export async function deletePastoralNote(id: string) {
  const { db, churchId } = await requirePastoral()
  await db.from('pastoral_notes').delete().eq('church_id', churchId).eq('id', id)
}
