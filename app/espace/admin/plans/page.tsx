import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlanCalendarLazy as PlanCalendar } from './PlanCalendarLazy'
import { PlanTimeEditor } from './PlanTimeEditor'
import { SubscribeCalendarButton } from './SubscribeCalendarButton'
import { IconCalendar, IconMusicalNote } from '@/app/espace/_components/Icons'
import { LinkPendingSpinner } from '@/app/espace/_components/LinkPendingSpinner'
import { PlanWorkspaceData } from './PlanWorkspaceData'
import { WorkspaceSkeleton } from './WorkspaceSkeleton'
import { MyAssignmentQuickActions } from './RespondAssignmentButtons'
import { AutoFillButton } from './AutoFillButton'
import { siteUrl as getSiteUrl } from '@/lib/site'

export type PlanItem = {
  id: string
  title: string
  service_date: string
  plan_type: string | null
  teams: unknown
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; plan?: string; fill?: string; sent?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const params = await searchParams
  const view   = params.view === 'calendar' ? 'calendar' : 'list'
  const now    = new Date().toISOString()

  // me + upcoming + calToken en parallèle (tous indépendants après auth)
  const admin = createAdminClient()
  const [{ data: me }, { data: upcoming }, { data: calSettings }] = await Promise.all([
    supabase.from('profiles').select('permission').eq('id', user.id).single(),
    supabase
      .from('plans')
      .select('id, title, service_date, plan_type, teams(name)')
      .gte('service_date', now)
      .order('service_date'),
    admin.from('projection_settings').select('calendar_token').single(),
  ])

  const isAdmin   = ['admin', 'super_admin'].includes(me?.permission ?? '')
  const isEditor  = me?.permission === 'editor'
  const canManage = isAdmin || isEditor

  // past dépend de canManage et view → séquentiel mais sur une seule requête
  const { data: past } = await (canManage
    ? supabase
        .from('plans')
        .select('id, title, service_date, plan_type, teams(name)')
        .lt('service_date', now)
        .order('service_date', { ascending: false })
        .limit(view === 'calendar' ? 60 : 10)
    : Promise.resolve({ data: [] as PlanItem[] }))

  const upcomingPlans = (upcoming ?? []) as PlanItem[]
  const pastPlans = (past ?? []) as PlanItem[]
  const allPlans = [...upcomingPlans, ...pastPlans]

  // Compte affectations (liste + agenda du calendrier)
  const countByPlan: Record<string, number> = {}
  const allIds = allPlans.map(p => p.id)
  const [{ data: counts }, { data: myAssignments }] = await Promise.all([
    supabase
      .from('plan_assignments')
      .select('plan_id')
      .in('plan_id', allIds.length ? allIds : ['']),
    supabase
      .from('plan_assignments')
      .select('id, plan_id, status')
      .eq('user_id', user.id)
      .in('plan_id', allIds.length ? allIds : ['']),
  ])
  counts?.forEach(c => { countByPlan[c.plan_id] = (countByPlan[c.plan_id] ?? 0) + 1 })
  type MyAssignment = { id: string; plan_id: string; status: string }
  const myAssignmentByPlan: Record<string, MyAssignment> = Object.fromEntries(
    (myAssignments ?? []).map(a => [a.plan_id, a as MyAssignment])
  )

  // Token iCal (récupéré dans le Promise.all ci-dessus)
  let calToken = calSettings?.calendar_token as string | null
  if (!calToken) {
    calToken = crypto.randomUUID()
    await admin.from('projection_settings').update({ calendar_token: calToken }).not('id', 'is', null)
  }

  const siteUrl = getSiteUrl()
  const icalUrl = `${siteUrl}/api/calendar/${calToken}.ics`

  // ── Workspace desktop unifié (≥ xl, admin/editor, vue liste) ──────────
  const selectedPlanId = view === 'list'
    ? (params.plan ?? upcomingPlans[0]?.id ?? pastPlans[0]?.id ?? null)
    : null
  const fillKey = params.fill ?? null

  function PlanRow({ plan }: { plan: PlanItem }) {
    const team = plan.teams as unknown as { name: string } | null
    const date = new Date(plan.service_date).toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
    const time = new Date(plan.service_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const n    = countByPlan[plan.id] ?? 0
    const past = plan.service_date < now
    return (
      <tr className={`border-b border-teal/10 last:border-0 hover:bg-teal-50/40 transition-colors ${past ? 'opacity-50' : ''}`}>
        <td className="px-6 py-4 font-sans text-sm text-dark/50 capitalize">
          <div className="flex items-center gap-2">
            <Link href={`/espace/admin/plans/${plan.id}`} className="block">{date}</Link>
            {canManage && (
              <PlanTimeEditor
                planId={plan.id}
                serviceDate={plan.service_date}
                stopPropagation
                className="font-sans text-xs tabular-nums text-dark/35 hover:text-teal transition-colors cursor-pointer hover:underline decoration-dotted"
              />
            )}
            {!canManage && <span className="font-sans text-xs text-dark/35">{time}</span>}
          </div>
        </td>
        <td className="px-6 py-4 font-sans text-sm text-dark font-medium">
          <Link href={`/espace/admin/plans/${plan.id}`} className="flex items-center gap-2">
            {plan.plan_type === 'rehearsal' && <IconMusicalNote className="w-3 h-3 text-teal/60 shrink-0" />}
            {plan.title}
          </Link>
        </td>
        <td className="px-6 py-4 font-sans text-sm text-dark/50">
          <Link href={`/espace/admin/plans/${plan.id}`} className="block">{team?.name ?? 'Toutes'}</Link>
        </td>
        <td className="px-6 py-4 font-sans text-sm text-dark/50">
          <Link href={`/espace/admin/plans/${plan.id}`} className="block">{n} affecté{n > 1 ? 's' : ''}</Link>
        </td>
        <td className="px-6 py-4 text-right">
          <Link href={`/espace/admin/plans/${plan.id}`} className="text-teal font-sans text-sm hover:underline">
            {canManage ? 'Gérer →' : 'Voir →'}
          </Link>
        </td>
      </tr>
    )
  }

  function PlanCard({ plan, myAssignment }: { plan: PlanItem; myAssignment: { id: string; status: string } | null }) {
    const team = plan.teams as unknown as { name: string } | null
    const date = new Date(plan.service_date).toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
    const time = new Date(plan.service_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const n         = countByPlan[plan.id] ?? 0
    const past      = plan.service_date < now
    return (
      <div className={`flex items-center gap-2 px-4 py-3.5 border-b border-teal/10 last:border-0 ${past ? 'opacity-50' : ''}`}>
        <Link
          href={`/espace/admin/plans/${plan.id}`}
          className="relative flex-1 min-w-0 hover:opacity-70 transition-opacity"
        >
          <LinkPendingSpinner />
          <div className="flex items-center gap-1.5 mb-0.5">
            {plan.plan_type === 'rehearsal' && <IconMusicalNote className="w-3 h-3 text-teal/50 shrink-0" />}
            <p className="font-sans text-sm text-dark font-medium truncate">{plan.title}</p>
          </div>
          <p className="font-sans text-xs text-dark/50 capitalize">
            {date} · {time}
          </p>
          {team && <p className="font-sans text-xs text-dark/40 mt-0.5">{team.name}</p>}
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {myAssignment ? (
            <MyAssignmentQuickActions
              assignmentId={myAssignment.id}
              initialStatus={myAssignment.status as 'pending' | 'confirmed' | 'declined'}
              count={n}
            />
          ) : (
            <>
              {n > 0 && <span className="font-sans text-xs text-dark/40 tabular-nums">{n} pers.</span>}
              <span className="text-teal font-sans text-sm">→</span>
            </>
          )}
        </div>
      </div>
    )
  }

  /** Liste à venir / passés + export iCal — vue classique (mobile, tablette, et non-managers). */
  function ClassicListView() {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <section>
          <h2 className="font-display text-xl text-dark font-light mb-3">À venir</h2>
          <div className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
            {upcomingPlans.length > 0 ? (
              <>
                {/* Mobile : cartes */}
                <div className="md:hidden divide-y divide-teal/10">
                  {upcomingPlans.map(p => <PlanCard key={p.id} plan={p} myAssignment={myAssignmentByPlan[p.id] ?? null} />)}
                </div>
                {/* Desktop : tableau */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-teal/10">
                        <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Date</th>
                        <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Titre</th>
                        <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Équipe</th>
                        <th className="text-left px-6 py-3 text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Bénévoles</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingPlans.map(p => <PlanRow key={p.id} plan={p} />)}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="font-sans text-sm text-dark/40 mb-3">Aucun service à venir.</p>
                <Link href="/espace/admin/plans/nouveau" className="text-teal font-sans text-sm hover:underline">
                  Créer le premier service →
                </Link>
              </div>
            )}
          </div>
        </section>

        {pastPlans.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-dark font-light mb-3 text-dark/50">Passés</h2>
            <div className="bg-white rounded-2xl border border-teal/20 overflow-hidden opacity-60">
              <div className="md:hidden divide-y divide-teal/10">
                {pastPlans.map(p => <PlanCard key={p.id} plan={p} myAssignment={myAssignmentByPlan[p.id] ?? null} />)}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <tbody>
                    {pastPlans.map(p => <PlanRow key={p.id} plan={p} />)}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {canManage && (
          <div className="flex justify-center">
            <SubscribeCalendarButton icalUrl={icalUrl} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sand">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-3" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <div className="flex items-center gap-4">
          <Link href="/espace/dashboard" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm shrink-0">←</Link>
          <div className="flex-1 min-w-0">
            <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Planifier</p>
            <h1 className="font-display text-2xl text-dark font-light">Planification</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Liste / Calendrier — desktop uniquement */}
            <div className="hidden md:flex rounded-full bg-dark/5 p-1 gap-1">
              <Link
                href="?view=list"
                className={`px-3 py-1.5 rounded-full font-sans text-xs font-medium transition-colors flex items-center gap-1 ${view === 'list' ? 'bg-white text-dark shadow-sm' : 'text-dark/45 hover:text-dark'}`}
              >
                ☰ Liste
              </Link>
              <Link
                href="?view=calendar"
                className={`px-3 py-1.5 rounded-full font-sans text-xs font-medium transition-colors flex items-center gap-1 ${view === 'calendar' ? 'bg-white text-dark shadow-sm' : 'text-dark/45 hover:text-dark'}`}
              >
                <IconCalendar className="w-3 h-3" />
                Calendrier
              </Link>
            </div>
            {canManage && <AutoFillButton />}
            {canManage && (
              <Link
                href="/espace/admin/plans/nouveau"
                className="shrink-0 px-3.5 py-1.5 bg-coral text-white rounded-full font-sans text-sm font-medium hover:opacity-90 transition-opacity"
              >
                + Nouveau
              </Link>
            )}
          </div>
        </div>
        {/* Toggle Liste / Calendrier — mobile uniquement */}
        <div className="md:hidden flex mt-3 rounded-full bg-dark/5 p-1 gap-1 w-fit">
          <Link
            href="?view=list"
            className={`px-3 py-1.5 rounded-full font-sans text-xs font-medium transition-colors flex items-center gap-1 ${view === 'list' ? 'bg-white text-dark shadow-sm' : 'text-dark/45 hover:text-dark'}`}
          >
            ☰ Liste
          </Link>
          <Link
            href="?view=calendar"
            className={`px-3 py-1.5 rounded-full font-sans text-xs font-medium transition-colors flex items-center gap-1 ${view === 'calendar' ? 'bg-white text-dark shadow-sm' : 'text-dark/45 hover:text-dark'}`}
          >
            <IconCalendar className="w-3 h-3" />
            Calendrier
          </Link>
        </div>
      </header>

      <main className="px-4 md:px-6 py-6 md:py-8">
        {view === 'calendar' ? (
          <div className="max-w-5xl mx-auto">
            <PlanCalendar plans={allPlans} monthParam={params.month} icalUrl={icalUrl} canManage={canManage} countByPlan={countByPlan} />
          </div>
        ) : canManage && selectedPlanId ? (
          <>
            {/* ≥ xl : workspace unifié triage + tableau d'affectation + sélecteur */}
            <div className="hidden xl:flex gap-5 max-w-370 mx-auto items-start">
              <Suspense key={selectedPlanId} fallback={<WorkspaceSkeleton />}>
                <PlanWorkspaceData
                  selectedPlanId={selectedPlanId}
                  userId={user.id}
                  isAdmin={isAdmin}
                  plans={upcomingPlans}
                  pastPlans={pastPlans}
                  countByPlan={countByPlan}
                  fillKey={fillKey}
                  flashError={params.error}
                  flashSent={params.sent}
                />
              </Suspense>
            </div>
            {/* < xl : liste classique */}
            <div className="xl:hidden">
              <ClassicListView />
            </div>
          </>
        ) : (
          <ClassicListView />
        )}
      </main>
    </div>
  )
}
