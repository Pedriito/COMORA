import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  requireChurch: vi.fn(),
  createAdminClient: vi.fn(),
  getStripe: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/auth/church', () => ({ requireChurch: mocks.requireChurch }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/billing/stripe', () => ({ getStripe: mocks.getStripe }))

const { startCheckout, openBillingPortal } = await import('./actions')

/** Requête Supabase factice : la même réponse quelle que soit la chaîne d'appels. */
const query = (result: unknown) => {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'insert']) chain[m] = () => chain
  chain.single = () => Promise.resolve(result)
  chain.maybeSingle = () => Promise.resolve(result)
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result)
  return chain
}

const stripe = {
  customers: { create: vi.fn() },
  prices: { list: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}
let subscriptionRow: unknown
let insertError: unknown

function setup({ founder = false, subscription = null as unknown } = {}) {
  subscriptionRow = subscription
  insertError = null
  mocks.requireChurch.mockResolvedValue({
    userId: 'u1',
    church: { churchId: 'church-1', role: 'admin' },
    supabase: {
      from: () => query({ data: { name: 'Église de la Source', is_founder: founder } }),
      auth: { getUser: () => Promise.resolve({ data: { user: { email: 'admin@exemple.fr' } } }) },
    },
  })
  mocks.createAdminClient.mockReturnValue({
    from: () => ({
      select: () => query({ data: subscriptionRow }),
      insert: () => Promise.resolve({ error: insertError }),
    }),
  })
  mocks.getStripe.mockReturnValue(stripe)
}

const fd = (entries: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}
async function redirectedTo(promise: Promise<unknown>) {
  await expect(promise).rejects.toThrow('NEXT_REDIRECT')
  return mocks.redirect.mock.calls.at(-1)![0] as string
}

beforeEach(() => {
  vi.clearAllMocks()
  stripe.customers.create.mockResolvedValue({ id: 'cus_1' })
  stripe.prices.list.mockResolvedValue({ data: [{ id: 'price_1' }] })
  stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.test/session' })
  stripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.stripe.test/portal' })
})

describe('startCheckout', () => {
  it("exige un administrateur, y compris en lecture seule (c'est ainsi qu'on en sort)", async () => {
    setup()
    await redirectedTo(startCheckout(fd({ offer: 'essentiel', interval: 'month' })))
    expect(mocks.requireChurch).toHaveBeenCalledWith('admin', { allowReadOnly: true })
  })

  it('crée le client Stripe avec la mention de facture, puis ouvre le paiement', async () => {
    setup()
    const url = await redirectedTo(startCheckout(fd({ offer: 'communaute', interval: 'year' })))
    expect(url).toBe('https://checkout.stripe.test/session')
    expect(stripe.customers.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Église de la Source', email: 'admin@exemple.fr', metadata: { church_id: 'church-1' },
      invoice_settings: { footer: expect.stringContaining('293 B') },
    }))
    expect(stripe.prices.list).toHaveBeenCalledWith(expect.objectContaining({ lookup_keys: ['communaute_year'] }))
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription', customer: 'cus_1', client_reference_id: 'church-1',
      line_items: [{ price: 'price_1', quantity: 1 }],
      subscription_data: { metadata: { church_id: 'church-1', offer: 'communaute', interval: 'year' } },
    }))
  })

  it('réutilise le client Stripe déjà enregistré pour cette église', async () => {
    setup({ subscription: { stripe_customer_id: 'cus_existant', status: null } })
    await redirectedTo(startCheckout(fd({ offer: 'essentiel', interval: 'month' })))
    expect(stripe.customers.create).not.toHaveBeenCalled()
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_existant' }))
  })

  it("le prix fondateur n'est proposé qu'à une église fondatrice en base", async () => {
    setup({ founder: true })
    await redirectedTo(startCheckout(fd({ offer: 'signature', interval: 'month' })))
    expect(stripe.prices.list).toHaveBeenCalledWith(expect.objectContaining({ lookup_keys: ['signature_founder_month'] }))
  })

  it('refuse le prix fondateur demandé par une église qui ne l’est pas, même en le réclamant dans le formulaire', async () => {
    setup({ founder: false })
    await redirectedTo(startCheckout(fd({ offer: 'signature', interval: 'month', founder: '1', lookup_key: 'signature_founder_month', price: 'price_fondateur' })))
    expect(stripe.prices.list).toHaveBeenCalledWith(expect.objectContaining({ lookup_keys: ['signature_month'] }))
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ line_items: [{ price: 'price_1', quantity: 1 }] }))
  })

  it.each([
    [{ offer: 'gratuit', interval: 'month' }],
    [{ offer: 'essentiel', interval: 'week' }],
    [{ offer: 'essentiel' }],
    [{}],
  ])('refuse un choix invalide %j sans toucher à Stripe', async entries => {
    setup()
    expect(await redirectedTo(startCheckout(fd(entries as Record<string, string>)))).toBe('/espace/abonnement?erreur=choix')
    expect(stripe.customers.create).not.toHaveBeenCalled()
  })

  it('renvoie vers le portail, pas vers un second abonnement, si l’église est déjà abonnée', async () => {
    for (const status of ['active', 'past_due']) {
      setup({ subscription: { stripe_customer_id: 'cus_1', status } })
      expect(await redirectedTo(startCheckout(fd({ offer: 'essentiel', interval: 'month' })))).toBe('/espace/abonnement?erreur=deja')
    }
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it("reste sur l'espace avec un message clair si Stripe est indisponible, sans détail technique", async () => {
    setup()
    stripe.checkout.sessions.create.mockRejectedValue(new Error('sk_test_secret détail interne'))
    const url = await redirectedTo(startCheckout(fd({ offer: 'essentiel', interval: 'month' })))
    expect(url).toBe('/espace/abonnement?erreur=indisponible')
  })

  it('signale un catalogue absent de Stripe', async () => {
    setup()
    stripe.prices.list.mockResolvedValue({ data: [] })
    expect(await redirectedTo(startCheckout(fd({ offer: 'essentiel', interval: 'month' })))).toBe('/espace/abonnement?erreur=indisponible')
  })

  it('si Stripe n’est pas configuré, la personne reste sur un message et rien ne plante', async () => {
    setup()
    mocks.getStripe.mockImplementation(() => { throw new Error('STRIPE_SECRET_KEY manquante') })
    expect(await redirectedTo(startCheckout(fd({ offer: 'essentiel', interval: 'month' })))).toBe('/espace/abonnement?erreur=indisponible')
  })
})

describe('openBillingPortal', () => {
  it('ouvre le portail du client de CETTE église', async () => {
    setup({ subscription: { stripe_customer_id: 'cus_1' } })
    const url = await redirectedTo(openBillingPortal())
    expect(url).toBe('https://billing.stripe.test/portal')
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_1' }))
    expect(mocks.requireChurch).toHaveBeenCalledWith('admin', { allowReadOnly: true })
  })

  it('refuse sans abonnement ni client Stripe', async () => {
    setup({ subscription: null })
    expect(await redirectedTo(openBillingPortal())).toBe('/espace/abonnement?erreur=aucun')
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled()
  })

  it('utilise la configuration du portail réservée aux fondateurs', async () => {
    vi.stubEnv('STRIPE_PORTAL_CONFIG_FOUNDER', 'bpc_fondateur')
    vi.stubEnv('STRIPE_PORTAL_CONFIG_STANDARD', 'bpc_standard')
    setup({ founder: true, subscription: { stripe_customer_id: 'cus_1' } })
    await redirectedTo(openBillingPortal())
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ configuration: 'bpc_fondateur' }))
    setup({ founder: false, subscription: { stripe_customer_id: 'cus_1' } })
    await redirectedTo(openBillingPortal())
    expect(stripe.billingPortal.sessions.create).toHaveBeenLastCalledWith(expect.objectContaining({ configuration: 'bpc_standard' }))
    vi.unstubAllEnvs()
  })
})
