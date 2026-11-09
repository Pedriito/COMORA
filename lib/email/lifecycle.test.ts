import { describe, expect, it } from 'vitest'
import { GRACE_DAYS, RETENTION_DAYS } from '@/lib/billing/access'
import { dueTimeKinds, emailKey, isOptionalKind, renderLifecycleEmail, type ChurchLifecycleRow, type LifecycleKind } from './lifecycle'

const DAY = 864e5
const NOW = new Date('2026-11-09T09:00:00Z')
const at = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString()

/** Église en essai, créée il y a `age` jours, essai de 30 jours. */
function trial(age: number, over: Partial<ChurchLifecycleRow> = {}): ChurchLifecycleRow {
  return {
    id: 'c1',
    name: 'Église de la Source',
    timezone: 'Europe/Paris',
    billing_status: 'trialing',
    created_at: at(-age),
    trial_ends_at: at(30 - age),
    grace_ends_at: null,
    deletion_scheduled_at: null,
    ...over,
  }
}
const kinds = (c: ChurchLifecycleRow, now = NOW) => dueTimeKinds(c, now).map((d) => d.kind)

describe('messages dus selon le jour de l\'essai', () => {
  it('jour 0 : bienvenue seulement', () => {
    expect(kinds(trial(0))).toEqual(['welcome'])
  })

  it('jour 1 et 2 : seulement la bienvenue (rattrapage si elle n\'est pas partie)', () => {
    expect(kinds(trial(1))).toEqual(['welcome'])
    expect(kinds(trial(2.5))).toEqual(['welcome'])
  })

  it('jour 3 : relance d\'import (et bienvenue encore due en rattrapage)', () => {
    expect(kinds(trial(3))).toEqual(['welcome', 'no_import_d3'])
  })

  it('jour 7 à 14 : plus de bienvenue, plus de relance d\'import après 8 jours', () => {
    expect(kinds(trial(7.5))).toEqual(['no_import_d3'])
    expect(kinds(trial(9))).toEqual([])
    expect(kinds(trial(14))).toEqual([])
  })

  it('mi-parcours : de 15 à 8 jours restants', () => {
    expect(kinds(trial(15))).toEqual(['trial_midway'])
    expect(kinds(trial(22))).toEqual(['trial_midway'])
    expect(kinds(trial(22.5))).toEqual(['trial_midway']) // 7,5 jours restants : 8 en arrondi supérieur
    expect(kinds(trial(23))).toEqual(['trial_ending_7'])
  })

  it('J-7 : de 7 à 2 jours restants, avec rattrapage si un jour a sauté', () => {
    expect(kinds(trial(23))).toEqual(['trial_ending_7'])
    expect(kinds(trial(28.5))).toEqual(['trial_ending_7'])
  })

  it('J-1 : dernier jour, tant que l\'essai n\'est pas fini', () => {
    expect(kinds(trial(29))).toEqual(['trial_ending_1'])
    expect(kinds(trial(29.9))).toEqual(['trial_ending_1'])
    expect(kinds(trial(30))).toEqual([])
    expect(kinds(trial(31))).toEqual([])
  })

  it('essai prolongé : rien tant qu\'il reste plus de 15 jours', () => {
    expect(kinds(trial(10, { trial_ends_at: at(40) }))).toEqual([])
  })

  it('aucun message d\'essai pour une église qui paie ou en lecture seule', () => {
    expect(kinds(trial(29, { billing_status: 'active' }))).toEqual([])
    expect(kinds(trial(29, { billing_status: 'read_only' }))).toEqual([])
  })
})

describe('impayé et suppression', () => {
  it('impayé : message tant que la grâce court, une clé par échéance de grâce', () => {
    const church = trial(60, { billing_status: 'past_due', trial_ends_at: null, grace_ends_at: at(GRACE_DAYS - 1) })
    const due = dueTimeKinds(church, NOW)
    expect(due.map((d) => d.kind)).toEqual(['payment_failed'])
    expect(due[0].key).toBe(`payment_failed:${at(GRACE_DAYS - 1).slice(0, 10)}`)
  })

  it('impayé : plus rien une fois la grâce terminée', () => {
    expect(kinds(trial(60, { billing_status: 'past_due', trial_ends_at: null, grace_ends_at: at(-1) }))).toEqual([])
  })

  it('suppression : avertissement dans les 7 derniers jours, pas avant, pas après', () => {
    const base = { billing_status: 'read_only', trial_ends_at: at(-80) }
    expect(kinds(trial(110, { ...base, deletion_scheduled_at: at(7) }))).toEqual(['deletion_warning'])
    expect(kinds(trial(110, { ...base, deletion_scheduled_at: at(1) }))).toEqual(['deletion_warning'])
    expect(kinds(trial(110, { ...base, deletion_scheduled_at: at(8) }))).toEqual([])
    expect(kinds(trial(110, { ...base, deletion_scheduled_at: at(-1) }))).toEqual([])
  })

  it('suppression : jamais pour une église qui a payé entre-temps', () => {
    expect(kinds(trial(110, { billing_status: 'active', deletion_scheduled_at: at(3) }))).toEqual([])
  })
})

describe('clés d\'unicité', () => {
  it('portent un repère quand le message peut se reproduire', () => {
    expect(emailKey('welcome')).toBe('welcome')
    expect(emailKey('payment_failed', new Date('2026-12-03T10:00:00Z'))).toBe('payment_failed:2026-12-03')
    expect(emailKey('subscription_confirmed', 'sub_123')).toBe('subscription_confirmed:sub_123')
  })
})

describe('contenu des messages', () => {
  const ALL: LifecycleKind[] = [
    'welcome', 'no_import_d3', 'trial_midway', 'trial_ending_7', 'trial_ending_1',
    'deletion_warning', 'payment_failed', 'subscription_confirmed', 'cancellation_scheduled', 'subscription_ended',
  ]
  const ctx = {
    firstName: 'Camille',
    churchName: 'Église <b>Source</b> & Co',
    timeZone: 'Europe/Paris',
    daysLeft: 5,
    trialEndsAt: '2026-11-14T22:59:59Z',
    graceEndsAt: '2026-11-16T10:00:00Z',
    deletionAt: '2027-02-07T10:00:00Z',
    periodEnd: '2026-12-09T10:00:00Z',
    offerName: 'Communauté',
    interval: 'year' as const,
  }

  it.each(ALL)('%s : objet, aperçu, lien vers l\'espace, signature, aucune valeur manquante', (kind) => {
    const { subject, html } = renderLifecycleEmail(kind, ctx)
    expect(subject.length).toBeGreaterThan(5)
    expect(subject).not.toMatch(/undefined|NaN|null/)
    expect(html).not.toMatch(/undefined|NaN|>null</)
    expect(html).toContain('Bonjour Camille,')
    expect(html).toContain('Pierre-Elie, de Comora')
    expect(html).toMatch(/href="[^"]*\/espace\/(abonnement|demarrage)"/)
    expect(html).toContain('lang="fr"')
  })

  it.each(ALL)('%s : le nom de l\'église saisi par l\'utilisateur est échappé', (kind) => {
    const { html } = renderLifecycleEmail(kind, ctx)
    expect(html).not.toContain('<b>Source</b>')
    expect(html).toContain('&lt;b&gt;Source&lt;/b&gt;')
  })

  it('sans prénom : « Bonjour, » ; le prénom saisi est échappé', () => {
    expect(renderLifecycleEmail('welcome', { ...ctx, firstName: '' }).html).toContain('Bonjour,')
    expect(renderLifecycleEmail('welcome', { ...ctx, firstName: '<i>X</i>' }).html).not.toContain('<i>X</i>')
  })

  it('les dates sont données dans le fuseau de l\'église', () => {
    // 22:59 UTC le 14 novembre = 23:59 à Paris, mais 18:59 à Montréal
    const paris = renderLifecycleEmail('trial_ending_1', { ...ctx, timeZone: 'Europe/Paris' }).html
    const montreal = renderLifecycleEmail('trial_ending_1', { ...ctx, timeZone: 'America/Montreal' }).html
    expect(paris).toContain('14 novembre à 23:59')
    expect(montreal).toContain('14 novembre à 17:59')
  })

  it('« jour » au singulier quand il ne reste qu\'un jour', () => {
    expect(renderLifecycleEmail('trial_ending_7', { ...ctx, daysLeft: 1 }).subject).toBe("Plus que 1 jour d'essai gratuit")
    expect(renderLifecycleEmail('trial_ending_7', { ...ctx, daysLeft: 4 }).subject).toBe("Plus que 4 jours d'essai gratuit")
  })

  it('annoncent la conservation des données et la période de grâce avec les durées du produit', () => {
    expect(renderLifecycleEmail('trial_ending_7', ctx).html).toContain(`${RETENTION_DAYS} jours`)
    expect(renderLifecycleEmail('payment_failed', ctx).html).toContain(`${GRACE_DAYS} jours`)
  })

  it('confirmation : offre et périodicité', () => {
    const { subject, html } = renderLifecycleEmail('subscription_confirmed', ctx)
    expect(subject).toBe('Votre abonnement Communauté est actif')
    expect(html).toContain('(annuel)')
  })
})

describe('lien de désinscription', () => {
  const ctx = { firstName: 'Camille', churchName: 'Église X', timeZone: 'Europe/Paris', daysLeft: 5, trialEndsAt: '2026-11-14T22:59:59Z', graceEndsAt: '2026-11-16T10:00:00Z', deletionAt: '2027-02-07T10:00:00Z', periodEnd: '2026-12-09T10:00:00Z', unsubscribeUrl: 'https://app.comora.fr/espace/desinscription/abc' }
  const OPTIONAL: LifecycleKind[] = ['no_import_d3', 'trial_midway', 'trial_ending_7', 'trial_ending_1']
  const SERVICE: LifecycleKind[] = ['welcome', 'deletion_warning', 'payment_failed', 'subscription_confirmed', 'cancellation_scheduled', 'subscription_ended']

  it.each(OPTIONAL)('%s : message de rappel, avec le lien « Me désinscrire »', (kind) => {
    expect(isOptionalKind(kind)).toBe(true)
    const { html } = renderLifecycleEmail(kind, ctx)
    expect(html).toContain('href="https://app.comora.fr/espace/desinscription/abc"')
    expect(html).toContain('Me désinscrire')
  })

  it.each(SERVICE)('%s : message de service, jamais de lien de désinscription', (kind) => {
    expect(isOptionalKind(kind)).toBe(false)
    const { html } = renderLifecycleEmail(kind, ctx)
    expect(html).not.toContain('Me désinscrire')
    expect(html).not.toContain('desinscription')
  })

  it('sans lien fourni, rien n\'est affiché', () => {
    expect(renderLifecycleEmail('trial_midway', { ...ctx, unsubscribeUrl: undefined }).html).not.toContain('Me désinscrire')
  })
})
