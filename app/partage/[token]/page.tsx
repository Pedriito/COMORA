import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SharedSetlist } from './SharedSetlist'

export default async function PartageSetlistPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // Retrouver le plan via le token public (pas d'auth requise)
  const { data: plan } = await supabase
    .from('plans')
    .select('id, title, service_date')
    .eq('share_token', token)
    .single()

  if (!plan) notFound()

  // Charger les chants du plan
  const { data: rawSongs } = await supabase
    .from('plan_songs')
    .select('id, order_index, key_selected, songs(id, title), arrangements(id, name, chord_chart, chord_chart_key)')
    .eq('plan_id', plan.id)
    .order('order_index')

  const songs = (rawSongs ?? []).map(ps => ({
    planSongId:  ps.id,
    orderIndex:  ps.order_index,
    keySelected: ps.key_selected,
    song:        (ps as any).songs as { id: number; title: string },
    arrangement: (ps as any).arrangements as {
      id: string; name: string
      chord_chart: string | null; chord_chart_key: string | null
    } | null,
  }))

  const dateStr = plan.service_date
    ? new Date(plan.service_date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return <SharedSetlist planTitle={plan.title} dateStr={dateStr} songs={songs} />
}
