import 'server-only'
import type { ChurchContext } from '@/lib/auth/church'

export const STEP_KEYS = ['import', 'team', 'service', 'invite'] as const
export type StepKey = (typeof STEP_KEYS)[number]

export type OnboardingState = {
  steps: Array<{ key: StepKey; done: boolean; skipped: boolean }>
  /** Toutes les étapes faites ou passées. */
  finished: boolean
  dismissed: boolean
  /** Afficher le rappel sur le tableau de bord. */
  showReminder: boolean
}

/**
 * Avancement du guide. « Fait » se lit dans les données de l'église (il y a des
 * personnes, une équipe, un culte, un responsable invité) : pas de case à cocher qui
 * puisse se désynchroniser. Seul « passer » est mémorisé.
 */
export async function getOnboarding(ctx: ChurchContext): Promise<OnboardingState> {
  const churchId = ctx.church.churchId
  const count = (table: 'members' | 'teams' | 'plans') =>
    ctx.supabase.from(table).select('id', { count: 'exact', head: true }).eq('church_id', churchId)

  const [members, teams, plans, others, progress] = await Promise.all([
    count('members'),
    count('teams'),
    count('plans'),
    ctx.supabase
      .from('church_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .neq('user_id', ctx.userId),
    ctx.supabase.from('onboarding_progress').select('skipped, dismissed_at').eq('church_id', churchId).maybeSingle(),
  ])

  const skipped = new Set<string>(progress.data?.skipped ?? [])
  const done: Record<StepKey, boolean> = {
    import: (members.count ?? 0) > 1,
    team: (teams.count ?? 0) > 0,
    service: (plans.count ?? 0) > 0,
    invite: (others.count ?? 0) > 0,
  }
  const steps = STEP_KEYS.map(key => ({ key, done: done[key], skipped: !done[key] && skipped.has(key) }))
  const finished = steps.every(s => s.done || s.skipped)
  const dismissed = !!progress.data?.dismissed_at
  return { steps, finished, dismissed, showReminder: !finished && !dismissed }
}
