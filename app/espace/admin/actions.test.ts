import { describe, it, expect, vi, beforeEach } from 'vitest'

// `redirect()` de Next.js interrompt l'exécution en lançant une exception spéciale — on
// reproduit ce comportement pour que le test puisse la capturer tout en ayant déjà vérifié
// les appels `revalidateTag` faits juste avant.
const { redirectMock, revalidateTagMock, createClientMock, createAdminClientMock, sendInviteEmailMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidateTagMock: vi.fn(),
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  sendInviteEmailMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidateTag: revalidateTagMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/email/espace', () => ({ sendInviteEmail: sendInviteEmailMock }))

const { inviteBenevole, updateBenevoleAdmin, deleteBenevole } = await import('./actions')

/** Client "cookie" : auth.getUser() + vérification de permission admin. */
function fakeSessionClient() {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin-1' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { permission: 'admin' } }) }) }),
    }),
  }
}

function fd(entries: Record<string, string | string[]>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) v.forEach(item => f.append(k, item))
    else f.set(k, v)
  }
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  createClientMock.mockResolvedValue(fakeSessionClient())
})

describe('inviteBenevole', () => {
  it('invalide le tag `profiles`, et `team-members` seulement si des équipes sont assignées', async () => {
    createAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          createUser: () => Promise.resolve({ data: { user: { id: 'new-user-1' } }, error: null }),
          generateLink: () => Promise.resolve({ data: { properties: {} }, error: null }), // pas d'action_link -> saute l'envoi d'email
        },
      },
      from: (table: string) => ({
        upsert: () => Promise.resolve({ error: null }),
        insert: () => Promise.resolve({ error: null, data: table === 'team_members' ? [] : null }),
      }),
    })

    await expect(
      inviteBenevole(fd({ first_name: 'A', last_name: 'B', email: 'a@b.fr', permission: 'member', team_ids: ['team-1'] }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(revalidateTagMock).toHaveBeenCalledWith('profiles', 'max')
    expect(revalidateTagMock).toHaveBeenCalledWith('team-members', 'max')
  })

  it("n'invalide pas `team-members` si aucune équipe n'est assignée", async () => {
    createAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          createUser: () => Promise.resolve({ data: { user: { id: 'new-user-1' } }, error: null }),
          generateLink: () => Promise.resolve({ data: { properties: {} }, error: null }),
        },
      },
      from: () => ({ upsert: () => Promise.resolve({ error: null }) }),
    })

    await expect(
      inviteBenevole(fd({ first_name: 'A', last_name: 'B', email: 'a@b.fr', permission: 'member' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(revalidateTagMock).toHaveBeenCalledWith('profiles', 'max')
    expect(revalidateTagMock).not.toHaveBeenCalledWith('team-members', 'max')
  })
})

describe('updateBenevoleAdmin', () => {
  it('invalide le tag `profiles` après la mise à jour du profil', async () => {
    createAdminClientMock.mockReturnValue({
      auth: { admin: { updateUserById: () => Promise.resolve({ error: null }) } },
      from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    })

    await expect(
      updateBenevoleAdmin(fd({ user_id: 'u1', first_name: 'A', last_name: 'B', email: 'a@b.fr', permission: 'member', status: 'active' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(revalidateTagMock).toHaveBeenCalledWith('profiles', 'max')
  })
})

describe('deleteBenevole', () => {
  it('invalide profiles + team-members + member-positions après suppression', async () => {
    createAdminClientMock.mockReturnValue({
      auth: { admin: { deleteUser: () => Promise.resolve({ error: null }) } },
    })

    await expect(deleteBenevole(fd({ user_id: 'u2' }))).rejects.toThrow('NEXT_REDIRECT')

    expect(revalidateTagMock).toHaveBeenCalledWith('profiles', 'max')
    expect(revalidateTagMock).toHaveBeenCalledWith('team-members', 'max')
    expect(revalidateTagMock).toHaveBeenCalledWith('member-positions', 'max')
  })
})
