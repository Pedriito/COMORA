import { requireChurch } from '@/lib/auth/church'
import Link from 'next/link'
import { FlashMessage } from '../../_components/FlashMessage'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function normalizeFirst(title: string): string {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()[0] ?? '#'
}

export default async function AdminChantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleted?: string; tab?: string }>
}) {
  const { supabase, church } = await requireChurch('responsable')

  const { q, deleted, tab } = await searchParams
  const search = q?.trim() ?? ''
  const activeTab = tab ?? 'tous'

  let query = supabase
    .from('songs')
    .select('id, title, arrangements(id, chord_chart_key)')
    .eq('church_id', church.churchId)
    .order('title')

  if (search) query = query.ilike('title', `%${search}%`)

  const { data: songs } = await query

  // Grouper par lettre (seulement sans recherche active)
  const grouped: Record<string, typeof songs> = {}
  if (!search && songs) {
    for (const song of songs) {
      const letter = normalizeFirst(song.title)
      if (!grouped[letter]) grouped[letter] = []
      grouped[letter]!.push(song)
    }
  }

  const lettersWithSongs = new Set(Object.keys(grouped))

  const tabs = [
    { key: 'tous',     label: 'Tous' },
    { key: 'favoris',  label: 'Favoris' },
    { key: 'recent',   label: 'Récemment chantés' },
    { key: 'never',    label: 'Jamais utilisés' },
  ]

  function tabHref(key: string) {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (key !== 'tous') params.set('tab', key)
    const qs = params.toString()
    return `/espace/admin/chants${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-4 flex items-center gap-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <Link href="/espace/admin" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm shrink-0">←</Link>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Banque de Louange</p>
          <h1 className="font-display text-2xl text-dark font-light">Chants · {songs?.length ?? 0}</h1>
        </div>
        <Link
          href="/espace/admin/chants/nouveau"
          className="shrink-0 px-3 md:px-4 py-2 bg-coral text-white rounded-lg font-sans text-sm font-medium hover:bg-coral/90 transition-colors"
        >
          + Nouveau chant
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-4">

        {deleted && (
          <FlashMessage type="success" message="Chant supprimé." />
        )}

        {/* Recherche */}
        <form method="GET" className="relative">
          {activeTab !== 'tous' && <input type="hidden" name="tab" value={activeTab} />}
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark/30 pointer-events-none">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
          <input
            name="q"
            defaultValue={search}
            placeholder="Rechercher par titre ou tonalité…"
            autoComplete="off"
            className="w-full bg-white border border-teal/20 rounded-2xl pl-10 pr-10 py-3 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          {search && (
            <Link
              href={tabHref(activeTab).split('?')[0] + (activeTab !== 'tous' ? `?tab=${activeTab}` : '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark/30 hover:text-dark text-lg"
            >
              ×
            </Link>
          )}
        </form>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map(t => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-sans transition-colors ${
                activeTab === t.key
                  ? 'bg-teal text-white'
                  : 'bg-white border border-teal/20 text-dark/60 hover:bg-teal/5'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* A-Z quick nav (desktop) */}
        {!search && (
          <div className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-10 flex-col gap-0.5">
            {ALPHABET.map(letter => (
              lettersWithSongs.has(letter) ? (
                <a
                  key={letter}
                  href={`#letter-${letter}`}
                  className="text-teal font-sans text-xs font-medium hover:text-teal-dark leading-tight"
                >
                  {letter}
                </a>
              ) : (
                <span key={letter} className="text-dark/20 font-sans text-xs leading-tight">{letter}</span>
              )
            ))}
          </div>
        )}

        {/* Contenu */}
        {search ? (
          /* Résultats de recherche : liste plate */
          <div className="space-y-2">
            {(songs ?? []).map(song => {
              const firstKey = (song.arrangements as { id: string; chord_chart_key: string | null }[])
                .map(a => a.chord_chart_key).filter(Boolean)[0] ?? null
              return (
                <SongRow key={song.id} song={song} firstKey={firstKey} />
              )
            })}
            {(songs ?? []).length === 0 && (
              <div className="text-center py-12">
                <p className="font-sans text-sm text-dark/40">Aucun résultat pour &ldquo;{search}&rdquo;</p>
              </div>
            )}
          </div>
        ) : (
          /* Vue alphabétique */
          <div className="space-y-6">
            {ALPHABET.filter(l => grouped[l]?.length).map(letter => (
              <div key={letter} id={`letter-${letter}`} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 300px' }}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display text-xl text-teal font-light">{letter}</h2>
                  <span className="font-sans text-xs text-dark/40">{grouped[letter]!.length}</span>
                </div>
                <div className="bg-white rounded-2xl border border-teal/20 overflow-hidden divide-y divide-teal/10">
                  {grouped[letter]!.map(song => {
                    const firstKey = (song.arrangements as { id: string; chord_chart_key: string | null }[])
                      .map(a => a.chord_chart_key).filter(Boolean)[0] ?? null
                    return <SongRow key={song.id} song={song} firstKey={firstKey} grouped />
                  })}
                </div>
              </div>
            ))}
            {(songs ?? []).length === 0 && (
              <div className="text-center py-12">
                <p className="font-sans text-sm text-dark/40">Aucun chant.</p>
                <Link href="/espace/admin/chants/nouveau" className="mt-3 inline-block text-teal font-sans text-sm hover:underline">
                  Créer le premier chant →
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function SongRow({
  song,
  firstKey,
  grouped = false,
}: {
  song: { id: string; title: string }
  firstKey: string | null
  grouped?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 hover:bg-teal-50/60 transition-colors ${!grouped ? 'bg-white rounded-2xl border border-teal/20' : ''}`}>
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal/10 text-teal font-sans text-xs font-medium shrink-0">
        {firstKey ?? '—'}
      </span>
      <p className="font-sans text-sm text-dark flex-1 min-w-0 truncate">{song.title}</p>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/espace/chants/${song.id}`}
          prefetch={false}
          className="px-3 py-1.5 font-sans text-xs text-dark/40 hover:text-dark hover:bg-teal/5 rounded-lg transition-colors"
        >
          Voir
        </Link>
        <Link
          href={`/espace/admin/chants/${song.id}/modifier`}
          prefetch={false}
          className="px-3 py-1.5 bg-teal/10 text-teal font-sans text-xs rounded-lg hover:bg-teal/20 transition-colors font-medium"
        >
          Modifier
        </Link>
      </div>
    </div>
  )
}
