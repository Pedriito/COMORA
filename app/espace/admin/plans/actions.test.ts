import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

const { redirectMock, revalidatePathMock, requireChurchMock, createAdminClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidatePathMock: vi.fn(),
  requireChurchMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock, refresh: vi.fn() }))
vi.mock('@/lib/auth/church', () => ({ requireChurch: requireChurchMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/email/espace', () => ({
  sendPlanAssignmentEmail: vi.fn(),
  sendCancellationNotificationEmail: vi.fn(),
  sendExternalGuestInvitationEmail: vi.fn(),
}))
vi.mock('@/lib/pushNotifications', () => ({ sendPushToUser: vi.fn(), sendPushToUsers: vi.fn() }))

const { setDmHolder, addAssignmentAsync, respondAssignmentAsync } = await import('./actions')

/** Contexte d'église simulé : le client de session est le faux Supabase du test. */
function ctxWith(supabase: unknown) {
  return { supabase, userId: 'user-1', memberId: 'member-1', church: { churchId: 'church-1', role: 'responsable', isPastoral: false } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('setDmHolder', () => {
  it("retire l'affectation DM sans la remplacer quand sourcePositionId est null (désélection)", async () => {
    requireChurchMock.mockResolvedValue(ctxWith(
      makeFakeSupabase({ plan_assignments: [ok(null)] }) // un seul appel : le delete
    ))
    const result = await setDmHolder('plan-1', 'team-1', 'pos-dm', null)
    expect(result).toEqual({ ok: true })
  })

  it("copie l'affectation de l'instrument choisi (Piano/Basse/Batterie) vers le poste DM", async () => {
    requireChurchMock.mockResolvedValue(ctxWith(
      makeFakeSupabase({
        plan_assignments: [
          ok(null),                  // delete de l'affectation DM existante
          ok({ member_id: 'member-1' }), // select du titulaire actuel de l'instrument source
          ok(null),                  // insert de la nouvelle affectation DM
        ],
      })
    ))
    const result = await setDmHolder('plan-1', 'team-1', 'pos-dm', 'pos-piano')
    expect(result).toEqual({ ok: true })
  })

  it("retourne une erreur explicite si personne n'est affecté à l'instrument source", async () => {
    requireChurchMock.mockResolvedValue(ctxWith(
      makeFakeSupabase({
        plan_assignments: [ok(null), ok(null)], // delete, puis select vide (maybeSingle -> null)
      })
    ))
    const result = await setDmHolder('plan-1', 'team-1', 'pos-dm', 'pos-piano')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/personne d'affecté/)
  })

  it('remonte une erreur Supabase (delete) plutôt que de la masquer', async () => {
    requireChurchMock.mockResolvedValue(ctxWith(
      makeFakeSupabase({ plan_assignments: [{ data: null, error: { message: 'db down' } }] })
    ))
    const result = await setDmHolder('plan-1', 'team-1', 'pos-dm', null)
    expect(result).toEqual({ ok: false, error: 'db down' })
  })
})

describe('contrôle des droits', () => {
  it('les écritures de planning exigent le rôle responsable', async () => {
    requireChurchMock.mockResolvedValue(ctxWith(makeFakeSupabase({ plan_assignments: [ok(null)] })))
    await setDmHolder('plan-1', 'team-1', 'pos-dm', null)
    expect(requireChurchMock).toHaveBeenCalledWith('responsable')
  })

  it('un responsable sans droit est redirigé (requireChurch redirige) et rien n’est écrit', async () => {
    requireChurchMock.mockRejectedValue(new Error('NEXT_REDIRECT:/espace/dashboard'))
    const fake = makeFakeSupabase({})
    await expect(addAssignmentAsync({ planId: 'p', memberId: 'm' })).rejects.toThrow('NEXT_REDIRECT')
    expect(fake.calls).toEqual([])
  })

  it('un invité externe sans nom est refusé', async () => {
    const fake = makeFakeSupabase({ plan_assignments: [ok(null)] })
    requireChurchMock.mockResolvedValue(ctxWith(fake))
    const result = await addAssignmentAsync({ planId: 'p', memberId: null, externalName: '  ' })
    expect(result.ok).toBe(false)
    expect(fake.calls).toEqual([])
  })

  it('répondre exige l’accès membre, un statut valide et une fiche liée au compte', async () => {
    const fake = makeFakeSupabase({})
    requireChurchMock.mockResolvedValue({ ...ctxWith(fake), memberId: null })
    expect((await respondAssignmentAsync('a-1', 'confirmed')).ok).toBe(false)
    expect((await respondAssignmentAsync('a-1', 'nimporte')).ok).toBe(false)
    expect(fake.calls).toEqual([])
  })
})
