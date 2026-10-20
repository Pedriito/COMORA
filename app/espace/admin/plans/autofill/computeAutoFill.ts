'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { exclusiveEndDate } from './frequency'
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

const INVITE_EXT_ID = '00000000-0000-0000-0000-000000000001'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')
  const { data: profile } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!profile || !['admin', 'editor', 'super_admin'].includes(profile.permission)) redirect('/espace/dashboard')
  return { admin: createAdminClient() }
}

type Result =
  | { ok: true; proposals: AutoFillProposal[]; skipped: AutoFillSkipped[] }
  | { ok: false; error: string }

/** Récupère les données nécessaires (plans, équipes/postes, qualifications, profils,
 *  indisponibilités, historique) puis délègue le calcul de la proposition au cœur pur
 *  `buildAutoFillProposal` (testable unitairement, sans base de données). Ne persiste rien —
 *  la modale d'aperçu appelle `commitAutoFillProposal` séparément une fois validée/éditée.
 *
 *  Pas de filtre `church_id` sur ces requêtes : `profiles.church_id` peut être `null` pour un
 *  compte admin existant (backfill historique non garanti), ce qui ferait silencieusement
 *  remonter zéro plan/équipe/profil. Ce module suit ici la même convention que le reste de
 *  `admin/plans` (`getStableCatalog()` dans getPlanDetail.ts, et la page liste des plans) qui ne
 *  filtre pas non plus par église — cohérent tant que l'app reste utilisée par une seule église. */
export async function computeAutoFillProposal(startDate: string, endDate: string): Promise<Result> {
  const { admin } = await requireAdmin()

  if (!startDate || !endDate || startDate > endDate) {
    return { ok: false, error: 'Plage de dates invalide.' }
  }

  // `service_date` est un timestamptz : la borne de fin doit être EXCLUSIVE (lendemain à 00:00)
  // pour inclure tous les services du dernier jour quelle que soit leur heure.
  const endExclusive = exclusiveEndDate(endDate)

  const lookbackStart = new Date(startDate)
  lookbackStart.setDate(lookbackStart.getDate() - 90)
  const lookbackStartStr = lookbackStart.toISOString().split('T')[0]

  const [
    plansRes,
    teamsRes,
    memberPositionsRes,
    profilesRes,
    blockoutsRes,
    historicalPlansRes,
  ] = await Promise.all([
    admin
      .from('plans')
      .select('id, title, service_date, team_ids, excluded_position_ids')
      .gte('service_date', startDate)
      .lt('service_date', endExclusive)
      .order('service_date'),
    // Pas de `allow_multiple` ici : cette colonne (migration 012) n'est pas garantie appliquée
    // en base (voir le même avertissement dans getStableCatalog, getPlanDetail.ts) — la
    // sélectionner ferait échouer TOUTE la requête `teams` si elle n'existe pas, videant
    // silencieusement les équipes (symptôme observé : "0 proposé · 0 non pourvu").
    admin
      .from('teams')
      .select('id, name, positions(id, name, team_id, archived)'),
    admin.from('member_positions').select('user_id, position_id'),
    admin.from('profiles').select('id, first_name, last_name, desired_frequency'),
    admin.from('blockout_dates').select('user_id, start_date, end_date'),
    admin
      .from('plans')
      .select('id, service_date')
      .gte('service_date', lookbackStartStr)
      .lt('service_date', startDate),
  ])

  // Ne jamais avaler une erreur Supabase en silence : sans ça, une requête qui échoue (colonne
  // manquante, RLS, réseau...) rend juste 0 proposition ET 0 créneau non pourvu, indiscernable
  // d'un résultat légitimement vide — exactement le bug qu'on vient de traquer à l'aveugle.
  for (const [label, res] of [
    ['plans', plansRes], ['teams', teamsRes], ['member_positions', memberPositionsRes],
    ['profiles', profilesRes], ['blockout_dates', blockoutsRes], ['historicalPlans', historicalPlansRes],
  ] as const) {
    if (res.error) {
      console.error(`[computeAutoFillProposal] échec requête "${label}":`, res.error.message)
      return { ok: false, error: `Erreur base de données (${label}) : ${res.error.message}` }
    }
  }

  const { data: plans } = plansRes
  const { data: teams } = teamsRes
  const { data: memberPositions } = memberPositionsRes
  const { data: profiles } = profilesRes
  const { data: blockouts } = blockoutsRes
  const { data: historicalPlans } = historicalPlansRes

  if (!plans || plans.length === 0) {
    return { ok: true, proposals: [], skipped: [] }
  }

  const planIds = plans.map(p => p.id)
  const historicalPlanIds = (historicalPlans ?? []).map(p => p.id)
  const historicalDateById = new Map((historicalPlans ?? []).map(p => [p.id, p.service_date.split('T')[0]]))
  const planDateById = new Map(plans.map(p => [p.id, p.service_date.split('T')[0]]))

  const allRelevantPlanIds = [...historicalPlanIds, ...planIds]
  const assignmentsRes = allRelevantPlanIds.length > 0
    ? await admin
        .from('plan_assignments')
        .select('user_id, position_id, plan_id, status')
        .in('plan_id', allRelevantPlanIds)
        .neq('status', 'declined')
        .neq('user_id', INVITE_EXT_ID)
    : { data: [] as { user_id: string; position_id: string | null; plan_id: string; status: string }[], error: null }

  if (assignmentsRes.error) {
    console.error('[computeAutoFillProposal] échec requête "plan_assignments":', assignmentsRes.error.message)
    return { ok: false, error: `Erreur base de données (plan_assignments) : ${assignmentsRes.error.message}` }
  }
  const { data: relevantAssignments } = assignmentsRes

  const existingAssignments: BuildAssignment[] = (relevantAssignments ?? [])
    .map(a => ({
      userId: a.user_id,
      positionId: a.position_id,
      planId: a.plan_id,
      date: historicalDateById.get(a.plan_id) ?? planDateById.get(a.plan_id) ?? '',
    }))
    .filter(a => a.date !== '')

  const qualifiedUserIdsByPosition: Record<string, string[]> = {}
  for (const mp of memberPositions ?? []) {
    (qualifiedUserIdsByPosition[mp.position_id] ??= []).push(mp.user_id)
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
      // `allow_multiple` non sélectionné (cf. commentaire plus haut) : toutes les positions sont
      // traitées comme à occupant unique tant que cette colonne n'est pas confirmée en base.
      // Postes masqués (archived) exclus : jamais proposés par l'auto-remplissage.
      positions: ((t.positions ?? []) as { id: string; name: string; archived: boolean | null }[])
        .filter(pos => !pos.archived)
        .map(pos => ({ id: pos.id, name: pos.name, allow_multiple: false })),
    })),
    qualifiedUserIdsByPosition,
    profiles: profiles ?? [],
    blockouts: (blockouts ?? []).map(b => ({ userId: b.user_id, startDate: b.start_date, endDate: b.end_date })),
    existingAssignments,
  })

  return { ok: true, proposals, skipped }
}
