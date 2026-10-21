'use client'

import { useState } from 'react'
import { ChordChart } from '@/app/espace/chants/[id]/ChordChart'
import { siteConfig } from '@/lib/site'

type Song = {
  planSongId: string
  orderIndex: number
  keySelected: string | null
  song: { id: string; title: string }
  arrangement: {
    id: string; name: string
    chord_chart: string | null; chord_chart_key: string | null
  } | null
}

type Props = {
  planTitle: string
  dateStr: string | null
  songs: Song[]
}

export function SharedSetlist({ planTitle, dateStr, songs }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  function toggle(idx: number) {
    setOpenIdx(prev => prev === idx ? null : idx)
  }

  return (
    <div className="min-h-screen bg-teal-50">
      {/* Header */}
      <div className="bg-white border-b border-teal/20 px-4 py-5 sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto">
          <p className="font-sans text-[10px] uppercase tracking-widest text-teal/60 mb-0.5">
            Setlist
          </p>
          <h1 className="font-display text-xl text-dark font-light leading-tight">{planTitle}</h1>
          {dateStr && (
            <p className="font-sans text-xs text-dark/40 mt-0.5 capitalize">{dateStr}</p>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-2">
        {songs.length === 0 && (
          <p className="font-sans text-sm text-dark/30 text-center py-12">
            Aucun chant dans cette setlist.
          </p>
        )}

        {songs.map((s, idx) => {
          const isOpen   = openIdx === idx
          const hasChart = !!s.arrangement?.chord_chart
          const key      = s.keySelected ?? s.arrangement?.chord_chart_key

          return (
            <div
              key={s.planSongId}
              className="bg-white rounded-2xl border border-teal/20 overflow-hidden shadow-sm"
            >
              {/* En-tête du chant — toujours visible */}
              <button
                onClick={() => toggle(idx)}
                className="w-full text-left px-4 py-4 flex items-center gap-3"
              >
                {/* Numéro */}
                <span className="font-sans text-sm text-dark/25 tabular-nums w-6 shrink-0">
                  {idx + 1}
                </span>

                {/* Titre + arrangement */}
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-base font-semibold text-dark leading-snug">
                    {s.song.title}
                  </p>
                  {s.arrangement?.name && (
                    <p className="font-sans text-xs text-dark/40 mt-0.5">{s.arrangement.name}</p>
                  )}
                </div>

                {/* Tonalité */}
                {key && (
                  <span className="font-sans text-base font-bold text-teal shrink-0">{key}</span>
                )}

                {/* Indicateur grille */}
                {hasChart ? (
                  <span className={`font-sans text-xs shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                ) : (
                  <span className="font-sans text-xs text-dark/20 shrink-0">—</span>
                )}
              </button>

              {/* Grille d'accords (dépliable) */}
              {isOpen && hasChart && s.arrangement && (
                <div className="border-t border-teal/10 px-4 py-4">
                  <ChordChart
                    chart={s.arrangement.chord_chart!}
                    originalKey={s.arrangement.chord_chart_key}
                    initialKey={s.keySelected ?? s.arrangement.chord_chart_key ?? undefined}
                    songId={s.song.id}
                    arrangementId={s.arrangement.id}
                  />
                </div>
              )}

              {/* Message si pas de grille */}
              {isOpen && !hasChart && (
                <div className="border-t border-teal/10 px-4 py-4">
                  <p className="font-sans text-sm text-dark/30 text-center">
                    Pas de grille d'accords disponible pour cet arrangement.
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {/* Footer */}
        <p className="font-sans text-[10px] text-dark/20 text-center pt-6 pb-4">
          Accès en lecture seule · {siteConfig.signature}
        </p>
      </div>
    </div>
  )
}
