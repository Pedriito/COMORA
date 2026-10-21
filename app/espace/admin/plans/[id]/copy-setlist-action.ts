'use server'

import { churchOrNull } from '@/lib/auth/church'

export async function copySetlist(
  sourcePlanId: string,
  destPlanId: string
): Promise<{ ok: boolean; copied: number; error?: string }> {
  const ctx = await churchOrNull('responsable')
  if (!ctx) return { ok: false, copied: 0, error: 'Non autorisé' }
  const { supabase } = ctx
  const churchId = ctx.church.churchId

  // Récupérer les chants source dans l'ordre
  const { data: sourceSongs, error: fetchErr } = await supabase
    .from('plan_songs')
    .select('song_id, arrangement_id, key_selected, order_index')
    .eq('church_id', churchId)
    .eq('plan_id', sourcePlanId)
    .order('order_index')

  if (fetchErr) return { ok: false, copied: 0, error: fetchErr.message }
  if (!sourceSongs || sourceSongs.length === 0) return { ok: true, copied: 0 }

  // Chants déjà présents dans le plan destination (et dernier order_index)
  const { data: destSongs } = await supabase
    .from('plan_songs')
    .select('song_id, order_index')
    .eq('church_id', churchId)
    .eq('plan_id', destPlanId)

  const existingSongIds = new Set((destSongs ?? []).map(r => r.song_id))
  const startIndex = Math.max(-1, ...(destSongs ?? []).map(r => r.order_index)) + 1

  // Insérer uniquement les chants pas encore présents dans le plan destination
  const toInsert = sourceSongs
    .filter(s => !existingSongIds.has(s.song_id))
    .map((s, i) => ({
      church_id:      churchId,
      plan_id:        destPlanId,
      song_id:        s.song_id,
      arrangement_id: s.arrangement_id,
      key_selected:   s.key_selected,
      order_index:    startIndex + i,
    }))

  if (toInsert.length === 0) return { ok: true, copied: 0 }

  const { error: insertErr } = await supabase.from('plan_songs').insert(toInsert)
  if (insertErr) return { ok: false, copied: 0, error: insertErr.message }

  return { ok: true, copied: toInsert.length }
}

export async function getOtherPlans(currentPlanId: string) {
  const ctx = await churchOrNull('membre')
  if (!ctx) return []

  const { data: church } = await ctx.supabase.from('churches').select('timezone').eq('id', ctx.church.churchId).maybeSingle()
  const { data } = await ctx.supabase
    .from('plans')
    .select('id, title, service_date')
    .eq('church_id', ctx.church.churchId)
    .neq('id', currentPlanId)
    .order('service_date', { ascending: false })
    .limit(30)

  return (data ?? []).map(p => ({
    id: p.id,
    title: p.title,
    date: new Date(p.service_date).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: church?.timezone ?? 'Europe/Paris',
    }),
  }))
}
