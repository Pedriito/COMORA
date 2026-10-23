import type { SupabaseClient } from '@supabase/supabase-js'
import { GRACE_DAYS, RETENTION_DAYS } from '@/lib/billing/access'
import { parseLookupKey, type BillingInterval, type OfferId } from '@/lib/offers'

/*
 * Traitement des événements Stripe : de l'événement à l'état de l'église.
 *
 *   - jamais deux fois le même événement (table stripe_events) ;
 *   - un événement plus ancien que l'état connu est ignoré (Stripe ne garantit pas l'ordre de livraison) ;
 *   - rien n'est cru sur parole : l'église est retrouvée par le client Stripe que NOUS avons créé ;
 *   - toutes les écritures passent par la clé secrète, filtrées par l'église retrouvée.
 *
 * Le module ne dépend pas du SDK Stripe (types structurels) : il se teste avec de simples objets.
 */

type Admin = SupabaseClient

/* eslint-disable @typescript-eslint/no-explicit-any */
export type StripeEventLike = { id: string; type: string; created: number; data: { object: any } }

export type EventDeps = {
  now?: Date
  /** Prévient l'équipe Comora qu'une église prend l'offre Signature. */
  notifySignature?: (info: { churchId: string; churchName: string; interval: BillingInterval }) => Promise<void>
}

export type EventOutcome = 'processed' | 'duplicate' | 'ignored'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const id = (value: unknown): string | null =>
  typeof value === 'string' ? value : value && typeof (value as { id?: unknown }).id === 'string' ? (value as { id: string }).id : null

type SubscriptionRow = {
  church_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  offer: OfferId | null
  last_event_at: string | null
}

type ChurchRow = { id: string; name: string; billing_status: string; grace_ends_at: string | null; deletion_scheduled_at: string | null }

export async function handleStripeEvent(admin: Admin, event: StripeEventLike, deps: EventDeps = {}): Promise<EventOutcome> {
  // 1. Journal : un événement déjà traité n'est jamais rejoué
  const { error: insertError } = await admin.from('stripe_events').insert({ id: event.id, type: event.type })
  if (insertError) {
    if (insertError.code !== '23505') throw new Error(`stripe_events : ${insertError.message}`)
    const { data: seen } = await admin.from('stripe_events').select('processed_at').eq('id', event.id).maybeSingle()
    if (seen?.processed_at) return 'duplicate'
    // Reçu mais pas terminé (échec précédent) : on retraite, les mises à jour sont idempotentes
  }

  const outcome = await dispatch(admin, event, deps)
  await admin.from('stripe_events').update({ processed_at: (deps.now ?? new Date()).toISOString() }).eq('id', event.id)
  return outcome
}

async function dispatch(admin: Admin, event: StripeEventLike, deps: EventDeps): Promise<EventOutcome> {
  const object = event.data.object
  switch (event.type) {
    case 'checkout.session.completed':
      return onCheckoutCompleted(admin, object)
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return onSubscription(admin, event, deps)
    case 'invoice.payment_failed':
      return onPaymentFailed(admin, event, deps)
    case 'invoice.paid':
      return onInvoicePaid(admin, event)
    default:
      return 'ignored'
  }
}

async function subscriptionByCustomer(admin: Admin, customerId: string | null): Promise<SubscriptionRow | null> {
  if (!customerId) return null
  const { data } = await admin
    .from('subscriptions')
    .select('church_id, stripe_customer_id, stripe_subscription_id, offer, last_event_at')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return (data as SubscriptionRow | null) ?? null
}

async function churchOf(admin: Admin, churchId: string): Promise<ChurchRow | null> {
  const { data } = await admin
    .from('churches')
    .select('id, name, billing_status, grace_ends_at, deletion_scheduled_at')
    .eq('id', churchId)
    .maybeSingle()
  return (data as ChurchRow | null) ?? null
}

const isStale = (row: SubscriptionRow, event: StripeEventLike) =>
  !!row.last_event_at && new Date(row.last_event_at).getTime() > event.created * 1000

const plusDays = (from: Date, days: number) => new Date(from.getTime() + days * 864e5).toISOString()

/** Fin de la période payée : sur l'abonnement (ancienne API) ou sur sa première ligne (nouvelle API). */
function periodEnd(subscription: any): string | null {
  const seconds = subscription?.items?.data?.[0]?.current_period_end ?? subscription?.current_period_end
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null
}

/** Abonnement d'une facture : champ historique ou « parent » de la nouvelle API. */
function invoiceSubscriptionId(invoice: any): string | null {
  return id(invoice?.subscription) ?? id(invoice?.parent?.subscription_details?.subscription)
}

async function onCheckoutCompleted(admin: Admin, session: any): Promise<EventOutcome> {
  if (session?.mode !== 'subscription') return 'ignored'
  const customerId = id(session.customer)
  const churchId = session.client_reference_id
  if (!customerId || typeof churchId !== 'string' || !UUID.test(churchId)) return 'ignored'

  // Le client doit être celui que nous avons créé pour CETTE église
  const row = await subscriptionByCustomer(admin, customerId)
  if (!row || row.church_id !== churchId) return 'ignored'

  const subscriptionId = id(session.subscription)
  if (subscriptionId) {
    await admin.from('subscriptions').update({ stripe_subscription_id: subscriptionId, updated_at: new Date().toISOString() }).eq('church_id', churchId)
  }
  return 'processed'
}

async function onSubscription(admin: Admin, event: StripeEventLike, deps: EventDeps): Promise<EventOutcome> {
  const sub = event.data.object
  const now = deps.now ?? new Date()
  const row = await subscriptionByCustomer(admin, id(sub?.customer))
  if (!row) return 'ignored'
  if (isStale(row, event)) return 'ignored'

  // Un ancien abonnement (résilié, remplacé) ne doit pas écraser l'actuel
  const subId = id(sub)
  if (row.stripe_subscription_id && subId !== row.stripe_subscription_id && event.type !== 'customer.subscription.created') return 'ignored'

  const price = sub?.items?.data?.[0]?.price
  const parsed = parseLookupKey(price?.lookup_key)
  if (!parsed) return 'ignored' // prix qui n'est pas de Comora

  const church = await churchOf(admin, row.church_id)
  if (!church) return 'ignored'

  const status: string = event.type === 'customer.subscription.deleted' ? 'canceled' : String(sub?.status ?? '')
  const churchPatch: Record<string, unknown> = {}

  switch (status) {
    case 'active':
    case 'trialing':
      churchPatch.billing_status = 'active' // le déclencheur de la base efface grâce et suppression programmée
      churchPatch.offer = parsed.offer
      break
    case 'past_due':
      churchPatch.billing_status = 'past_due'
      churchPatch.offer = parsed.offer
      churchPatch.grace_ends_at = church.billing_status === 'past_due' && church.grace_ends_at ? church.grace_ends_at : plusDays(now, GRACE_DAYS)
      break
    case 'canceled':
      churchPatch.billing_status = 'canceled'
      churchPatch.deletion_scheduled_at = church.deletion_scheduled_at ?? plusDays(now, RETENTION_DAYS)
      break
    case 'unpaid':
    case 'paused':
      churchPatch.billing_status = 'read_only'
      churchPatch.deletion_scheduled_at = church.deletion_scheduled_at ?? plusDays(now, RETENTION_DAYS)
      break
    default:
      // incomplete, incomplete_expired : le premier paiement n'a pas abouti, l'église garde son état
      break
  }

  await admin
    .from('subscriptions')
    .update({
      stripe_subscription_id: id(sub) ?? row.stripe_subscription_id,
      offer: parsed.offer,
      billing_interval: parsed.interval,
      founder_price: parsed.founder,
      status,
      current_period_end: periodEnd(sub),
      cancel_at_period_end: sub?.cancel_at_period_end === true,
      last_event_at: new Date(event.created * 1000).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('church_id', row.church_id)
  if (Object.keys(churchPatch).length > 0) await admin.from('churches').update(churchPatch).eq('id', row.church_id)

  if (parsed.offer === 'signature' && status === 'active' && row.offer !== 'signature') {
    await deps.notifySignature?.({ churchId: church.id, churchName: church.name, interval: parsed.interval })
  }
  return 'processed'
}

async function onPaymentFailed(admin: Admin, event: StripeEventLike, deps: EventDeps): Promise<EventOutcome> {
  const invoice = event.data.object
  const row = await subscriptionByCustomer(admin, id(invoice?.customer))
  if (!row || isStale(row, event)) return 'ignored'
  const subscriptionId = invoiceSubscriptionId(invoice)
  if (!subscriptionId || subscriptionId !== row.stripe_subscription_id) return 'ignored'

  const church = await churchOf(admin, row.church_id)
  // Seule une église qui payait passe en impayé : un premier paiement refusé ne lui retire rien
  if (!church || church.billing_status !== 'active') return 'ignored'

  const now = deps.now ?? new Date()
  await admin.from('churches').update({ billing_status: 'past_due', grace_ends_at: plusDays(now, GRACE_DAYS) }).eq('id', church.id)
  await admin.from('subscriptions').update({ last_event_at: new Date(event.created * 1000).toISOString(), updated_at: now.toISOString() }).eq('church_id', church.id)
  return 'processed'
}

async function onInvoicePaid(admin: Admin, event: StripeEventLike): Promise<EventOutcome> {
  const invoice = event.data.object
  const row = await subscriptionByCustomer(admin, id(invoice?.customer))
  if (!row || isStale(row, event)) return 'ignored'
  const subscriptionId = invoiceSubscriptionId(invoice)
  if (!subscriptionId || subscriptionId !== row.stripe_subscription_id) return 'ignored'

  const church = await churchOf(admin, row.church_id)
  if (!church || church.billing_status === 'active') return 'ignored'

  await admin.from('churches').update({ billing_status: 'active' }).eq('id', church.id)
  await admin.from('subscriptions').update({ last_event_at: new Date(event.created * 1000).toISOString(), updated_at: new Date().toISOString() }).eq('church_id', church.id)
  return 'processed'
}
