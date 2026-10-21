import Link from 'next/link'
import { requireChurch } from '@/lib/auth/church'
import { resolveTimeZone, startOfLocalDayUtc, utcToLocalParts } from '@/lib/timezone'
import { respondAssignment } from '../admin/plans/actions'
import { CancelAssignmentButton } from './CancelAssignmentButton'
import { PushManager } from '../_components/PushManager'
import { PushPromptCard } from '../_components/PushPromptCard'
import { IconBan, IconMusicalNote } from '../_components/Icons'

export default async function DashboardPage() {
  const ctx = await requireChurch('membre')
  const { supabase, memberId } = ctx
  const churchId = ctx.church.churchId

  const empty = Promise.resolve({ data: null })
  const [
    { data: church },
    { data: account },
    { data: member },
    { data: teamMemberships },
    { data: assignments },
    { data: confirmedHistory },
  ] = await Promise.all([
    supabase.from('churches').select('timezone').eq('id', churchId).maybeSingle(),
    supabase.from('profiles').select('first_name, last_name').eq('id', ctx.userId).maybeSingle(),
    memberId
      ? supabase.from('members').select('first_name, last_name').eq('id', memberId).eq('church_id', churchId).maybeSingle()
      : empty,
    memberId
      ? supabase.from('team_members').select('role, teams(id, name)').eq('church_id', churchId).eq('member_id', memberId)
      : empty,
    memberId
      ? supabase.from('plan_assignments')
          .select('id, status, plans(id, title, service_date), positions(name), teams(name)')
          .eq('church_id', churchId)
          .eq('member_id', memberId).order('created_at', { ascending: false }).limit(20)
      : empty,
    memberId
      ? supabase.from('plan_assignments')
          .select('plans(service_date)').eq('church_id', churchId).eq('member_id', memberId).eq('status', 'confirmed')
      : empty,
  ])

  // Dates et heures affichées dans le fuseau de l'église
  const timeZone = resolveTimeZone(church?.timezone)
  const profile = member ?? account

  const now = new Date()
  const today = utcToLocalParts(now, timeZone)
  const quarterMonth = Math.floor((today.month - 1) / 3) * 3 + 1
  const yearStart    = startOfLocalDayUtc(`${today.year}-01-01`, timeZone)
  const quarterStart = startOfLocalDayUtc(`${today.year}-${String(quarterMonth).padStart(2, '0')}-01`, timeZone)

  const upcoming = (assignments ?? [])
    .filter(a => {
      const plan = a.plans as unknown as { service_date: string } | null
      return plan && new Date(plan.service_date) >= now
    })
    .sort((a, b) => {
      const dA = (a.plans as unknown as { service_date: string } | null)?.service_date ?? ''
      const dB = (b.plans as unknown as { service_date: string } | null)?.service_date ?? ''
      return dA.localeCompare(dB)
    })

  const pending       = upcoming.filter(a => a.status === 'pending')
  const nextConfirmed = upcoming.find(a => a.status === 'confirmed')
  const nextPlan      = nextConfirmed
    ? nextConfirmed.plans as unknown as { id: string; title: string; service_date: string } | null
    : null

  const yearCount = (confirmedHistory ?? []).filter(a => {
    const d = (a.plans as unknown as { service_date: string } | null)?.service_date
    return d && new Date(d) >= new Date(yearStart)
  }).length
  const quarterCount = (confirmedHistory ?? []).filter(a => {
    const d = (a.plans as unknown as { service_date: string } | null)?.service_date
    return d && new Date(d) >= new Date(quarterStart)
  }).length

  const daysUntil = nextPlan
    ? Math.ceil((new Date(nextPlan.service_date).getTime() - now.getTime()) / 86_400_000)
    : null

  const mobileDateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).toUpperCase()
  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase() || 'B'

  const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) => {
    const s = new Date(iso).toLocaleDateString('fr-FR', { ...opts, timeZone })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  return (
    <>
      {/* ══════════════════════════════════════════════════
          MOBILE (< lg)
      ══════════════════════════════════════════════════ */}
      <div className="lg:hidden min-h-screen bg-teal-50">

        {/* En-tête : date + bonjour + avatar */}
        <div
          className="px-5 pb-5 flex items-start justify-between"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 52px)' }}
        >
          <div>
            <p className="font-sans text-[11px] uppercase tracking-widest text-teal font-semibold">
              {mobileDateLabel}
            </p>
            <h1 className="font-display text-[2.6rem] text-dark font-light leading-[1.1] mt-1">
              Bonjour, {profile?.first_name}
            </h1>
          </div>
          <Link
            href="/espace/profil"
            className="w-11 h-11 rounded-full bg-teal/15 flex items-center justify-center shrink-0 mt-2"
          >
            <span className="font-sans text-sm font-semibold text-teal-dark">{initials}</span>
          </Link>
        </div>

        <div className="px-4 space-y-4 pb-6">

          {/* Prochain service */}
          {nextPlan && (
            <div
              className="p-5 text-white"
              style={{
                background: 'linear-gradient(135deg, var(--color-teal), var(--color-teal-dark))',
                borderRadius: '1.5rem',
                overflow: 'hidden',
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="font-sans text-[10px] uppercase tracking-widest text-white/60 font-semibold pt-0.5">
                  Prochain service
                </p>
                <span className="shrink-0 font-sans text-sm text-white/80 bg-white/15 px-3 py-0.5 rounded-full">
                  {new Date(nextPlan.service_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone })}
                </span>
              </div>
              <h2 className="font-display text-[1.9rem] text-white font-light leading-tight">
                {fmtDate(nextPlan.service_date, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              {(() => {
                const pos  = nextConfirmed?.positions as unknown as { name: string } | null
                const team = nextConfirmed?.teams     as unknown as { name: string } | null
                const sub  = [pos?.name, team?.name].filter(Boolean).join(' · ')
                return sub ? <p className="font-sans text-sm text-white/60 mt-1">{sub}</p> : null
              })()}
              <div className="border-t border-white/20 mt-4 pt-3 flex items-center justify-between">
                <p className="font-sans text-xs text-white/50">
                  {daysUntil !== null && daysUntil > 0
                    ? `Dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}`
                    : "Aujourd'hui"}
                </p>
                <Link href={`/espace/admin/plans/${nextPlan.id}`} className="font-sans text-sm text-white font-medium">
                  Voir le service →
                </Link>
              </div>
            </div>
          )}

          {/* À confirmer */}
          {pending.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <p className="font-sans text-[11px] uppercase tracking-widest font-bold text-dark/55">
                  À confirmer
                </p>
                <span className="w-5 h-5 rounded-full bg-amber-400 text-white font-sans text-[11px] font-bold flex items-center justify-center leading-none shrink-0">
                  {pending.length}
                </span>
              </div>
              <div className="space-y-3">
                {pending.map(a => {
                  const plan = a.plans     as unknown as { id: string; title: string; service_date: string } | null
                  const pos  = a.positions as unknown as { name: string } | null
                  const team = a.teams     as unknown as { name: string } | null
                  const dateLabel = plan?.service_date
                    ? fmtDate(plan.service_date, { weekday: 'long', day: 'numeric', month: 'long' })
                    : '—'
                  const subtitle = [plan?.title, pos?.name ?? team?.name].filter(Boolean).join(' · ')
                  return (
                    <div key={a.id} className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                      <p className="font-display text-xl text-dark">{dateLabel}</p>
                      <p className="font-sans text-sm text-dark/45 mt-0.5">{subtitle}</p>
                      <div className="flex items-center gap-3 mt-4">
                        <form action={respondAssignment} className="flex-1">
                          <input type="hidden" name="assignment_id" value={a.id} />
                          <input type="hidden" name="status" value="declined" />
                          <button type="submit" className="w-full py-3 bg-white border border-dark/10 text-coral rounded-2xl font-sans text-sm font-medium hover:bg-coral/5 transition-colors">
                            Décliner
                          </button>
                        </form>
                        <form action={respondAssignment} className="flex-1">
                          <input type="hidden" name="assignment_id" value={a.id} />
                          <input type="hidden" name="status" value="confirmed" />
                          <button type="submit" className="w-full py-3 bg-teal-dark text-white rounded-2xl font-sans text-sm font-medium hover:opacity-90 transition-opacity">
                            Je serai présent·e
                          </button>
                        </form>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Prompt notifications push */}
          <PushPromptCard />

          {/* Raccourcis rapides */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/espace/mes-indisponibilites" className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow">
              <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
                <IconBan className="w-5 h-5 text-teal" />
              </div>
              <p className="font-sans text-sm font-semibold text-dark">Mes indispos</p>
              <p className="font-sans text-xs text-dark/40 mt-0.5">Déclarer une absence</p>
            </Link>
            <Link href="/espace/chants" className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow">
              <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
                <IconMusicalNote className="w-5 h-5 text-teal" />
              </div>
              <p className="font-sans text-sm font-semibold text-dark">Les chants</p>
              <p className="font-sans text-xs text-dark/40 mt-0.5">Paroles &amp; accords</p>
            </Link>
          </div>

          {/* Mes équipes */}
          {teamMemberships && teamMemberships.length > 0 && (
            <section>
              <p className="font-sans text-[10px] uppercase tracking-widest text-dark/35 font-semibold mb-3 px-1">
                Mes équipes
              </p>
              <div className="flex flex-wrap gap-2">
                {teamMemberships.map((t, i) => {
                  const team = t.teams as unknown as { id: string; name: string } | null
                  if (!team) return null
                  return (
                    <Link
                      key={i}
                      href={`/espace/admin/equipes/${team.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-dark/10 rounded-full font-sans text-sm text-dark hover:border-teal/40 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                    >
                      {t.role === 'leader' && <span className="text-teal text-xs">★</span>}
                      {team.name}
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Stats discrètes */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-white/60 rounded-2xl px-4 py-4 text-center">
              <p className="font-display text-3xl text-teal font-light">{quarterCount}</p>
              <p className="font-sans text-[10px] uppercase tracking-widest text-dark/35 mt-1.5 leading-tight">Ce trimestre</p>
            </div>
            <div className="bg-white/60 rounded-2xl px-4 py-4 text-center">
              <p className="font-display text-3xl text-teal font-light">{yearCount}</p>
              <p className="font-sans text-[10px] uppercase tracking-widest text-dark/35 mt-1.5 leading-tight">Cette année</p>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          DESKTOP (lg+)
      ══════════════════════════════════════════════════ */}
      <div className="hidden lg:block min-h-screen bg-sand">

        <header className="bg-white border-b border-teal/20 px-4 md:px-6 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Mon espace</p>
            <h1 className="font-display text-2xl text-dark font-light">Tableau de bord</h1>
          </div>
          <div className="shrink-0">
            <PushManager />
          </div>
        </header>

        <main className="max-w-6xl mx-0 px-6 md:px-10 py-8">
          <div className="flex gap-6 items-start">

            {/* ── Colonne gauche ── */}
            <div className="flex-1 min-w-0 space-y-6">

              {pending.length > 0 && (
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <h2 className="font-display text-2xl text-dark font-light">À confirmer</h2>
                    <span className="w-6 h-6 rounded-full bg-amber-400 text-white font-sans text-xs font-bold flex items-center justify-center leading-none shrink-0">
                      {pending.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pending.map(a => {
                      const plan = a.plans     as unknown as { id: string; title: string; service_date: string } | null
                      const pos  = a.positions as unknown as { name: string } | null
                      const team = a.teams     as unknown as { name: string } | null
                      const d    = plan?.service_date ? new Date(plan.service_date) : null
                      const dateLabel = d ? fmtDate(plan!.service_date, { weekday: 'long', day: 'numeric', month: 'long' }) : '—'
                      const time = d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }) : ''
                      const subtitle = [plan?.title, pos?.name ?? team?.name, time].filter(Boolean).join(' · ')
                      return (
                        <div key={a.id} className="bg-white rounded-2xl border border-dark/8 border-l-[4px] border-l-amber-400 px-6 py-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-display text-xl text-dark font-light">{dateLabel}</p>
                            <p className="font-sans text-sm text-dark/45 mt-0.5">{subtitle}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <form action={respondAssignment}>
                              <input type="hidden" name="assignment_id" value={a.id} />
                              <input type="hidden" name="status" value="declined" />
                              <button type="submit" className="px-4 py-2 bg-white border border-dark/15 text-dark/60 rounded-full font-sans text-sm hover:bg-dark/5 transition-colors">Décliner</button>
                            </form>
                            <form action={respondAssignment}>
                              <input type="hidden" name="assignment_id" value={a.id} />
                              <input type="hidden" name="status" value="confirmed" />
                              <button type="submit" className="px-4 py-2 bg-teal-dark text-white rounded-full font-sans text-sm font-medium hover:opacity-90 transition-opacity">Je serai présent·e</button>
                            </form>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-2xl text-dark font-light">Mon planning</h2>
                  <Link href="/espace/historique" className="font-sans text-sm text-teal hover:underline">Tout voir →</Link>
                </div>
                <div className="bg-white rounded-2xl border border-dark/8 overflow-hidden">
                  {upcoming.length > 0 ? (
                    <div className="divide-y divide-dark/6">
                      {upcoming.map(a => {
                        const plan = a.plans     as unknown as { id: string; title: string; service_date: string } | null
                        const pos  = a.positions as unknown as { name: string } | null
                        const team = a.teams     as unknown as { name: string } | null
                        const d    = plan?.service_date ? new Date(plan.service_date) : null
                        const weekday = d ? d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone }).replace('.', '').toUpperCase() : ''
                        const dayNum  = d ? utcToLocalParts(d, timeZone).day : ''
                        const month   = d ? d.toLocaleDateString('fr-FR', { month: 'short', timeZone }).replace('.', '').toUpperCase() : ''
                        const time    = d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }) : ''
                        const details = [time, pos?.name, team?.name].filter(Boolean).join(' · ')
                        const isDeclined = a.status === 'declined'
                        return (
                          <div key={a.id} className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-sand/50 ${isDeclined ? 'opacity-40' : ''}`}>
                            <div className="w-9 shrink-0 text-center leading-none">
                              <div className="font-sans text-[9px] text-dark/35 uppercase tracking-wide">{weekday}</div>
                              <div className="font-display text-[22px] text-dark/70 font-light my-0.5">{dayNum}</div>
                              <div className="font-sans text-[9px] text-dark/35 uppercase tracking-wide">{month}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-sans text-sm font-medium text-dark truncate">{plan?.title ?? '—'}</p>
                              {details && <p className="font-sans text-xs text-dark/40 mt-0.5">{details}</p>}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {a.status === 'confirmed' && <span className="px-2.5 py-1 rounded-full font-sans text-xs font-medium bg-green-50 text-green-700 border border-green-200">Confirmé</span>}
                              {a.status === 'pending'   && <span className="px-2.5 py-1 rounded-full font-sans text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">En attente</span>}
                              {a.status === 'declined'  && <span className="px-2.5 py-1 rounded-full font-sans text-xs font-medium bg-red-50 text-red-400 border border-red-100">Décliné</span>}
                              {a.status === 'confirmed' && <CancelAssignmentButton assignmentId={a.id} />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="px-6 py-12 text-center">
                      <p className="font-sans text-sm text-dark/40">Aucun service planifié pour le moment.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* ── Colonne droite ── */}
            <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-3">

              {nextPlan && (
                <div className="bg-gradient-to-br from-teal to-teal-dark rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <p className="font-sans text-[10px] uppercase tracking-widest text-white/50 font-semibold mt-0.5">Prochain service</p>
                    <span className="shrink-0 font-sans text-xs text-white bg-black/20 px-2.5 py-1 rounded-full">
                      {new Date(nextPlan.service_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone })}
                    </span>
                  </div>
                  <p className="font-display text-2xl text-white font-light leading-tight">
                    {fmtDate(nextPlan.service_date, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {(() => {
                    const pos  = nextConfirmed?.positions as unknown as { name: string } | null
                    const team = nextConfirmed?.teams     as unknown as { name: string } | null
                    const sub  = [pos?.name, team?.name].filter(Boolean).join(' · ')
                    return sub ? <p className="font-sans text-sm text-white/55 mt-1">{sub}</p> : null
                  })()}
                  <div className="border-t border-white/15 mt-4 pt-3 flex items-center justify-between">
                    <p className="font-sans text-xs text-white/45">
                      {daysUntil !== null && daysUntil > 0 ? `Dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}` : "Aujourd'hui"}
                    </p>
                    <Link href={`/espace/admin/plans/${nextPlan.id}`} className="font-sans text-xs text-white/60 hover:text-white transition-colors">
                      Voir le service →
                    </Link>
                  </div>
                </div>
              )}

              <Link href="/espace/mes-indisponibilites" className="flex items-center justify-between bg-white rounded-2xl border border-dark/8 px-5 py-4 hover:border-dark/15 transition-colors group">
                <div>
                  <p className="font-sans text-sm font-semibold text-dark">Mes indisponibilités</p>
                  <p className="font-sans text-xs text-dark/40 mt-0.5">Déclarer une absence</p>
                </div>
                <span className="text-dark/25 font-sans text-sm group-hover:translate-x-0.5 transition-transform shrink-0">→</span>
              </Link>

              <Link href="/espace/chants" className="flex items-center justify-between bg-white rounded-2xl border border-dark/8 px-5 py-4 hover:border-dark/15 transition-colors group">
                <div>
                  <p className="font-sans text-sm font-semibold text-dark">Les chants</p>
                  <p className="font-sans text-xs text-dark/40 mt-0.5">Paroles &amp; accords</p>
                </div>
                <span className="text-dark/25 font-sans text-sm group-hover:translate-x-0.5 transition-transform shrink-0">→</span>
              </Link>

              <Link href="/espace/gestion" className="flex items-center justify-between bg-white rounded-2xl border border-dark/8 px-5 py-4 hover:border-dark/15 transition-colors group">
                <div>
                  <p className="font-sans text-sm font-semibold text-dark">Gestion équipes</p>
                  <p className="font-sans text-xs text-dark/40 mt-0.5">Tâches en attente</p>
                </div>
                <span className="text-dark/25 font-sans text-sm group-hover:translate-x-0.5 transition-transform shrink-0">→</span>
              </Link>

              {teamMemberships && teamMemberships.length > 0 && (
                <div className="pt-2">
                  <p className="font-sans text-[10px] uppercase tracking-widest text-dark/35 font-semibold px-1 mb-2.5">Mes équipes</p>
                  <div className="flex flex-wrap gap-2">
                    {teamMemberships.map((t, i) => {
                      const team = t.teams as unknown as { id: string; name: string } | null
                      if (!team) return null
                      return (
                        <Link key={i} href={`/espace/admin/equipes/${team.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-dark/10 rounded-full font-sans text-xs text-dark hover:border-teal/40 transition-colors"
                        >
                          {t.role === 'leader' && <span className="text-teal text-[10px]">★</span>}
                          {team.name}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white rounded-2xl border border-dark/8 px-4 py-5 text-center">
                  <p className="font-display text-4xl text-teal font-light">{quarterCount}</p>
                  <p className="font-sans text-[10px] uppercase tracking-widest text-dark/35 mt-2 leading-tight">Ce trimestre</p>
                </div>
                <div className="bg-white rounded-2xl border border-dark/8 px-4 py-5 text-center">
                  <p className="font-display text-4xl text-teal font-light">{yearCount}</p>
                  <p className="font-sans text-[10px] uppercase tracking-widest text-dark/35 mt-2 leading-tight">Cette année</p>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </>
  )
}
