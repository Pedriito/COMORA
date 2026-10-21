import { requireChurch } from '@/lib/auth/church'
import Link from 'next/link'

function rate(confirmed: number, responded: number) {
  if (responded === 0) return null
  return Math.round((confirmed / responded) * 100)
}

function RateBar({ confirmed, declined, pending }: { confirmed: number; declined: number; pending: number }) {
  const total = confirmed + declined + pending
  if (total === 0) return <span className="text-xs text-dark/50 font-sans">—</span>
  const pctC = Math.round((confirmed / total) * 100)
  const pctD = Math.round((declined / total) * 100)
  const pctP = 100 - pctC - pctD
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 rounded-full overflow-hidden w-24 bg-dark/10">
        <div className="bg-green-500 h-full" style={{ width: `${pctC}%` }} />
        <div className="bg-red-400 h-full" style={{ width: `${pctD}%` }} />
        <div className="bg-dark/20 h-full" style={{ width: `${pctP}%` }} />
      </div>
      <span className="font-sans text-xs text-dark/50 tabular-nums">{pctC} %</span>
    </div>
  )
}

export default async function StatsPage() {
  const ctx = await requireChurch('responsable')
  const db = ctx.supabase
  const churchId = ctx.church.churchId
  const now = new Date().toISOString()

  const [
    { data: pastPlans },
    { data: allPlans },
    { data: teams },
    { data: activeMembers },
    { data: teamMemberships },
  ] = await Promise.all([
    db.from('plans').select('id').eq('church_id', churchId).lt('service_date', now),
    db.from('plans').select('id').eq('church_id', churchId),
    db.from('teams').select('id, name').eq('church_id', churchId).order('name'),
    db.from('members').select('id').eq('church_id', churchId).eq('status', 'active'),
    db.from('team_members').select('member_id, team_id').eq('church_id', churchId),
  ])

  const pastPlanIds = pastPlans?.map(p => p.id) ?? []

  // Affectations des services passés (pour les stats de confirmation)
  const { data: pastAssignments } = pastPlanIds.length
    ? await db
        .from('plan_assignments')
        .select('id, status, member_id, team_id, external_name, members(first_name, last_name)')
        .eq('church_id', churchId)
        .in('plan_id', pastPlanIds)
    : { data: [] }

  // Affectations futures (pour stats à venir)
  const futurePlanIds = (allPlans ?? []).map(p => p.id).filter(id => !pastPlanIds.includes(id))
  const { data: futureAssignments } = futurePlanIds.length
    ? await db
        .from('plan_assignments')
        .select('id, status, member_id, team_id')
        .eq('church_id', churchId)
        .in('plan_id', futurePlanIds)
    : { data: [] }

  const past = pastAssignments ?? []
  const future = futureAssignments ?? []

  // ── Stats globales ───────────────────────────────────────────────
  const totalServices = allPlans?.length ?? 0
  const totalPastServices = pastPlanIds.length
  const totalPastAssignments = past.length
  const globalConfirmed = past.filter(a => a.status === 'confirmed').length
  const globalDeclined = past.filter(a => a.status === 'declined').length
  const globalRate = rate(globalConfirmed, globalConfirmed + globalDeclined)
  const pendingFuture = future.filter(a => a.status === 'pending' && a.member_id !== null).length

  // ── Par équipe ───────────────────────────────────────────────────
  // Nombre de membres par équipe
  const memberCountByTeam: Record<string, number> = {}
  teamMemberships?.forEach(tm => {
    memberCountByTeam[tm.team_id] = (memberCountByTeam[tm.team_id] ?? 0) + 1
  })

  type TeamStat = { id: string; name: string; total: number; confirmed: number; declined: number; pending: number; members: number }
  const teamMap: Record<string, TeamStat> = {}
  teams?.forEach(t => {
    teamMap[t.id] = { id: t.id, name: t.name, total: 0, confirmed: 0, declined: 0, pending: 0, members: memberCountByTeam[t.id] ?? 0 }
  })

  past.forEach(a => {
    if (!a.team_id || !teamMap[a.team_id]) return
    const ts = teamMap[a.team_id]
    ts.total++
    if (a.status === 'confirmed') ts.confirmed++
    else if (a.status === 'declined') ts.declined++
    else ts.pending++
  })

  const teamStats = Object.values(teamMap)
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total)

  // ── Top bénévoles ────────────────────────────────────────────────
  type VolStat = { userId: string; name: string; confirmed: number; total: number; declined: number }
  const volMap: Record<string, VolStat> = {}

  past.forEach(a => {
    // Invités externes (sans personne de l'église) : hors classement
    if (!a.member_id) return
    const profile = a.members as unknown as { first_name: string; last_name: string } | null
    if (!volMap[a.member_id]) {
      volMap[a.member_id] = {
        userId: a.member_id,
        name: profile ? `${profile.first_name} ${profile.last_name}` : '—',
        confirmed: 0,
        total: 0,
        declined: 0,
      }
    }
    volMap[a.member_id].total++
    if (a.status === 'confirmed') volMap[a.member_id].confirmed++
    if (a.status === 'declined') volMap[a.member_id].declined++
  })

  const topVols = Object.values(volMap)
    .sort((a, b) => b.confirmed - a.confirmed || b.total - a.total)
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 py-4 flex items-center gap-4">
        <Link href="/espace/dashboard" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm">
          ← Tableau de bord
        </Link>
        <h1 className="font-display text-2xl text-dark font-light">Statistiques</h1>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8">

        {/* Chiffres globaux */}
        <section>
          <h2 className="font-display text-lg text-dark/40 font-light mb-3">Vue d'ensemble</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Services total', value: totalServices },
              { label: 'Services passés', value: totalPastServices },
              { label: 'Bénévoles actifs', value: activeMembers?.length ?? 0 },
              { label: 'Réponses en attente', value: pendingFuture },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-teal/20 p-5 text-center">
                <p className="font-display text-3xl text-dark font-light">{s.value}</p>
                <p className="text-xs text-dark/50 font-sans mt-1 uppercase tracking-widest leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Taux global */}
        {totalPastAssignments > 0 && (
          <section>
            <h2 className="font-display text-lg text-dark/40 font-light mb-3">Taux de confirmation global</h2>
            <div className="bg-white rounded-2xl border border-teal/20 px-6 py-5">
              <div className="flex items-end gap-6 flex-wrap">
                <div>
                  <p className="font-display text-5xl text-dark font-light">{globalRate ?? '—'}{globalRate != null ? ' %' : ''}</p>
                  <p className="font-sans text-xs text-dark/40 mt-1">sur {totalPastAssignments} affectations passées</p>
                </div>
                <div className="flex gap-6 pb-1">
                  <div className="text-center">
                    <p className="font-display text-2xl text-green-600 font-light">{globalConfirmed}</p>
                    <p className="font-sans text-xs text-dark/40 uppercase tracking-widest">Confirmés</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-2xl text-red-400 font-light">{globalDeclined}</p>
                    <p className="font-sans text-xs text-dark/40 uppercase tracking-widest">Déclinés</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-2xl text-dark/30 font-light">{totalPastAssignments - globalConfirmed - globalDeclined}</p>
                    <p className="font-sans text-xs text-dark/40 uppercase tracking-widest">Sans réponse</p>
                  </div>
                </div>
              </div>
              {/* Barre globale */}
              <div className="mt-5">
                <RateBar
                  confirmed={globalConfirmed}
                  declined={globalDeclined}
                  pending={totalPastAssignments - globalConfirmed - globalDeclined}
                />
              </div>
            </div>
          </section>
        )}

        {/* Par équipe */}
        {teamStats.length > 0 && (
          <section>
            <h2 className="font-display text-lg text-dark/40 font-light mb-3">Par équipe</h2>
            <div className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
              {/* Mobile : cartes */}
              <div className="md:hidden divide-y divide-teal/10">
                {teamStats.map(t => (
                  <div key={t.id} className="px-4 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-sans text-sm text-dark font-medium truncate">{t.name}</p>
                      <p className="font-sans text-xs text-dark/50 mt-0.5">{t.members} membre{t.members > 1 ? 's' : ''} · {t.total} affectation{t.total > 1 ? 's' : ''}</p>
                    </div>
                    <div className="shrink-0">
                      <RateBar confirmed={t.confirmed} declined={t.declined} pending={t.pending} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop : tableau */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="border-b border-teal/10">
                      <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Équipe</th>
                      <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Membres</th>
                      <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Affectations</th>
                      <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Confirmation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStats.map((t, i) => (
                      <tr key={t.id} className={i % 2 === 0 ? '' : 'bg-teal-50/40'}>
                        <td className="px-6 py-4 font-sans text-sm text-dark font-medium">{t.name}</td>
                        <td className="px-6 py-4 font-sans text-sm text-dark/50 tabular-nums">{t.members}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="font-sans text-sm text-dark tabular-nums font-medium">{t.total}</span>
                            <span className="font-sans text-xs text-dark/30 tabular-nums">
                              {t.confirmed}✓ {t.declined}✕
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <RateBar confirmed={t.confirmed} declined={t.declined} pending={t.pending} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Top bénévoles */}
        {topVols.length > 0 && (
          <section>
            <h2 className="font-display text-lg text-dark/40 font-light mb-3">Bénévoles les plus actifs</h2>
            <div className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
              {/* Mobile : cartes */}
              <div className="md:hidden divide-y divide-teal/10">
                {topVols.map((v, i) => {
                  const r = rate(v.confirmed, v.confirmed + v.declined)
                  return (
                    <div key={v.userId} className="px-4 py-3.5 flex items-center gap-3">
                      <span className="font-sans text-xs text-dark/30 tabular-nums w-5 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-sm text-dark font-medium truncate">{v.name}</p>
                        <p className="font-sans text-xs text-dark/50 mt-0.5">{v.confirmed} confirmé{v.confirmed > 1 ? 's' : ''} / {v.total}</p>
                      </div>
                      {r != null && (
                        <span className={`font-sans text-sm tabular-nums font-semibold shrink-0 ${r >= 80 ? 'text-green-600' : r >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
                          {r} %
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Desktop : tableau */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="border-b border-teal/10">
                      <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium w-8">#</th>
                      <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Bénévole</th>
                      <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Confirmés</th>
                      <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topVols.map((v, i) => {
                      const r = rate(v.confirmed, v.confirmed + v.declined)
                      return (
                        <tr key={v.userId} className={i % 2 === 0 ? '' : 'bg-teal-50/40'}>
                          <td className="px-6 py-4 font-sans text-sm text-dark/40 tabular-nums">{i + 1}</td>
                          <td className="px-6 py-4 font-sans text-sm text-dark font-medium">{v.name}</td>
                          <td className="px-6 py-4">
                            <span className="font-sans text-sm text-dark tabular-nums font-medium">{v.confirmed}</span>
                            <span className="font-sans text-xs text-dark/30 ml-2 tabular-nums">/ {v.total}</span>
                          </td>
                          <td className="px-6 py-4">
                            {r != null ? (
                              <span className={`font-sans text-sm tabular-nums font-medium ${r >= 80 ? 'text-green-600' : r >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
                                {r} %
                              </span>
                            ) : (
                              <span className="text-xs text-dark/50 font-sans">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {totalPastAssignments === 0 && (
          <div className="bg-white rounded-2xl border border-teal/20 px-6 py-12 text-center">
            <p className="font-sans text-sm text-dark/40">Pas encore de données — les statistiques apparaîtront après les premiers services.</p>
          </div>
        )}

      </main>
    </div>
  )
}
