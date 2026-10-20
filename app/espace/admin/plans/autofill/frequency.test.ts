import { describe, it, expect } from 'vitest'
import { minGapDays, daysBetween, exclusiveEndDate, FREQUENCY_MIN_GAP_DAYS } from './frequency'

describe('minGapDays', () => {
  it('retourne le bon espacement pour chaque fréquence connue', () => {
    expect(minGapDays('weekly')).toBe(7)
    expect(minGapDays('twice_month')).toBe(14)
    expect(minGapDays('monthly')).toBe(30)
    expect(minGapDays('every_6_weeks')).toBe(42)
    expect(minGapDays('as_needed')).toBe(0)
  })

  it('retourne 0 pour une préférence non renseignée ou inconnue', () => {
    expect(minGapDays(null)).toBe(0)
    expect(minGapDays('inconnu')).toBe(0)
  })

  it('couvre exactement les mêmes clés que FREQUENCY_MIN_GAP_DAYS', () => {
    expect(Object.keys(FREQUENCY_MIN_GAP_DAYS).sort()).toEqual(
      ['as_needed', 'every_6_weeks', 'monthly', 'twice_month', 'weekly'].sort()
    )
  })
})

describe('daysBetween', () => {
  it('calcule un écart en jours, symétrique', () => {
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7)
    expect(daysBetween('2026-01-08', '2026-01-01')).toBe(7)
  })

  it('retourne 0 pour la même date', () => {
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0)
  })
})

describe('exclusiveEndDate', () => {
  it("retourne le lendemain d'une date donnée", () => {
    expect(exclusiveEndDate('2026-12-06')).toBe('2026-12-07')
  })

  it('gère le changement de mois', () => {
    expect(exclusiveEndDate('2026-11-30')).toBe('2026-12-01')
  })

  it("gère le changement d'année", () => {
    expect(exclusiveEndDate('2026-12-31')).toBe('2027-01-01')
  })
})
