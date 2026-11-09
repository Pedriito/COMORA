import { isInterval, isOfferId, OFFERS, priceCents, type OfferId } from '@/lib/offers'

/*
 * Indicateurs du back-office, calculés à partir des COMPTEURS renvoyés par platform_overview()
 * et du catalogue de prix (lib/offers.ts) : aucun prix n'est recopié en base.
 */

export type SubscriptionCount = { offer: OfferId; interval: 'month' | 'year'; founder: boolean; count: number }

export type PlatformOverview = {
  churches: number
  byStatus: Record<string, number>
  subscriptions: SubscriptionCount[]
  solidarity: number
  solidarityRequests: number
}

/** Lit la réponse de la base sans lui faire confiance : tout ce qui n'a pas la bonne forme est écarté. */
export function parseOverview(raw: unknown): PlatformOverview {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
  const byStatus: Record<string, number> = {}
  if (o.by_status && typeof o.by_status === 'object') {
    for (const [status, n] of Object.entries(o.by_status as Record<string, unknown>)) byStatus[status] = num(n)
  }
  const subscriptions: SubscriptionCount[] = []
  if (Array.isArray(o.subscriptions)) {
    for (const row of o.subscriptions as Array<Record<string, unknown>>) {
      if (isOfferId(row?.offer) && isInterval(row?.interval)) {
        subscriptions.push({ offer: row.offer, interval: row.interval, founder: row.founder === true, count: num(row.count) })
      }
    }
  }
  return { churches: num(o.churches), byStatus, subscriptions, solidarity: num(o.solidarity), solidarityRequests: num(o.solidarity_requests) }
}

/** Revenu mensuel récurrent, en centimes : un abonnement annuel compte pour son douzième. */
export function monthlyRecurringRevenueCents(subscriptions: SubscriptionCount[]): number {
  let total = 0
  for (const s of subscriptions) {
    const price = priceCents(s.offer, s.interval, s.founder)
    total += (s.interval === 'year' ? price / 12 : price) * s.count
  }
  return Math.round(total)
}

/** Nombre d'églises payantes par offre. */
export function payingChurchesByOffer(subscriptions: SubscriptionCount[]): Record<OfferId, number> {
  const out = Object.fromEntries(OFFERS.map((o) => [o, 0])) as Record<OfferId, number>
  for (const s of subscriptions) out[s.offer] += s.count
  return out
}
