import { describe, it, expect } from 'vitest'
import {
  localToUtcIso, localDateString, addDays, startOfLocalDayUtc, resolveTimeZone, isValidTimeZone, utcToLocalParts,
} from './timezone'

describe('localToUtcIso', () => {
  it('convertit une heure d\'été à Paris (CEST, UTC+2)', () => {
    expect(localToUtcIso('2026-09-20T10:00', 'Europe/Paris')).toBe('2026-09-20T08:00:00.000Z')
  })

  it('convertit une heure d\'hiver à Paris (CET, UTC+1)', () => {
    expect(localToUtcIso('2026-01-11T10:00', 'Europe/Paris')).toBe('2026-01-11T09:00:00.000Z')
  })

  it('gère une chaîne avec secondes', () => {
    expect(localToUtcIso('2026-09-20T10:00:30', 'Europe/Paris')).toBe('2026-09-20T08:00:30.000Z')
  })

  it('gère le passage à minuit (heure tardive)', () => {
    expect(localToUtcIso('2026-01-11T23:30', 'Europe/Paris')).toBe('2026-01-11T22:30:00.000Z')
  })

  it('prend en compte le fuseau de l\'église', () => {
    expect(localToUtcIso('2026-01-11T10:00', 'America/Montreal')).toBe('2026-01-11T15:00:00.000Z')
    expect(localToUtcIso('2026-01-11T10:00', 'Indian/Reunion')).toBe('2026-01-11T06:00:00.000Z')
    expect(localToUtcIso('2026-07-12T10:00', 'Africa/Abidjan')).toBe('2026-07-12T10:00:00.000Z')
  })

  it('reste juste juste après un changement d\'heure', () => {
    // 29 mars 2026 : Paris passe à l'heure d'été à 2h ; 3h30 locale = 1h30 UTC
    expect(localToUtcIso('2026-03-29T03:30', 'Europe/Paris')).toBe('2026-03-29T01:30:00.000Z')
    // 25 octobre 2026 : retour à l'heure d'hiver ; 4h locale = 3h UTC
    expect(localToUtcIso('2026-10-25T04:00', 'Europe/Paris')).toBe('2026-10-25T03:00:00.000Z')
  })

  it('aller-retour : l\'heure ré-affichée dans le fuseau est celle saisie', () => {
    const iso = localToUtcIso('2026-09-20T10:00', 'America/Montreal')
    expect(utcToLocalParts(iso, 'America/Montreal')).toMatchObject({ hour: 10, minute: 0 })
  })

  it('retombe sur Europe/Paris pour un fuseau inconnu', () => {
    expect(localToUtcIso('2026-01-11T10:00', 'Pas/UnFuseau')).toBe('2026-01-11T09:00:00.000Z')
  })
})

describe('dates locales', () => {
  it('donne la date locale d\'un instant selon le fuseau', () => {
    expect(localDateString('2026-01-11T23:30:00.000Z', 'Europe/Paris')).toBe('2026-01-12')
    expect(localDateString('2026-01-11T23:30:00.000Z', 'America/Montreal')).toBe('2026-01-11')
  })

  it('ajoute des jours en franchissant les mois', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('calcule le début de la journée locale en UTC', () => {
    expect(startOfLocalDayUtc('2026-06-01', 'Europe/Paris')).toBe('2026-05-31T22:00:00.000Z')
  })

  it('valide les fuseaux', () => {
    expect(isValidTimeZone('Europe/Paris')).toBe(true)
    expect(isValidTimeZone('n/importe/quoi')).toBe(false)
    expect(isValidTimeZone(null)).toBe(false)
    expect(resolveTimeZone(undefined)).toBe('Europe/Paris')
  })
})
