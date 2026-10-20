'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidateTag } from 'next/cache'

// Pas de redirect() dans les server actions : un redirect depuis une action
// provoque une navigation et efface l'état React du composant client.
// On retourne null en cas d'erreur et le composant gère silencieusement.
async function getAdminIfAllowed() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
    if (!['admin', 'editor', 'super_admin'].includes(me?.permission ?? '')) return null
    return createAdminClient()
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNONCES RÉCURRENTES (globales, apparaissent sur tous les plans)
// ─────────────────────────────────────────────────────────────────────────────

export type RecurringAnnouncement = {
  id: string
  title: string | null
  body: string
  order_index: number
  image_url: string | null
  video_url: string | null
  active: boolean
}

export async function addRecurringAnnouncement(
  title: string, body: string,
  imageUrl: string | null = null, videoUrl: string | null = null
): Promise<RecurringAnnouncement | null> {
  const admin = await getAdminIfAllowed()
  if (!admin) return null
  const { data: existing } = await admin
    .from('recurring_announcements')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
  const nextIndex = existing?.[0] ? existing[0].order_index + 1 : 0
  const { data } = await admin.from('recurring_announcements').insert({
    title: title.trim() || null, body, order_index: nextIndex,
    image_url: imageUrl, video_url: videoUrl || null, active: true,
  }).select().single()
  revalidateTag('recurring-announcements', 'max')
  return data as RecurringAnnouncement | null
}

export async function updateRecurringAnnouncement(
  id: string, title: string, body: string,
  imageUrl: string | null = null, videoUrl: string | null = null
) {
  const admin = await getAdminIfAllowed()
  if (!admin) return
  await admin.from('recurring_announcements')
    .update({ title: title.trim() || null, body, image_url: imageUrl, video_url: videoUrl || null })
    .eq('id', id)
  revalidateTag('recurring-announcements', 'max')
}

export async function deleteRecurringAnnouncement(id: string) {
  const admin = await getAdminIfAllowed()
  if (!admin) return
  await admin.from('recurring_announcements').delete().eq('id', id)
  revalidateTag('recurring-announcements', 'max')
}

export async function moveRecurringAnnouncement(id: string, direction: 'up' | 'down') {
  const admin = await getAdminIfAllowed()
  if (!admin) return
  const { data: all } = await admin
    .from('recurring_announcements')
    .select('id, order_index')
    .order('order_index')
  if (!all || all.length < 2) return
  const idx = all.findIndex(a => a.id === id)
  if (idx === -1) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return
  const a = all[idx], b = all[swapIdx]
  await Promise.all([
    admin.from('recurring_announcements').update({ order_index: b.order_index }).eq('id', a.id),
    admin.from('recurring_announcements').update({ order_index: a.order_index }).eq('id', b.id),
  ])
  revalidateTag('recurring-announcements', 'max')
}

export async function uploadAnnouncementImage(formData: FormData): Promise<string | null> {
  const admin = await getAdminIfAllowed()
  if (!admin) return null
  const file = formData.get('file') as File | null
  if (!file) return null
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `announcements/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await admin.storage.from('media').upload(path, buffer, { contentType: file.type })
  if (error) return null
  const { data } = admin.storage.from('media').getPublicUrl(path)
  return data.publicUrl
}

export async function addAnnouncement(
  planId: string, title: string, body: string,
  imageUrl: string | null = null, videoUrl: string | null = null
) {
  const admin = await getAdminIfAllowed()
  if (!admin) return null
  const { data: existing } = await admin
    .from('plan_announcements')
    .select('order_index')
    .eq('plan_id', planId)
    .order('order_index', { ascending: false })
    .limit(1)
  const nextIndex = existing?.[0] ? existing[0].order_index + 1 : 0
  const { data } = await admin.from('plan_announcements').insert({
    plan_id: planId, title: title.trim() || null, body, order_index: nextIndex,
    image_url: imageUrl, video_url: videoUrl || null,
  }).select().single()
  return data as { id: string; title: string | null; body: string; order_index: number; image_url: string | null; video_url: string | null } | null
}

export async function updateAnnouncement(
  id: string, planId: string, title: string, body: string,
  imageUrl: string | null = null, videoUrl: string | null = null
) {
  const admin = await getAdminIfAllowed()
  if (!admin) return
  await admin.from('plan_announcements')
    .update({ title: title.trim() || null, body, image_url: imageUrl, video_url: videoUrl || null })
    .eq('id', id)
}

export async function deleteAnnouncement(id: string, planId: string) {
  const admin = await getAdminIfAllowed()
  if (!admin) return
  await admin.from('plan_announcements').delete().eq('id', id)
}

export async function moveAnnouncement(id: string, planId: string, direction: 'up' | 'down') {
  const admin = await getAdminIfAllowed()
  if (!admin) return
  const { data: all } = await admin
    .from('plan_announcements')
    .select('id, order_index')
    .eq('plan_id', planId)
    .order('order_index')
  if (!all || all.length < 2) return
  const idx = all.findIndex(a => a.id === id)
  if (idx === -1) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return
  const a = all[idx], b = all[swapIdx]
  await Promise.all([
    admin.from('plan_announcements').update({ order_index: b.order_index }).eq('id', a.id),
    admin.from('plan_announcements').update({ order_index: a.order_index }).eq('id', b.id),
  ])
}
