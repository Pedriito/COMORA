import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

const { redirectMock, revalidatePathMock, createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidatePathMock: vi.fn(),
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/email/espace', () => ({
  sendPlanAssignmentEmail: vi.fn(),
  sendCancellationNotificationEmail: vi.fn(),
  sendExternalGuestInvitationEmail: vi.fn(),
}))
vi.mock('@/lib/pushNotifications', () => ({ sendPushToUser: vi.fn(), sendPushToUsers: vi.fn() }))

const { setDmHolder } = await import('./actions')

/** Client "cookie" utilisé par `requireAdmin()` : auth.getUser() + vérification de permission. */
function fakeSessionClient(permission = 'admin') {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin-1' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { permission } }) }) }),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  createClientMock.mockResolvedValue(fakeSessionClient())
})

describe('setDmHolder', () => {
  it("retire l'affectation DM sans la remplacer quand sourcePositionId est null (désélection)", async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({ plan_assignments: [ok(null)] }) // un seul appel : le delete
    )
    const result = await setDmHolder('plan-1', 'team-1', 'pos-dm', null)
    expect(result).toEqual({ ok: true })
  })

  it("copie l'affectation de l'instrument choisi (Piano/Basse/Batterie) vers le poste DM", async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({
        plan_assignments: [
          ok(null),                  // delete de l'affectation DM existante
          ok({ user_id: 'user-1' }), // select du titulaire actuel de l'instrument source
          ok(null),                  // insert de la nouvelle affectation DM
        ],
      })
    )
    const result = await setDmHolder('plan-1', 'team-1', 'pos-dm', 'pos-piano')
    expect(result).toEqual({ ok: true })
  })

  it("retourne une erreur explicite si personne n'est affecté à l'instrument source", async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({
        plan_assignments: [ok(null), ok(null)], // delete, puis select vide (maybeSingle -> null)
      })
    )
    const result = await setDmHolder('plan-1', 'team-1', 'pos-dm', 'pos-piano')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/personne d'affecté/)
  })

  it('remonte une erreur Supabase (delete) plutôt que de la masquer', async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({ plan_assignments: [{ data: null, error: { message: 'db down' } }] })
    )
    const result = await setDmHolder('plan-1', 'team-1', 'pos-dm', null)
    expect(result).toEqual({ ok: false, error: 'db down' })
  })
})
