'use client'

import { useState, useTransition, useCallback } from 'react'
import { parseChordPro } from '@/lib/parseChordPro'

type ParsedSong = {
  title:  string
  artist: string | null
  key:    string | null
  bpm:    number | null
  chart:  string
}

type Props = {
  /** Appelé quand l'utilisateur valide un chant — pré-remplit le formulaire */
  onImport: (song: ParsedSong) => void
}

export function ShirImport({ onImport }: Props) {
  const [open, setOpen]             = useState(false)
  const [tab, setTab]               = useState<'search' | 'browse'>('search')
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<{ title: string }[]>([])
  const [browsePage, setBrowsePage] = useState<{ title: string }[]>([])
  const [browseCont, setBrowseCont] = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [fetchingTitle, setFetchingTitle] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, start]          = useTransition()

  async function search() {
    if (!query.trim()) return
    setLoading(true); setError(null); setResults([])
    try {
      const res = await fetch(`/api/shir?action=search&q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(data.results ?? [])
      if ((data.results ?? []).length === 0) setError('Aucun résultat.')
    } catch { setError('Erreur de connexion.') }
    finally { setLoading(false) }
  }

  const browse = useCallback(async (cont?: string) => {
    setLoading(true); setError(null)
    try {
      const url = `/api/shir?action=browse${cont ? `&continue=${encodeURIComponent(cont)}` : ''}`
      const res  = await fetch(url)
      const data = await res.json()
      setBrowsePage(data.results ?? [])
      setBrowseCont(data.continue ?? null)
    } catch { setError('Erreur de connexion.') }
    finally { setLoading(false) }
  }, [])

  async function importSong(title: string) {
    setFetchingTitle(title); setError(null)
    try {
      const res = await fetch(`/api/shir?action=fetch&title=${encodeURIComponent(title)}`)
      if (!res.ok) { setError(`Impossible de récupérer "${title}".`); return }
      const text   = await res.text()
      const parsed = parseChordPro(text)
      // Si le parser n'a pas trouvé de titre, utiliser celui de l'API
      if (!parsed.title) parsed.title = title
      onImport(parsed)
      setOpen(false)
    } catch { setError('Erreur lors de l\'import.') }
    finally { setFetchingTitle(null) }
  }

  function handleOpen() {
    setOpen(true)
    if (browsePage.length === 0) browse()
  }

  const list = tab === 'search' ? results : browsePage

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal/20 bg-teal/5 hover:bg-teal/10 font-sans text-sm text-teal transition-colors"
      >
        🎵 Importer depuis shir.fr
        <span className="font-sans text-xs text-teal/50">~1200 chants</span>
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
                <h2 className="font-display text-lg text-dark font-light">Importer depuis shir.fr</h2>
                <p className="font-sans text-xs text-dark/40">~1200 partitions de chants chrétiens</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-dark/30 hover:text-dark text-xl">×</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-teal/10">
              {(['search', 'browse'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); if (t === 'browse' && browsePage.length === 0) browse() }}
                  className={`flex-1 py-2.5 font-sans text-xs font-medium transition-colors ${tab === t ? 'text-teal border-b-2 border-teal' : 'text-dark/40 hover:text-dark/60'}`}
                >
                  {t === 'search' ? '🔍 Rechercher' : '📋 Parcourir'}
                </button>
              ))}
            </div>

            {/* Search bar */}
            {tab === 'search' && (
              <div className="flex gap-2 px-4 py-3 border-b border-teal/10">
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                  placeholder="Titre du chant, artiste…"
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
            )}

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {error && (
                <p className="font-sans text-sm text-dark/40 text-center py-8">{error}</p>
              )}
              {loading && !error && (
                <p className="font-sans text-xs text-dark/30 text-center py-8">Chargement…</p>
              )}
              {!loading && list.map(r => (
                <button
                  key={r.title}
                  onClick={() => importSong(r.title)}
                  disabled={!!fetchingTitle}
                  className="w-full text-left px-5 py-3 hover:bg-teal/5 transition-colors border-b border-teal/5 flex items-center justify-between group"
                >
                  <span className="font-sans text-sm text-dark group-hover:text-teal transition-colors">
                    {r.title}
                  </span>
                  <span className="font-sans text-xs text-teal/50 shrink-0 ml-3">
                    {fetchingTitle === r.title ? '⏳ Import…' : 'Importer →'}
                  </span>
                </button>
              ))}
            </div>

            {/* Browse pagination */}
            {tab === 'browse' && !loading && (
              <div className="flex gap-2 px-4 py-3 border-t border-teal/10">
                {browseCont && (
                  <button
                    onClick={() => browse(browseCont)}
                    className="flex-1 py-2 bg-teal/10 hover:bg-teal/20 text-teal rounded-lg font-sans text-xs font-medium transition-colors"
                  >
                    Suivants →
                  </button>
                )}
              </div>
            )}

            {/* Note copyright */}
            <p className="font-sans text-[10px] text-dark/25 text-center px-4 py-2 border-t border-teal/5">
              Contenu fourni par shir.fr · Droits réservés aux auteurs · Usage interne uniquement
            </p>
          </div>
        </div>
      )}
    </>
  )
}
