import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProjectorScreen } from './ProjectorScreen'
import { DEFAULT_SETTINGS, SETTINGS_ID } from '@/lib/projectionSettings'
import type { SlideStyle } from '@/lib/slidePresets'

export default async function ProjectorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const [{ data: plan }, { data: rawSongs }, { data: rawSettings }] = await Promise.all([
    supabase.from('plans').select('id, title, churches(name)').eq('id', id).single(),
    supabase
      .from('plan_songs')
      .select('id, order_index, key_selected, songs(id, title), arrangements(id, name, chord_chart, chord_chart_key, slide_style)')
      .eq('plan_id', id)
      .order('order_index'),
    supabase.from('projection_settings').select('*').eq('id', SETTINGS_ID).single(),
  ])

  if (!plan) notFound()

  const songs = (rawSongs ?? []).map(ps => ({
    planSongId:  ps.id,
    keySelected: ps.key_selected,
    song:        (ps as any).songs as { id: number; title: string },
    arrangement: (ps as any).arrangements as {
      id: string; name: string
      chord_chart: string | null; chord_chart_key: string | null
      slide_style: SlideStyle | null
    } | null,
  }))

  const settings = (rawSettings as any) ?? DEFAULT_SETTINGS

  const churchName = ((plan as any).churches as { name: string } | null)?.name ?? ''

  return <ProjectorScreen planId={plan.id} songs={songs} settings={settings} churchName={churchName} />
}
