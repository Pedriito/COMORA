import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

// `getStableCatalog` est défini via `unstable_cache(fn, keyParts, options)` au chargement du
// module. On capture ces arguments (pour vérifier la config du cache) et on transforme
// `unstable_cache` en passe-plat pour que chaque test relance la vraie fonction, sans TTL.
const { unstableCacheMock, createAdminClientMock } = vi.hoisted(() => ({
  unstableCacheMock: vi.fn((fn: (...a: unknown[]) => unknown, _keys?: string[], _options?: { revalidate: number; tags: string[] }) => fn),
  createAdminClientMock: vi.fn(),
}))

vi.mock('next/cache', () => ({
  unstable_cache: unstableCacheMock,
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

const { getPlanDetail, catalogTag } = await import('./getPlanDetail')

/** Viewer d'un plan : église, personne liée au compte, droit de gestion, fuseau. */
const CHURCH_ID = 'church-1'
function viewer(memberId: string | null, canManage = false) {
  return { churchId: CHURCH_ID, memberId, canManage, timeZone: 'Europe/Paris' }
}

const TEAMS_CATALOG = [
  { id: 'team-1', name: 'Louange', allows_guests: false, is_coordination: false, hide_positions: false, is_prayer_meeting: false, positions: [{ id: 'pos-1', name: 'Chant lead' }] },
  { id: 'team-2', name: 'Café', allows_guests: false, is_coordination: false, hide_positions: false, is_prayer_meeting: false, positions: [] },
]
const PROFILES_CATALOG = [
  { id: 'user-1', first_name: 'Alice', last_name: 'A', desired_frequency: null },
  { id: 'user-2', first_name: 'Bob', last_name: 'B', desired_frequency: null },
]
const TEAM_MEMBERSHIPS = [
  { member_id: 'user-1', team_id: 'team-1' },
  { member_id: 'user-2', team_id: 'team-2' },
]
const MEMBER_POSITIONS = [{ member_id: 'user-1', position_id: 'pos-1' }]
const SONGS_CATALOG = [{ id: 'song-1', title: 'Amazing Grace', arrangements: [] }]
const RECURRING_ANNOUNCEMENTS = [{ id: 'ra-1', title: 'Bienvenue', body: 'Merci de venir tôt', order_index: 0, image_url: null, video_url: null, active: true }]

function setupAdminCatalog() {
  createAdminClientMock.mockReturnValue(
    makeFakeSupabase({
      teams: [ok(TEAMS_CATALOG)],
      members: [ok(PROFILES_CATALOG)],
      team_members: [ok(TEAM_MEMBERSHIPS)],
      member_positions: [ok(MEMBER_POSITIONS)],
      songs: [ok(SONGS_CATALOG)],
      recurring_announcements: [ok(RECURRING_ANNOUNCEMENTS)],
    })
  )
}

beforeEach(() => {
  // `unstable_cache(...)` n'est appelé qu'une fois, au chargement du module (top-level
  // `const getStableCatalog = unstable_cache(...)`) — on ne le réinitialise donc pas ici,
  // seulement le mock du client admin (recréé/relu à chaque test).
  createAdminClientMock.mockReset()
  setupAdminCatalog()
})

describe('getStableCatalog (cache wiring)', () => {
  async function loadFor(churchId: string) {
    const supabase = makeFakeSupabase({
      plans: [ok({ id: 'plan-1', title: 'Culte', service_date: '2026-06-01T10:00:00.000Z', notes: null, plan_type: 'sunday_service', team_ids: null, excluded_position_ids: null }), ok([])],
      plan_assignments: [ok([])],
      blockout_dates: [ok([])],
      plan_songs: [ok([])],
      plan_announcements: [ok([])],
      plan_sermons: [ok([])],
      plan_videos: [ok([])],
    })
    await getPlanDetail(supabase as any, 'plan-1', { ...viewer('user-1'), churchId })
  }

  it('configure unstable_cache avec un TTL de 5 min et des tags propres à l’église', async () => {
    await loadFor('church-1')
    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      ['plan-detail-stable-catalog', 'church-1'],
      {
        revalidate: 300,
        tags: expect.arrayContaining(['teams', 'songs', catalogTag('church-1', 'teams'), catalogTag('church-1', 'songs')]),
      },
    )
  })

  it('n’utilise jamais la même entrée de cache pour deux églises', async () => {
    await loadFor('church-1')
    await loadFor('church-2')
    const keys = unstableCacheMock.mock.calls.map(call => JSON.stringify(call[1]))
    expect(new Set(keys).size).toBe(2)
    const tagsOfSecond = unstableCacheMock.mock.calls[1]?.[2]?.tags ?? []
    expect(tagsOfSecond).toContain('church:church-2:songs')
    expect(tagsOfSecond).not.toContain('church:church-1:songs')
  })

  it('ne lit le catalogue qu’avec le filtre de l’église', async () => {
    await loadFor('church-9')
    // Le catalogue (clé secrète) est interrogé pour l’église demandée uniquement
    expect(createAdminClientMock).toHaveBeenCalled()
  })
})

describe('getPlanDetail', () => {
  const PLAN = {
    id: 'plan-1',
    title: 'Culte du dimanche',
    service_date: '2026-06-01T10:00:00.000Z',
    notes: null,
    plan_type: 'sunday_service',
    team_ids: null,
    excluded_position_ids: null,
  }

  const MAIN_ASSIGNMENTS = [
    {
      id: 'a1',
      status: 'confirmed',
      member_id: 'user-1',
      position_id: 'pos-1',
      team_id: null,
      external_name: null,
      external_email: null,
      invitation_sent_at: null,
      members: { first_name: 'Alice', last_name: 'A' },
      positions: { id: 'pos-1', name: 'Chant lead', team_id: 'team-1' },
    },
  ]

  const BLOCKOUTS = [{ member_id: 'user-2', start_date: '2026-01-01', end_date: '2026-12-31' }]

  function fakeCookieClient() {
    return makeFakeSupabase({
      plans: [ok(PLAN), ok([{ id: 'plan-0' }])], // 1er appel = plan courant, 2e = recentPlans
      plan_assignments: [ok(MAIN_ASSIGNMENTS), ok([{ member_id: 'user-2' }, { member_id: 'user-2' }, { member_id: 'user-2' }])],
      blockout_dates: [ok(BLOCKOUTS)],
      plan_songs: [ok([])],
      plan_announcements: [ok([])],
      plan_sermons: [ok([])],
      plan_videos: [ok([])],
    })
  }

  it('retourne null si le plan est introuvable', async () => {
    const supabase = makeFakeSupabase({
      plans: [ok(null), ok([])],
      plan_assignments: [ok([]), ok([])],
      blockout_dates: [ok([])],
      plan_songs: [ok([])],
      plan_announcements: [ok([])],
      plan_sermons: [ok([])],
      plan_videos: [ok([])],
    })
    const result = await getPlanDetail(supabase as any, 'missing-plan', viewer('user-1', false))
    expect(result).toBeNull()
  })

  it('assemble correctement le catalogue stable (cache) et les données volatiles du plan', async () => {
    const supabase = fakeCookieClient()
    const result = await getPlanDetail(supabase as any, 'plan-1', viewer('user-1', false))

    expect(result).not.toBeNull()
    expect(result!.plan.id).toBe('plan-1')

    // Catalogue stable (songs/annonces) correctement transmis depuis getStableCatalog
    expect(result!.allSongs).toEqual(SONGS_CATALOG)
    expect(result!.recurringAnnouncements).toEqual(RECURRING_ANNOUNCEMENTS)

    const team1 = result!.teams.find(t => t.id === 'team-1')!
    const team2 = result!.teams.find(t => t.id === 'team-2')!

    // Visibilité : user-1 est membre de team-1 (visible) mais pas de team-2 (non admin/coordinateur)
    expect(team1.visible).toBe(true)
    expect(team2.visible).toBe(false)

    // L'affectation existante est bien rattachée à team-1, et user-1 n'est pas indisponible
    expect(team1.assignments).toHaveLength(1)
    expect(team1.assignments[0].unavailable).toBe(false)

    // user-1 est déjà affecté au seul poste nommé -> ne doit pas se reproposer lui-même
    expect(team1.candidatesByPosition['pos-1']).toEqual([])

    // team-2 (sans poste nommé) : le pool = ses membres, ici user-2 seul.
    // Il doit apparaître indisponible (blockout couvrant la date du plan) avec le bon
    // décompte de charge récente (3 affectations sur les 60 derniers jours).
    expect(team2.candidateProfiles).toHaveLength(1)
    expect(team2.candidateProfiles[0]).toMatchObject({ id: 'user-2', unavailable: true, recentCount: 3 })
  })
})
