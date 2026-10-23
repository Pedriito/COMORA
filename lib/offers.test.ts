import { describe, expect, it } from 'vitest'
import { allPrices, checkoutPriceKey, parseLookupKey, priceCents, priceLookupKey } from './offers'

describe('catalogue des offres', () => {
  it('les montants annuels en centimes sont ceux du cahier des charges', () => {
    expect(priceCents('essentiel', 'year', false)).toBe(18240)
    expect(priceCents('communaute', 'year', false)).toBe(47040)
    expect(priceCents('signature', 'year', false)).toBe(114240)
    expect(priceCents('essentiel', 'year', true)).toBe(11520)
    expect(priceCents('communaute', 'year', true)).toBe(27840)
    expect(priceCents('signature', 'year', true)).toBe(66240)
  })

  it('les montants mensuels', () => {
    expect([19, 49, 119].map((_, i) => priceCents(['essentiel', 'communaute', 'signature'][i] as never, 'month', false))).toEqual([1900, 4900, 11900])
    expect([12, 29, 69].map((_, i) => priceCents(['essentiel', 'communaute', 'signature'][i] as never, 'month', true))).toEqual([1200, 2900, 6900])
  })

  it('12 prix, aux clés de recherche uniques et lisibles dans les deux sens', () => {
    const prices = allPrices()
    expect(prices).toHaveLength(12)
    expect(new Set(prices.map(p => p.lookupKey)).size).toBe(12)
    for (const p of prices) expect(parseLookupKey(p.lookupKey)).toEqual({ offer: p.offer, interval: p.interval, founder: p.founder })
    expect(priceLookupKey('essentiel', 'month', false)).toBe('essentiel_month')
    expect(priceLookupKey('communaute', 'year', true)).toBe('communaute_founder_year')
  })

  it('une clé étrangère n’est pas reconnue', () => {
    for (const key of ['autre_month', 'essentiel', 'essentiel_week', '', null, undefined]) expect(parseLookupKey(key)).toBeNull()
  })

  it('le tarif fondateur n’est accordé qu’aux églises fondatrices', () => {
    expect(checkoutPriceKey('essentiel', 'month', true)).toBe('essentiel_founder_month')
    expect(checkoutPriceKey('essentiel', 'month', false)).toBe('essentiel_month')
    expect(checkoutPriceKey('signature', 'year', undefined as unknown as boolean)).toBe('signature_year')
  })
})
