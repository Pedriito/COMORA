import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

// Même montage que `getPlanDetail.test.ts` : `getStableCatalog` est construit au chargement du
// module via `unstable_cache(fn, keyParts, options)`, qu'on transforme en passe-plat pour que
// chaque test rejoue la vraie fonction (sans cache ni TTL) sur un faux client admin.
const { unstableCacheMock, createAdminClientMock } = vi.hoisted(() => ({
  unstableCacheMock: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
  createAdminClientMock: vi.fn(),
}))

vi.mock('next/cache', () => ({
  unstable_cache: unstableCacheMock,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

const { getPlanDetail } = await import('./getPlanDetail')
/** Viewer d'un plan : église, personne liée au compte, droit de gestion, fuseau. */
const CHURCH_ID = 'church-1'
function viewer(memberId: string | null, canManage = false) {
  return { churchId: CHURCH_ID, memberId, canManage, timeZone: 'Europe/Paris' }
}


// ---------------------------------------------------------------------------
// Faux client qui enregistre AUSSI les filtres appliqués
// ---------------------------------------------------------------------------
// `makeFakeSupabase` ignore les filtres (il sert des fixtures en FIFO par table) : pour
// verrouiller des exclusions côté requête (`.neq('status', 'declined')`, bornes de mois...),
// on enveloppe son builder pour mémoriser les appels chaînés, requête par requête.
type RecordedQuery = { table: string; calls: { method: string; args: unknown[] }[] }

const CHAINABLE = ['select', 'eq', 'neq', 'not', 'gte', 'lt', 'in', 'order', 'limit'] as const

function makeRecordingSupabase(queues: Parameters<typeof makeFakeSupabase>[0]) {
  const inner = makeFakeSupabase(queues)
  const queries: RecordedQuery[] = []

  function from(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base: any = inner.from(table)
    const entry: RecordedQuery = { table, calls: [] }
    queries.push(entry)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recorder: any = {
      single: () => base.single(),
      maybeSingle: () => base.maybeSingle(),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        base.then(resolve, reject),
    }
    for (const method of CHAINABLE) {
      recorder[method] = (...args: unknown[]) => {
        entry.calls.push({ method, args })
        base[method](...args)
        return recorder
      }
    }
    return recorder
  }

  return { from, queries }
}

/** N-ième requête (0-indexée) émise sur une table donnée. */
function queryAt(queries: RecordedQuery[], table: string, index: number) {
  return queries.filter(q => q.table === table)[index]
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const POS_CHANT = { id: 'pos-chant', name: 'Chant lead', archived: false }
const POS_ORDI = { id: 'pos-ordi', name: 'Ordi - clic/track', archived: true }
/** Poste sans la colonne `archived` (migration 021 pas encore appliquée) : doit rester visible. */
const POS_SON = { id: 'pos-son', name: 'Son' }

const TEAM_LOUANGE = {
  id: 'team-louange', name: 'Louange', allows_guests: false, is_coordination: false,
  hide_positions: false, is_prayer_meeting: false, positions: [POS_CHANT, POS_ORDI, POS_SON],
}
const TEAM_PROD = {
  id: 'team-prod', name: 'Production', allows_guests: false, is_coordination: false,
  hide_positions: false, is_prayer_meeting: false, positions: [],
}
const TEAM_PRIERE = {
  id: 'team-priere', name: 'Réunion de prière', allows_guests: true, is_coordination: false,
  hide_positions: false, is_prayer_meeting: true, positions: [],
}
const TEAM_COORD = {
  id: 'team-coord', name: 'Coordination', allows_guests: false, is_coordination: true,
  hide_positions: false, is_prayer_meeting: false, positions: [],
}

const ALICE = { id: 'user-alice', first_name: 'Alice', last_name: 'Martin', desired_frequency: '2x/mois' }
const BOB = { id: 'user-bob', first_name: 'Bob', last_name: 'Durand', desired_frequency: null }
/** Profil dont la colonne `desired_frequency` n'est pas renseignée du tout. */
const CLARA = { id: 'user-clara', first_name: 'Clara', last_name: 'Petit' }

/** Alice : Louange + Production. Bob : Production. Clara : aucune équipe. */
const MEMBERSHIPS = [
  { member_id: 'user-alice', team_id: 'team-louange' },
  { member_id: 'user-alice', team_id: 'team-prod' },
  { member_id: 'user-bob', team_id: 'team-prod' },
]

const MEMBER_POSITIONS = [
  { member_id: 'user-alice', position_id: 'pos-chant' },
  { member_id: 'user-bob', position_id: 'pos-chant' },
  { member_id: 'user-clara', position_id: 'pos-son' },
]

const PLAN = {
  id: 'plan-1',
  title: 'Culte du dimanche',
  service_date: '2026-06-07T10:00:00.000Z',
  notes: null,
  plan_type: 'sunday_service',
  team_ids: null as string[] | null,
  excluded_position_ids: null,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assignment(over: Record<string, any> = {}) {
  return {
    id: 'a1',
    status: 'confirmed',
    member_id: 'user-alice',
    position_id: null,
    team_id: null,
    external_name: null,
    external_email: null,
    invitation_sent_at: null,
    members: { first_name: 'Alice', last_name: 'Martin' },
    positions: null,
    ...over,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rows = Record<string, any>[]

type Scenario = {
  plan?: Record<string, unknown>
  assignments?: Rows
  teams?: Rows
  profiles?: Rows
  teamMembers?: Rows
  memberPositions?: Rows
  blockouts?: Rows
  recentPlans?: Rows
  monthPlans?: Rows
  recentAssignments?: Rows
  monthAssignments?: Rows
  userId?: string
  isAdmin?: boolean
}

/** Joue `getPlanDetail` sur un scénario complet et renvoie le résultat + les requêtes observées.
 *  Les files FIFO respectent l'ordre d'émission du code source :
 *  `plans` = [plan courant, plans récents (60 j), plans du mois],
 *  `plan_assignments` = [affectations du plan, affectations récentes, affectations du mois]. */
async function runPlanDetail(scenario: Scenario = {}) {
  const s = {
    plan: PLAN,
    assignments: [] as Rows,
    teams: [TEAM_LOUANGE, TEAM_PROD, TEAM_PRIERE, TEAM_COORD] as Rows,
    profiles: [ALICE, BOB, CLARA] as Rows,
    teamMembers: MEMBERSHIPS as Rows,
    memberPositions: MEMBER_POSITIONS as Rows,
    blockouts: [] as Rows,
    recentPlans: [{ id: 'plan-recent' }] as Rows,
    monthPlans: [{ id: 'plan-mois' }] as Rows,
    recentAssignments: [] as Rows,
    monthAssignments: [] as Rows,
    userId: 'user-alice',
    isAdmin: false,
    ...scenario,
  }

  createAdminClientMock.mockReturnValue(
    makeFakeSupabase({
      teams: [ok(s.teams)],
      members: [ok(s.profiles)],
      team_members: [ok(s.teamMembers)],
      member_positions: [ok(s.memberPositions)],
      songs: [ok([])],
      recurring_announcements: [ok([])],
    })
  )

  const supabase = makeRecordingSupabase({
    plans: [ok(s.plan), ok(s.recentPlans), ok(s.monthPlans)],
    plan_assignments: [ok(s.assignments), ok(s.recentAssignments), ok(s.monthAssignments)],
    blockout_dates: [ok(s.blockouts)],
    plan_songs: [ok([])],
    plan_announcements: [ok([])],
    plan_sermons: [ok([])],
    plan_videos: [ok([])],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await getPlanDetail(supabase as any, 'plan-1', viewer(s.userId, s.isAdmin))
  return { result: result!, queries: supabase.queries }
}

beforeEach(() => {
  createAdminClientMock.mockReset()
})

// ---------------------------------------------------------------------------
describe('isMyTeam', () => {
  it('est vrai pour une équipe dont le viewer est membre, même sans aucune affectation sur ce service', async () => {
    // Régression : le dépliage automatique se basait sur « avoir une affectation sur ce service »,
    // donc une équipe encore vide (Production) ne se dépliait jamais pour ses propres membres.
    const { result } = await runPlanDetail({ userId: 'user-alice', assignments: [] })

    const prod = result.teams.find(t => t.id === 'team-prod')!
    expect(prod.assignments).toHaveLength(0)
    expect(prod.isMyTeam).toBe(true)
  })

  it('est faux pour une équipe où la personne est seulement affectée sans en être membre', async () => {
    const { result } = await runPlanDetail({
      userId: 'user-clara',
      assignments: [assignment({
        member_id: 'user-clara',
        position_id: 'pos-chant',
        members: { first_name: 'Clara', last_name: 'Petit' },
        positions: { id: 'pos-chant', name: 'Chant lead', team_id: 'team-louange' },
      })],
    })

    const louange = result.teams.find(t => t.id === 'team-louange')!
    expect(louange.assignments).toHaveLength(1)
    expect(louange.assignments[0].member_id).toBe('user-clara')
    expect(louange.isMyTeam).toBe(false)
  })

  it('est faux pour une équipe dont le viewer n’est ni membre ni affecté', async () => {
    const { result } = await runPlanDetail({ userId: 'user-alice' })

    expect(result.teams.find(t => t.id === 'team-priere')!.isMyTeam).toBe(false)
    expect(result.teams.find(t => t.id === 'team-coord')!.isMyTeam).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('postes archivés (migration 021)', () => {
  it('exclut les postes archivés des créneaux à pourvoir et de leurs pools de candidats', async () => {
    const { result } = await runPlanDetail()

    const louange = result.teams.find(t => t.id === 'team-louange')!
    // `pos-son` n'a pas la colonne `archived` : rétrocompatible, il reste proposé.
    expect(louange.positions.map(p => p.id)).toEqual(['pos-chant', 'pos-son'])
    expect(Object.keys(louange.candidatesByPosition)).toEqual(['pos-chant', 'pos-son'])
    expect(louange.candidatesByPosition['pos-ordi']).toBeUndefined()
  })

  it('continue d’afficher une affectation déjà enregistrée sur un poste archivé', async () => {
    const { result } = await runPlanDetail({
      assignments: [assignment({
        id: 'a-archivee',
        position_id: 'pos-ordi',
        positions: { id: 'pos-ordi', name: 'Ordi - clic/track', team_id: 'team-louange' },
      })],
    })

    const louange = result.teams.find(t => t.id === 'team-louange')!
    expect(louange.assignments.map(a => a.id)).toEqual(['a-archivee'])
    expect(louange.assignments[0].positions!.id).toBe('pos-ordi')
    // ...sans pour autant faire réapparaître le poste comme créneau à pourvoir.
    expect(louange.positions.map(p => p.id)).not.toContain('pos-ordi')
  })
})

// ---------------------------------------------------------------------------
describe('servedThisMonth et desired_frequency des candidats', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('compte les services du mois indépendamment de la charge des 60 derniers jours', async () => {
    const { result } = await runPlanDetail({
      recentAssignments: [
        { member_id: 'user-alice' }, { member_id: 'user-alice' }, { member_id: 'user-alice' },
        { member_id: 'user-bob' },
      ],
      monthAssignments: [{ member_id: 'user-alice' }, { member_id: 'user-alice' }],
    })

    const prod = result.teams.find(t => t.id === 'team-prod')!
    expect(prod.candidateProfiles.map(p => p.id)).toEqual(['user-alice', 'user-bob'])
    expect(prod.candidateProfiles[0]).toMatchObject({ recentCount: 3, servedThisMonth: 2 })
    expect(prod.candidateProfiles[1]).toMatchObject({ recentCount: 1, servedThisMonth: 0 })
  })

  it('remonte le rythme souhaité du profil, et null quand il n’est pas renseigné', async () => {
    const { result } = await runPlanDetail({
      // Équipe sans membres déclarés : le pool retombe sur tous les profils.
      teamMembers: [],
    })

    const prod = result.teams.find(t => t.id === 'team-prod')!
    expect(prod.candidateProfiles.map(p => p.desired_frequency)).toEqual(['2x/mois', null, null])
  })

  it('exclut les affectations refusées et les invités externes du comptage du mois', async () => {
    const { queries } = await runPlanDetail()

    const monthAssignmentsQuery = queryAt(queries, 'plan_assignments', 2)
    expect(monthAssignmentsQuery.calls).toContainEqual({ method: 'neq', args: ['status', 'declined'] })
    // Les invités externes (sans personne liée) ne comptent pas dans la charge de service
    expect(monthAssignmentsQuery.calls).toContainEqual({ method: 'not', args: ['member_id', 'is', null] })
    expect(monthAssignmentsQuery.calls).toContainEqual({ method: 'in', args: ['plan_id', ['plan-mois']] })

    // La requête des 60 derniers jours, elle, exclut les invités externes mais pas les refus.
    const recentAssignmentsQuery = queryAt(queries, 'plan_assignments', 1)
    expect(recentAssignmentsQuery.calls).toContainEqual({ method: 'not', args: ['member_id', 'is', null] })
    expect(recentAssignmentsQuery.calls).not.toContainEqual({ method: 'neq', args: ['status', 'declined'] })
  })

  it('borne le comptage aux services du mois calendaire courant', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'))

    const { queries } = await runPlanDetail()

    const monthPlansQuery = queryAt(queries, 'plans', 2)
    const bounds = monthPlansQuery.calls.filter(c => c.method === 'gte' || c.method === 'lt')
    // Les bornes doivent correspondre au mois calendaire LOCAL. Une construction via
    // `new Date(y, m, 1).toISOString()` convertirait minuit local (Europe/Paris) en UTC et
    // reculerait les deux bornes d'un jour — le compteur incluait alors le dernier jour du
    // mois précédent et ignorait le dernier jour du mois courant.
    // En septembre, Paris est à UTC+2 : minuit local du 1er = 22 h UTC la veille.
    expect(bounds).toEqual([
      { method: 'gte', args: ['service_date', '2026-08-31T22:00:00.000Z'] },
      { method: 'lt', args: ['service_date', '2026-09-30T22:00:00.000Z'] },
    ])
  })

  it('ne compte aucun service du mois quand aucun plan n’est trouvé sur la période', async () => {
    const { result, queries } = await runPlanDetail({
      monthPlans: [],
      monthAssignments: [{ member_id: 'user-alice' }],
    })

    // Sans plan sur le mois, la requête d'affectations du mois n'est même pas émise.
    expect(queries.filter(q => q.table === 'plan_assignments')).toHaveLength(2)
    const prod = result.teams.find(t => t.id === 'team-prod')!
    expect(prod.candidateProfiles.every(p => p.servedThisMonth === 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('visible', () => {
  it('masque une équipe dont le viewer n’est ni admin, ni coordinateur, ni membre', async () => {
    const { result } = await runPlanDetail({ userId: 'user-alice', isAdmin: false })

    expect(result.teams.find(t => t.id === 'team-louange')!.visible).toBe(true)
    expect(result.teams.find(t => t.id === 'team-priere')!.visible).toBe(false)
    expect(result.teams.find(t => t.id === 'team-coord')!.visible).toBe(false)
  })

  it('rend toutes les équipes visibles pour un admin', async () => {
    const { result } = await runPlanDetail({ userId: 'user-clara', isAdmin: true })

    expect(result.teams.every(t => t.visible)).toBe(true)
    // Visible ne veut pas dire « mon équipe » : l'admin n'est membre d'aucune.
    expect(result.teams.every(t => !t.isMyTeam)).toBe(true)
  })

  it('rend toutes les équipes visibles pour un coordinateur affecté sur ce service', async () => {
    const { result } = await runPlanDetail({
      userId: 'user-clara',
      isAdmin: false,
      assignments: [assignment({
        member_id: 'user-clara',
        team_id: 'team-coord',
        members: { first_name: 'Clara', last_name: 'Petit' },
      })],
    })

    expect(result.teams.every(t => t.visible)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('filtrage des équipes du service', () => {
  it('ne retourne que les équipes listées dans plan.team_ids', async () => {
    const { result } = await runPlanDetail({
      plan: { ...PLAN, team_ids: ['team-prod', 'team-coord'] },
    })

    expect(result.teams.map(t => t.id)).toEqual(['team-prod', 'team-coord'])
  })

  it('retourne toutes les équipes quand plan.team_ids est nul ou vide', async () => {
    const { result: sansListe } = await runPlanDetail({ plan: { ...PLAN, team_ids: null } })
    expect(sansListe.teams.map(t => t.id)).toEqual(['team-louange', 'team-prod', 'team-priere', 'team-coord'])

    const { result: listeVide } = await runPlanDetail({ plan: { ...PLAN, team_ids: [] } })
    expect(listeVide.teams.map(t => t.id)).toEqual(['team-louange', 'team-prod', 'team-priere', 'team-coord'])
  })

  it('ne retourne que les équipes de prière pour un service de type prayer_meeting', async () => {
    const { result } = await runPlanDetail({
      // team_ids est ignoré : le type de service prime.
      plan: { ...PLAN, plan_type: 'prayer_meeting', team_ids: ['team-louange'] },
    })

    expect(result.teams.map(t => t.id)).toEqual(['team-priere'])
  })
})
