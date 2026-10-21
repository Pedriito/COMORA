import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase, type FakeResponse } from '@/tests/helpers/fakeSupabase'

const {
  redirectMock,
  revalidatePathMock,
  refreshMock,
  requireChurchMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidatePathMock: vi.fn(),
  refreshMock: vi.fn(),
  requireChurchMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
// `actions.ts` importe `refresh` en plus de `revalidatePath` : les deux doivent être exposés,
// sinon le module explose dès l'import.
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock, refresh: refreshMock }))
vi.mock('@/lib/auth/church', () => ({ requireChurch: requireChurchMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email/espace', () => ({
  sendPlanAssignmentEmail: vi.fn(),
  sendCancellationNotificationEmail: vi.fn(),
  sendExternalGuestInvitationEmail: vi.fn(),
}))
vi.mock('@/lib/pushNotifications', () => ({ sendPushToUser: vi.fn(), sendPushToUsers: vi.fn() }))

const { excludePlanPositionAsync } = await import('./actions')

/** Contexte d'église simulé : le client de session est le faux Supabase du test. */
function ctxWith(supabase: unknown) {
  return { supabase, userId: 'user-1', memberId: 'member-1', church: { churchId: 'church-1', role: 'responsable', isPastoral: false } }
}

type RecordedUpdate = { table: string; payload: Record<string, unknown> }

/**
 * Enrobe `makeFakeSupabase` pour mémoriser l'argument réellement passé à `.update()`.
 * Local au fichier de test : le helper partagé `test/helpers/fakeSupabase.ts` reste intact.
 */
function makeRecordingSupabase(queues: Record<string, FakeResponse[]>) {
  const base = makeFakeSupabase(queues)
  const updates: RecordedUpdate[] = []
  return {
    calls: base.calls,
    updates,
    from(table: string) {
      const builder = base.from(table)
      const originalUpdate = builder.update.bind(builder)
      builder.update = (payload: Record<string, unknown>) => {
        updates.push({ table, payload })
        return originalUpdate(payload)
      }
      return builder
    },
  }
}

/** Fixtures : lecture de `excluded_position_ids` puis écriture réussie. */
function planQueues(currentIds: string[] | null): Record<string, FakeResponse[]> {
  return { plans: [ok({ excluded_position_ids: currentIds }), ok(null)] }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('excludePlanPositionAsync', () => {
  it('exige le rôle responsable', async () => {
    requireChurchMock.mockResolvedValue(ctxWith(makeRecordingSupabase(planQueues([]))))
    await excludePlanPositionAsync('plan-1', 'pos-a', true)
    expect(requireChurchMock).toHaveBeenCalledWith('responsable')
  })

  it("ajoute l'id au tableau existant quand on masque un poste", async () => {
    const supabase = makeRecordingSupabase(planQueues(['pos-a']))
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await excludePlanPositionAsync('plan-1', 'pos-b', true)

    expect(result).toEqual({ ok: true })
    expect(supabase.updates).toHaveLength(1)
    expect(supabase.updates[0].payload).toEqual({ excluded_position_ids: ['pos-a', 'pos-b'] })
  })

  it("retire l'id du tableau quand on réaffiche un poste", async () => {
    const supabase = makeRecordingSupabase(planQueues(['pos-a', 'pos-b', 'pos-c']))
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await excludePlanPositionAsync('plan-1', 'pos-b', false)

    expect(result).toEqual({ ok: true })
    expect(supabase.updates[0].payload).toEqual({ excluded_position_ids: ['pos-a', 'pos-c'] })
  })

  it("crée le tableau à partir de rien quand la colonne vaut null en base", async () => {
    const supabase = makeRecordingSupabase(planQueues(null))
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await excludePlanPositionAsync('plan-1', 'pos-a', true)

    expect(result).toEqual({ ok: true })
    expect(supabase.updates[0].payload).toEqual({ excluded_position_ids: ['pos-a'] })
  })

  // Anti-régression : correctif délibéré contre une condition de course (deux clics rapprochés).
  // La valeur écrite doit être dérivée d'une RELECTURE en base, jamais d'un état fourni par le
  // client. Ici la base contient des ids que l'appelant n'a jamais transmis : s'ils disparaissent
  // de l'argument d'`.update()`, c'est qu'on s'est remis à faire confiance au client.
  it('relit la valeur en base juste avant d’écrire, sans se fier à un état client obsolète', async () => {
    const supabase = makeRecordingSupabase(planQueues(['pos-ajoute-par-un-autre-clic']))
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await excludePlanPositionAsync('plan-1', 'pos-b', true)

    expect(result).toEqual({ ok: true })
    // Deux requêtes sur `plans` : le SELECT de relecture, puis l'UPDATE.
    expect(supabase.calls).toEqual(['plans', 'plans'])
    expect(supabase.updates[0].payload).toEqual({
      excluded_position_ids: ['pos-ajoute-par-un-autre-clic', 'pos-b'],
    })
  })

  it("ne duplique pas l'id quand on masque un poste déjà masqué (idempotence)", async () => {
    const supabase = makeRecordingSupabase(planQueues(['pos-a', 'pos-b']))
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await excludePlanPositionAsync('plan-1', 'pos-b', true)

    expect(result).toEqual({ ok: true })
    expect(supabase.updates[0].payload).toEqual({ excluded_position_ids: ['pos-a', 'pos-b'] })
  })

  it("laisse le tableau inchangé quand on réaffiche un poste qui n'était pas masqué", async () => {
    const supabase = makeRecordingSupabase(planQueues(['pos-a']))
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await excludePlanPositionAsync('plan-1', 'pos-z', false)

    expect(result).toEqual({ ok: true })
    expect(supabase.updates[0].payload).toEqual({ excluded_position_ids: ['pos-a'] })
  })

  it('écrit null (et non un tableau vide) quand le dernier poste masqué est réaffiché', async () => {
    const supabase = makeRecordingSupabase(planQueues(['pos-a']))
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await excludePlanPositionAsync('plan-1', 'pos-a', false)

    expect(result).toEqual({ ok: true })
    expect(supabase.updates[0].payload).toEqual({ excluded_position_ids: null })
  })

  it('revalide les deux chemins concernés et force le rafraîchissement immédiat en cas de succès', async () => {
    requireChurchMock.mockResolvedValue(ctxWith(makeRecordingSupabase(planQueues(['pos-a']))))

    await excludePlanPositionAsync('plan-42', 'pos-b', true)

    expect(revalidatePathMock).toHaveBeenCalledWith('/espace/admin/plans/plan-42')
    expect(revalidatePathMock).toHaveBeenCalledWith('/espace/admin/plans')
    expect(revalidatePathMock).toHaveBeenCalledTimes(2)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('remonte une erreur de relecture plutôt que de la masquer, et n’écrit rien', async () => {
    const supabase = makeRecordingSupabase({
      plans: [{ data: null, error: { message: 'select failed' } }],
    })
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await excludePlanPositionAsync('plan-1', 'pos-a', true)

    expect(result).toEqual({ ok: false, error: 'select failed' })
    expect(supabase.updates).toHaveLength(0)
    expect(revalidatePathMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it("remonte une erreur d'écriture plutôt que de la masquer, sans revalider ni rafraîchir", async () => {
    requireChurchMock.mockResolvedValue(ctxWith(
      makeRecordingSupabase({
        plans: [ok({ excluded_position_ids: ['pos-a'] }), { data: null, error: { message: 'write failed' } }],
      })
    ))

    const result = await excludePlanPositionAsync('plan-1', 'pos-b', true)

    expect(result).toEqual({ ok: false, error: 'write failed' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
