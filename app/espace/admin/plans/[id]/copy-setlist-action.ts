'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function copySetlist(
  sourcePlanId: string,
  destPlanId: string
): Promise<{ ok: boolean; copied: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'editor', 'super_admin'].includes(me?.permission ?? '')) return { ok: false, copied: 0, error: 'Non autorisé' }

  const admin = createAdminClient()

  // Récupérer les chants source dans l'ordre
  const { data: sourceSongs, error: fetchErr } = await admin
    .from('plan_songs')
    .select('song_id, arrangement_id, key_selected, order_index')
    .eq('plan_id', sourcePlanId)
    .order('order_index')

  if (fetchErr) return { ok: false, copied: 0, error: fetchErr.message }
  if (!sourceSongs || sourceSongs.length === 0) return { ok: true, copied: 0 }

  // Dernier order_index dans le plan destination
  const { data: destExisting } = await admin
    .from('plan_songs')
    .select('order_index, song_id')
    .eq('plan_id', destPlanId)
    .order('order_index', { ascending: false })
    .limit(1)

  const existingSongIds = new Set(
    ((await admin.from('plan_songs').select('song_id').eq('plan_id', destPlanId)).data ?? [])
      .map(r => r.song_id)
  )

  const startIndex = (destExisting?.[0]?.order_index ?? -1) + 1

  // Insérer uniquement les chants pas encore présents dans le plan destination
  const toInsert = sourceSongs
    .filter(s => !existingSongIds.has(s.song_id))
    .map((s, i) => ({
      plan_id:        destPlanId,
      song_id:        s.song_id,
      arrangement_id: s.arrangement_id,
      key_selected:   s.key_selected,
      order_index:    startIndex + i,
    }))

  if (toInsert.length === 0) return { ok: true, copied: 0 }

  const { error: insertErr } = await admin.from('plan_songs').insert(toInsert)
  if (insertErr) return { ok: false, copied: 0, error: insertErr.message }

  return { ok: true, copied: toInsert.length }
}

export async function getOtherPlans(currentPlanId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('plans')
    .select('id, title, service_date')
    .neq('id', currentPlanId)
    .order('service_date', { ascending: false })
    .limit(30)

  return (data ?? []).map(p => ({
    id: p.id,
    title: p.title,
    date: new Date(p.service_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
  }))
}
