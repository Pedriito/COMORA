'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminIfAllowed() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
    if (!['admin', 'editor', 'super_admin'].includes(me?.permission ?? '')) return null
    return createAdminClient()
  } catch { return null }
}

export async function addVideo(planId: string, title: string, url: string) {
  const admin = await getAdminIfAllowed()
  if (!admin) return null
  const { data: existing } = await admin
    .from('plan_videos')
    .select('order_index')
    .eq('plan_id', planId)
    .order('order_index', { ascending: false })
    .limit(1)
  const nextIndex = existing?.[0] ? existing[0].order_index + 1 : 0
  const { data } = await admin.from('plan_videos').insert({
    plan_id: planId, title: title.trim() || null, url, order_index: nextIndex,
  }).select().single()
  return data as { id: string; title: string | null; url: string; order_index: number } | null
}

export async function deleteVideo(id: string) {
  const admin = await getAdminIfAllowed()
  if (!admin) return
  await admin.from('plan_videos').delete().eq('id', id)
}
