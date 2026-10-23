import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleStripeEvent } from '@/lib/billing/events'
import { getStripe } from '@/lib/billing/stripe'
import { sendSignatureSubscribedEmail } from '@/lib/email/espace'

/*
 * Webhook Stripe. La signature est vérifiée sur le corps BRUT (avant tout JSON.parse) ;
 * sans signature valide, rien n'est lu. Le traitement est idempotent (voir lib/billing/events.ts) :
 * Stripe peut renvoyer ou désordonner ses événements sans effet de bord.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  const signature = req.headers.get('stripe-signature')
  if (!secret || !signature) return new Response('Bad request', { status: 400 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    // Clé secrète : événement signé par Stripe, sans session ; l'église est retrouvée par le client Stripe.
    const outcome = await handleStripeEvent(createAdminClient(), event, {
      notifySignature: async ({ churchName, interval }) => {
        try {
          await sendSignatureSubscribedEmail({ churchName, interval })
        } catch {
          console.error('[stripe/webhook] alerte Signature non envoyée')
        }
      },
    })
    return Response.json({ received: true, outcome })
  } catch (error) {
    // 500 : Stripe renverra l'événement plus tard
    console.error('[stripe/webhook] traitement impossible :', (error as Error).message)
    return new Response('Webhook handler failed', { status: 500 })
  }
}
