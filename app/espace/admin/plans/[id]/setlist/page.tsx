import { requireChurch } from '@/lib/auth/church'
import { notFound } from 'next/navigation'
import { PRIVATE_BUCKET, isChurchPath } from '@/lib/storage'
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
  // Mode live accessible à tous les membres de l'église (prod, louange, chanteurs…)
  const { supabase, church } = await requireChurch('membre')
  const churchId = church.churchId

  const [{ data: plan }, { data: rawSongs }, { data: announcements }, { data: sermons }, { data: videos }] = await Promise.all([
    supabase.from('plans').select('id, title').eq('id', id).eq('church_id', churchId).maybeSingle(),
    supabase
      .from('plan_songs')
      .select('id, order_index, key_selected, songs(id, title), arrangements(id, name, bpm, chord_chart, chord_chart_key, youtube_url, audio_url, slide_style)')
      .eq('plan_id', id)
      .eq('church_id', churchId)
      .order('order_index'),
    supabase
      .from('plan_announcements')
      .select('id, title, body, order_index, image_url, video_url')
      .eq('plan_id', id)
      .eq('church_id', churchId)
      .order('order_index'),
    supabase
      .from('plan_sermons')
      .select('id, title, url, storage_path')
      .eq('plan_id', id)
      .eq('church_id', churchId)
      .order('created_at'),
    supabase
      .from('plan_videos')
      .select('id, title, url, order_index')
      .eq('plan_id', id)
      .eq('church_id', churchId)
      .order('order_index'),
  ])

  if (!plan) notFound()

  // Annonces récurrentes de l'église
  const { data: recurringAnn } = await supabase
    .from('recurring_announcements')
    .select('id, title, body, order_index, image_url, video_url')
    .eq('church_id', churchId)
    .eq('active', true)
    .order('order_index')

  // Merge : récurrentes en premier, puis spécifiques au plan
  const allAnnouncements = [
    ...(recurringAnn ?? []).map(a => ({ ...a, id: `recurring-${a.id}` })),
    ...(announcements ?? []),
  ]

  // Fetch tous les arrangements disponibles pour chaque chant du plan
  // Les embeds sont typés en tableau (clés étrangères composites) : un seul objet en pratique
  const songOf = (ps: { songs: unknown }) => ps.songs as unknown as { id: string; title: string } | null
  const songIds = [...new Set((rawSongs ?? []).map(ps => songOf(ps)?.id).filter((sid): sid is string => !!sid))]
  const { data: allArrangementsRaw } = songIds.length > 0
    ? await supabase
        .from('arrangements')
        .select('id, name, song_id, chord_chart_key, chord_chart')
        .eq('church_id', churchId)
        .in('song_id', songIds)
    : { data: [] as { id: string; name: string; song_id: string; chord_chart_key: string | null; chord_chart: string | null }[] }

  // Index par song_id
  const arrsBySong: Record<string, { id: string; name: string; chord_chart_key: string | null; hasChart: boolean }[]> = {}
  for (const a of (allArrangementsRaw ?? [])) {
    const sid = a.song_id
    if (!arrsBySong[sid]) arrsBySong[sid] = []
    arrsBySong[sid].push({ id: a.id, name: a.name, chord_chart_key: a.chord_chart_key, hasChart: !!a.chord_chart })
  }

  const songs = (rawSongs ?? []).map(ps => ({
    planSongId:      ps.id,
    orderIndex:      ps.order_index,
    keySelected:     ps.key_selected,
    song:            songOf(ps) as { id: string; title: string },
    arrangement:     ps.arrangements as unknown as {
      id: string; name: string; bpm: number | null
      chord_chart: string | null; chord_chart_key: string | null
      youtube_url: string | null; audio_url: string | null
      slide_style: import('@/lib/slidePresets').SlideStyle | null
    } | null,
    allArrangements: arrsBySong[songOf(ps)?.id ?? ''] ?? [],
  }))

  // PDF de prédication : URL signée (1 h) pour les fichiers du stockage privé de l'église
  const sermonsWithUrl = (await Promise.all((sermons ?? []).map(async s => {
    if (s.storage_path) {
      if (!isChurchPath(churchId, s.storage_path)) return null
      const { data } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(s.storage_path, 3600)
      return data?.signedUrl ? { id: s.id, title: s.title, url: data.signedUrl } : null
    }
    return /^https?:\/\//.test(s.url) ? { id: s.id, title: s.title, url: s.url } : null
  }))).filter((s): s is { id: string; title: string; url: string } => s !== null)

  return (
    <SetlistView
      planId={plan.id}
      churchId={churchId}
      planTitle={plan.title}
      songs={songs}
      announcements={allAnnouncements as { id: string; title: string | null; body: string; order_index: number; image_url: string | null; video_url: string | null }[]}
      sermons={sermonsWithUrl}
      videos={(videos ?? []) as { id: string; title: string | null; url: string; order_index: number }[]}
      autoProjection={projection === '1'}
    />
  )
}
