import { describe, expect, it } from 'vitest'
import { accessState, effectiveOffer, isWritable, solidarityDaysLeft, trialDaysLeft, trialMessage, trialTone } from './access'

const NOW = new Date('2026-11-10T12:00:00Z')
const at = (days: number) => new Date(NOW.getTime() + days * 864e5)

describe('accessState', () => {
  it('essai en cours, puis lecture seule à la seconde exacte de la fin', () => {
    expect(accessState({ billingStatus: 'trialing', trialEndsAt: at(10) }, NOW)).toBe('trial')
    expect(accessState({ billingStatus: 'trialing', trialEndsAt: new Date(NOW.getTime() + 1) }, NOW)).toBe('trial')
    expect(accessState({ billingStatus: 'trialing', trialEndsAt: NOW }, NOW)).toBe('read_only')
    expect(accessState({ billingStatus: 'trialing', trialEndsAt: at(-1) }, NOW)).toBe('read_only')
  })

  it('un essai sans date reste ouvert (église créée par le serveur de test)', () => {
    expect(accessState({ billingStatus: 'trialing', trialEndsAt: null }, NOW)).toBe('trial')
  })

  it('abonnement actif, grâce après impayé, puis lecture seule', () => {
    expect(accessState({ billingStatus: 'active', trialEndsAt: at(-90) }, NOW)).toBe('active')
    expect(accessState({ billingStatus: 'past_due', trialEndsAt: null, graceEndsAt: at(3) }, NOW)).toBe('grace')
    expect(accessState({ billingStatus: 'past_due', trialEndsAt: null, graceEndsAt: at(-1) }, NOW)).toBe('read_only')
    expect(accessState({ billingStatus: 'past_due', trialEndsAt: null }, NOW)).toBe('read_only')
  })

  it('résilié, lecture seule et suppression programmée ne permettent pas d’écrire', () => {
    for (const billingStatus of ['canceled', 'read_only', 'pending_deletion'] as const) {
      expect(isWritable(accessState({ billingStatus, trialEndsAt: at(10) }, NOW))).toBe(false)
    }
  })

  it('seuls essai, actif et grâce sont modifiables', () => {
    expect(['trial', 'active', 'grace', 'read_only', 'pending_deletion'].map(s => isWritable(s as never))).toEqual([true, true, true, false, false])
  })
})

describe('essai', () => {
  it('compte les jours restants, au jour supérieur', () => {
    expect(trialDaysLeft('trial', at(30), NOW)).toBe(30)
    expect(trialDaysLeft('trial', new Date(NOW.getTime() + 3600e3), NOW)).toBe(1)
    expect(trialDaysLeft('trial', at(7.2), NOW)).toBe(8)
    expect(trialDaysLeft('active', at(30), NOW)).toBeNull()
    expect(trialDaysLeft('trial', null, NOW)).toBeNull()
  })

  it('ton et message du bandeau', () => {
    expect([30, 8, 7, 2, 1, 0].map(trialTone)).toEqual(['calm', 'calm', 'soon', 'soon', 'last', 'last'])
    expect(trialMessage(12)).toBe('Il vous reste 12 jours d’essai gratuit.')
    expect(trialMessage(1)).toBe('Dernier jour de votre essai gratuit.')
  })

  it('Communauté s’applique pendant l’essai, ensuite l’offre choisie', () => {
    expect(effectiveOffer('trial', null)).toBe('communaute')
    expect(effectiveOffer('trial', 'essentiel')).toBe('essentiel')
    expect(effectiveOffer('active', 'signature')).toBe('signature')
    expect(effectiveOffer('read_only', null)).toBeNull()
  })
})

describe('tarif solidaire', () => {
  const now = new Date('2027-03-01T12:00:00Z')
  const daysAgo = (n: number) => new Date(now.getTime() - n * 864e5)

  it('Essentiel pour une église solidaire, quel que soit son état', () => {
    expect(effectiveOffer('active', 'communaute', true)).toBe('essentiel')
    expect(effectiveOffer('trial', null, true)).toBe('essentiel')
    expect(effectiveOffer('trial', null, false)).toBe('communaute')
  })

  it('30 membres atteints : 30 jours, puis lecture seule à la seconde exacte', () => {
    const base = { billingStatus: 'active' as const, trialEndsAt: null, isSolidarity: true }
    expect(accessState({ ...base, solidarityExceededAt: null }, now)).toBe('active')
    expect(accessState({ ...base, solidarityExceededAt: daysAgo(29) }, now)).toBe('active')
    expect(accessState({ ...base, solidarityExceededAt: daysAgo(30) }, now)).toBe('read_only')
    expect(accessState({ ...base, solidarityExceededAt: daysAgo(31) }, now)).toBe('read_only')
  })

  it('une église non solidaire ignore la date', () => {
    expect(accessState({ billingStatus: 'active', trialEndsAt: null, isSolidarity: false, solidarityExceededAt: daysAgo(90) }, now)).toBe('active')
  })

  it('jours restants pour choisir une offre', () => {
    expect(solidarityDaysLeft(true, daysAgo(0), now)).toBe(30)
    expect(solidarityDaysLeft(true, daysAgo(29), now)).toBe(1)
    expect(solidarityDaysLeft(true, daysAgo(40), now)).toBe(0)
    expect(solidarityDaysLeft(true, null, now)).toBeNull()
    expect(solidarityDaysLeft(false, daysAgo(5), now)).toBeNull()
  })
})
