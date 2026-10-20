import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

const { createAdminClientMock } = vi.hoisted(() => ({ createAdminClientMock: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))

const { GET } = await import('./route')

describe('GET /api/calendar/[token]', () => {
  it('renvoie un Cache-Control public de 5 min (pollé par des clients calendrier externes)', async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({
        projection_settings: [ok({ calendar_token: 'good-token' })],
        plans: [ok([
          { id: 'plan-1', title: 'Culte', service_date: '2026-06-01T10:00:00.000Z', plan_type: 'sunday_service', notes: null },
        ])],
      })
    )

    const req = new NextRequest('http://localhost/api/calendar/good-token')
    const res = await GET(req, { params: Promise.resolve({ token: 'good-token' }) })

    expect(res.status).toBe(200)
    const cacheControl = res.headers.get('Cache-Control')
    expect(cacheControl).toContain('public')
    expect(cacheControl).toContain('max-age=300')
    expect(cacheControl).toContain('stale-while-revalidate')
    // Pas de fuite entre tokens : jamais de contenu privé servi sans cache-busting
    expect(cacheControl).not.toContain('no-cache')
  })

  it('rejette un token invalide (401) avant de générer le calendrier', async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({
        projection_settings: [ok({ calendar_token: 'good-token' })],
        plans: [ok([])],
      })
    )

    const req = new NextRequest('http://localhost/api/calendar/wrong-token')
    const res = await GET(req, { params: Promise.resolve({ token: 'wrong-token' }) })
    expect(res.status).toBe(401)
  })
})
