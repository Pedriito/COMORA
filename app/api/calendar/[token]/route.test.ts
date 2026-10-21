import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'

const { createAdminClientMock } = vi.hoisted(() => ({ createAdminClientMock: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))

const { GET } = await import('./route')

type Call = { method: string; args: unknown[] }
type Query = { table: string; calls: Call[] }

/** Faux client : une file de réponses par table, et l'enregistrement des filtres de chaque requête. */
function fakeAdmin(queues: Record<string, unknown[]>) {
  const queries: Query[] = []
  function from(table: string) {
    const entry: Query = { table, calls: [] }
    queries.push(entry)
    const data = queues[table]?.shift() ?? null
    const resp = { data, error: null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      maybeSingle: () => Promise.resolve(resp),
      single: () => Promise.resolve(resp),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(resp).then(resolve, reject),
    }
    for (const m of ['select', 'eq', 'is', 'gte', 'lt', 'order', 'in']) {
      builder[m] = (...args: unknown[]) => { entry.calls.push({ method: m, args }); return builder }
    }
    return builder
  }
  return { from, queries }
}

const TOKEN = 'A'.repeat(43)
const CHURCH = '11111111-1111-1111-1111-111111111111'

function call(token: string) {
  const req = new NextRequest(`http://localhost/api/calendar/${token}`)
  return GET(req, { params: Promise.resolve({ token }) })
}

function happyQueues() {
  return {
    calendar_feeds: [{ church_id: CHURCH, user_id: 'user-1' }],
    church_memberships: [{ id: 'm-1' }],
    churches: [{ name: 'Église Test', timezone: 'America/Montreal' }],
    plans: [[
      { id: 'plan-1', title: 'Culte, louange', service_date: '2026-06-01T14:00:00.000Z', plan_type: 'sunday_service' },
    ]],
  }
}

beforeEach(() => createAdminClientMock.mockReset())

describe('GET /api/calendar/[token]', () => {
  it('rejette un jeton mal formé sans interroger la base', async () => {
    const res = await call('pas-un-jeton')
    expect(res.status).toBe(404)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('recherche le flux par empreinte du jeton, non révoqué', async () => {
    const fake = fakeAdmin(happyQueues())
    createAdminClientMock.mockReturnValue(fake)
    await call(`${TOKEN}.ics`)
    const feedQuery = fake.queries.find(q => q.table === 'calendar_feeds')!
    const hash = createHash('sha256').update(TOKEN).digest('hex')
    expect(feedQuery.calls).toContainEqual({ method: 'eq', args: ['token_hash', hash] })
    expect(feedQuery.calls).toContainEqual({ method: 'is', args: ['revoked_at', null] })
  })

  it('renvoie 404 pour un jeton inconnu ou révoqué', async () => {
    createAdminClientMock.mockReturnValue(fakeAdmin({ calendar_feeds: [null] }))
    const res = await call(TOKEN)
    expect(res.status).toBe(404)
  })

  it("renvoie 404 si le compte n'est plus membre actif de l'église", async () => {
    const queues = happyQueues()
    queues.church_memberships = [null as never]
    const fake = fakeAdmin(queues)
    createAdminClientMock.mockReturnValue(fake)
    const res = await call(TOKEN)
    expect(res.status).toBe(404)
    const membership = fake.queries.find(q => q.table === 'church_memberships')!
    expect(membership.calls).toContainEqual({ method: 'eq', args: ['status', 'active'] })
    expect(fake.queries.some(q => q.table === 'plans')).toBe(false)
  })

  it("n'exporte que les plans de l'église du flux, sans cache partagé", async () => {
    const fake = fakeAdmin(happyQueues())
    createAdminClientMock.mockReturnValue(fake)
    const res = await call(TOKEN)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')

    const plansQuery = fake.queries.find(q => q.table === 'plans')!
    expect(plansQuery.calls).toContainEqual({ method: 'eq', args: ['church_id', CHURCH] })

    const body = await res.text()
    expect(body).toContain('DTSTART:20260601T140000Z')
    expect(body).toContain('SUMMARY:Culte\\, louange')
    expect(body).toContain('X-WR-TIMEZONE:America/Montreal')
    expect(body).toContain('X-WR-CALNAME:Planning — Église Test')
  })
})
