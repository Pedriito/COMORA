import { createClient } from '@/lib/supabase/server'
import { getPlanDetail } from './getPlanDetail'
import { TriagePanel } from './TriagePanel'
import { PlanWorkspace } from './PlanWorkspace'
import type { PlanItem } from './page'

type Props = {
  selectedPlanId: string
  userId: string
  isAdmin: boolean
  plans: PlanItem[]
  pastPlans: PlanItem[]
  countByPlan: Record<string, number>
  fillKey: string | null
  flashError?: string
  flashSent?: string
}

/** Charge getPlanDetail() pour le service sélectionné et rend le triage + le workspace
 *  d'affectation. Isolé dans son propre composant serveur asynchrone pour pouvoir être
 *  entouré d'un <Suspense key={selectedPlanId}> — changer de service affiche un squelette
 *  au lieu de figer l'écran (la navigation ne se fait que via un search param, sans loading.tsx). */
export async function PlanWorkspaceData({
  selectedPlanId, userId, isAdmin, plans, pastPlans, countByPlan, fillKey, flashError, flashSent,
}: Props) {
  const supabase = await createClient()
  const detail = await getPlanDetail(supabase, selectedPlanId, userId, isAdmin)

  if (!detail) {
    return (
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-teal/20 px-6 py-10 text-center">
        <p className="font-sans text-sm text-dark/40">Ce service est introuvable.</p>
      </div>
    )
  }

  const openPositionsCount = detail.teams.filter(t => t.visible).reduce((sum, t) => {
    if (t.positions.length === 0) return sum
    const filledIds = new Set(t.assignments.map(a => a.position_id).filter(Boolean))
    return sum + t.positions.filter(p => !filledIds.has(p.id)).length
  }, 0)

  return (
    <>
      <TriagePanel
        plans={plans}
        pastPlans={pastPlans}
        countByPlan={countByPlan}
        selectedPlanId={selectedPlanId}
        openPositionsCount={openPositionsCount}
        pendingCount={detail.pendingCount}
        featuredPlanTitle={detail.plan.title}
      />
      <PlanWorkspace
        planId={selectedPlanId}
        detail={detail}
        userId={userId}
        isAdmin={isAdmin}
        flashError={flashError}
        flashSent={flashSent}
        returnTo={`/espace/admin/plans?plan=${selectedPlanId}`}
        initialFillKey={fillKey}
      />
    </>
  )
}
