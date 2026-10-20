import Link from 'next/link'
import type { PlanItem } from './page'
import { TYPE_COLORS } from './planTypeStyles'
import { IconWarning } from '@/app/espace/_components/Icons'
import { LinkPendingSpinner } from '@/app/espace/_components/LinkPendingSpinner'

type Props = {
  plans: PlanItem[]
  pastPlans: PlanItem[]
  countByPlan: Record<string, number>
  selectedPlanId: string
  openPositionsCount: number
  pendingCount: number
  featuredPlanTitle: string
}

function ServiceRow({ plan, n, active }: { plan: PlanItem; n: number; active: boolean }) {
  const colors = TYPE_COLORS[plan.plan_type ?? 'sunday_service'] ?? TYPE_COLORS.sunday_service
  const d = new Date(plan.service_date)
  const day = d.toLocaleDateString('fr-FR', { day: 'numeric' })
  const month = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <Link
      href={`?plan=${plan.id}`}
      className={`relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        active ? 'border-teal bg-white shadow-sm' : 'border-teal/15 bg-white hover:border-teal/40'
      }`}
    >
      <LinkPendingSpinner />
      <div className={`w-9 text-center rounded-lg py-1 shrink-0 ${colors.bg}`}>
        <div className="font-display text-base font-semibold leading-none text-dark">{day}</div>
        <div className="text-[9px] uppercase tracking-wide font-semibold text-dark/50 mt-0.5">{month}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-sans text-sm truncate ${active ? 'font-semibold text-dark' : 'font-medium text-dark/80'}`}>{plan.title}</p>
        <p className="font-sans text-xs text-dark/40 capitalize">{weekday} · {time}</p>
      </div>
      {n > 0 && <span className="font-sans text-xs text-dark/30 tabular-nums shrink-0">{n}</span>}
    </Link>
  )
}

export function TriagePanel({
  plans, pastPlans, countByPlan, selectedPlanId, openPositionsCount, pendingCount, featuredPlanTitle,
}: Props) {
  return (
    <aside className="w-70 shrink-0 space-y-5 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
      {(openPositionsCount > 0 || pendingCount > 0) && (
        <div>
          <p className="font-sans text-[10px] uppercase tracking-widest font-semibold text-dark/40 mb-2 px-1">À traiter</p>
          <div className="space-y-2">
            {openPositionsCount > 0 && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <IconWarning className="w-4 h-4 text-red-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-sans text-sm font-semibold text-dark">
                    {openPositionsCount} poste{openPositionsCount > 1 ? 's' : ''} à pourvoir
                  </p>
                  <p className="font-sans text-xs text-red-400/80 truncate">{featuredPlanTitle}</p>
                </div>
              </div>
            )}
            {pendingCount > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                <span className="text-amber-500 text-base shrink-0" aria-hidden>⏳</span>
                <div className="min-w-0">
                  <p className="font-sans text-sm font-semibold text-dark">
                    {pendingCount} réponse{pendingCount > 1 ? 's' : ''} en attente
                  </p>
                  <p className="font-sans text-xs text-amber-600/70 truncate">{featuredPlanTitle}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <p className="font-sans text-[10px] uppercase tracking-widest font-semibold text-dark/40 mb-2 px-1">
          À venir · {plans.length}
        </p>
        <div className="space-y-2">
          {plans.length === 0 && (
            <p className="font-sans text-xs text-dark/40 px-1">Aucun service à venir.</p>
          )}
          {plans.map(p => (
            <ServiceRow key={p.id} plan={p} n={countByPlan[p.id] ?? 0} active={p.id === selectedPlanId} />
          ))}
        </div>
      </div>

      {pastPlans.length > 0 && (
        <div className="opacity-60">
          <p className="font-sans text-[10px] uppercase tracking-widest font-semibold text-dark/40 mb-2 px-1">Passés</p>
          <div className="space-y-2">
            {pastPlans.map(p => (
              <ServiceRow key={p.id} plan={p} n={countByPlan[p.id] ?? 0} active={p.id === selectedPlanId} />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
