import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { addBlockout, removeBlockout } from './actions'

export default async function IndisponibilitesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const params = await searchParams

  const { data: blockouts } = await supabase
    .from('blockout_dates')
    .select('id, start_date, end_date, reason')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })

  const today = new Date().toISOString().split('T')[0]

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  const fmtLong = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const count = blockouts?.length ?? 0

  return (
    <>
      {/* ══ MOBILE ══ */}
      <div className="lg:hidden min-h-screen bg-teal-50">
        <div className="px-5 pb-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 52px)' }}>
          <p className="font-sans text-[10px] uppercase tracking-widest text-teal font-semibold">Disponibilité</p>
          <h1 className="font-display text-[2.4rem] text-dark font-light leading-tight mt-0.5">Mes indispos</h1>
          <p className="font-sans text-sm text-dark/50 mt-2 leading-snug">
            Indique tes dates d&rsquo;absence — tu ne seras pas programmé(e) sur ces périodes.
          </p>
        </div>

        <div className="px-4 pb-6 space-y-4">
          {params.success === 'added' && (
            <div className="bg-teal/10 rounded-2xl px-4 py-3 font-sans text-sm text-teal-dark">
              Indisponibilité enregistrée.
            </div>
          )}

          {/* Formulaire */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <form action={addBlockout} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">DU</label>
                  <input
                    name="start_date"
                    type="date"
                    required
                    min={today}
                    defaultValue={today}
                    className="w-full py-2 rounded-xl border border-dark/10 bg-teal-50 text-teal-dark font-sans focus:outline-none focus:ring-2 focus:ring-teal/30"
                    style={{ fontSize: '16px', paddingLeft: '10px', paddingRight: '4px', WebkitAppearance: 'none' }}
                  />
                </div>
                <span className="text-dark/25 font-sans text-sm shrink-0 mt-5">→</span>
                <div className="flex-1 min-w-0">
                  <label className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">AU</label>
                  <input
                    name="end_date"
                    type="date"
                    min={today}
                    defaultValue={today}
                    className="w-full py-2 rounded-xl border border-dark/10 bg-teal-50 text-teal-dark font-sans focus:outline-none focus:ring-2 focus:ring-teal/30"
                    style={{ fontSize: '16px', paddingLeft: '10px', paddingRight: '4px', WebkitAppearance: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-2">
                  RAISON <span className="normal-case tracking-normal font-normal text-dark/30">(optionnel)</span>
                </label>
                <input
                  name="reason"
                  type="text"
                  placeholder="Vacances, voyage, maladie..."
                  className="w-full px-3 py-2.5 rounded-xl border border-dark/10 bg-white text-dark placeholder:text-dark/30 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </div>

              {params.error === 'dates' && (
                <p className="font-sans text-xs text-red-500">La date de fin doit être après la date de début.</p>
              )}

              <button
                type="submit"
                className="w-full py-3.5 text-white rounded-xl font-sans text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-teal-dark))' }}
              >
                Enregistrer
              </button>
            </form>
          </div>

          {/* Périodes déclarées */}
          {count > 0 && (
            <section>
              <p className="font-sans text-[10px] uppercase tracking-widest text-dark/35 font-semibold mb-3 px-1">
                Périodes déclarées · {count}
              </p>
              <div className="space-y-2">
                {blockouts!.map(b => {
                  const isSameDay = b.start_date === b.end_date
                  const isPast    = b.end_date < today
                  const label = isSameDay
                    ? fmtLong(b.start_date)
                    : `${fmtLong(b.start_date)} → ${fmtLong(b.end_date)}`

                  return (
                    <div key={b.id} className={`bg-white rounded-2xl px-4 py-4 flex items-center justify-between gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ${isPast ? 'opacity-50' : ''}`}>
                      <div className="min-w-0">
                        <p className="font-sans text-sm font-semibold text-dark">
                          {label}
                          {isPast && <span className="font-normal text-dark/40 ml-1 text-xs">· passée</span>}
                        </p>
                        {b.reason && <p className="font-sans text-xs text-dark/40 mt-0.5">{b.reason}</p>}
                      </div>
                      <form action={removeBlockout} className="shrink-0">
                        <input type="hidden" name="id" value={b.id} />
                        <button type="submit" className="w-8 h-8 rounded-full bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {count === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <p className="font-sans text-sm text-dark/40">Aucune indisponibilité enregistrée.</p>
            </div>
          )}
        </div>
      </div>

      {/* ══ DESKTOP ══ */}
      <div className="hidden lg:block min-h-screen bg-sand">
        <header className="bg-white border-b border-teal/20 px-4 md:px-6 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Planifier</p>
            <h1 className="font-display text-2xl text-dark font-light">Mes indisponibilités</h1>
          </div>
        </header>

        <main className="px-6 md:px-10 py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            {params.success === 'added' && (
              <div className="bg-teal-light border border-teal/20 text-teal-dark rounded-xl px-4 py-3 font-sans text-sm">
                Indisponibilité enregistrée.
              </div>
            )}
            {params.error === 'insert' && (
              <div className="bg-red-50 border border-red-200 text-red-500 rounded-xl px-4 py-3 font-sans text-sm">
                Une erreur s'est produite. Veuillez réessayer.
              </div>
            )}

            <section>
              <h2 className="font-display text-xl text-dark font-light mb-3">Ajouter une période</h2>
              <div className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
                <form action={addBlockout} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-sans text-dark/50 mb-1">Du</label>
                      <input name="start_date" type="date" required min={today} className="w-full px-3 py-2 rounded-lg border border-teal/30 bg-teal-50 text-dark font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal/40" />
                    </div>
                    <div>
                      <label className="block text-xs font-sans text-dark/50 mb-1">Au</label>
                      <input name="end_date" type="date" min={today} className="w-full px-3 py-2 rounded-lg border border-teal/30 bg-teal-50 text-dark font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal/40" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-sans text-dark/50 mb-1">Raison <span className="text-dark/30">(optionnel)</span></label>
                    <input name="reason" type="text" placeholder="Vacances, voyage, maladie…" className="w-full px-3 py-2 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal/40" />
                  </div>
                  {params.error === 'dates' && <p className="text-sm text-red-500 font-sans">La date de fin doit être après la date de début.</p>}
                  <button type="submit" className="w-full py-2.5 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal-dark transition-colors">Enregistrer</button>
                </form>
              </div>
            </section>

            <section>
              <h2 className="font-display text-xl text-dark font-light mb-3">
                {count > 0 ? `${count} période${count > 1 ? 's' : ''} enregistrée${count > 1 ? 's' : ''}` : 'Périodes enregistrées'}
              </h2>
              <div className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
                {count > 0 ? (
                  <div className="divide-y divide-teal/10">
                    {blockouts!.map(b => {
                      const isSameDay = b.start_date === b.end_date
                      const isPast    = b.end_date < today
                      const s = fmtLong(b.start_date)
                      const e = fmtLong(b.end_date)
                      return (
                        <div key={b.id} className={`px-6 py-4 flex items-center justify-between gap-4 hover:bg-teal-50/40 transition-colors ${isPast ? 'opacity-50' : ''}`}>
                          <div className="min-w-0">
                            <p className="font-sans text-sm font-medium text-dark">
                              {isSameDay ? s : `${s} → ${e}`}
                              {isPast && <span className="ml-2 text-xs text-dark/30 font-normal">(passée)</span>}
                            </p>
                            {b.reason && <p className="font-sans text-xs text-dark/40 mt-0.5">{b.reason}</p>}
                          </div>
                          <form action={removeBlockout} className="shrink-0">
                            <input type="hidden" name="id" value={b.id} />
                            <button type="submit" className="text-dark/30 hover:text-red-400 transition-colors font-sans text-sm">Supprimer</button>
                          </form>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-10 text-center">
                    <p className="font-sans text-sm text-dark/40">Aucune indisponibilité enregistrée.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  )
}
