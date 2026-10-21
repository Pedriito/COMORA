import { requireChurch } from '@/lib/auth/church'
import { notFound } from 'next/navigation'
import { ProjectorScreen } from './ProjectorScreen'
import { loadProjectionSettings } from '@/lib/projectionSettings'
import type { SlideStyle } from '@/lib/slidePresets'

export default async function ProjectorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, church } = await requireChurch('membre')

  const [{ data: plan }, { data: rawSongs }, settings] = await Promise.all([
    supabase.from('plans').select('id').eq('id', id).eq('church_id', church.churchId).maybeSingle(),
    supabase
      .from('plan_songs')
      .select('id, order_index, key_selected, songs(id, title), arrangements(id, name, chord_chart, chord_chart_key, slide_style)')
      .eq('plan_id', id)
      .eq('church_id', church.churchId)
      .order('order_index'),
    // Seulement les colonnes d'affichage (aucun champ sensible n'est envoyé au navigateur)
    loadProjectionSettings(supabase, church.churchId),
  ])

  if (!plan) notFound()

  const songs = (rawSongs ?? []).map(ps => ({
    planSongId:  ps.id,
    keySelected: ps.key_selected,
    song:        ps.songs as unknown as { id: string; title: string },
    arrangement: ps.arrangements as unknown as {
      id: string; name: string
      chord_chart: string | null; chord_chart_key: string | null
      slide_style: SlideStyle | null
    } | null,
  }))

  return (
    <ProjectorScreen
      planId={plan.id}
      churchId={church.churchId}
      songs={songs}
      settings={settings}
      churchName={church.churchName}
    />
  )
}
