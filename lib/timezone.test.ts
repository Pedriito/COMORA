import { describe, it, expect } from 'vitest'
import { parisLocalToUtcIso } from './timezone'

describe('parisLocalToUtcIso', () => {
  it('convertit une heure d\'été (CEST, UTC+2) — 10:00 Paris en septembre → 08:00 UTC', () => {
    expect(parisLocalToUtcIso('2026-09-20T10:00')).toBe('2026-09-20T08:00:00.000Z')
  })

  it('convertit une heure d\'hiver (CET, UTC+1) — 10:00 Paris en janvier → 09:00 UTC', () => {
    expect(parisLocalToUtcIso('2026-01-11T10:00')).toBe('2026-01-11T09:00:00.000Z')
  })

  it('gère une chaîne avec secondes', () => {
    expect(parisLocalToUtcIso('2026-09-20T10:00:30')).toBe('2026-09-20T08:00:30.000Z')
  })

  it('reste cohérent au ré-affichage en heure de Paris (round-trip)', () => {
    const utcIso = parisLocalToUtcIso('2026-09-20T10:00')
    const parisTime = new Date(utcIso).toLocaleTimeString('fr-FR', {
      timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
    expect(parisTime).toBe('10:00')
  })

  it('gère le changement de date autour du passage à minuit (heure tardive)', () => {
    // 23h30 Paris en hiver (CET, +1) → 22h30 UTC, même jour
    expect(parisLocalToUtcIso('2026-01-11T23:30')).toBe('2026-01-11T22:30:00.000Z')
  })
})
