import Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  createAdminClient: vi.fn(() => ({})),
  sendSignatureSubscribedEmail: vi.fn(),
}))
vi.mock('@/lib/billing/events', () => ({ handleStripeEvent: mocks.handle }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/email/espace', () => ({ sendSignatureSubscribedEmail: mocks.sendSignatureSubscribedEmail }))

const { POST } = await import('./route')

const SECRET = 'whsec_secret_de_test'
const stripe = new Stripe('sk_test_cle_de_test')
const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'invoice.paid', created: 1, data: { object: {} } })
const signed = (body = payload, secret = SECRET) => stripe.webhooks.generateTestHeaderString({ payload: body, secret })
const request = (body: string, headers: Record<string, string> = {}) => new Request('http://x/api/stripe/webhook', { method: 'POST', body, headers })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_cle_de_test')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET)
  mocks.handle.mockResolvedValue('processed')
})

describe('webhook Stripe', () => {
  it('accepte un événement correctement signé et le transmet', async () => {
    const response = await POST(request(payload, { 'stripe-signature': signed() }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true, outcome: 'processed' })
    expect(mocks.handle).toHaveBeenCalledTimes(1)
    expect(mocks.handle.mock.calls[0][1]).toMatchObject({ id: 'evt_1', type: 'invoice.paid' })
  })

  it('refuse sans signature, sans lire le contenu', async () => {
    expect((await POST(request(payload))).status).toBe(400)
    expect(mocks.handle).not.toHaveBeenCalled()
  })

  it('refuse une signature fausse, ou calculée avec un autre secret', async () => {
    expect((await POST(request(payload, { 'stripe-signature': 't=1,v1=abc' }))).status).toBe(400)
    expect((await POST(request(payload, { 'stripe-signature': signed(payload, 'whsec_autre') }))).status).toBe(400)
    expect(mocks.handle).not.toHaveBeenCalled()
  })

  it('refuse un contenu modifié après la signature', async () => {
    const header = signed()
    const tampered = payload.replace('invoice.paid', 'customer.subscription.deleted')
    expect((await POST(request(tampered, { 'stripe-signature': header }))).status).toBe(400)
    expect(mocks.handle).not.toHaveBeenCalled()
  })

  it('refuse tout si le secret du webhook n’est pas configuré', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    expect((await POST(request(payload, { 'stripe-signature': signed() }))).status).toBe(400)
    expect(mocks.handle).not.toHaveBeenCalled()
  })

  it('répond 500 sans détail si le traitement échoue : Stripe renverra l’événement', async () => {
    mocks.handle.mockRejectedValue(new Error('détail interne confidentiel'))
    const response = await POST(request(payload, { 'stripe-signature': signed() }))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('confidentiel')
  })
})
