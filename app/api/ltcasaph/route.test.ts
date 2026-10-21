// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

const { getChurchContextMock } = vi.hoisted(() => ({ getChurchContextMock: vi.fn() }))
vi.mock('@/lib/auth/church', () => ({ getChurchContext: getChurchContextMock }))

const { GET } = await import('./route')

function req(query: string) {
  return { nextUrl: new URL(`http://localhost/api/ltcasaph?${query}`) } as unknown as NextRequest
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  getChurchContextMock.mockResolvedValue({ church: { churchId: 'church-a', role: 'membre' } })
})
afterEach(() => vi.unstubAllGlobals())

describe('GET /api/ltcasaph', () => {
  it('refuse sans session (401)', async () => {
    getChurchContextMock.mockResolvedValue(null)
    expect((await GET(req('action=fetch&id=12'))).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuse un identifiant mal formé ou une recherche trop longue (400)', async () => {
    expect((await GET(req('action=fetch&id=12%2F..%2Fadmin'))).status).toBe(400)
    expect((await GET(req('action=fetch&id=abc'))).status).toBe(400)
    expect((await GET(req(`action=search&q=${'a'.repeat(101)}`))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('récupère un chant par identifiant numérique', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { attributes: { title: { display: { main: 'Titre' } } } } })))
    const res = await GET(req('action=fetch&id=1234'))
    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toBe('https://db.ltc-asaph.com/json/songs/1234')
  })
})
