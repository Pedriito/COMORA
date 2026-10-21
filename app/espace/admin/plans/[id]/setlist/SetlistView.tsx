'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconProjector, IconMusicalNote } from '@/app/espace/_components/Icons'
import { ChordChart } from '@/app/espace/chants/[id]/ChordChart'
import { MediaPlayer } from '@/app/espace/chants/[id]/MediaPlayer'
import { ProjectionView } from './ProjectionView'
import { updatePlanSongArrangement } from '@/app/espace/admin/plans/actions'
import { SlideStyleModal } from './SlideStyleModal'
import { type SlideStyle, getPresetById } from '@/lib/slidePresets'
import { isSectionHeader, isChordLine } from '@/lib/transpose'

function DrummerChart({ chart, bpm }: { chart: string | null; bpm: number | null }) {
  if (!chart) {
    return (
      <div className="bg-white rounded-xl border border-teal/20 px-4 py-6 text-center">
        <p className="font-sans text-sm text-dark/40">Pas de grille pour cet arrangement.</p>
      </div>
    )
  }

  const lines = chart.split('\n')
  const filtered = lines.filter(line => !isChordLine(line))

  return (
    <div className="bg-white rounded-2xl border border-teal/20 p-5 space-y-4">
      {bpm && (
        <div className="flex items-center gap-2 pb-3 border-b border-teal/10">
          <span className="font-sans text-3xl font-bold text-teal tabular-nums">{bpm}</span>
          <span className="font-sans text-sm text-dark/40 font-medium">BPM</span>
        </div>
      )}
      <div className="font-mono text-sm leading-relaxed space-y-0.5">
        {filtered.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-3" />
          if (isSectionHeader(line)) {
            return (
              <div key={i} className="font-sans text-xs font-semibold text-teal uppercase tracking-widest pt-3 pb-1 first:pt-0">
                {line.replace(/^\[|\]$/g, '')}
              </div>
            )
          }
          return (
            <div key={i} className="font-sans text-sm text-dark/80">{line}</div>
          )
        })}
      </div>
    </div>
  )
}

type Song = {
  planSongId: string
  orderIndex: number
  keySelected: string | null
  song: { id: string; title: string }
  arrangement: {
    id: string
    name: string
    bpm: number | null
    chord_chart: string | null
    chord_chart_key: string | null
    youtube_url?: string | null
    audio_url?: string | null
    slide_style?: SlideStyle | null
  } | null
  allArrangements: { id: string; name: string; chord_chart_key: string | null; hasChart: boolean }[]
}

type Announcement = { id: string; title: string | null; body: string; order_index: number; image_url: string | null; video_url: string | null }
type Sermon = { id: string; title: string; url: string }
type PlanVideo = { id: string; title: string | null; url: string; order_index: number }

type Props = {
  planId: string
  churchId: string
  planTitle: string
  songs: Song[]
  announcements: Announcement[]
  sermons: Sermon[]
  videos?: PlanVideo[]
  autoProjection?: boolean
}

export function SetlistView({ planId, churchId, planTitle, songs, announcements, sermons, videos, autoProjection }: Props) {
  const router = useRouter()
  const [activeIdx, setActiveIdx] = useState(0)
  const [mobileView, setMobileView] = useState<'list' | 'chart'>('list')
  const [drummerMode, setDrummerMode] = useState(false)
  const [projecting, setProjecting]       = useState(autoProjection ?? false)
  const [styleModalSong, setStyleModalSong] = useState<Song | null>(null)
  const [songStyles, setSongStyles] = useState<Record<string, SlideStyle | null>>({})  // arrangementId → style
  const projectorWinRef = useRef<Window | null>(null)

  // Ouvre la fenêtre projecteur DANS le geste utilisateur (onClick),
  // sinon Chrome l'interprète comme un popup non sollicité et ouvre un onglet.
  const openProjection = useCallback(() => {
    const url      = `/espace/admin/plans/${planId}/setlist/projector`
    const features = [
      `width=${window.screen.width}`,
      `height=${window.screen.height}`,
      'left=0', 'top=0',
      'toolbar=no', 'menubar=no', 'location=no', 'status=no',
      'noopener',
    ].join(',')
    projectorWinRef.current = window.open(url, `projector-${planId}`, features)
    setProjecting(true)
  }, [planId])
  const [isPending, startTransition] = useTransition()
  const [switchError, setSwitchError] = useState<string | null>(null)
  const songRefs = useRef<(HTMLDivElement | null)[]>([])

  async function switchArrangement(arrangementId: string) {
    setSwitchError(null)
    startTransition(async () => {
      const res = await updatePlanSongArrangement(active!.planSongId, arrangementId, planId)
      if (!res.ok) { setSwitchError(res.error ?? 'Erreur'); return }
      router.refresh()
    })
  }

  const active = songs[activeIdx] ?? null

  function selectSong(idx: number) {
    setActiveIdx(idx)
    if (mobileView === 'chart') {
      // Déjà en vue scroll — juste scroller jusqu'au chant
      setTimeout(() => {
        songRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 30)
    } else {
      setMobileView('chart')
      // Attendre le rendu puis scroller
      setTimeout(() => {
        songRefs.current[idx]?.scrollIntoView({ behavior: 'instant', block: 'start' })
      }, 50)
    }
  }

  return (
    <div className="flex h-screen bg-teal-50 overflow-hidden">
      {projecting && (
        <ProjectionView
          planId={planId}
          churchId={churchId}
          songs={songs}
          announcements={announcements}
          sermons={sermons}
          videos={videos ?? []}
          initialSongIdx={activeIdx}
          preOpenedWindow={projectorWinRef.current}
          onClose={() => { setProjecting(false); projectorWinRef.current = null }}
        />
      )}

      {/* ── Liste (gauche) ─────────────────────────────────────────── */}
      <aside className={`
        flex flex-col bg-white border-r border-teal/20 shrink-0
        w-full md:w-72 lg:w-80
        ${mobileView === 'chart' ? 'hidden md:flex' : 'flex'}
      `}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-teal/10 flex items-center gap-3">
          <Link
            href={`/espace/admin/plans/${planId}`}
            className="text-dark/40 hover:text-dark transition-colors text-sm"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base text-dark font-light truncate">{planTitle}</p>
            <p className="font-sans text-xs text-dark/40">{songs.length} chant{songs.length > 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Mode batteur */}
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none" title="Mode batteur : masque les accords, affiche le BPM">
              <input
                type="checkbox"
                checked={drummerMode}
                onChange={e => setDrummerMode(e.target.checked)}
                className="sr-only"
              />
              <span className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${drummerMode ? 'bg-teal' : 'bg-dark/20'}`}>
                <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${drummerMode ? 'translate-x-3' : 'translate-x-0'}`} />
              </span>
              <span className="font-sans text-xs text-dark/50">🥁</span>
            </label>

            <button
              onClick={openProjection}
              title="Mode vidéoprojecteur"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-dark hover:bg-dark/80 text-white rounded-lg font-sans text-xs font-medium transition-colors"
            >
              <IconProjector className="w-3.5 h-3.5" /> Projection
            </button>
          </div>
        </div>

        {/* Songs list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {songs.length === 0 && (
            <p className="px-4 py-8 text-center font-sans text-xs text-dark/30">
              Aucun chant dans ce plan.
            </p>
          )}
          {songs.map((s, idx) => {
            const isActive = idx === activeIdx
            return (
              <button
                key={s.planSongId}
                onClick={() => selectSong(idx)}
                className={`
                  w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-l-2
                  ${isActive
                    ? 'bg-teal/8 border-teal'
                    : 'border-transparent hover:bg-teal/5'}
                `}
              >
                <span className={`font-sans text-xs tabular-nums shrink-0 w-5 ${isActive ? 'text-teal font-semibold' : 'text-dark/25'}`}>
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`font-sans text-sm truncate ${isActive ? 'text-dark font-semibold' : 'text-dark/80 font-medium'}`}>
                    {s.song.title}
                  </p>
                  <p className="font-sans text-xs text-dark/35 mt-0.5">
                    {s.arrangement?.name && <span className="mr-2">{s.arrangement.name}</span>}
                    {s.keySelected && <span className="text-teal font-medium">{s.keySelected}</span>}
                  </p>
                </div>
                {isActive && (
                  <IconMusicalNote className="w-3.5 h-3.5 text-teal shrink-0" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Navigation prev/next en bas */}
        {songs.length > 0 && (
          <div className="border-t border-teal/10 px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => activeIdx > 0 && selectSong(activeIdx - 1)}
              disabled={activeIdx === 0}
              className="font-sans text-xs text-dark/40 hover:text-dark disabled:opacity-25 transition-colors px-2 py-1"
            >
              ← Précédent
            </button>
            <span className="font-sans text-xs text-dark/30 tabular-nums">
              {activeIdx + 1} / {songs.length}
            </span>
            <button
              onClick={() => activeIdx < songs.length - 1 && selectSong(activeIdx + 1)}
              disabled={activeIdx === songs.length - 1}
              className="font-sans text-xs text-dark/40 hover:text-dark disabled:opacity-25 transition-colors px-2 py-1"
            >
              Suivant →
            </button>
          </div>
        )}
      </aside>

      {/* ── Partition (droite) ─────────────────────────────────────── */}
      <main className={`
        flex-1 overflow-y-auto min-w-0
        ${mobileView === 'list' ? 'hidden md:block' : 'block'}
      `}>

        {/* ── VUE MOBILE : tous les chants en scroll continu ── */}
        <div className="md:hidden flex flex-col h-full">
          {/* Barre sticky : retour + titre du plan */}
          <div className="sticky top-0 z-10 bg-white border-b border-teal/20 px-4 py-3 flex items-center gap-3 shrink-0">
            <button
              onClick={() => setMobileView('list')}
              className="text-dark/40 hover:text-dark font-sans text-sm shrink-0"
            >
              ← Liste
            </button>
            <p className="font-sans text-sm text-dark/50 truncate flex-1">{planTitle}</p>
            <span className="font-sans text-xs text-dark/50 tabular-nums shrink-0">{songs.length} chant{songs.length > 1 ? 's' : ''}</span>
          </div>

          {/* Scroll continu : tous les chants empilés */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
            {songs.map((s, idx) => (
              <div
                key={s.planSongId}
                ref={el => { songRefs.current[idx] = el }}
              >
                {/* En-tête du chant */}
                <div className="px-4 pt-6 pb-3 flex items-baseline gap-3 flex-wrap">
                  <span className="font-sans text-xs text-dark/40 tabular-nums shrink-0">{idx + 1}</span>
                  <h2 className="font-display text-xl text-dark font-light leading-tight">{s.song.title}</h2>
                  {!drummerMode && s.keySelected && (
                    <span className="font-sans text-sm text-teal font-semibold shrink-0">{s.keySelected}</span>
                  )}
                  {drummerMode && s.arrangement?.bpm && (
                    <span className="font-sans text-base font-bold text-teal tabular-nums shrink-0">{s.arrangement.bpm} BPM</span>
                  )}
                </div>
                {s.arrangement?.name && (
                  <p className="px-4 pb-2 font-sans text-xs text-dark/35">{s.arrangement.name}</p>
                )}

                {/* Partition ou message */}
                <div className="px-4 pb-2">
                  {drummerMode ? (
                    <DrummerChart chart={s.arrangement?.chord_chart ?? null} bpm={s.arrangement?.bpm ?? null} />
                  ) : s.arrangement?.chord_chart ? (
                    <ChordChart
                      chart={s.arrangement.chord_chart}
                      originalKey={s.arrangement.chord_chart_key}
                      initialKey={s.keySelected ?? s.arrangement.chord_chart_key ?? undefined}
                      songId={s.song.id}
                      arrangementId={s.arrangement.id}
                    />
                  ) : (
                    <div className="bg-white rounded-xl border border-teal/20 px-4 py-6 text-center">
                      <p className="font-sans text-sm text-dark/40 mb-3">
                        Pas de grille pour cet arrangement.
                      </p>
                      <a
                        href={`/espace/chants/${s.song.id}`}
                        target="_blank"
                        className="font-sans text-xs text-teal/60 hover:text-teal hover:underline"
                      >
                        Gérer les arrangements →
                      </a>
                    </div>
                  )}
                </div>

                {/* Séparateur entre chants */}
                {idx < songs.length - 1 && (
                  <div className="mx-4 my-4 border-t-2 border-dashed border-teal/15 flex items-center justify-center">
                    <span className="bg-teal-50 px-3 text-xs text-dark/40 font-sans -mt-2.5 relative">
                      {songs[idx + 1]?.song.title}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {/* Espace en bas pour ne pas finir à ras bord */}
            <div className="h-16" />
          </div>
        </div>

        {/* ── VUE DESKTOP : un seul chant actif ── */}
        {active ? (
          <div className="hidden md:block max-w-2xl mx-auto px-6 py-6">
            {/* Titre */}
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h2 className="font-display text-2xl text-dark font-light">{active.song.title}</h2>
                  {drummerMode && active.arrangement?.bpm && (
                    <span className="font-sans text-2xl font-bold text-teal tabular-nums">{active.arrangement.bpm} BPM</span>
                  )}
                </div>
                {active.arrangement?.name && (
                  <p className="font-sans text-xs text-dark/40 mt-0.5">{active.arrangement.name}</p>
                )}
              </div>
              {active.arrangement && (
                <button
                  onClick={() => setStyleModalSong(active)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal/30 hover:border-teal/60 hover:bg-teal/5 transition-colors group"
                  title="Apparence de la projection"
                >
                  {(() => {
                    const style = songStyles[active.arrangement.id] !== undefined
                      ? songStyles[active.arrangement.id]
                      : active.arrangement.slide_style ?? null
                    const preset = getPresetById(style?.preset)
                    return preset
                      ? <span className="w-3 h-3 rounded-full" style={{ background: preset.thumbnail }} />
                      : null
                  })()}
                  <span className="font-sans text-xs text-teal">Apparence</span>
                </button>
              )}
            </div>

            {/* Navigation desktop */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => activeIdx > 0 && setActiveIdx(activeIdx - 1)}
                disabled={activeIdx === 0}
                className="font-sans text-xs text-dark/40 hover:text-dark disabled:opacity-25 transition-colors"
              >
                ← {songs[activeIdx - 1]?.song.title ?? ''}
              </button>
              <button
                onClick={() => activeIdx < songs.length - 1 && setActiveIdx(activeIdx + 1)}
                disabled={activeIdx === songs.length - 1}
                className="font-sans text-xs text-dark/40 hover:text-dark disabled:opacity-25 transition-colors"
              >
                {songs[activeIdx + 1]?.song.title ?? ''} →
              </button>
            </div>

            {drummerMode ? (
              <DrummerChart chart={active.arrangement?.chord_chart ?? null} bpm={active.arrangement?.bpm ?? null} />
            ) : active.arrangement?.chord_chart ? (
              <ChordChart
                chart={active.arrangement.chord_chart}
                originalKey={active.arrangement.chord_chart_key}
                initialKey={active.keySelected ?? active.arrangement.chord_chart_key ?? undefined}
                songId={active.song.id}
                arrangementId={active.arrangement.id}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-teal/20 px-5 py-10 text-center space-y-5">
                <p className="font-sans text-sm text-dark/40">
                  L'arrangement &laquo;&nbsp;{active.arrangement?.name ?? 'sélectionné'}&nbsp;&raquo; n'a pas de grille d'accords.
                </p>
                {active.allArrangements.filter(a => a.id !== active.arrangement?.id).length > 0 && (
                  <div className="space-y-2">
                    <p className="font-sans text-xs text-dark/50">Autres arrangements disponibles :</p>
                    <div className="flex flex-col gap-2 items-center">
                      {active.allArrangements
                        .filter(a => a.id !== active.arrangement?.id)
                        .map(a => (
                          <button
                            key={a.id}
                            onClick={() => switchArrangement(a.id)}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-teal/10 hover:bg-teal/20 disabled:opacity-50 border border-teal/20 rounded-lg font-sans text-sm text-teal transition-colors"
                          >
                            {a.hasChart ? <IconMusicalNote className="w-3.5 h-3.5 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-teal/40 shrink-0 inline-block" />}
                            <span>{a.name}</span>
                            {a.chord_chart_key && <span className="text-teal/60 text-xs">{a.chord_chart_key}</span>}
                            {a.hasChart && <span className="text-xs text-teal/50">· grille dispo</span>}
                          </button>
                        ))
                      }
                    </div>
                    {switchError && <p className="font-sans text-xs text-red-500">{switchError}</p>}
                    {isPending && <p className="font-sans text-xs text-dark/40">Changement en cours…</p>}
                  </div>
                )}
                <a
                  href={`/espace/chants/${active.song.id}`}
                  target="_blank"
                  className="inline-block font-sans text-xs text-teal/60 hover:text-teal hover:underline"
                >
                  Gérer les arrangements →
                </a>
              </div>
            )}

            {/* Lecteur média */}
            {(active.arrangement?.youtube_url || active.arrangement?.audio_url) && (
              <div className="mt-4">
                <MediaPlayer
                  youtubeUrl={active.arrangement.youtube_url ?? null}
                  audioUrl={active.arrangement.audio_url ?? null}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="hidden md:flex items-center justify-center h-full">
            <p className="font-sans text-sm text-dark/30">Sélectionne un chant dans la liste.</p>
          </div>
        )}
      </main>

      {/* Modal apparence diapo */}
      {styleModalSong && styleModalSong.arrangement && (
        <SlideStyleModal
          songTitle={styleModalSong.song.title}
          arrangementId={styleModalSong.arrangement.id}
          planId={planId}
          initialStyle={
            songStyles[styleModalSong.arrangement.id] !== undefined
              ? songStyles[styleModalSong.arrangement.id]
              : styleModalSong.arrangement.slide_style ?? null
          }
          onClose={() => setStyleModalSong(null)}
          onSaved={(newStyle) => {
            setSongStyles(prev => ({ ...prev, [styleModalSong.arrangement!.id]: newStyle }))
          }}
        />
      )}
    </div>
  )
}
