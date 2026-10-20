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

const { addTeamMember, removeTeamMember, toggleMemberPosition } = await import('./actions')

/** Simule un admin authentifié — passe `requireAdminOrLeader`/`requireAdmin` sans redirect. */
function fakeAdminSessionClient() {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin-1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { permission: 'admin' } }) }) }) }),
  }
}

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  createClientMock.mockResolvedValue(fakeAdminSessionClient())
})

describe('addTeamMember', () => {
  it('invalide `team-members` après un upsert réussi', async () => {
    createAdminClientMock.mockReturnValue(makeFakeSupabase({ team_members: [ok(null)] }))

    const result = await addTeamMember(null, fd({ team_id: 'team-1', user_id: 'user-1', role: 'member' }))

    expect(result).toBeNull()
    expect(revalidateTagMock).toHaveBeenCalledWith('team-members', 'max')
    expect(revalidatePathMock).toHaveBeenCalledWith('/espace/admin/equipes/team-1')
  })

  it("n'invalide rien si l'upsert échoue", async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({ team_members: [{ data: null, error: { message: 'boom' } }] })
    )

    const result = await addTeamMember(null, fd({ team_id: 'team-1', user_id: 'user-1', role: 'member' }))

    expect(result).toEqual({ error: 'boom' })
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})

describe('removeTeamMember', () => {
  it("invalide `team-members` ET `member-positions` quand l'équipe a des postes nommés", async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({
        team_members: [ok(null)],
        positions: [ok([{ id: 'pos-1' }, { id: 'pos-2' }])],
        member_positions: [ok(null)],
      })
    )

    await removeTeamMember(fd({ team_id: 'team-1', user_id: 'user-1' }))

    expect(revalidateTagMock).toHaveBeenCalledWith('member-positions', 'max')
    expect(revalidateTagMock).toHaveBeenCalledWith('team-members', 'max')
  })

  it("n'invalide pas `member-positions` quand l'équipe n'a aucun poste nommé", async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({
        team_members: [ok(null)],
        positions: [ok([])],
      })
    )

    await removeTeamMember(fd({ team_id: 'team-1', user_id: 'user-1' }))

    expect(revalidateTagMock).not.toHaveBeenCalledWith('member-positions', 'max')
    expect(revalidateTagMock).toHaveBeenCalledWith('team-members', 'max')
  })
})

describe('toggleMemberPosition', () => {
  it.each(['add', 'remove'])("invalide `member-positions` pour l'action %s", async (action) => {
    createAdminClientMock.mockReturnValue(makeFakeSupabase({ member_positions: [ok(null)] }))

    await toggleMemberPosition(fd({ team_id: 'team-1', user_id: 'user-1', position_id: 'pos-1', action }))

    expect(revalidateTagMock).toHaveBeenCalledWith('member-positions', 'max')
  })
})
