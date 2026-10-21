// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

const { getChurchContextMock } = vi.hoisted(() => ({ getChurchContextMock: vi.fn() }))
vi.mock('@/lib/auth/church', () => ({ getChurchContext: getChurchContextMock }))

const { GET } = await import('./route')

function req(query: string) {
  return { nextUrl: new URL(`http://localhost/api/shir?${query}`) } as unknown as NextRequest
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  getChurchContextMock.mockResolvedValue({ church: { churchId: 'church-a', role: 'membre' } })
})
afterEach(() => vi.unstubAllGlobals())

describe('GET /api/shir', () => {
  it('refuse sans session (401)', async () => {
    getChurchContextMock.mockResolvedValue(null)
    expect((await GET(req('action=search&q=gloire'))).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuse une recherche ou un titre invalides (400)', async () => {
    expect((await GET(req(`action=search&q=${'a'.repeat(101)}`))).status).toBe(400)
    expect((await GET(req('action=fetch&title='))).status).toBe(400)
    expect((await GET(req('action=fetch&title=a%0Ab'))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('appelle shir.fr en https', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ query: { search: [{ title: 'À toi la gloire' }] } })))
    const res = await GET(req('action=search&q=gloire'))
    expect(res.status).toBe(200)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/shir\.fr\//)

    fetchMock.mockResolvedValue(new Response('{title: X}'))
    await GET(req('action=fetch&title=%C3%80%20toi%20la%20gloire'))
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://shir.fr/chant/chordpro/%C3%80%20toi%20la%20gloire.chordpro')
  })
})
