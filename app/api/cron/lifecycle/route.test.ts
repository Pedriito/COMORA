import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from, calls } = vi.hoisted(() => {
  const calls: Array<{ table: string; method: string }> = []
  const rpc = vi.fn()
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'gt', 'lte', 'delete', 'update']) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method })
        void args
        return method === 'lte' ? Promise.resolve({ data: [{ id: 'a' }, { id: 'b' }] }) : chain
      }
    }
    return chain
  })
  return { rpc, from, calls }
})
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc, from }) }))

const { GET } = await import('./route')
const request = (auth?: string) => new Request('http://x/api/cron/lifecycle', { headers: auth ? { authorization: auth } : {} }) as never

beforeEach(() => {
  process.env.CRON_SECRET = 'secret-de-test'
  rpc.mockReset()
  calls.length = 0
})

describe('cron lifecycle', () => {
  it('refuse sans le bon secret, sans rien faire', async () => {
    expect((await GET(request())).status).toBe(401)
    expect((await GET(request('Bearer autre'))).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('passe les essais en lecture seule mais ne supprime jamais rien (simulation)', async () => {
    rpc.mockResolvedValue({ data: { trials_ended: 2, graces_ended: 1 }, error: null })
    const response = await GET(request('Bearer secret-de-test'))
    const body = await response.json()
    expect(rpc).toHaveBeenCalledWith('church_lifecycle_step')
    expect(body).toMatchObject({ ok: true, trials_ended: 2, graces_ended: 1, deletionDue: 2, deleted: 0 })
    expect(calls.some(c => c.method === 'delete' || c.method === 'update')).toBe(false)
  })

  it('répond 500 sans détail si la base échoue', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'détail interne' } })
    const response = await GET(request('Bearer secret-de-test'))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('détail interne')
  })
})
