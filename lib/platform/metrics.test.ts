import { describe, expect, it } from 'vitest'
import { priceCents } from '@/lib/offers'
import { monthlyRecurringRevenueCents, parseOverview, payingChurchesByOffer, type SubscriptionCount } from './metrics'

const sub = (offer: SubscriptionCount['offer'], interval: SubscriptionCount['interval'], founder: boolean, count: number): SubscriptionCount => ({ offer, interval, founder, count })

describe('revenu mensuel récurrent', () => {
  it('additionne les abonnements mensuels au prix du catalogue', () => {
    expect(monthlyRecurringRevenueCents([sub('essentiel', 'month', false, 2)])).toBe(2 * priceCents('essentiel', 'month', false))
    expect(monthlyRecurringRevenueCents([sub('essentiel', 'month', false, 2)])).toBe(3800)
  })

  it('compte un abonnement annuel pour son douzième', () => {
    const annual = priceCents('communaute', 'year', true)
    expect(monthlyRecurringRevenueCents([sub('communaute', 'year', true, 1)])).toBe(Math.round(annual / 12))
    // L'annuel (−20 %) rapporte moins par mois que le mensuel
    expect(monthlyRecurringRevenueCents([sub('communaute', 'year', true, 1)])).toBeLessThan(priceCents('communaute', 'month', true))
  })

  it('distingue le tarif fondateur du tarif normal', () => {
    expect(monthlyRecurringRevenueCents([sub('signature', 'month', true, 1)])).toBe(6900)
    expect(monthlyRecurringRevenueCents([sub('signature', 'month', false, 1)])).toBe(11900)
  })

  it('vaut zéro sans abonnement', () => {
    expect(monthlyRecurringRevenueCents([])).toBe(0)
  })
})

describe('églises payantes par offre', () => {
  it('regroupe les périodicités et tarifs d\'une même offre', () => {
    const counts = payingChurchesByOffer([sub('essentiel', 'month', false, 3), sub('essentiel', 'year', true, 2), sub('signature', 'year', false, 1)])
    expect(counts).toEqual({ essentiel: 5, communaute: 0, signature: 1 })
  })
})

describe('lecture de la réponse de la base', () => {
  it('reprend une réponse bien formée', () => {
    const overview = parseOverview({
      churches: 12, by_status: { trialing: 7, active: 5 }, solidarity: 2, solidarity_requests: 1,
      subscriptions: [{ offer: 'communaute', interval: 'month', founder: true, count: 4 }],
    })
    expect(overview).toEqual({ churches: 12, byStatus: { trialing: 7, active: 5 }, solidarity: 2, solidarityRequests: 1, subscriptions: [sub('communaute', 'month', true, 4)] })
  })

  it('écarte ce qui n\'a pas la bonne forme au lieu de le croire', () => {
    const overview = parseOverview({
      churches: -3, by_status: { active: 'beaucoup' }, solidarity: null,
      subscriptions: [{ offer: 'gratuit', interval: 'month', count: 9 }, { offer: 'essentiel', interval: 'decade', count: 9 }, { offer: 'essentiel', interval: 'year', count: 1 }, null],
    })
    expect(overview.churches).toBe(0)
    expect(overview.byStatus).toEqual({ active: 0 })
    expect(overview.subscriptions).toEqual([sub('essentiel', 'year', false, 1)])
  })

  it('ne plante pas sur une réponse vide ou absente', () => {
    for (const raw of [null, undefined, 'x', 42, []]) expect(parseOverview(raw)).toEqual({ churches: 0, byStatus: {}, subscriptions: [], solidarity: 0, solidarityRequests: 0 })
  })
})
