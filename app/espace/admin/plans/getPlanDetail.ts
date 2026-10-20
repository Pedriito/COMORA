import { unstable_cache } from 'next/cache'
import type { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { INVITE_EXT_ID } from './constants'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Catalogue quasi-statique partagé par tous les plans/utilisateurs (équipes, postes, profils,
 *  affectations aux équipes/postes, chants, annonces récurrentes) — mis en cache 5 min pour éviter
 *  de le re-fetcher à chaque affichage/action sur un plan. Invalidé précisément par `revalidateTag`
 *  dans les Server Actions qui modifient ces tables (voir admin/actions.ts, admin/equipes/[id]/actions.ts,
 *  admin/eglises/actions.ts, admin/chants/actions.ts, admin/plans/[id]/annonces-actions.ts). */
const getStableCatalog = unstable_cache(
  async () => {
    const admin = createAdminClient()
    const [
      teamsRes,
      profilesRes,
      teamMembershipsRes,
      memberPositionsRes,
      songsRes,
      recurringAnnouncementsRes,
    ] = await Promise.all([
      // TODO: ajouter `allow_multiple` à la sélection une fois la migration 012 appliquée en base.
      admin.from('teams').select('id, name, allows_guests, is_coordination, hide_positions, is_prayer_meeting, positions(id, name, archived)').order('name'),
      admin.from('profiles').select('id, first_name, last_name, desired_frequency').order('first_name'),
      admin.from('team_members').select('user_id, team_id'),
      admin.from('member_positions').select('user_id, position_id'),
      admin.from('songs').select('id, title, arrangements(id, name, chord_chart_key, keys_available)').order('title'),
      admin.from('recurring_announcements').select('id, title, body, order_index, image_url, video_url, active').eq('active', true).order('order_index'),
    ])

    // Ne jamais avaler une erreur Supabase en silence (colonne manquante, réseau...) : sans ça,
    // ce catalogue partagé par tout le module planning retomberait sur des tableaux vides
    // pendant 5 min (durée du cache), invisible et indiscernable d'un catalogue légitimement vide.
    for (const [label, res] of [
      ['teams', teamsRes], ['profiles', profilesRes], ['team_members', teamMembershipsRes],
      ['member_positions', memberPositionsRes], ['songs', songsRes], ['recurring_announcements', recurringAnnouncementsRes],
    ] as const) {
      if (res.error) console.error(`[getStableCatalog] échec requête "${label}":`, res.error.message)
    }

    return {
      teams: teamsRes.data ?? [],
      allProfiles: profilesRes.data ?? [],
      teamMemberships: teamMembershipsRes.data ?? [],
      memberPositions: memberPositionsRes.data ?? [],
      allSongs: songsRes.data ?? [],
      recurringAnnouncements: recurringAnnouncementsRes.data ?? [],
    }
  },
  ['plan-detail-stable-catalog'],
  { revalidate: 300, tags: ['teams', 'profiles', 'team-members', 'member-positions', 'songs', 'recurring-announcements'] },
)

export { INVITE_EXT_ID }

export type Profile = {
  id: string
  first_name: string
  last_name: string
  unavailable: boolean   // blockout ce jour
  recentCount: number    // nb de services les 60 derniers jours
  desired_frequency: string | null  // rythme souhaité, réglé par le bénévole dans son profil
  servedThisMonth: number           // nb de services sur le mois calendaire courant
}

// `allow_multiple` : ajouté par la migration 012, pas encore appliquée en base — optionnel
// pour l'instant, sélectionné dès qu'elle l'est (voir la requête `teams` ci-dessous).
export type Position = { id: string; name: string; allow_multiple?: boolean; archived?: boolean }

export type AssignmentRow = {
  id: string
  status: string
  user_id: string
  position_id: string | null
  team_id: string | null
  external_name: string | null
  external_email: string | null
  invitation_sent_at: string | null
  profiles: { first_name: string; last_name: string } | null
  positions: { id: string; name: string; team_id: string } | null
  unavailable: boolean
}

export type TeamDetail = {
  id: string
  name: string
  allowsGuests: boolean
  isCoordination: boolean
  hidePositions: boolean
  isPrayerMeeting: boolean
  visible: boolean
  /** Le viewer est membre de cette équipe (team_members) — indépendant du fait qu'il soit
   *  affecté ou non sur CE service. Sert au dépliage par défaut du bloc d'équipe. */
  isMyTeam: boolean
  positions: Position[]
  assignments: AssignmentRow[]
  /** Pool de l'équipe entière — utilisé seulement quand l'équipe n'a pas de postes nommés. */
  candidateProfiles: Profile[]
  /** Pool restreint aux bénévoles cochés pour ce poste précis (member_positions). */
  candidatesByPosition: Record<string, Profile[]>
}

export type PlanDetail = {
  plan: { id: string; title: string; service_date: string; notes: string | null; plan_type: string | null; team_ids: string[] | null; excluded_position_ids: string[] | null }
  isRehearsal: boolean
  teams: TeamDetail[]
  /** Toutes les équipes disponibles (non filtrées) — pour le gestionnaire d'équipes. */
  availableTeams: { id: string; name: string }[]
  noTeamAssignments: AssignmentRow[]
  pendingCount: number
  planSongs: unknown[]
  allSongs: unknown[]
  announcements: unknown[]
  recurringAnnouncements: unknown[]
  sermons: unknown[]
  videos: unknown[]
}

/** Charge toutes les données d'un plan (équipes, affectations, candidats, contenus)
 *  — utilisé à la fois par la page de détail mobile et le workspace desktop. */
export async function getPlanDetail(
  supabase: SupabaseServerClient,
  planId: string,
  userId: string,
  isAdmin: boolean,
): Promise<PlanDetail | null> {
  // Fréquence récente : nb de services les 60 derniers jours par bénévole (calculé avant le
  // Promise.all pour permettre de paralléliser `recentPlans` avec les autres requêtes ci-dessous).
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)

  // Bornes du mois calendaire LOCAL, construites à la main. `toISOString()` convertirait
  // minuit local en UTC et ferait reculer les deux bornes d'un jour aux fuseaux positifs
  // (Europe/Paris) : le compteur incluait alors le dernier jour du mois précédent et
  // ignorait le dernier jour du mois courant.
  const now = new Date()
  const firstOfMonth = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const monthStart = firstOfMonth(now)
  const monthEnd = firstOfMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1))

  const [
    { data: plan },
    { data: rawAssignments },
    catalog,
    { data: blockouts },
    { data: planSongs },
    { data: announcements },
    { data: sermons },
    { data: videos },
    { data: recentPlans },
    { data: monthPlans },
  ] = await Promise.all([
    supabase.from('plans').select('id, title, service_date, notes, plan_type, team_ids, excluded_position_ids').eq('id', planId).single(),
    supabase
      .from('plan_assignments')
      .select('id, status, user_id, position_id, team_id, external_name, external_email, invitation_sent_at, profiles(first_name, last_name), positions(id, name, team_id)')
      .eq('plan_id', planId),
    getStableCatalog(),
    supabase.from('blockout_dates').select('user_id, start_date, end_date'),
    supabase
      .from('plan_songs')
      .select('id, order_index, key_selected, songs(id, title), arrangements(id, name, chord_chart, chord_chart_key)')
      .eq('plan_id', planId)
      .order('order_index'),
    supabase
      .from('plan_announcements')
      .select('id, title, body, order_index, image_url, video_url')
      .eq('plan_id', planId)
      .order('order_index'),
    supabase
      .from('plan_sermons')
      .select('id, title, url, storage_path, created_at')
      .eq('plan_id', planId)
      .order('created_at'),
    supabase
      .from('plan_videos')
      .select('id, title, url, order_index')
      .eq('plan_id', planId)
      .order('order_index'),
    supabase
      .from('plans')
      .select('id')
      .gte('service_date', cutoff.toISOString().split('T')[0])
      .neq('id', planId),
    supabase
      .from('plans')
      .select('id')
      .gte('service_date', monthStart)
      .lt('service_date', monthEnd),
  ])

  const { teams, allProfiles, teamMemberships, memberPositions, allSongs, recurringAnnouncements } = catalog

  if (!plan) return null

  const recentPlanIds = (recentPlans ?? []).map(p => p.id)
  const monthPlanIds = (monthPlans ?? []).map(p => p.id)

  const [{ data: recentAssignments }, { data: monthAssignments }] = await Promise.all([
    recentPlanIds.length > 0
      ? supabase.from('plan_assignments').select('user_id').in('plan_id', recentPlanIds).neq('user_id', INVITE_EXT_ID)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    monthPlanIds.length > 0
      ? supabase.from('plan_assignments').select('user_id').in('plan_id', monthPlanIds).neq('user_id', INVITE_EXT_ID).neq('status', 'declined')
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ])

  const recentCountMap: Record<string, number> = {}
  for (const a of recentAssignments ?? []) {
    recentCountMap[a.user_id] = (recentCountMap[a.user_id] ?? 0) + 1
  }

  const monthCountMap: Record<string, number> = {}
  for (const a of monthAssignments ?? []) {
    monthCountMap[a.user_id] = (monthCountMap[a.user_id] ?? 0) + 1
  }

  const planDate = plan.service_date.split('T')[0]
  const unavailableIds = new Set(
    blockouts?.filter(b => b.start_date <= planDate && b.end_date >= planDate).map(b => b.user_id) ?? []
  )

  const assignments = (rawAssignments ?? []).map(a => ({
    ...a,
    unavailable: unavailableIds.has(a.user_id),
  })) as unknown as AssignmentRow[]

  // Membres par équipe
  const membersByTeam: Record<string, Set<string>> = {}
  teamMemberships?.forEach(tm => {
    if (!membersByTeam[tm.team_id]) membersByTeam[tm.team_id] = new Set()
    membersByTeam[tm.team_id].add(tm.user_id)
  })

  // Bénévoles cochés par poste (member_positions)
  const userIdsByPosition: Record<string, Set<string>> = {}
  memberPositions?.forEach(mp => {
    if (!userIdsByPosition[mp.position_id]) userIdsByPosition[mp.position_id] = new Set()
    userIdsByPosition[mp.position_id].add(mp.user_id)
  })

  // Affectations par équipe (team_id direct, sinon via positions)
  const assignmentsByTeam: Record<string, AssignmentRow[]> = {}
  const noTeamAssignments: AssignmentRow[] = []
  assignments.forEach(a => {
    const tid = a.team_id ?? a.positions?.team_id ?? null
    if (tid) {
      if (!assignmentsByTeam[tid]) assignmentsByTeam[tid] = []
      assignmentsByTeam[tid].push(a)
    } else {
      noTeamAssignments.push(a)
    }
  })

  const pendingCount = assignments.filter(a => a.status === 'pending' && a.user_id !== INVITE_EXT_ID).length

  const myTeamIdsInPlan = new Set(
    assignments
      .filter(a => a.user_id === userId)
      .map(a => a.team_id ?? a.positions?.team_id)
      .filter((id): id is string => !!id)
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCoordinator = (teams ?? []).some((t: any) => t.is_coordination && myTeamIdsInPlan.has(t.id))
  const canSeeAllTeams = isAdmin || isCoordinator

  const myTeamMemberIds = new Set(
    teamMemberships?.filter(tm => tm.user_id === userId).map(tm => tm.team_id) ?? []
  )

  const isRehearsal = plan.plan_type === 'rehearsal'

  // Filtrage des équipes : prayer_meeting → équipes prière seulement ;
  // sinon si team_ids est défini → seulement celles-là ; sinon → toutes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTeams = teams ?? [] as any[]
  const planTeamIds = (plan as any).team_ids as string[] | null
  const relevantTeams = plan.plan_type === 'prayer_meeting'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? allTeams.filter((t: any) => t.is_prayer_meeting)
    : planTeamIds && planTeamIds.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? allTeams.filter((t: any) => planTeamIds.includes(t.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : allTeams

  const teamDetails: TeamDetail[] = relevantTeams.map((team: any) => {
    // Postes masqués (archived) : jamais proposés comme créneaux à pourvoir, mais une
    // affectation déjà enregistrée dessus continue de s'afficher normalement (elle vient de
    // `team.assignments`, un flux de données séparé, non filtré ici).
    const teamPositions = (team.positions as unknown as Position[]).filter(p => !p.archived)
    const teamAssignments = assignmentsByTeam[team.id] ?? []
    const teamMemberIds = membersByTeam[team.id]

    // Qui occupe déjà quel poste dans cette équipe pour ce service ('' = affectation sans
    // poste nommé) — permet à la même personne de cumuler plusieurs postes différents
    // (ex : conducteur + guitare, piano + DM, basse + DM), tout en évitant de la reproposer
    // pour un poste qu'elle occupe déjà.
    const assignedUserIdsByPosition: Record<string, Set<string>> = {}
    teamAssignments.forEach(a => {
      const key = a.position_id ?? ''
      if (!assignedUserIdsByPosition[key]) assignedUserIdsByPosition[key] = new Set()
      assignedUserIdsByPosition[key].add(a.user_id)
    })

    const eligibleProfiles: Profile[] = (allProfiles ?? [])
      .filter(p => !teamMemberIds || teamMemberIds.size === 0 || teamMemberIds.has(p.id))
      .map(p => ({
        ...p,
        unavailable: unavailableIds.has(p.id),
        recentCount: recentCountMap[p.id] ?? 0,
        desired_frequency: p.desired_frequency ?? null,
        servedThisMonth: monthCountMap[p.id] ?? 0,
      }))

    // Pool pour une équipe SANS postes nommés : un seul rôle possible par personne, donc on
    // exclut qui est déjà affecté à l'équipe (pas de cumul possible sans poste pour distinguer).
    const candidateProfiles: Profile[] = eligibleProfiles.filter(
      p => !assignedUserIdsByPosition['']?.has(p.id)
    )

    // Pour chaque poste nommé, on ne propose que les bénévoles cochés pour ce poste précis,
    // en excluant seulement ceux qui occupent déjà CE poste (le cumul sur un autre poste reste possible).
    const candidatesByPosition: Record<string, Profile[]> = {}
    teamPositions.forEach(pos => {
      const qualifiedIds = userIdsByPosition[pos.id]
      const alreadyHere = assignedUserIdsByPosition[pos.id]
      candidatesByPosition[pos.id] = eligibleProfiles.filter(
        p => qualifiedIds?.has(p.id) && !alreadyHere?.has(p.id)
      )
    })

    return {
      id: team.id,
      name: team.name,
      allowsGuests: !!team.allows_guests,
      isCoordination: !!team.is_coordination,
      hidePositions: !!team.hide_positions,
      isPrayerMeeting: !!team.is_prayer_meeting,
      visible: canSeeAllTeams || myTeamMemberIds.has(team.id),
      isMyTeam: myTeamMemberIds.has(team.id),
      positions: teamPositions,
      assignments: teamAssignments,
      candidateProfiles,
      candidatesByPosition,
    }
  })

  // Équipes disponibles pour le gestionnaire (toutes sauf prière si service normal)
  const availableTeams: { id: string; name: string }[] = (
    plan.plan_type === 'prayer_meeting'
      ? allTeams.filter((t: any) => t.is_prayer_meeting)
      : allTeams.filter((t: any) => !t.is_prayer_meeting)
  ).map((t: any) => ({ id: t.id, name: t.name }))

  return {
    plan,
    isRehearsal,
    teams: teamDetails,
    availableTeams,
    noTeamAssignments,
    pendingCount,
    planSongs: planSongs ?? [],
    allSongs: allSongs ?? [],
    announcements: announcements ?? [],
    recurringAnnouncements: recurringAnnouncements ?? [],
    sermons: sermons ?? [],
    videos: videos ?? [],
  }
}
