'use server'

import { churchOrNull } from '@/lib/auth/church'

export async function addVideo(planId: string, title: string, url: string) {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return null
  const churchId = ctx.church.churchId
  // Seules les adresses web sont acceptées (pas de javascript:, data:…)
  if (!/^https?:\/\//i.test(url.trim())) return null
  const { data: existing } = await ctx.supabase
    .from('plan_videos')
    .select('order_index')
    .eq('church_id', churchId)
    .eq('plan_id', planId)
    .order('order_index', { ascending: false })
    .limit(1)
  const nextIndex = existing?.[0] ? existing[0].order_index + 1 : 0
  const { data } = await ctx.supabase.from('plan_videos').insert({
    church_id: churchId, plan_id: planId, title: title.trim() || null, url: url.trim(), order_index: nextIndex,
  }).select('id, title, url, order_index').single()
  return data as { id: string; title: string | null; url: string; order_index: number } | null
}

export async function deleteVideo(id: string) {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return
  await ctx.supabase.from('plan_videos').delete().eq('id', id).eq('church_id', ctx.church.churchId)
}
