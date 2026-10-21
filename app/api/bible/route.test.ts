// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

const { getChurchContextMock } = vi.hoisted(() => ({ getChurchContextMock: vi.fn() }))
vi.mock('@/lib/auth/church', () => ({ getChurchContext: getChurchContextMock }))

const { GET } = await import('./route')

function req(query: string) {
  return { nextUrl: new URL(`http://localhost/api/bible?${query}`) } as unknown as NextRequest
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  getChurchContextMock.mockResolvedValue({ church: { churchId: 'church-a', role: 'membre' } })
})
afterEach(() => vi.unstubAllGlobals())

describe('GET /api/bible', () => {
  it('refuse sans session (401) sans appeler la source', async () => {
    getChurchContextMock.mockResolvedValue(null)
    const res = await GET(req('translation=BDS&book=43&chapter=3'))
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuse une version hors liste ou un chapitre hors bornes (400)', async () => {
    expect((await GET(req('translation=EVIL&book=43&chapter=3'))).status).toBe(400)
    expect((await GET(req('translation=BDS&book=43&chapter=999'))).status).toBe(400)
    expect((await GET(req('translation=BDS&book=..%2F..&chapter=3'))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('interroge bolls.life avec des paramètres validés', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ pk: 1, verse: 16, text: 'Car Dieu…' }])))
    const res = await GET(req('translation=BDS&book=43&chapter=3'))
    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toBe('https://bolls.life/get-text/BDS/43/3/')
  })
})
