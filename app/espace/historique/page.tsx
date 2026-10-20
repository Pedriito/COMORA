import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { respondAssignmentOnHistorique } from '../admin/plans/actions'
import { assignmentStatusLabels } from '@/lib/labels'

export default async function HistoriquePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const [{ data: profile }, { data: rawAssignments }] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single(),
    supabase
      .from('plan_assignments')
      .select('id, status, plans(id, title, service_date), positions(name), teams(name)')
      .eq('user_id', user.id),
  ])

  const now = new Date()

  type Assignment = NonNullable<typeof rawAssignments>[number]
  const planDate = (a: Assignment) => new Date((a.plans as unknown as { service_date: string } | null)?.service_date ?? 0)

  const upcoming = (rawAssignments ?? [])
    .filter(a => planDate(a) >= now)
    .sort((a, b) => planDate(a).getTime() - planDate(b).getTime())

  const past = (rawAssignments ?? [])
    .filter(a => planDate(a) < now)
    .sort((a, b) => planDate(b).getTime() - planDate(a).getTime())

  const total     = past.length
  const confirmed = past.filter(a => a.status === 'confirmed').length
  const taux      = total > 0 ? Math.round((confirmed / total) * 100) : 0

  const fmtShort = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleDateString('fr-FR', opts).replace('.', '').toUpperCase()

  const statusBadge = (status: string) => {
    if (status === 'confirmed') return { dot: 'bg-green-500',  pill: 'bg-green-50 text-green-700',   label: assignmentStatusLabels.confirmed }
    if (status === 'pending')   return { dot: 'bg-amber-400',  pill: 'bg-amber-50 text-amber-600',   label: assignmentStatusLabels.pending   }
    return                             { dot: 'bg-red-400',    pill: 'bg-red-50 text-red-400',       label: assignmentStatusLabels.declined  }
  }

  const AssignmentCard = ({ a, dimmed = false }: { a: Assignment; dimmed?: boolean }) => {
    const plan = a.plans     as unknown as { id: string; title: string; service_date: string } | null
    const pos  = a.positions as unknown as { name: string } | null
    const team = a.teams     as unknown as { name: string } | null
    const d    = plan?.service_date ? new Date(plan.service_date) : null
    const wd   = d ? fmtShort(plan!.service_date, { weekday: 'short' }) : ''
    const day  = d ? d.getDate() : ''
    const mon  = d ? fmtShort(plan!.service_date, { month: 'short' }) : ''
    const time = d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
    const details = [time, pos?.name, team?.name].filter(Boolean).join(' · ')
    const badge = statusBadge(a.status)
    const isPending = a.status === 'pending'

    return (
      <div className={`bg-white rounded-2xl px-4 py-4 flex items-center gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ${dimmed ? 'opacity-50' : ''}`}>
        {/* Date — lien vers le service */}
        <Link href={plan ? `/espace/admin/plans/${plan.id}` : '#'} className="w-10 shrink-0 text-center leading-none">
          <div className="font-sans text-[9px] text-teal uppercase tracking-wide font-semibold">{wd}</div>
          <div className="font-display text-[26px] text-teal font-semibold leading-tight">{day}</div>
          <div className="font-sans text-[9px] text-teal uppercase tracking-wide font-semibold">{mon}</div>
        </Link>

        {/* Infos — lien vers le service */}
        <Link href={plan ? `/espace/admin/plans/${plan.id}` : '#'} className="flex-1 min-w-0">
          <p className="font-sans text-sm font-semibold text-dark truncate">{plan?.title ?? '—'}</p>
          {details && <p className="font-sans text-xs text-dark/40 mt-0.5">{details}</p>}
        </Link>

        {/* Droite : boutons si en attente, badge + désistement si confirmé, badge seul sinon */}
        {isPending ? (
          <div className="flex items-center gap-2 shrink-0">
            <form action={respondAssignmentOnHistorique}>
              <input type="hidden" name="assignment_id" value={a.id} />
              <input type="hidden" name="status" value="declined" />
              <button
                type="submit"
                aria-label="Décliner"
                className="w-10 h-10 rounded-full border border-red-200 bg-white flex items-center justify-center text-red-400 hover:bg-red-50 active:scale-90 transition-all"
              >
                <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 2l10 10M12 2L2 12" />
                </svg>
              </button>
            </form>
            <form action={respondAssignmentOnHistorique}>
              <input type="hidden" name="assignment_id" value={a.id} />
              <input type="hidden" name="status" value="confirmed" />
              <button
                type="submit"
                aria-label="Confirmer"
                className="w-10 h-10 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-green-600 hover:bg-green-100 active:scale-90 transition-all"
              >
                <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1.5 7.5l3.5 3.5 7-7" />
                </svg>
              </button>
            </form>
          </div>
        ) : (
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-sans text-xs font-medium ${badge.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dot}`} />
              {badge.label}
            </span>
            {!dimmed && a.status === 'confirmed' && (
              <form action={respondAssignmentOnHistorique}>
                <input type="hidden" name="assignment_id" value={a.id} />
                <input type="hidden" name="status" value="declined" />
                <button type="submit" className="font-sans text-xs text-red-400/70 hover:text-red-500 transition-colors">
                  Se désister
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ══ MOBILE ══ */}
      <div className="lg:hidden min-h-screen bg-teal-50">
        <div className="px-5 pb-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 52px)' }}>
          <p className="font-sans text-[10px] uppercase tracking-widest text-teal font-semibold">Mes services</p>
          <h1 className="font-display text-[2.4rem] text-dark font-light leading-tight mt-0.5">Mon planning</h1>
        </div>

        <div className="px-4 pb-6 space-y-3">
          {upcoming.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <p className="font-sans text-sm text-dark/40">Aucun service à venir.</p>
            </div>
          )}
          {upcoming.map(a => <AssignmentCard key={a.id} a={a} />)}

          {past.length > 0 && (
            <>
              <p className="font-sans text-[10px] uppercase tracking-widest text-dark/35 font-semibold pt-2 px-1">Passés</p>
              {past.map(a => <AssignmentCard key={a.id} a={a} dimmed />)}
            </>
          )}
        </div>
      </div>

      {/* ══ DESKTOP ══ */}
      <div className="hidden lg:block min-h-screen bg-sand">
        <header className="bg-white border-b border-dark/8 px-6 md:px-10 py-5">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-display text-3xl text-dark font-light">Historique</h1>
            <p className="font-sans text-sm text-dark/40 mt-1">{profile?.first_name} {profile?.last_name}</p>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 md:px-10 py-8 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[{ label: 'Services', value: total }, { label: 'Confirmés', value: confirmed }, { label: 'Taux', value: `${taux} %` }].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-dark/8 p-5 text-center">
                <p className="font-display text-3xl text-teal font-light">{s.value}</p>
                <p className="font-sans text-[10px] text-dark/35 mt-2 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>

          {past.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dark/8 px-6 py-12 text-center">
              <p className="font-sans text-sm text-dark/40">Aucun service passé.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dark/8 overflow-hidden divide-y divide-dark/6">
              {past.map(a => {
                const plan = a.plans     as unknown as { title: string; service_date: string } | null
                const pos  = a.positions as unknown as { name: string } | null
                const team = a.teams     as unknown as { name: string } | null
                const d    = plan?.service_date ? new Date(plan.service_date) : null
                const wd   = d ? fmtShort(plan!.service_date, { weekday: 'short' }) : ''
                const day  = d ? d.getDate() : ''
                const mon  = d ? fmtShort(plan!.service_date, { month: 'short' }) : ''
                const badge = statusBadge(a.status)
                return (
                  <div key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-sand/50 transition-colors">
                    <div className="w-9 shrink-0 text-center leading-none">
                      <div className="font-sans text-[9px] text-dark/35 uppercase tracking-wide">{wd}</div>
                      <div className="font-display text-[22px] text-dark/60 font-light my-0.5">{day}</div>
                      <div className="font-sans text-[9px] text-dark/35 uppercase tracking-wide">{mon}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm text-dark font-medium truncate">{plan?.title ?? '—'}</p>
                      {(pos?.name ?? team?.name) && <p className="font-sans text-xs text-dark/40 mt-0.5">{pos?.name ?? team?.name}</p>}
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-sans text-xs font-medium ${badge.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
