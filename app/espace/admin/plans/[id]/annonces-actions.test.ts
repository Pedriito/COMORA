import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

const { revalidateTagMock, createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  revalidateTagMock: vi.fn(),
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidateTag: revalidateTagMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))

const {
  addRecurringAnnouncement,
  updateRecurringAnnouncement,
  deleteRecurringAnnouncement,
  moveRecurringAnnouncement,
  addAnnouncement,
} = await import('./annonces-actions')

function fakeAdminSessionClient() {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin-1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { permission: 'admin' } }) }) }) }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  createClientMock.mockResolvedValue(fakeAdminSessionClient())
})

describe('annonces récurrentes — invalidation du cache', () => {
  it('addRecurringAnnouncement invalide `recurring-announcements`', async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({ recurring_announcements: [ok([]), ok({ id: 'ra-1' })] })
    )
    await addRecurringAnnouncement('Titre', 'Corps')
    expect(revalidateTagMock).toHaveBeenCalledWith('recurring-announcements', 'max')
  })

  it('updateRecurringAnnouncement invalide `recurring-announcements`', async () => {
    createAdminClientMock.mockReturnValue(makeFakeSupabase({ recurring_announcements: [ok(null)] }))
    await updateRecurringAnnouncement('ra-1', 'Titre', 'Corps')
    expect(revalidateTagMock).toHaveBeenCalledWith('recurring-announcements', 'max')
  })

  it('deleteRecurringAnnouncement invalide `recurring-announcements`', async () => {
    createAdminClientMock.mockReturnValue(makeFakeSupabase({ recurring_announcements: [ok(null)] }))
    await deleteRecurringAnnouncement('ra-1')
    expect(revalidateTagMock).toHaveBeenCalledWith('recurring-announcements', 'max')
  })

  it('moveRecurringAnnouncement invalide `recurring-announcements`', async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({
        recurring_announcements: [
          ok([{ id: 'ra-1', order_index: 0 }, { id: 'ra-2', order_index: 1 }]),
          ok(null),
          ok(null),
        ],
      })
    )
    await moveRecurringAnnouncement('ra-2', 'up')
    expect(revalidateTagMock).toHaveBeenCalledWith('recurring-announcements', 'max')
  })

  it("n'invalide rien si l'utilisateur n'est pas autorisé", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
    })
    const result = await addRecurringAnnouncement('Titre', 'Corps')
    expect(result).toBeNull()
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})

describe('annonces de plan (volatiles) — pas d’invalidation de cache', () => {
  it("addAnnouncement (plan_announcements) n'invalide aucun tag — donnée propre au plan, jamais cachée", async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({ plan_announcements: [ok([]), ok({ id: 'pa-1' })] })
    )
    await addAnnouncement('plan-1', 'Titre', 'Corps')
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})
