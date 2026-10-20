'use client'

import { useState, useMemo } from 'react'
import { transposeChart, getSemitones, isSectionHeader, isChordLine } from '@/lib/transpose'
import { IconMusicalNote } from '@/app/espace/_components/Icons'

type Props = {
  chart: string
  originalKey: string | null
  /** Pré-sélectionne une tonalité différente de l'originale (ex: depuis le plan) */
  initialKey?: string
  songId: number | string
  arrangementId?: string
}

// Tonalités courantes affichées dans le sélecteur
const COMMON_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'Bb', 'Eb', 'Ab', 'Db', 'F#', 'B']

export function ChordChart({ chart, originalKey, initialKey, songId, arrangementId }: Props) {
  const defaultKey = originalKey ?? 'C'
  const [selectedKey, setSelectedKey] = useState(initialKey ?? defaultKey)
  const [showChords, setShowChords] = useState(true)

  const transposed = useMemo(
    () => transposeChart(chart, defaultKey, selectedKey),
    [chart, defaultKey, selectedKey]
  )

  const semitones = getSemitones(defaultKey, selectedKey)

  function openPrint() {
    const arr = arrangementId ? `&arr=${arrangementId}` : ''
    const url = `/espace/chants/${songId}/print?key=${selectedKey}${arr}&chords=${showChords}`
    window.open(url, '_blank', 'width=900,height=700')
  }

  return (
    <div className="space-y-3 w-full">
      {/* Barre d'outils */}
      <div className="bg-white rounded-2xl border border-teal/20 p-4 space-y-3">
        {/* Ligne : tonalité + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs text-dark/40 uppercase tracking-wide shrink-0">Tonalité</span>
          {semitones !== 0 && (
            <span className="font-sans text-xs text-teal bg-teal/10 px-2 py-0.5 rounded-full shrink-0">
              {semitones > 6 ? `−${12 - semitones}` : `+${semitones}`} demi-tons
            </span>
          )}

          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            {/* Masquer accords */}
            <button
              onClick={() => setShowChords(v => !v)}
              className={`
                font-sans text-xs px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1
                ${showChords
                  ? 'border-teal/20 text-dark/50 hover:border-teal/40 hover:text-dark'
                  : 'border-teal bg-teal/10 text-teal font-medium'}
              `}
            >
              <IconMusicalNote className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{showChords ? 'Accords visibles' : 'Accords masqués'}</span>
            </button>

            {/* PDF */}
            <button
              onClick={openPrint}
              className="font-sans text-xs px-2.5 py-1.5 rounded-lg border border-teal/20 text-dark/50 hover:border-teal/40 hover:text-dark transition-colors"
            >
              PDF
            </button>

            {/* Réinitialiser tonalité */}
            {semitones !== 0 && (
              <button
                onClick={() => setSelectedKey(defaultKey)}
                className="font-sans text-xs text-dark/30 hover:text-dark transition-colors"
              >
                ↺
              </button>
            )}
          </div>
        </div>

        {/* Boutons de tonalité */}
        <div className="flex flex-wrap gap-1.5">
          {COMMON_KEYS.map(key => (
            <button
              key={key}
              onClick={() => setSelectedKey(key)}
              className={`
                w-9 h-9 rounded-xl font-sans text-sm font-medium transition-colors
                ${selectedKey === key
                  ? 'bg-teal text-white'
                  : 'bg-teal/5 text-dark/60 hover:bg-teal/15'}
              `}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Grille d'accords */}
      {/* L'alignement accord/parole repose sur un padding en espaces (police monospace) :
          on interdit le retour à la ligne (whitespace-pre) et on scrolle horizontalement
          plutôt que de laisser le navigateur wrapper les deux lignes indépendamment, ce qui
          désynchroniserait l'accord de la syllabe qu'il surplombe dès qu'une ligne wrap. */}
      <div className="bg-white rounded-2xl border border-teal/20 p-5 w-full overflow-x-auto">
        <pre className="font-mono text-sm leading-relaxed whitespace-pre">
          {transposed.split('\n').map((line, i) => {
            if (!line.trim()) return <span key={i}>{'\n'}</span>

            // Accords en priorité — évite que F, G, A… soient pris pour des titres de section
            if (isChordLine(line)) {
              if (!showChords) return null
              return (
                <span key={i} className="block text-teal font-semibold">
                  {line}
                </span>
              )
            }

            if (isSectionHeader(line)) {
              return (
                <span key={i} className="block text-xs font-sans font-semibold uppercase tracking-widest text-dark/30 mt-3 mb-1">
                  {line}
                </span>
              )
            }

            // Ligne de paroles
            return (
              <span key={i} className="block text-dark/80">
                {line}
              </span>
            )
          })}
        </pre>
      </div>
    </div>
  )
}
