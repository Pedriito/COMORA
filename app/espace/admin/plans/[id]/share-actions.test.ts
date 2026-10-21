import { describe, it, expect, vi, beforeEach } from 'vitest'

const { churchOrNullMock } = vi.hoisted(() => ({ churchOrNullMock: vi.fn() }))
vi.mock('@/lib/auth/church', () => ({ churchOrNull: churchOrNullMock }))

const { createShareLink, revokeShareLinks, getShareLinkStatus } = await import('./share-actions')
const { hashToken, isWellFormedToken } = await import('@/lib/tokens')

type Call = { table: string; op: string; payload?: any; filters: [string, unknown][] }

function client(planFound = true) {
  const calls: Call[] = []
  return {
    calls,
    from(table: string) {
      const call: Call = { table, op: 'select', filters: [] }
      calls.push(call)
      const b: any = {
        select: () => b,
        insert: (p: unknown) => { call.op = 'insert'; call.payload = p; return b },
        update: (p: unknown) => { call.op = 'update'; call.payload = p; return b },
        eq: (c: string, v: unknown) => { call.filters.push([c, v]); return b },
        is: () => b, gt: () => b, order: () => b, limit: () => b,
        maybeSingle: () => Promise.resolve({ data: table === 'plans' ? (planFound ? { id: 'p1' } : null) : null, error: null }),
        then: (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(res),
      }
      return b
    },
  }
}

beforeEach(() => vi.clearAllMocks())

describe('liens de partage', () => {
  it('refuse sans le rôle responsable', async () => {
    churchOrNullMock.mockResolvedValue(null)
    expect(await createShareLink('p1')).toBeNull()
    expect(await revokeShareLinks('p1')).toEqual({ ok: false })
    expect(await getShareLinkStatus('p1')).toBeNull()
    expect(churchOrNullMock).toHaveBeenCalledWith('responsable')
  })

  it('refuse un plan hors de l’église courante', async () => {
    const c = client(false)
    churchOrNullMock.mockResolvedValue({ supabase: c, userId: 'u1', church: { churchId: 'church-a' } })
    expect(await createShareLink('autre-plan')).toBeNull()
    expect(c.calls.some(x => x.table === 'plan_share_links')).toBe(false)
  })

  it('stocke seulement l’empreinte du jeton, avec expiration à 30 jours', async () => {
    const c = client()
    churchOrNullMock.mockResolvedValue({ supabase: c, userId: 'u1', church: { churchId: 'church-a' } })
    const link = await createShareLink('p1')
    expect(link).not.toBeNull()
    expect(isWellFormedToken(link!.token)).toBe(true)

    const insert = c.calls.find(x => x.op === 'insert')!
    expect(insert.payload.token_hash).toBe(hashToken(link!.token))
    expect(JSON.stringify(insert.payload)).not.toContain(link!.token)
    expect(insert.payload.church_id).toBe('church-a')
    const days = (new Date(insert.payload.expires_at).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThanOrEqual(30)
    // l'ancien lien est révoqué avant la création
    expect(c.calls.some(x => x.op === 'update' && 'revoked_at' in x.payload)).toBe(true)
  })
})
