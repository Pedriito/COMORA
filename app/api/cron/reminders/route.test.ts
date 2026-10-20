import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/email/espace', () => ({ sendReminderEmail: vi.fn() }))
vi.mock('@/lib/pushNotifications', () => ({ sendPushToUser: vi.fn() }))

const { chunk, resolveInternalUsers, GET } = await import('./route')

describe('chunk', () => {
  it('découpe en lots de la taille demandée, y compris un dernier lot partiel', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('renvoie un tableau vide pour une entrée vide', () => {
    expect(chunk([], 10)).toEqual([])
  })

  it('renvoie un seul lot si size >= longueur', () => {
    expect(chunk(['a', 'b'], 10)).toEqual([['a', 'b']])
  })
})

describe('resolveInternalUsers', () => {
  function makeFakeAdmin(profiles: { id: string; first_name: string }[], emails: Record<string, string | undefined>) {
    const fromSpy = vi.fn((table: string) => {
      expect(table).toBe('profiles')
      return {
        select: () => ({
          in: (_col: string, ids: string[]) => Promise.resolve({
            data: profiles.filter(p => ids.includes(p.id)),
            error: null,
          }),
        }),
      }
    })
    const getUserById = vi.fn((id: string) =>
      Promise.resolve({ data: { user: emails[id] ? { email: emails[id] } : null }, error: null })
    )
    return { admin: { from: fromSpy, auth: { admin: { getUserById } } } as any, fromSpy, getUserById }
  }

  it("ne fait qu'une seule requête `profiles` (batch) même avec plusieurs bénévoles", async () => {
    const { admin, fromSpy, getUserById } = makeFakeAdmin(
      [{ id: 'u1', first_name: 'Alice' }, { id: 'u2', first_name: 'Bob' }],
      { u1: 'alice@example.com', u2: 'bob@example.com' }
    )

    const { profileMap, emailMap } = await resolveInternalUsers(admin, ['u1', 'u2'])

    expect(fromSpy).toHaveBeenCalledTimes(1) // une seule requête batchée, pas une par bénévole
    expect(getUserById).toHaveBeenCalledTimes(2) // une fois par utilisateur unique
    expect(profileMap.get('u1')).toEqual({ first_name: 'Alice' })
    expect(emailMap.get('u2')).toBe('bob@example.com')
  })

  it('déduplique les user_id en doublon (une affectation par équipe cumulée ne doit pas refaire un appel)', async () => {
    const { getUserById } = makeFakeAdmin([{ id: 'u1', first_name: 'Alice' }], { u1: 'alice@example.com' })
    const fake = makeFakeAdmin([{ id: 'u1', first_name: 'Alice' }], { u1: 'alice@example.com' })

    await resolveInternalUsers(fake.admin, ['u1', 'u1', 'u1'])

    expect(fake.getUserById).toHaveBeenCalledTimes(1)
    void getUserById
  })

  it('ignore silencieusement un utilisateur sans email Auth (compte supprimé) au lieu de planter', async () => {
    const { admin } = makeFakeAdmin([{ id: 'u1', first_name: 'Alice' }], { u1: undefined })
    const { emailMap } = await resolveInternalUsers(admin, ['u1'])
    expect(emailMap.has('u1')).toBe(false)
  })

  it("ne fait aucun appel réseau si la liste d'utilisateurs est vide", async () => {
    const { admin, fromSpy, getUserById } = makeFakeAdmin([], {})
    const { profileMap, emailMap } = await resolveInternalUsers(admin, [])
    expect(fromSpy).not.toHaveBeenCalled()
    expect(getUserById).not.toHaveBeenCalled()
    expect(profileMap.size).toBe(0)
    expect(emailMap.size).toBe(0)
  })
})

describe('GET /api/cron/reminders — garde d’authentification', () => {
  it('renvoie 401 sans le bon secret cron', async () => {
    const prevSecret = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'expected-secret'
    try {
      const req = new NextRequest('http://localhost/api/cron/reminders', {
        headers: { authorization: 'Bearer wrong-secret' },
      })
      const res = await GET(req)
      expect(res.status).toBe(401)
    } finally {
      process.env.CRON_SECRET = prevSecret
    }
  })
})
