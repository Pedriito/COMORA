import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase, type FakeResponse } from '@/tests/helpers/fakeSupabase'

const {
  redirectMock,
  revalidatePathMock,
  requireChurchMock,
  sendPushToUserMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidatePathMock: vi.fn(),
  requireChurchMock: vi.fn(),
  sendPushToUserMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/auth/church', () => ({ requireChurch: requireChurchMock }))
vi.mock('@/lib/pushNotifications', () => ({
  sendPushToUser: sendPushToUserMock,
  sendPushToUsers: vi.fn(),
}))

const { commitAutoFillProposal } = await import('./commitAutoFill')
type CommitRow = Parameters<typeof commitAutoFillProposal>[0][number]

/** Contexte d'église simulé : le client de session est le faux Supabase du test. */
function ctxWith(supabase: unknown) {
  return { supabase, userId: 'admin-1', memberId: 'member-1', church: { churchId: 'church-1', role: 'responsable', isPastoral: false } }
}

type InsertedPayload = Record<string, unknown> | Record<string, unknown>[]

/**
 * Enrobe `makeFakeSupabase` pour (1) mémoriser l'argument réellement passé à `.insert()` et
 * (2) ajouter `.not()`, absent du helper partagé mais utilisé par `commitAutoFill`.
 * Local au fichier de test : le helper partagé `test/helpers/fakeSupabase.ts` reste intact.
 */
function makeRecordingSupabase(queues: Record<string, FakeResponse[]>) {
  const base = makeFakeSupabase(queues)
  const inserts: { table: string; payload: InsertedPayload }[] = []
  return {
    calls: base.calls,
    inserts,
    from(table: string) {
      const builder = base.from(table)
      builder.not = () => builder
      const originalInsert = builder.insert.bind(builder)
      builder.insert = (payload: InsertedPayload) => {
        inserts.push({ table, payload })
        return originalInsert(payload)
      }
      return builder
    },
  }
}

function row(overrides: Partial<CommitRow> = {}): CommitRow {
  return {
    planId: 'plan-1',
    serviceDate: '2026-12-06T10:00:00.000Z',
    teamId: 'team-1',
    positionId: 'pos-1',
    positionName: 'Guitare',
    allowMultiple: false,
    userId: 'user-1',
    ...overrides,
  }
}

/** Fixtures : 1er appel `plan_assignments` = relecture des postes déjà pourvus, 2e = insertion. */
function assignmentQueues(
  existing: { plan_id: string; position_id: string }[],
  insertResponse: FakeResponse = ok(null),
): Record<string, FakeResponse[]> {
  const memberIds = ['user-1', 'user-2', 'user-3', 'user-9']
  return {
    plan_assignments: [ok(existing), insertResponse],
    // Personnes affectées : chacune a un compte `acc-<id>` (destinataire des notifications)
    members: [ok(memberIds.map(id => ({ id, user_id: `acc-${id}` })))],
    churches: [ok({ timezone: 'Europe/Paris' })],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  sendPushToUserMock.mockResolvedValue(undefined)
})

describe('commitAutoFillProposal — permission', () => {
  it('exige le rôle responsable, et ne fait rien si requireChurch redirige', async () => {
    requireChurchMock.mockRejectedValue(new Error('NEXT_REDIRECT:/espace/dashboard'))

    await expect(commitAutoFillProposal([row()])).rejects.toThrow('NEXT_REDIRECT')
    expect(requireChurchMock).toHaveBeenCalledWith('responsable')
  })
})

describe('commitAutoFillProposal — insertion groupée', () => {
  it('insère toutes les lignes validées en une seule requête (un tableau, pas une boucle)', async () => {
    const supabase = makeRecordingSupabase(assignmentQueues([]))
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await commitAutoFillProposal([
      row(),
      row({ positionId: 'pos-2', positionName: 'Batterie', userId: 'user-2' }),
      row({ planId: 'plan-2', positionId: 'pos-3', positionName: 'Chant', userId: 'user-3' }),
    ])

    expect(result).toEqual({ ok: true, inserted: 3, skipped: 0 })
    expect(supabase.inserts).toHaveLength(1)
    expect(supabase.inserts[0].table).toBe('plan_assignments')
    expect(supabase.inserts[0].payload).toHaveLength(3)
  })

  it('mappe chaque ligne vers les colonnes de `plan_assignments`, en statut « pending »', async () => {
    const supabase = makeRecordingSupabase(assignmentQueues([]))
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    await commitAutoFillProposal([row()])

    expect(supabase.inserts[0].payload).toEqual([{
      church_id: 'church-1',
      plan_id: 'plan-1',
      member_id: 'user-1',
      position_id: 'pos-1',
      team_id: 'team-1',
      status: 'pending',
    }])
  })

  it('revalide la liste des plans et chaque plan concerné après une insertion réussie', async () => {
    requireChurchMock.mockResolvedValue(ctxWith(makeRecordingSupabase(assignmentQueues([]))))

    await commitAutoFillProposal([row(), row({ planId: 'plan-2', positionId: 'pos-2', userId: 'user-2' })])

    expect(revalidatePathMock).toHaveBeenCalledWith('/espace/admin/plans')
    expect(revalidatePathMock).toHaveBeenCalledWith('/espace/admin/plans/plan-1')
    expect(revalidatePathMock).toHaveBeenCalledWith('/espace/admin/plans/plan-2')
  })
})

describe('commitAutoFillProposal — garde anti-doublon', () => {
  // La modale d'aperçu peut rester ouverte longtemps : un poste proposé a pu être pourvu
  // manuellement entre-temps. La relecture juste avant l'insertion évite le doublon.
  it("n'insère pas une ligne dont le poste a été pourvu pendant que la modale était ouverte", async () => {
    const supabase = makeRecordingSupabase(
      assignmentQueues([{ plan_id: 'plan-1', position_id: 'pos-1' }])
    )
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await commitAutoFillProposal([
      row(),
      row({ positionId: 'pos-2', positionName: 'Batterie', userId: 'user-2' }),
    ])

    expect(result).toEqual({ ok: true, inserted: 1, skipped: 1 })
    expect(supabase.inserts[0].payload).toEqual([
      expect.objectContaining({ position_id: 'pos-2', member_id: 'user-2' }),
    ])
  })

  it('ne confond pas deux plans différents partageant le même poste', async () => {
    const supabase = makeRecordingSupabase(
      assignmentQueues([{ plan_id: 'plan-1', position_id: 'pos-1' }])
    )
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await commitAutoFillProposal([row({ planId: 'plan-2' })])

    expect(result).toEqual({ ok: true, inserted: 1, skipped: 0 })
    expect(supabase.inserts[0].payload).toEqual([
      expect.objectContaining({ plan_id: 'plan-2', position_id: 'pos-1' }),
    ])
  })

  it('échappe à la garde pour un poste acceptant plusieurs bénévoles (`allowMultiple`)', async () => {
    const supabase = makeRecordingSupabase(
      assignmentQueues([{ plan_id: 'plan-1', position_id: 'pos-1' }])
    )
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await commitAutoFillProposal([row({ allowMultiple: true, userId: 'user-9' })])

    expect(result).toEqual({ ok: true, inserted: 1, skipped: 0 })
    expect(supabase.inserts[0].payload).toEqual([
      expect.objectContaining({ position_id: 'pos-1', member_id: 'user-9' }),
    ])
  })

  it("n'écrit rien du tout si toutes les lignes ont été pourvues entre-temps", async () => {
    const supabase = makeRecordingSupabase(
      assignmentQueues([
        { plan_id: 'plan-1', position_id: 'pos-1' },
        { plan_id: 'plan-1', position_id: 'pos-2' },
      ])
    )
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await commitAutoFillProposal([
      row(),
      row({ positionId: 'pos-2', userId: 'user-2' }),
    ])

    expect(result).toEqual({ ok: true, inserted: 0, skipped: 2 })
    expect(supabase.inserts).toEqual([])
    expect(sendPushToUserMock).not.toHaveBeenCalled()
  })
})

describe('commitAutoFillProposal — remontée des erreurs', () => {
  it("renvoie une erreur explicite si l'insertion Supabase échoue (jamais de succès silencieux)", async () => {
    const supabase = makeRecordingSupabase(
      assignmentQueues([], { data: null, error: { message: 'duplicate key value violates unique constraint' } })
    )
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await commitAutoFillProposal([row()])

    expect(result).toEqual({ ok: false, error: 'duplicate key value violates unique constraint' })
  })

  it("n'envoie aucune notification et ne revalide rien quand l'insertion échoue", async () => {
    requireChurchMock.mockResolvedValue(ctxWith(
      makeRecordingSupabase(assignmentQueues([], { data: null, error: { message: 'timeout' } }))
    ))

    await commitAutoFillProposal([row()])

    expect(sendPushToUserMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('commitAutoFillProposal — notifications push (bonus non bloquant)', () => {
  it('notifie chaque bénévole nouvellement affecté, et seulement lui', async () => {
    requireChurchMock.mockResolvedValue(ctxWith(
      makeRecordingSupabase(assignmentQueues([{ plan_id: 'plan-1', position_id: 'pos-1' }]))
    ))

    await commitAutoFillProposal([
      row(), // pourvu entre-temps : pas de notification
      row({ positionId: 'pos-2', positionName: 'Batterie', userId: 'user-2' }),
    ])

    expect(sendPushToUserMock).toHaveBeenCalledTimes(1)
    expect(sendPushToUserMock).toHaveBeenCalledWith('acc-user-2', expect.objectContaining({
      body: expect.stringContaining('Batterie'),
      url: '/espace/historique',
      tag: 'assignment-plan-1',
    }))
  })

  it("un échec d'envoi de notification ne fait pas échouer l'action (Promise.allSettled)", async () => {
    requireChurchMock.mockResolvedValue(ctxWith(makeRecordingSupabase(assignmentQueues([]))))
    sendPushToUserMock.mockRejectedValue(new Error('push service unavailable'))

    const result = await commitAutoFillProposal([
      row(),
      row({ positionId: 'pos-2', userId: 'user-2' }),
    ])

    expect(result).toEqual({ ok: true, inserted: 2, skipped: 0 })
    expect(sendPushToUserMock).toHaveBeenCalledTimes(2)
    expect(revalidatePathMock).toHaveBeenCalledWith('/espace/admin/plans')
  })

  it("un seul échec parmi plusieurs envois n'empêche pas les autres", async () => {
    requireChurchMock.mockResolvedValue(ctxWith(makeRecordingSupabase(assignmentQueues([]))))
    sendPushToUserMock
      .mockRejectedValueOnce(new Error('endpoint expiré'))
      .mockResolvedValueOnce(undefined)

    const result = await commitAutoFillProposal([
      row(),
      row({ positionId: 'pos-2', userId: 'user-2' }),
    ])

    expect(result.ok).toBe(true)
    expect(sendPushToUserMock.mock.calls.map(c => c[0])).toEqual(['acc-user-1', 'acc-user-2'])
  })
})

describe('commitAutoFillProposal — cas limite', () => {
  it("ne déclenche aucune écriture ni lecture quand la liste d'entrée est vide", async () => {
    const supabase = makeRecordingSupabase({})
    requireChurchMock.mockResolvedValue(ctxWith(supabase))

    const result = await commitAutoFillProposal([])

    expect(result).toEqual({ ok: true, inserted: 0, skipped: 0 })
    expect(supabase.calls).toEqual([])
    expect(supabase.inserts).toEqual([])
    expect(sendPushToUserMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})
