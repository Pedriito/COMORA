'use server'

import { revalidateTag } from 'next/cache'
import { churchOrNull, type ChurchContext } from '@/lib/auth/church'
import { PUBLIC_BUCKET, churchFilePath, extensionFor, isChurchPath } from '@/lib/storage'

// Pas de redirect() dans les server actions : un redirect depuis une action
// provoque une navigation et efface l'état React du composant client.
// On retourne null en cas d'erreur et le composant gère silencieusement.

/** Taille maximale d'une image d'annonce (celle du bucket) */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Supprime du stockage l'image d'une annonce, si elle appartient bien à l'église courante. */
async function removeOwnImage(ctx: ChurchContext, imageUrl: string | null | undefined) {
  if (!imageUrl) return
  const marker = `/${PUBLIC_BUCKET}/`
  const i = imageUrl.indexOf(marker)
  if (i === -1) return
  const path = decodeURIComponent(imageUrl.slice(i + marker.length).split('?')[0])
  if (!isChurchPath(ctx.church.churchId, path)) return
  await ctx.supabase.storage.from(PUBLIC_BUCKET).remove([path])
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNONCES RÉCURRENTES (propres à l'église, apparaissent sur tous ses plans)
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
  const ctx = await churchOrNull('responsable')
  if (!ctx) return null
  const churchId = ctx.church.churchId
  const { data: existing } = await ctx.supabase
    .from('recurring_announcements')
    .select('order_index')
    .eq('church_id', churchId)
    .order('order_index', { ascending: false })
    .limit(1)
  const nextIndex = existing?.[0] ? existing[0].order_index + 1 : 0
  const { data } = await ctx.supabase.from('recurring_announcements').insert({
    church_id: churchId,
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
  const ctx = await churchOrNull('responsable')
  if (!ctx) return
  await ctx.supabase.from('recurring_announcements')
    .update({ title: title.trim() || null, body, image_url: imageUrl, video_url: videoUrl || null })
    .eq('id', id)
    .eq('church_id', ctx.church.churchId)
  revalidateTag('recurring-announcements', 'max')
}

export async function deleteRecurringAnnouncement(id: string) {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return
  const churchId = ctx.church.churchId
  const { data: row } = await ctx.supabase
    .from('recurring_announcements').select('image_url').eq('id', id).eq('church_id', churchId).maybeSingle()
  await ctx.supabase.from('recurring_announcements').delete().eq('id', id).eq('church_id', churchId)
  await removeOwnImage(ctx, row?.image_url)
  revalidateTag('recurring-announcements', 'max')
}

export async function moveRecurringAnnouncement(id: string, direction: 'up' | 'down') {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return
  const churchId = ctx.church.churchId
  const { data: all } = await ctx.supabase
    .from('recurring_announcements')
    .select('id, order_index')
    .eq('church_id', churchId)
    .order('order_index')
  if (!all || all.length < 2) return
  const idx = all.findIndex(a => a.id === id)
  if (idx === -1) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return
  const a = all[idx], b = all[swapIdx]
  await Promise.all([
    ctx.supabase.from('recurring_announcements').update({ order_index: b.order_index }).eq('id', a.id).eq('church_id', churchId),
    ctx.supabase.from('recurring_announcements').update({ order_index: a.order_index }).eq('id', b.id).eq('church_id', churchId),
  ])
  revalidateTag('recurring-announcements', 'max')
}

/** Dépose une image d'annonce dans le dossier de l'église ; renvoie son URL publique. */
export async function uploadAnnouncementImage(formData: FormData): Promise<string | null> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return null
  const file = formData.get('file')
  if (!(file instanceof File)) return null
  // Le type vient de la liste autorisée, jamais du nom du fichier
  const ext = extensionFor('image', file.type)
  if (!ext || file.size === 0 || file.size > MAX_IMAGE_BYTES) return null
  const path = churchFilePath(ctx.church.churchId, 'announcements', ext)
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await ctx.supabase.storage.from(PUBLIC_BUCKET).upload(path, buffer, { contentType: file.type })
  if (error) return null
  return ctx.supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function addAnnouncement(
  planId: string, title: string, body: string,
  imageUrl: string | null = null, videoUrl: string | null = null
) {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return null
  const churchId = ctx.church.churchId
  const { data: existing } = await ctx.supabase
    .from('plan_announcements')
    .select('order_index')
    .eq('church_id', churchId)
    .eq('plan_id', planId)
    .order('order_index', { ascending: false })
    .limit(1)
  const nextIndex = existing?.[0] ? existing[0].order_index + 1 : 0
  const { data } = await ctx.supabase.from('plan_announcements').insert({
    church_id: churchId,
    plan_id: planId, title: title.trim() || null, body, order_index: nextIndex,
    image_url: imageUrl, video_url: videoUrl || null,
  }).select().single()
  return data as { id: string; title: string | null; body: string; order_index: number; image_url: string | null; video_url: string | null } | null
}

export async function updateAnnouncement(
  id: string, planId: string, title: string, body: string,
  imageUrl: string | null = null, videoUrl: string | null = null
) {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return
  await ctx.supabase.from('plan_announcements')
    .update({ title: title.trim() || null, body, image_url: imageUrl, video_url: videoUrl || null })
    .eq('id', id)
    .eq('plan_id', planId)
    .eq('church_id', ctx.church.churchId)
}

export async function deleteAnnouncement(id: string, planId: string) {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return
  const churchId = ctx.church.churchId
  const { data: row } = await ctx.supabase
    .from('plan_announcements').select('image_url').eq('id', id).eq('church_id', churchId).maybeSingle()
  await ctx.supabase.from('plan_announcements').delete().eq('id', id).eq('plan_id', planId).eq('church_id', churchId)
  await removeOwnImage(ctx, row?.image_url)
}

export async function moveAnnouncement(id: string, planId: string, direction: 'up' | 'down') {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return
  const churchId = ctx.church.churchId
  const { data: all } = await ctx.supabase
    .from('plan_announcements')
    .select('id, order_index')
    .eq('church_id', churchId)
    .eq('plan_id', planId)
    .order('order_index')
  if (!all || all.length < 2) return
  const idx = all.findIndex(a => a.id === id)
  if (idx === -1) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return
  const a = all[idx], b = all[swapIdx]
  await Promise.all([
    ctx.supabase.from('plan_announcements').update({ order_index: b.order_index }).eq('id', a.id).eq('church_id', churchId),
    ctx.supabase.from('plan_announcements').update({ order_index: a.order_index }).eq('id', b.id).eq('church_id', churchId),
  ])
}
