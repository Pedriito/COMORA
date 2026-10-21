import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ok, makeFakeSupabase, type FakeResponse } from '@/tests/helpers/fakeSupabase'

const { redirectMock, requireChurchMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  requireChurchMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/auth/church', () => ({ requireChurch: requireChurchMock }))

const { computeAutoFillProposal } = await import('./computeAutoFill')

/** Contexte d'église simulé : le client de session est le faux Supabase du test. */
function ctxWith(supabase: unknown) {
  return { supabase, userId: 'admin-1', memberId: 'member-1', church: { churchId: 'church-1', role: 'responsable', isPastoral: false } }
}

const TARGET_PLAN = {
  id: 'plan-1',
  title: 'Culte du dimanche',
  service_date: '2026-12-06T10:00:00.000Z',
  team_ids: null,
  excluded_position_ids: null,
}
const TEAMS = [
  { id: 'team-1', name: 'Louange', positions: [{ id: 'pos-1', name: 'Guitare', team_id: 'team-1' }] },
]
const MEMBER_POSITIONS = [{ member_id: 'user-1', position_id: 'pos-1' }]
const MEMBERS = [{ id: 'user-1', first_name: 'Alice', last_name: 'A', desired_frequency: null }]

/** Fixture "chemin heureux" complet : un plan, une équipe/poste, un bénévole qualifié,
 *  aucune affectation existante, aucune indisponibilité, aucun historique. */
function setupAdminClient(overrides: Partial<Record<string, FakeResponse[]>> = {}) {
  requireChurchMock.mockResolvedValue(ctxWith(
    makeFakeSupabase({
      churches: [ok({ timezone: 'Europe/Paris' })],
      plans: [ok([TARGET_PLAN]), ok([])], // 1er appel = plans de la plage, 2e = historique
      teams: [ok(TEAMS)],
      member_positions: [ok(MEMBER_POSITIONS)],
      members: [ok(MEMBERS)],
      blockout_dates: [ok([])],
      plan_assignments: [ok([])],
      ...overrides,
    })
  ))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('computeAutoFillProposal — permission', () => {
  it('exige le rôle responsable, et ne lit rien si requireChurch redirige', async () => {
    requireChurchMock.mockRejectedValue(new Error('NEXT_REDIRECT:/espace/dashboard'))

    await expect(computeAutoFillProposal('2026-12-01', '2026-12-31')).rejects.toThrow('NEXT_REDIRECT')
    expect(requireChurchMock).toHaveBeenCalledWith('responsable')
  })
})

describe('computeAutoFillProposal — validation', () => {
  it('refuse une plage de dates invalide (fin avant début)', async () => {
    setupAdminClient()
    const result = await computeAutoFillProposal('2026-12-10', '2026-12-01')
    expect(result).toEqual({ ok: false, error: 'Plage de dates invalide.' })
    expect(await computeAutoFillProposal('pas-une-date', '2026-12-01')).toEqual({ ok: false, error: 'Plage de dates invalide.' })
  })
})

describe('computeAutoFillProposal — chemin heureux', () => {
  it('propose le bénévole qualifié pour le seul poste ouvert du plan', async () => {
    setupAdminClient()
    const result = await computeAutoFillProposal('2026-12-01', '2026-12-31')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.skipped).toEqual([])
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0]).toMatchObject({
      planId: 'plan-1', positionId: 'pos-1', userId: 'user-1', allowMultiple: false,
    })
  })

  it("renvoie un résultat vide (proposals ET skipped) si aucun plan n'existe sur la plage — sans planter", async () => {
    setupAdminClient({ plans: [ok([]), ok([])] })
    const result = await computeAutoFillProposal('2026-12-01', '2026-12-31')
    expect(result).toEqual({ ok: true, proposals: [], skipped: [] })
  })
})

describe('computeAutoFillProposal — erreurs Supabase non avalées', () => {
  // Régression : la sélection de `teams.positions(...,allow_multiple,...)` échouait
  // silencieusement si la colonne n'existait pas en base, retombant sur `teams: []` et donc sur
  // "0 proposé · 0 non pourvu" — indiscernable d'un résultat légitimement vide. Toute erreur
  // Supabase doit maintenant remonter explicitement en `{ ok: false, error }`.
  it('remonte une erreur explicite si la requête `teams` échoue, plutôt que de rendre un résultat vide', async () => {
    setupAdminClient({ teams: [{ data: null, error: { message: 'column positions.allow_multiple does not exist' } }] })
    const result = await computeAutoFillProposal('2026-12-01', '2026-12-31')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('teams')
    expect(result.error).toContain('allow_multiple')
  })

  it('remonte une erreur explicite si la requête `plans` échoue', async () => {
    setupAdminClient({ plans: [{ data: null, error: { message: 'network error' } }] })
    const result = await computeAutoFillProposal('2026-12-01', '2026-12-31')
    expect(result).toEqual({ ok: false, error: 'Erreur base de données (plans) : network error' })
  })

  it('remonte une erreur explicite si la requête `plan_assignments` échoue', async () => {
    setupAdminClient({ plan_assignments: [{ data: null, error: { message: 'timeout' } }] })
    const result = await computeAutoFillProposal('2026-12-01', '2026-12-31')
    expect(result).toEqual({ ok: false, error: 'Erreur base de données (plan_assignments) : timeout' })
  })
})
