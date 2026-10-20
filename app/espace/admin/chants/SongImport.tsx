'use client'

import { useState } from 'react'
import { parseChordPro } from '@/lib/parseChordPro'

type ParsedSong = {
  title:  string
  artist: string | null
  key:    string | null
  bpm:    number | null
  chart:  string
}

type Props = {
  onImport: (song: ParsedSong) => void
}

type Result = {
  source:   'shir' | 'ltc'
  title:    string
  subtitle: string
  id?:      number
}

const SECTION_MAP: [RegExp, string][] = [
  [/^refrain\s*\d*$/i,      '{start_of_chorus}'],
  [/^chorus\s*\d*$/i,       '{start_of_chorus}'],
  [/^couplet\s*\d*$/i,      '{start_of_verse}'],
  [/^verse\s*\d*$/i,        '{start_of_verse}'],
  [/^strophe\s*\d*$/i,      '{start_of_verse}'],
  [/^pont\s*\d*$/i,         '{start_of_bridge}'],
  [/^bridge\s*\d*$/i,       '{start_of_bridge}'],
  [/^intro\s*\d*$/i,        '{start_of_verse}'],
  [/^outro\s*\d*$/i,        '{start_of_verse}'],
  [/^tag\s*\d*$/i,          '{start_of_verse}'],
  [/^pré.?refrain\s*\d*$/i, '{start_of_verse}'],
  [/^pre.?chorus\s*\d*$/i,  '{start_of_verse}'],
]

function ltcLyricsToChordPro(lyrics: string, title: string, artist: string): string {
  const header = [
    `{title: ${title}}`,
    artist ? `{subtitle: ${artist}}` : null,
  ].filter(Boolean).join('\n')

  const processed = lyrics.split('\n').map(line => {
    const t = line.trim()
    for (const [re, directive] of SECTION_MAP) {
      if (re.test(t)) return directive
    }
    return line
  }).join('\n')

  return `${header}\n\n${processed}`
}

export function SongImport({ onImport }: Props) {
  const [open, setOpen]           = useState(false)
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<Result[]>([])
  const [loading, setLoading]     = useState(false)
  const [fetchingKey, setFetchingKey] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  async function search() {
    if (!query.trim()) return
    setLoading(true); setError(null); setResults([])

    try {
      const [shirRes, ltcRes] = await Promise.allSettled([
        fetch(`/api/shir?action=search&q=${encodeURIComponent(query)}`).then(r => r.json()),
        fetch(`/api/ltcasaph?action=search&q=${encodeURIComponent(query)}`).then(r => r.json()),
      ])

      const shirItems: Result[] = shirRes.status === 'fulfilled'
        ? (shirRes.value.results ?? []).map((r: { title: string }) => ({
            source: 'shir' as const,
            title: r.title,
            subtitle: 'shir.fr',
          }))
        : []

      const ltcItems: Result[] = ltcRes.status === 'fulfilled'
        ? (ltcRes.value.results ?? []).map((r: { id: number; title: string; authors: string }) => ({
            source: 'ltc' as const,
            title: r.title,
            subtitle: r.authors || 'LTC-Asaph',
            id: r.id,
          }))
        : []

      // Intercaler les résultats des deux sources
      const merged: Result[] = []
      const max = Math.max(shirItems.length, ltcItems.length)
      for (let i = 0; i < max; i++) {
        if (i < shirItems.length) merged.push(shirItems[i])
        if (i < ltcItems.length)  merged.push(ltcItems[i])
      }

      setResults(merged)
      if (merged.length === 0) setError('Aucun résultat.')
    } catch {
      setError('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  async function importShir(title: string) {
    const key = `shir:${title}`
    setFetchingKey(key); setError(null)
    try {
      const res = await fetch(`/api/shir?action=fetch&title=${encodeURIComponent(title)}`)
      if (!res.ok) { setError(`Impossible de récupérer "${title}".`); return }
      const text   = await res.text()
      const parsed = parseChordPro(text)
      if (!parsed.title) parsed.title = title
      onImport(parsed)
      setOpen(false)
    } catch { setError("Erreur lors de l'import.") }
    finally { setFetchingKey(null) }
  }

  async function importLtc(id: number, title: string) {
    const key = `ltc:${id}`
    setFetchingKey(key); setError(null)
    try {
      const res  = await fetch(`/api/ltcasaph?action=fetch&id=${id}`)
      const data = await res.json()
      if (data.error) { setError(`Impossible d'importer "${title}".`); return }

      const songTitle  = data.title  || title
      const songArtist = data.authors || ''
      const chordPro   = ltcLyricsToChordPro(data.lyrics || '', songTitle, songArtist)
      const parsed     = parseChordPro(chordPro)

      onImport({
        title:  parsed.title  || songTitle,
        artist: parsed.artist || songArtist || null,
        key:    parsed.key    || data.key   || null,
        bpm:    parsed.bpm    || data.bpm   || null,
        chart:  parsed.chart  || '',
      })
      setOpen(false)
    } catch { setError("Erreur lors de l'import.") }
    finally { setFetchingKey(null) }
  }

  function handleImport(r: Result) {
    if (r.source === 'shir') return importShir(r.title)
    if (r.source === 'ltc' && r.id !== undefined) return importLtc(r.id, r.title)
  }

  function resultKey(r: Result) {
    return r.source === 'shir' ? `shir:${r.title}` : `ltc:${r.id}`
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal/20 bg-teal/5 hover:bg-teal/10 font-sans text-sm text-teal transition-colors"
      >
        🎵 Importer un chant
        <span className="font-sans text-xs text-teal/50">shir.fr · LTC-Asaph</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-teal/10">
              <div>
                <h2 className="font-display text-lg text-dark font-light">Importer un chant</h2>
                <p className="font-sans text-xs text-dark/40">Recherche simultanée sur shir.fr et LTC-Asaph (~6200 chants)</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-dark/30 hover:text-dark text-xl">×</button>
            </div>

            {/* Search bar */}
            <div className="flex gap-2 px-4 py-3 border-b border-teal/10">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Titre du chant, auteur…"
                className="flex-1 border border-teal/20 rounded-lg px-3 py-2 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:border-teal/40"
              />
              <button
                onClick={search}
                disabled={loading || !query.trim()}
                className="px-4 py-2 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal/90 disabled:opacity-40"
              >
                {loading ? '…' : 'Chercher'}
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {error && (
                <p className="font-sans text-sm text-dark/40 text-center py-8">{error}</p>
              )}
              {loading && !error && (
                <p className="font-sans text-xs text-dark/30 text-center py-8">Chargement…</p>
              )}
              {!loading && results.map(r => {
                const k = resultKey(r)
                return (
                  <button
                    key={k}
                    onClick={() => handleImport(r)}
                    disabled={fetchingKey !== null}
                    className="w-full text-left px-5 py-3 hover:bg-teal/5 transition-colors border-b border-teal/5 flex items-center justify-between gap-3 group"
                  >
                    <span className="min-w-0">
                      <span className="font-sans text-sm text-dark group-hover:text-teal transition-colors block truncate">
                        {r.title}
                      </span>
                      <span className="font-sans text-xs text-dark/40 block truncate">{r.subtitle}</span>
                    </span>
                    <span className="font-sans text-xs text-teal/50 shrink-0">
                      {fetchingKey === k ? '⏳ Import…' : 'Importer →'}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Note copyright */}
            <p className="font-sans text-[10px] text-dark/25 text-center px-4 py-2 border-t border-teal/5">
              Contenu fourni par shir.fr et LTC-Asaph · Droits réservés aux auteurs · Usage interne uniquement
            </p>
          </div>
        </div>
      )}
    </>
  )
}
