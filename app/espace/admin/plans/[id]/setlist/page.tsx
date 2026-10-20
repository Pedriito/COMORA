import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { SetlistView } from './SetlistView'

export default async function SetlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ projection?: string }>
}) {
  const { id } = await params
  const { projection } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: me } = await supabase
    .from('profiles')
    .select('permission')
    .eq('id', user.id)
    .single()
  // Mode live accessible à tous les bénévoles connectés (prod, louange, chanteurs…)

  const [{ data: plan }, { data: rawSongs }, { data: announcements }, { data: sermons }, { data: videos }] = await Promise.all([
    supabase.from('plans').select('id, title').eq('id', id).single(),
    supabase
      .from('plan_songs')
      .select('id, order_index, key_selected, songs(id, title), arrangements(id, name, bpm, chord_chart, chord_chart_key, youtube_url, audio_url, slide_style)')
      .eq('plan_id', id)
      .order('order_index'),
    supabase
      .from('plan_announcements')
      .select('id, title, body, order_index, image_url, video_url')
      .eq('plan_id', id)
      .order('order_index'),
    supabase
      .from('plan_sermons')
      .select('id, title, url')
      .eq('plan_id', id)
      .order('created_at'),
    supabase
      .from('plan_videos')
      .select('id, title, url, order_index')
      .eq('plan_id', id)
      .order('order_index'),
  ])

  if (!plan) notFound()

  // Annonces récurrentes (globales)
  const { data: recurringAnn } = await supabase
    .from('recurring_announcements')
    .select('id, title, body, order_index, image_url, video_url')
    .eq('active', true)
    .order('order_index')

  // Merge : récurrentes en premier, puis spécifiques au plan
  const allAnnouncements = [
    ...(recurringAnn ?? []).map(a => ({ ...a, id: `recurring-${a.id}` })),
    ...(announcements ?? []),
  ]

  // Fetch tous les arrangements disponibles pour chaque chant du plan
  const songIds = [...new Set((rawSongs ?? []).map(ps => (ps as any).songs?.id as number).filter(Boolean))]
  const { data: allArrangementsRaw } = songIds.length > 0
    ? await supabase
        .from('arrangements')
        .select('id, name, song_id, chord_chart_key, chord_chart')
        .in('song_id', songIds)
    : { data: [] as { id: string; name: string; song_id: number; chord_chart_key: string | null; chord_chart: string | null }[] }

  // Index par song_id
  const arrsBySong: Record<number, { id: string; name: string; chord_chart_key: string | null; hasChart: boolean }[]> = {}
  for (const a of (allArrangementsRaw ?? [])) {
    const sid = (a as any).song_id as number
    if (!arrsBySong[sid]) arrsBySong[sid] = []
    arrsBySong[sid].push({ id: a.id, name: a.name, chord_chart_key: a.chord_chart_key, hasChart: !!a.chord_chart })
  }

  const songs = (rawSongs ?? []).map(ps => ({
    planSongId:      ps.id,
    orderIndex:      ps.order_index,
    keySelected:     ps.key_selected,
    song:            (ps as any).songs as { id: number; title: string },
    arrangement:     (ps as any).arrangements as {
      id: string; name: string; bpm: number | null
      chord_chart: string | null; chord_chart_key: string | null
      youtube_url: string | null; audio_url: string | null
      slide_style: import('@/lib/slidePresets').SlideStyle | null
    } | null,
    allArrangements: arrsBySong[(ps as any).songs?.id as number] ?? [],
  }))

  return (
    <SetlistView
      planId={plan.id}
      planTitle={plan.title}
      songs={songs}
      announcements={allAnnouncements as { id: string; title: string | null; body: string; order_index: number; image_url: string | null; video_url: string | null }[]}
      sermons={(sermons ?? []) as { id: string; title: string; url: string }[]}
      videos={(videos ?? []) as { id: string; title: string | null; url: string; order_index: number }[]}
      autoProjection={projection === '1'}
    />
  )
}
