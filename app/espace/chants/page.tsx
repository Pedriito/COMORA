import { requireChurch } from '@/lib/auth/church'
import Link from 'next/link'

type Song = {
  id: string
  title: string
  ccli: string | null
  themes: string | null
  last_scheduled_date: string | null
  arrangements: { id: string; chord_chart_key: string | null }[]
}

const PAGE_SIZE = 100

export default async function ChantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { supabase, church } = await requireChurch('membre')

  const { q, page: pageParam } = await searchParams
  const search = q?.trim() ?? ''
  const page   = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const start  = (page - 1) * PAGE_SIZE
  const end    = start + PAGE_SIZE - 1

  let baseQuery = supabase
    .from('songs')
    .select('id, title, ccli, themes, last_scheduled_date, arrangements(id, chord_chart_key)')
    .eq('church_id', church.churchId)
    .order('title')

  if (search) baseQuery = baseQuery.ilike('title', `%${search}%`)

  const [{ data: songs }, { count: totalCount }] = await Promise.all([
    search ? baseQuery : baseQuery.range(start, end),
    search
      ? Promise.resolve({ count: null })
      : supabase.from('songs').select('id', { count: 'exact', head: true }).eq('church_id', church.churchId),
  ])
  const count    = songs?.length ?? 0
  const total    = totalCount ?? count
  const hasNext  = !search && end < total - 1
  const hasPrev  = !search && page > 1

  return (
    <>
      {/* ══ MOBILE ══ */}
      <div className="lg:hidden min-h-screen bg-teal-50">
        <div className="px-5 pb-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 52px)' }}>
          <p className="font-sans text-[10px] uppercase tracking-widest text-teal font-semibold">Répertoire</p>
          <h1 className="font-display text-[2.4rem] text-dark font-light leading-tight mt-0.5">
            Chants
            {!search && <span className="font-sans text-2xl text-dark/30 ml-2">· {total}</span>}
          </h1>
        </div>

        <div className="px-4 pb-6 space-y-3">
          {/* Recherche */}
          <form method="GET">
            <div className="flex items-center bg-white rounded-2xl focus-within:ring-2 focus-within:ring-teal/30 shadow-[0_1px_4px_rgba(0,0,0,0.06)]" style={{ paddingLeft: '14px', paddingRight: '14px' }}>
              <svg className="w-4 h-4 text-dark/30 shrink-0 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                name="q"
                defaultValue={search}
                placeholder="Rechercher un chant..."
                className="flex-1 min-w-0 bg-transparent py-3.5 px-3 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none border-0"
              />
              {search && (
                <Link href="/espace/chants" className="shrink-0 text-dark/30 text-xl leading-none">×</Link>
              )}
            </div>
          </form>

          {/* Liste */}
          <div className="space-y-2">
            {(songs ?? []).map(song => {
              const key = song.arrangements.find(a => a.chord_chart_key)?.chord_chart_key ?? null
              const theme = song.themes?.split(',')[0]?.trim() ?? null

              return (
                <Link
                  key={song.id}
                  href={`/espace/chants/${song.id}`}
                  prefetch={false}
                  className="bg-white rounded-2xl px-3.5 py-3 flex items-center gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow"
                >
                  {key ? (
                    <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                      <span className="font-sans text-xs font-semibold text-teal">{key}</span>
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-dark/5 flex items-center justify-center shrink-0">
                      <span className="font-sans text-xs text-dark/30">—</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm font-medium text-dark truncate">{song.title}</p>
                    <p className="font-sans text-xs text-dark/40 mt-0.5 truncate">
                      {theme ?? ''}
                      {song.ccli && <span className={theme ? 'ml-1' : ''}>CCLI {song.ccli}</span>}
                    </p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-dark/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              )
            })}

            {count === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <p className="font-sans text-sm text-dark/40">
                  {search ? `Aucun chant pour "${search}"` : 'Aucun chant importé.'}
                </p>
              </div>
            )}

            {/* Pagination mobile */}
            {(hasPrev || hasNext) && (
              <div className="flex items-center justify-between pt-2">
                {hasPrev ? (
                  <Link href={`/espace/chants?page=${page - 1}`} className="px-4 py-2.5 bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] font-sans text-sm text-dark/70">← Précédent</Link>
                ) : <span />}
                <span className="font-sans text-xs text-dark/40">{page} / {Math.ceil(total / PAGE_SIZE)}</span>
                {hasNext ? (
                  <Link href={`/espace/chants?page=${page + 1}`} className="px-4 py-2.5 bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] font-sans text-sm text-dark/70">Suivant →</Link>
                ) : <span />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ DESKTOP ══ */}
      <div className="hidden lg:block min-h-screen bg-sand">
        <header className="bg-white border-b border-dark/8 px-6 md:px-10 py-5">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl text-dark font-light">Chants</h1>
              <p className="font-sans text-xs text-dark/40 mt-0.5">{search ? `${count} résultat${count > 1 ? 's' : ''}` : `${total} chant${total > 1 ? 's' : ''}`}</p>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 md:px-10 py-6 space-y-4">
          <form method="GET" className="relative">
            <input
              name="q"
              defaultValue={search}
              placeholder="Rechercher un chant…"
              className="w-full bg-white border border-dark/8 rounded-2xl px-4 py-3 pr-10 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30 shadow-sm"
            />
            {search && (
              <Link href="/espace/chants" className="absolute right-3 top-1/2 -translate-y-1/2 text-dark/30 hover:text-dark text-lg">×</Link>
            )}
          </form>

          <div className="bg-white rounded-2xl border border-dark/8 shadow-sm overflow-hidden">
            {(songs ?? []).map(song => {
              const keys = song.arrangements.map(a => a.chord_chart_key).filter(Boolean).join(', ')
              return (
                <Link
                  key={song.id}
                  href={`/espace/chants/${song.id}`}
                  prefetch={false}
                  className="flex items-center justify-between border-b border-dark/6 last:border-0 px-5 py-4 hover:bg-sand/50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm text-dark font-medium truncate">{song.title}</p>
                    <p className="font-sans text-xs text-dark/40 mt-0.5">
                      {keys || 'aucune tonalité'}
                      {song.ccli && <span className="ml-2 text-dark/25">CCLI {song.ccli}</span>}
                    </p>
                  </div>
                  <span className="text-dark/25 font-sans text-sm group-hover:translate-x-0.5 transition-transform shrink-0 ml-3">→</span>
                </Link>
              )
            })}
            {count === 0 && (
              <div className="text-center py-12">
                <p className="font-sans text-sm text-dark/40">{search ? `Aucun chant pour "${search}"` : 'Aucun chant importé.'}</p>
              </div>
            )}
          </div>

          {/* Pagination desktop */}
          {(hasPrev || hasNext) && (
            <div className="flex items-center justify-between">
              {hasPrev ? (
                <Link href={`/espace/chants?page=${page - 1}`} className="px-4 py-2 bg-white border border-dark/8 rounded-xl font-sans text-sm text-dark/70 hover:bg-sand/50 transition-colors">← Précédent</Link>
              ) : <span />}
              <span className="font-sans text-xs text-dark/40">Page {page} sur {Math.ceil(total / PAGE_SIZE)}</span>
              {hasNext ? (
                <Link href={`/espace/chants?page=${page + 1}`} className="px-4 py-2 bg-white border border-dark/8 rounded-xl font-sans text-sm text-dark/70 hover:bg-sand/50 transition-colors">Suivant →</Link>
              ) : <span />}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
