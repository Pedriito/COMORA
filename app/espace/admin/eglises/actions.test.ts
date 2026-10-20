import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

const { redirectMock, revalidatePathMock, revalidateTagMock, createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock, revalidateTag: revalidateTagMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))

const { createChurch } = await import('./actions')

function fakeSuperAdminSessionClient() {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'super-1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { permission: 'super_admin' } }) }) }) }),
  }
}

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  createClientMock.mockResolvedValue(fakeSuperAdminSessionClient())
})

describe('createChurch', () => {
  it('invalide `teams` et `profiles` une fois la nouvelle église provisionnée', async () => {
    const fake = makeFakeSupabase({
      churches: [ok({ id: 'church-1' })],
      profiles: [ok(null)],
      church_settings: [ok(null)],
      teams: [ok(null)],
    })
    createAdminClientMock.mockReturnValue({
      ...fake,
      auth: {
        admin: {
          inviteUserByEmail: () => Promise.resolve({ data: { user: { id: 'new-admin-1' } }, error: null }),
        },
      },
    })

    const result = await createChurch(fd({ name: 'Église Test', slug: 'test', admin_email: 'admin@test.fr' }))

    expect(result).toEqual({ ok: true })
    expect(revalidateTagMock).toHaveBeenCalledWith('teams', 'max')
    expect(revalidateTagMock).toHaveBeenCalledWith('profiles', 'max')
  })

  it("n'invalide rien si l'invitation de l'admin échoue (rollback)", async () => {
    const fake = makeFakeSupabase({
      churches: [ok({ id: 'church-1' }), ok(null)], // création puis rollback delete
    })
    createAdminClientMock.mockReturnValue({
      ...fake,
      auth: {
        admin: {
          inviteUserByEmail: () => Promise.resolve({ data: null, error: { message: 'invite failed' } }),
        },
      },
    })

    const result = await createChurch(fd({ name: 'Église Test', slug: 'test', admin_email: 'admin@test.fr' }))

    expect(result.ok).toBe(false)
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })

  it('rejette une soumission incomplète sans toucher au cache', async () => {
    const result = await createChurch(fd({ name: '', slug: '', admin_email: '' }))
    expect(result.ok).toBe(false)
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})
