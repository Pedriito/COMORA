'use server'

import { requireChurch } from '@/lib/auth/church'
import { addDays, localDateString, resolveTimeZone, startOfLocalDayUtc } from '@/lib/timezone'
import {
  buildAutoFillProposal,
  type AutoFillProposal,
  type AutoFillSkipped,
  type BuildAssignment,
} from './buildAutoFillProposal'

// Pas de `export type { ... }` ici : un fichier `'use server'` ne peut exporter que des
// fonctions async — même un ré-export de type peut laisser une référence runtime fantôme
// selon le transform Next.js ("X is not defined"). Les composants clients doivent importer
// ces types directement depuis `./buildAutoFillProposal` (module pur, sans `'use server'`).

type Result =
  | { ok: true; proposals: AutoFillProposal[]; skipped: AutoFillSkipped[] }
  | { ok: false; error: string }

/** Récupère les données nécessaires (plans, équipes/postes, qualifications, personnes,
 *  indisponibilités, historique) de l'église courante, puis délègue le calcul de la proposition
 *  au cœur pur `buildAutoFillProposal` (testable unitairement, sans base de données). Ne persiste
 *  rien — la modale d'aperçu appelle `commitAutoFillProposal` séparément une fois validée/éditée.
 *  Dans le cœur pur, `userId` désigne l'id de la personne (`members.id`). */
export async function computeAutoFillProposal(startDate: string, endDate: string): Promise<Result> {
  const ctx = await requireChurch('responsable')
  const { supabase } = ctx
  const churchId = ctx.church.churchId

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(startDate) || !dateRe.test(endDate) || startDate > endDate) {
    return { ok: false, error: 'Plage de dates invalide.' }
  }

  const { data: church } = await supabase.from('churches').select('timezone').eq('id', churchId).maybeSingle()
  const timeZone = resolveTimeZone(church?.timezone)

  // Les dates saisies sont des jours de l'église ; `service_date` est un instant UTC.
  // Borne de fin EXCLUSIVE (lendemain à 00:00 locale) pour inclure tous les services du dernier jour.
  const startUtc = startOfLocalDayUtc(startDate, timeZone)
  const endExclusive = startOfLocalDayUtc(addDays(endDate, 1), timeZone)
  const lookbackStartUtc = startOfLocalDayUtc(addDays(startDate, -90), timeZone)

  const [
    plansRes,
    teamsRes,
    memberPositionsRes,
    membersRes,
    blockoutsRes,
    historicalPlansRes,
  ] = await Promise.all([
    supabase
      .from('plans')
      .select('id, title, service_date, team_ids, excluded_position_ids')
      .eq('church_id', churchId)
      .gte('service_date', startUtc)
      .lt('service_date', endExclusive)
      .order('service_date'),
    supabase
      .from('teams')
      .select('id, name, positions(id, name, team_id, archived, allow_multiple)')
      .eq('church_id', churchId),
    supabase.from('member_positions').select('member_id, position_id').eq('church_id', churchId),
    supabase.from('members').select('id, first_name, last_name, desired_frequency').eq('church_id', churchId).neq('status', 'inactive'),
    supabase.from('blockout_dates').select('member_id, start_date, end_date').eq('church_id', churchId),
    supabase
      .from('plans')
      .select('id, service_date')
      .eq('church_id', churchId)
      .gte('service_date', lookbackStartUtc)
      .lt('service_date', startUtc),
  ])

  // Ne jamais avaler une erreur Supabase en silence : sans ça, une requête qui échoue (colonne
  // manquante, RLS, réseau...) rend juste 0 proposition ET 0 créneau non pourvu, indiscernable
  // d'un résultat légitimement vide — exactement le bug qu'on vient de traquer à l'aveugle.
  for (const [label, res] of [
    ['plans', plansRes], ['teams', teamsRes], ['member_positions', memberPositionsRes],
    ['members', membersRes], ['blockout_dates', blockoutsRes], ['historicalPlans', historicalPlansRes],
  ] as const) {
    if (res.error) {
      console.error(`[computeAutoFillProposal] échec requête "${label}":`, res.error.message)
      return { ok: false, error: `Erreur base de données (${label}) : ${res.error.message}` }
    }
  }

  const { data: plans } = plansRes
  const { data: teams } = teamsRes
  const { data: memberPositions } = memberPositionsRes
  const { data: members } = membersRes
  const { data: blockouts } = blockoutsRes
  const { data: historicalPlans } = historicalPlansRes

  if (!plans || plans.length === 0) {
    return { ok: true, proposals: [], skipped: [] }
  }

  const planIds = plans.map(p => p.id)
  const historicalPlanIds = (historicalPlans ?? []).map(p => p.id)
  const historicalDateById = new Map((historicalPlans ?? []).map(p => [p.id, localDateString(p.service_date, timeZone)]))
  const planDateById = new Map(plans.map(p => [p.id, localDateString(p.service_date, timeZone)]))

  const allRelevantPlanIds = [...historicalPlanIds, ...planIds]
  const assignmentsRes = allRelevantPlanIds.length > 0
    ? await supabase
        .from('plan_assignments')
        .select('member_id, position_id, plan_id, status')
        .eq('church_id', churchId)
        .in('plan_id', allRelevantPlanIds)
        .neq('status', 'declined')
        .not('member_id', 'is', null)
    : { data: [] as { member_id: string | null; position_id: string | null; plan_id: string; status: string }[], error: null }

  if (assignmentsRes.error) {
    console.error('[computeAutoFillProposal] échec requête "plan_assignments":', assignmentsRes.error.message)
    return { ok: false, error: `Erreur base de données (plan_assignments) : ${assignmentsRes.error.message}` }
  }
  const { data: relevantAssignments } = assignmentsRes

  const existingAssignments: BuildAssignment[] = (relevantAssignments ?? [])
    .filter(a => a.member_id !== null)
    .map(a => ({
      userId: a.member_id as string,
      positionId: a.position_id,
      planId: a.plan_id,
      date: historicalDateById.get(a.plan_id) ?? planDateById.get(a.plan_id) ?? '',
    }))
    .filter(a => a.date !== '')

  const qualifiedUserIdsByPosition: Record<string, string[]> = {}
  for (const mp of memberPositions ?? []) {
    (qualifiedUserIdsByPosition[mp.position_id] ??= []).push(mp.member_id)
  }

  const { proposals, skipped } = buildAutoFillProposal({
    plans: (plans ?? []).map(p => ({
      id: p.id,
      title: p.title,
      service_date: p.service_date,
      team_ids: (p.team_ids ?? null) as string[] | null,
      excluded_position_ids: (p.excluded_position_ids ?? null) as string[] | null,
    })),
    teams: (teams ?? []).map(t => ({
      id: t.id,
      name: t.name,
      // Postes masqués (archived) exclus : jamais proposés par l'auto-remplissage.
      positions: ((t.positions ?? []) as { id: string; name: string; archived: boolean | null; allow_multiple: boolean | null }[])
        .filter(pos => !pos.archived)
        .map(pos => ({ id: pos.id, name: pos.name, allow_multiple: !!pos.allow_multiple })),
    })),
    qualifiedUserIdsByPosition,
    profiles: members ?? [],
    blockouts: (blockouts ?? []).map(b => ({ userId: b.member_id, startDate: b.start_date, endDate: b.end_date })),
    existingAssignments,
  })

  return { ok: true, proposals, skipped }
}
