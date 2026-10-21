import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { createAdminClientMock, sendReminderEmailMock, sendPushToUserMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  sendReminderEmailMock: vi.fn(),
  sendPushToUserMock: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/email/espace', () => ({ sendReminderEmail: sendReminderEmailMock }))
vi.mock('@/lib/pushNotifications', () => ({ sendPushToUser: sendPushToUserMock }))

const { GET } = await import('./route')
const { chunk, isAuthorizedCron, windowBounds, resolveInternalMembers, sendChurchReminders } = await import('./reminders')

type Call = { method: string; args: unknown[] }
type Query = { table: string; calls: Call[] }

/** Faux client admin : réponses servies par table (fonction ou file), filtres enregistrés. */
function fakeAdmin(
  responders: Record<string, (calls: Call[]) => unknown>,
  emails: Record<string, string | undefined> = {},
) {
  const queries: Query[] = []
  function from(table: string) {
    const entry: Query = { table, calls: [] }
    queries.push(entry)
    const resolve = () => ({ data: responders[table]?.(entry.calls) ?? null, error: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      maybeSingle: () => Promise.resolve(resolve()),
      single: () => Promise.resolve(resolve()),
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolve()).then(ok, ko),
    }
    for (const m of ['select', 'eq', 'in', 'not', 'is', 'gte', 'lt', 'order', 'update']) {
      builder[m] = (...args: unknown[]) => { entry.calls.push({ method: m, args }); return builder }
    }
    return builder
  }
  const getUserById = vi.fn((id: string) => Promise.resolve({ data: { user: emails[id] ? { email: emails[id] } : null }, error: null }))
  return { from, auth: { admin: { getUserById } }, queries, getUserById }
}

const eqArg = (calls: Call[], col: string) => calls.find(c => c.method === 'eq' && c.args[0] === col)?.args[1]

beforeEach(() => vi.clearAllMocks())

describe('chunk', () => {
  it('découpe en lots de la taille demandée, y compris un dernier lot partiel', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 10)).toEqual([])
  })
})

describe('isAuthorizedCron', () => {
  it('refuse si CRON_SECRET est vide ou absent, même avec « Bearer undefined »', () => {
    expect(isAuthorizedCron('Bearer undefined', undefined)).toBe(false)
    expect(isAuthorizedCron('Bearer ', '')).toBe(false)
  })

  it('refuse un mauvais secret ou un en-tête absent, accepte le bon', () => {
    expect(isAuthorizedCron('Bearer faux', 'secret-attendu')).toBe(false)
    expect(isAuthorizedCron(null, 'secret-attendu')).toBe(false)
    expect(isAuthorizedCron('Bearer secret-attendu', 'secret-attendu')).toBe(true)
  })
})

describe('GET /api/cron/reminders — garde d’authentification', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('renvoie 401 sans le bon secret', async () => {
    vi.stubEnv('CRON_SECRET', 'expected-secret')
    const res = await GET(new NextRequest('http://localhost/api/cron/reminders', { headers: { authorization: 'Bearer wrong' } }))
    expect(res.status).toBe(401)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('renvoie 401 quand CRON_SECRET est vide', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const res = await GET(new NextRequest('http://localhost/api/cron/reminders', { headers: { authorization: 'Bearer ' } }))
    expect(res.status).toBe(401)
  })

  it('traite chaque église séparément', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    const admin = fakeAdmin({
      churches: () => [{ id: 'church-a', timezone: 'Europe/Paris' }, { id: 'church-b', timezone: 'America/Montreal' }],
      plans: () => [],
    })
    createAdminClientMock.mockReturnValue(admin)
    const res = await GET(new NextRequest('http://localhost/api/cron/reminders', { headers: { authorization: 'Bearer s3cret' } }))
    expect(res.status).toBe(200)
    const planChurches = admin.queries.filter(q => q.table === 'plans').map(q => eqArg(q.calls, 'church_id'))
    // 3 fenêtres par église, chacune filtrée sur sa propre église
    expect(planChurches).toEqual(['church-a', 'church-a', 'church-a', 'church-b', 'church-b', 'church-b'])
  })
})

describe('windowBounds', () => {
  it('calcule J-1 dans le fuseau de l’église', () => {
    // 20 oct. 2026 23h30 UTC = 21 oct. à Paris, encore le 20 à Montréal
    const now = new Date('2026-10-20T23:30:00.000Z')
    expect(windowBounds(now, 1, 'Europe/Paris')).toEqual({
      start: '2026-10-21T22:00:00.000Z',
      end: '2026-10-22T22:00:00.000Z',
    })
    expect(windowBounds(now, 1, 'America/Montreal')).toEqual({
      start: '2026-10-21T04:00:00.000Z',
      end: '2026-10-22T04:00:00.000Z',
    })
  })
})

describe('resolveInternalMembers', () => {
  it("filtre par église et préfère l'e-mail du compte à celui de la fiche", async () => {
    const admin = fakeAdmin({
      members: () => [
        { id: 'm1', first_name: 'Alice', user_id: 'u1' },
        { id: 'm2', first_name: 'Bob', user_id: null },
      ],
      member_contacts: () => [{ member_id: 'm1', email: 'fiche@x.fr' }, { member_id: 'm2', email: 'bob@x.fr' }],
    }, { u1: 'compte@x.fr' })

    const map = await resolveInternalMembers(admin as never, 'church-a', ['m1', 'm2', 'm1'])

    for (const q of admin.queries) expect(eqArg(q.calls, 'church_id')).toBe('church-a')
    expect(admin.getUserById).toHaveBeenCalledTimes(1)
    expect(map.get('m1')).toEqual({ firstName: 'Alice', email: 'compte@x.fr', userId: 'u1' })
    expect(map.get('m2')).toEqual({ firstName: 'Bob', email: 'bob@x.fr', userId: null })
  })

  it("ne fait aucun appel si la liste est vide", async () => {
    const admin = fakeAdmin({})
    const map = await resolveInternalMembers(admin as never, 'church-a', [])
    expect(admin.queries).toHaveLength(0)
    expect(map.size).toBe(0)
  })
})

describe('sendChurchReminders', () => {
  it("envoie avec le fuseau de l'église, saute les rappels déjà envoyés et exclut les externes en J-2", async () => {
    const admin = fakeAdmin({
      plans: () => [{ id: 'plan-1', title: 'Culte', service_date: '2026-10-27T14:00:00.000Z' }],
      plan_assignments: calls => calls.some(c => c.method === 'update') ? null : [
        { id: 'a1', member_id: 'm1', status: 'pending', external_name: null, external_email: null, reminder_sent_days: [], positions: null, teams: { name: 'Louange' } },
        { id: 'a2', member_id: null, status: 'confirmed', external_name: 'Invité', external_email: 'ext@x.fr', reminder_sent_days: [], positions: null, teams: null },
        { id: 'a3', member_id: 'm1', status: 'confirmed', external_name: null, external_email: null, reminder_sent_days: [7, 2, 1], positions: null, teams: null },
      ],
      members: () => [{ id: 'm1', first_name: 'Alice', user_id: 'u1' }],
      member_contacts: () => [],
    }, { u1: 'alice@x.fr' })

    const results = await sendChurchReminders(admin as never, { id: 'church-a', timezone: 'America/Montreal' }, new Date('2026-10-20T12:00:00Z'))

    // Toutes les requêtes portent le filtre d'église
    for (const q of admin.queries.filter(q => q.table !== 'members' && q.table !== 'member_contacts')) {
      expect(eqArg(q.calls, 'church_id')).toBe('church-a')
    }
    // Fenêtre J-2 : externes exclus côté requête
    const j2 = admin.queries.filter(q => q.table === 'plan_assignments' && !q.calls.some(c => c.method === 'update'))[1]
    expect(j2.calls).toContainEqual({ method: 'not', args: ['member_id', 'is', null] })

    expect(sendReminderEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'alice@x.fr', timeZone: 'America/Montreal', isExternal: false }))
    expect(sendReminderEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'ext@x.fr', isExternal: true, timeZone: 'America/Montreal' }))
    expect(sendPushToUserMock).toHaveBeenCalledWith('u1', expect.anything())
    expect(results.every(r => r.churchId === 'church-a')).toBe(true)
    expect(results.reduce((n, r) => n + r.skipped, 0)).toBe(3) // a3, une fois par fenêtre
  })
})
