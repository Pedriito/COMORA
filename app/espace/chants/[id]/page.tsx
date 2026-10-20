import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChordChart } from './ChordChart'
import { MediaPlayer } from './MediaPlayer'

type Arrangement = {
  id: string
  name: string
  bpm: number | null
  length_seconds: number | null
  notes: string | null
  chord_chart: string | null
  chord_chart_key: string | null
  keys_available: string[]
  tags: string[]
  youtube_url: string | null
  audio_url: string | null
}

type Song = {
  id: number
  title: string
  ccli: string | null
  themes: string | null
  notes: string | null
  last_scheduled_date: string | null
  arrangements: Arrangement[]
}

function formatLength(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default async function SongPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { id } = await params
  const songId = parseInt(id, 10)

  const { data: song } = await supabase
    .from('songs')
    .select(`
      id, title, ccli, themes, notes, last_scheduled_date,
      arrangements(id, name, bpm, length_seconds, notes, chord_chart, chord_chart_key, keys_available, tags, youtube_url, audio_url)
    `)
    .eq('id', songId)
    .single()

  if (!song) notFound()

  const typedSong = song as unknown as Song

  // Arrangement sélectionné par défaut : le premier avec une grille
  const defaultArr = typedSong.arrangements.find(a => a.chord_chart) ?? typedSong.arrangements[0] ?? null

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 py-4 flex items-center gap-4">
        <Link href="/espace/chants" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm">
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-dark font-light truncate">{typedSong.title}</h1>
          {typedSong.ccli && (
            <p className="text-xs text-dark/30 font-sans mt-0.5">CCLI {typedSong.ccli}</p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* Méta */}
        {(typedSong.themes || typedSong.notes || typedSong.last_scheduled_date) && (
          <div className="bg-white rounded-2xl border border-teal/20 px-5 py-4 space-y-1">
            {typedSong.themes && (
              <p className="font-sans text-xs text-dark/50">
                <span className="text-dark/30 uppercase tracking-wide text-[10px] mr-2">Thèmes</span>
                {typedSong.themes}
              </p>
            )}
            {typedSong.last_scheduled_date && (
              <p className="font-sans text-xs text-dark/50">
                <span className="text-dark/30 uppercase tracking-wide text-[10px] mr-2">Dernier usage</span>
                {new Date(typedSong.last_scheduled_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            {typedSong.notes && (
              <p className="font-sans text-xs text-dark/50 mt-1">{typedSong.notes}</p>
            )}
          </div>
        )}

        {/* Arrangements */}
        {typedSong.arrangements.map(arr => (
          <section key={arr.id} className="space-y-3">
            {/* En-tête arrangement */}
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-display text-lg text-dark font-light">{arr.name}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {arr.bpm && (
                  <span className="font-sans text-xs text-dark/40 bg-white border border-teal/15 px-2 py-0.5 rounded-full">
                    {arr.bpm} BPM
                  </span>
                )}
                {arr.length_seconds && (
                  <span className="font-sans text-xs text-dark/40 bg-white border border-teal/15 px-2 py-0.5 rounded-full">
                    {formatLength(arr.length_seconds)}
                  </span>
                )}
                {arr.keys_available?.length > 0 && (
                  <span className="font-sans text-xs text-dark/40 bg-white border border-teal/15 px-2 py-0.5 rounded-full">
                    {arr.keys_available.join(' · ')}
                  </span>
                )}
                {arr.tags?.filter(Boolean).map(tag => (
                  <span key={tag} className="font-sans text-xs text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {arr.notes && (
              <p className="font-sans text-xs text-dark/50 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2">
                {arr.notes}
              </p>
            )}

            {/* Médias */}
            {(arr.youtube_url || arr.audio_url) && (
              <MediaPlayer youtubeUrl={arr.youtube_url} audioUrl={arr.audio_url} />
            )}

            {/* Grille avec transposition */}
            {arr.chord_chart ? (
              <ChordChart
                chart={arr.chord_chart}
                originalKey={arr.chord_chart_key}
                arrangementId={arr.id}
                songId={typedSong.id}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-teal/20 px-5 py-6 text-center">
                <p className="font-sans text-xs text-dark/30">Pas de grille d'accords</p>
              </div>
            )}
          </section>
        ))}

        {typedSong.arrangements.length === 0 && (
          <div className="text-center py-12">
            <p className="font-sans text-sm text-dark/40">Aucun arrangement.</p>
          </div>
        )}

      </main>
    </div>
  )
}
