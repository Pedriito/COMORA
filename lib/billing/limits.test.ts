import { describe, expect, it } from 'vitest'
import { churchOffer, limitKind, limitKindFromCode, limitMessage, limitMessageFor, offerFits } from './limits'
import { OFFERS, OFFER_LIMITS, nextOffer, offerForMembers } from '@/lib/offers'

describe('limites des offres', () => {
  it('Essentiel 100 membres / 3 administrateurs, Communauté 500, Signature illimitée', () => {
    expect(OFFER_LIMITS.essentiel).toMatchObject({ maxMembers: 100, maxAdmins: 3, publicSite: false })
    expect(OFFER_LIMITS.communaute).toMatchObject({ maxMembers: 500, maxAdmins: null, publicSite: true, customBranding: false })
    expect(OFFER_LIMITS.signature).toMatchObject({ maxMembers: null, maxAdmins: null, customDomain: true, multiSite: true, advancedRoles: true })
  })

  it('les limites croissent d’une offre à l’autre', () => {
    const sizes = OFFERS.map(o => OFFER_LIMITS[o].maxMembers ?? Infinity)
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
  })

  it('la plus petite offre qui accepte un effectif', () => {
    expect(offerForMembers(0)).toBe('essentiel')
    expect(offerForMembers(100)).toBe('essentiel')
    expect(offerForMembers(101)).toBe('communaute')
    expect(offerForMembers(500)).toBe('communaute')
    expect(offerForMembers(501)).toBe('signature')
    expect(offerForMembers(100000)).toBe('signature')
  })

  it('offre supérieure', () => {
    expect(nextOffer('essentiel')).toBe('communaute')
    expect(nextOffer('communaute')).toBe('signature')
    expect(nextOffer('signature')).toBeNull()
  })
})

describe('erreurs de la base', () => {
  it('reconnaît les deux limites, rien d’autre', () => {
    expect(limitKind({ message: 'limite_membres' })).toBe('members')
    expect(limitKind({ message: 'limite_administrateurs' })).toBe('admins')
    expect(limitKind({ message: 'duplicate key' })).toBeNull()
    expect(limitKind(null)).toBeNull()
  })

  it('codes de l’adresse', () => {
    expect(limitKindFromCode('limit_members')).toBe('members')
    expect(limitKindFromCode('limit_admins')).toBe('admins')
    expect(limitKindFromCode('failed')).toBeNull()
    expect(limitKindFromCode(undefined)).toBeNull()
  })
})

describe('messages', () => {
  it('Essentiel : propose Communauté, en français simple', () => {
    const m = limitMessage('members', 'essentiel')
    expect(m).toContain('100 membres')
    expect(m).toContain('Communauté')
    expect(m).toContain('500')
  })

  it('Communauté : propose Signature', () => {
    expect(limitMessage('members', 'communaute')).toContain('Signature')
  })

  it('administrateurs : seul Essentiel est limité', () => {
    expect(limitMessage('admins', 'essentiel')).toContain('3 administrateurs')
  })

  it('l’offre de l’église courante : solidaire = Essentiel, essai = Communauté', () => {
    expect(churchOffer({ access: 'active', offer: 'communaute', isSolidarity: true })).toBe('essentiel')
    expect(churchOffer({ access: 'trial', offer: null })).toBe('communaute')
    expect(churchOffer({ access: 'active', offer: 'signature' })).toBe('signature')
    expect(limitMessageFor('limit_members', { access: 'active', offer: 'essentiel' })).toContain('Essentiel')
    expect(limitMessageFor('failed', { access: 'active', offer: 'essentiel' })).toBeNull()
  })
})

describe('choisir une offre plus petite que l’église', () => {
  it('refusé au-dessus de la limite, accepté pile à la limite', () => {
    expect(offerFits('essentiel', { members: 100, admins: 3 })).toEqual({ ok: true })
    expect(offerFits('essentiel', { members: 101, admins: 1 })).toEqual({ ok: false, reason: 'members' })
    expect(offerFits('essentiel', { members: 10, admins: 4 })).toEqual({ ok: false, reason: 'admins' })
    expect(offerFits('communaute', { members: 500, admins: 40 })).toEqual({ ok: true })
    expect(offerFits('communaute', { members: 501, admins: 1 })).toEqual({ ok: false, reason: 'members' })
    expect(offerFits('signature', { members: 50000, admins: 400 })).toEqual({ ok: true })
  })
})
