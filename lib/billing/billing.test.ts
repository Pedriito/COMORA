/* eslint-disable @typescript-eslint/no-explicit-any -- fausse API Stripe : seuls les champs lus par le script comptent */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureCatalog } from './catalog-setup'
import { invoiceFooter, legalInfoComplete, stripeModeOf } from './legal'
import { getStripe } from './stripe'

/** Mini-Stripe en mémoire : juste ce que lit et écrit le script d'installation. */
function fakeStripe() {
  const state = { products: [] as any[], prices: [] as any[], configs: [] as any[], calls: [] as string[] }
  let n = 0
  const id = (p: string) => `${p}_${++n}`
  const stripe = {
    products: {
      list: async () => ({ data: state.products.filter(p => p.active) }),
      create: async (p: any) => { state.calls.push('product.create'); const row = { id: id('prod'), active: true, ...p }; state.products.push(row); return row },
    },
    prices: {
      list: async ({ lookup_keys }: any) => ({ data: state.prices.filter(p => p.active && lookup_keys.includes(p.lookup_key)) }),
      create: async (p: any) => {
        state.calls.push('price.create')
        for (const old of state.prices) if (p.transfer_lookup_key && old.lookup_key === p.lookup_key) old.lookup_key = null
        const row = { id: id('price'), active: true, ...p, recurring: p.recurring }
        state.prices.push(row)
        return row
      },
      update: async (priceId: string, patch: any) => { state.calls.push('price.update'); Object.assign(state.prices.find(p => p.id === priceId), patch) },
    },
    billingPortal: {
      configurations: {
        list: async () => ({ data: state.configs }),
        create: async (c: any) => { state.calls.push('portal.create'); const row = { id: id('bpc'), ...c }; state.configs.push(row); return row },
        update: async (cid: string, c: any) => { state.calls.push('portal.update'); Object.assign(state.configs.find(x => x.id === cid), c) },
      },
    },
  }
  return { stripe: stripe as any, state }
}
const urls = { site: 'https://comora.fr' }

describe('installation du catalogue Stripe', () => {
  it('crée 3 produits, 12 prix et 2 configurations de portail', async () => {
    const { stripe, state } = fakeStripe()
    const result = await ensureCatalog(stripe, () => {}, urls)
    expect(state.products).toHaveLength(3)
    expect(state.prices).toHaveLength(12)
    expect(Object.keys(result.prices)).toHaveLength(12)
    expect(state.configs.map(c => c.metadata.comora_config).sort()).toEqual(['founder', 'standard'])
    expect(state.prices.find(p => p.lookup_key === 'signature_founder_year').unit_amount).toBe(66240)
    expect(state.prices.find(p => p.lookup_key === 'essentiel_month')).toMatchObject({ unit_amount: 1900, currency: 'eur', recurring: { interval: 'month' } })
  })

  it('est idempotent : le relancer ne crée rien en double', async () => {
    const { stripe, state } = fakeStripe()
    const first = await ensureCatalog(stripe, () => {}, urls)
    state.calls.length = 0
    const second = await ensureCatalog(stripe, () => {}, urls)
    expect(state.calls.filter(c => c.endsWith('.create'))).toEqual([])
    expect(state.products).toHaveLength(3)
    expect(state.prices).toHaveLength(12)
    expect(second.portal).toEqual(first.portal)
    expect(second.prices).toEqual(first.prices)
  })

  it('un montant modifié crée un nouveau prix qui reprend la clé, et archive l’ancien', async () => {
    const { stripe, state } = fakeStripe()
    await ensureCatalog(stripe, () => {}, urls)
    const old = state.prices.find(p => p.lookup_key === 'communaute_month')
    old.unit_amount = 3900
    await ensureCatalog(stripe, () => {}, urls)
    const current = state.prices.filter(p => p.active && p.lookup_key === 'communaute_month')
    expect(current).toHaveLength(1)
    expect(current[0].unit_amount).toBe(4900)
    expect(old.active).toBe(false)
  })

  it('le portail des fondateurs ne propose que des prix fondateurs, l’autre que des prix standard', async () => {
    const { stripe, state } = fakeStripe()
    await ensureCatalog(stripe, () => {}, urls)
    const priceOf = (pid: string) => state.prices.find(p => p.id === pid).lookup_key as string
    const keys = (kind: string) => state.configs.find(c => c.metadata.comora_config === kind).features.subscription_update.products.flatMap((p: any) => p.prices.map(priceOf))
    expect(keys('founder')).toHaveLength(6)
    expect(keys('founder').every((k: string) => k.includes('_founder_'))).toBe(true)
    expect(keys('standard')).toHaveLength(6)
    expect(keys('standard').some((k: string) => k.includes('_founder_'))).toBe(false)
  })

  it('la résiliation se fait en fin de période', async () => {
    const { stripe, state } = fakeStripe()
    await ensureCatalog(stripe, () => {}, urls)
    for (const c of state.configs) expect(c.features.subscription_cancel).toMatchObject({ enabled: true, mode: 'at_period_end' })
  })
})

describe('clés Stripe et informations de la société', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reconnaît le mode de la clé', () => {
    expect(stripeModeOf('sk_test_abc')).toBe('test')
    expect(stripeModeOf('sk_live_abc')).toBe('live')
    expect(stripeModeOf('rk_live_abc')).toBe('live')
    expect(stripeModeOf('pk_test_abc')).toBeNull()
    expect(stripeModeOf('n’importe quoi')).toBeNull()
  })

  it('une clé de production est refusée tant que la société n’est pas renseignée', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_abc')
    for (const name of ['COMORA_LEGAL_NAME', 'COMORA_LEGAL_ADDRESS', 'COMORA_LEGAL_SIREN']) vi.stubEnv(name, '')
    expect(() => getStripe()).toThrow(/COMORA_LEGAL/)
    vi.stubEnv('COMORA_LEGAL_NAME', 'Comora SAS')
    vi.stubEnv('COMORA_LEGAL_ADDRESS', '1 rue de Test, 75001 Paris')
    expect(() => getStripe()).toThrow(/COMORA_LEGAL/) // le SIREN manque encore
    vi.stubEnv('COMORA_LEGAL_SIREN', '123456789')
    expect(() => getStripe()).not.toThrow()
  })

  it('une clé de test fonctionne sans la société ; une clé absente ou invalide est refusée', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_abc')
    expect(() => getStripe()).not.toThrow()
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    expect(() => getStripe()).toThrow(/manquante/)
    vi.stubEnv('STRIPE_SECRET_KEY', 'pk_test_abc')
    expect(() => getStripe()).toThrow(/invalide/)
  })

  it('le pied de facture porte toujours la mention TVA, et la société quand elle existe', () => {
    for (const name of ['COMORA_LEGAL_NAME', 'COMORA_LEGAL_ADDRESS', 'COMORA_LEGAL_SIREN']) vi.stubEnv(name, '')
    expect(legalInfoComplete()).toBe(false)
    expect(invoiceFooter()).toBe('TVA non applicable, art. 293 B du CGI')
    vi.stubEnv('COMORA_LEGAL_NAME', 'Comora SAS')
    vi.stubEnv('COMORA_LEGAL_ADDRESS', '1 rue de Test, 75001 Paris')
    vi.stubEnv('COMORA_LEGAL_SIREN', '123456789')
    expect(legalInfoComplete()).toBe(true)
    expect(invoiceFooter()).toBe('TVA non applicable, art. 293 B du CGI — Comora SAS, 1 rue de Test, 75001 Paris, SIREN 123456789')
  })
})
