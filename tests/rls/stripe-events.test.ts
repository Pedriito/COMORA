import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleStripeEvent, type StripeEventLike } from "../../lib/billing/events";
import { serviceClient } from "./local-supabase";

/*
 * Événements Stripe appliqués à une vraie base : du paiement à l'état de l'église.
 * Les événements sont fabriqués ici (même forme que ceux de Stripe) ; la signature du
 * webhook est testée à part (app/api/stripe/webhook/route.test.ts).
 */

const db = serviceClient();
const run = Math.random().toString(36).slice(2, 8);
const DAY = 864e5;

let seq = 0;
const eventId = () => `evt_${run}_${++seq}`;
let clock = Math.floor(Date.now() / 1000);
const next = () => ++clock;

type Ctx = { churchId: string; customer: string; subscription: string };

async function church(over: Record<string, unknown> = {}, label = "stripe"): Promise<Ctx> {
  const { data, error } = await db
    .from("churches")
    .insert({ name: `Église ${label}`, slug: `${label}-${run}-${++seq}`, billing_status: "trialing", trial_ends_at: new Date(Date.now() - DAY).toISOString(), ...over })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const customer = `cus_${run}_${seq}`;
  const { error: subError } = await db.from("subscriptions").insert({ church_id: data.id, stripe_customer_id: customer });
  if (subError) throw new Error(subError.message);
  return { churchId: data.id, customer, subscription: `sub_${run}_${seq}` };
}

const subscriptionEvent = (c: Ctx, type: string, over: Record<string, unknown> = {}, lookupKey = "communaute_month", created = next()): StripeEventLike => ({
  id: eventId(),
  type,
  created,
  data: {
    object: {
      id: c.subscription,
      customer: c.customer,
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ price: { lookup_key: lookupKey }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
      ...over,
    },
  },
});

const invoiceEvent = (c: Ctx, type: string, over: Record<string, unknown> = {}, created = next()): StripeEventLike => ({
  id: eventId(),
  type,
  created,
  data: { object: { id: `in_${run}`, customer: c.customer, subscription: c.subscription, ...over } },
});

const churchState = async (id: string) =>
  (await db.from("churches").select("billing_status, offer, grace_ends_at, deletion_scheduled_at").eq("id", id).single()).data!;
const subRow = async (id: string) => (await db.from("subscriptions").select("*").eq("church_id", id).single()).data!;

const notify = vi.fn(async () => {});
const deps = { notifySignature: notify };
beforeEach(() => notify.mockClear());

describe("paiement : de l'essai terminé à l'abonnement actif", () => {
  it("un paiement réussi rouvre l'espace, enregistre l'offre et efface la suppression programmée", async () => {
    const c = await church({ deletion_scheduled_at: new Date(Date.now() + 60 * DAY).toISOString() });
    await db.rpc("church_lifecycle_step");
    expect((await churchState(c.churchId)).billing_status).toBe("read_only");
    expect((await db.rpc("church_is_writable", { p_church: c.churchId })).data).toBe(false);

    const checkout: StripeEventLike = { id: eventId(), type: "checkout.session.completed", created: next(), data: { object: { mode: "subscription", customer: c.customer, subscription: c.subscription, client_reference_id: c.churchId } } };
    expect(await handleStripeEvent(db, checkout, deps)).toBe("processed");
    expect(await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created"), deps)).toBe("processed");

    expect(await churchState(c.churchId)).toMatchObject({ billing_status: "active", offer: "communaute", deletion_scheduled_at: null, grace_ends_at: null });
    expect(await subRow(c.churchId)).toMatchObject({ stripe_subscription_id: c.subscription, offer: "communaute", billing_interval: "month", founder_price: false, status: "active", cancel_at_period_end: false });
    expect((await db.rpc("church_is_writable", { p_church: c.churchId })).data).toBe(true);
    expect(notify).not.toHaveBeenCalled();
  });

  it("lit le prix fondateur et la périodicité annuelle sur le prix réellement facturé", async () => {
    const c = await church();
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created", {}, "essentiel_founder_year"), deps);
    expect(await subRow(c.churchId)).toMatchObject({ offer: "essentiel", billing_interval: "year", founder_price: true });
  });

  it("l'offre Signature prévient l'équipe, une seule fois", async () => {
    const c = await church({}, "signature");
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created", {}, "signature_year"), deps);
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.updated", {}, "signature_year"), deps);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ churchId: c.churchId, interval: "year" }));
  });

  it("un changement d'offre depuis le portail est répercuté", async () => {
    const c = await church();
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created"), deps);
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.updated", {}, "signature_month"), deps);
    expect(await churchState(c.churchId)).toMatchObject({ offer: "signature" });
    expect(notify).toHaveBeenCalledTimes(1);
  });
});

describe("impayé, grâce et reprise", () => {
  it("un paiement refusé ouvre 7 jours de grâce pendant lesquels l'espace reste modifiable", async () => {
    const c = await church();
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created"), deps);
    await handleStripeEvent(db, invoiceEvent(c, "invoice.payment_failed"), deps);

    const state = await churchState(c.churchId);
    expect(state.billing_status).toBe("past_due");
    const days = (new Date(state.grace_ends_at!).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    expect((await db.rpc("church_access", { p_church: c.churchId })).data).toBe("grace");
    expect((await db.rpc("church_is_writable", { p_church: c.churchId })).data).toBe(true);
  });

  it("une nouvelle tentative échouée ne prolonge pas la grâce", async () => {
    const c = await church();
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created"), deps);
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.updated", { status: "past_due" }), deps);
    const first = (await churchState(c.churchId)).grace_ends_at;
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.updated", { status: "past_due" }), deps);
    expect((await churchState(c.churchId)).grace_ends_at).toBe(first);
  });

  it("grâce terminée sans paiement : lecture seule ; le paiement rouvre aussitôt", async () => {
    const c = await church();
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created"), deps);
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.updated", { status: "past_due" }), deps);
    await db.from("churches").update({ grace_ends_at: new Date(Date.now() - 3600e3).toISOString() }).eq("id", c.churchId);
    await db.rpc("church_lifecycle_step");
    expect(await churchState(c.churchId)).toMatchObject({ billing_status: "read_only" });
    expect((await churchState(c.churchId)).deletion_scheduled_at).not.toBeNull();

    await handleStripeEvent(db, invoiceEvent(c, "invoice.paid"), deps);
    expect(await churchState(c.churchId)).toMatchObject({ billing_status: "active", grace_ends_at: null, deletion_scheduled_at: null });
    expect((await db.rpc("church_is_writable", { p_church: c.churchId })).data).toBe(true);
  });

  it("un premier paiement refusé n'enlève rien à une église en essai", async () => {
    const c = await church({ trial_ends_at: new Date(Date.now() + 10 * DAY).toISOString() });
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created", { status: "incomplete" }), deps);
    await handleStripeEvent(db, invoiceEvent(c, "invoice.payment_failed"), deps);
    expect(await churchState(c.churchId)).toMatchObject({ billing_status: "trialing" });
  });
});

describe("résiliation", () => {
  it("résiliation programmée : l'accès reste ouvert jusqu'à la fin de la période payée", async () => {
    const c = await church();
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created"), deps);
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.updated", { cancel_at_period_end: true }), deps);
    expect(await subRow(c.churchId)).toMatchObject({ cancel_at_period_end: true, status: "active" });
    expect(await churchState(c.churchId)).toMatchObject({ billing_status: "active" });
  });

  it("fin de l'abonnement : lecture seule et suppression programmée à +90 jours", async () => {
    const c = await church();
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created"), deps);
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.deleted", { status: "canceled" }), deps);
    const state = await churchState(c.churchId);
    expect(state.billing_status).toBe("canceled");
    const days = (new Date(state.deletion_scheduled_at!).getTime() - Date.now()) / DAY;
    expect(Math.round(days)).toBe(90);
    expect((await db.rpc("church_is_writable", { p_church: c.churchId })).data).toBe(false);
  });

  it("se réabonner après une résiliation rouvre l'espace, et l'ancien abonnement n'y change plus rien", async () => {
    const c = await church();
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created"), deps);
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.deleted", { status: "canceled" }), deps);

    const fresh = { ...c, subscription: `sub_new_${run}_${++seq}` };
    await handleStripeEvent(db, subscriptionEvent(fresh, "customer.subscription.created"), deps);
    expect(await churchState(c.churchId)).toMatchObject({ billing_status: "active", deletion_scheduled_at: null });

    // L'ancien abonnement envoie encore un événement tardif : sans effet
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.deleted", { status: "canceled" }), deps);
    expect(await churchState(c.churchId)).toMatchObject({ billing_status: "active" });
  });
});

describe("fiabilité du webhook", () => {
  it("rejouer deux fois le même événement n'a aucun effet de plus", async () => {
    const c = await church();
    const event = subscriptionEvent(c, "customer.subscription.created", {}, "signature_month");
    expect(await handleStripeEvent(db, event, deps)).toBe("processed");
    await db.from("churches").update({ billing_status: "read_only" }).eq("id", c.churchId); // état modifié ailleurs
    expect(await handleStripeEvent(db, event, deps)).toBe("duplicate");
    expect(await handleStripeEvent(db, event, deps)).toBe("duplicate");
    expect((await churchState(c.churchId)).billing_status).toBe("read_only"); // le rejeu n'a rien réécrit
    expect(notify).toHaveBeenCalledTimes(1);
    const { count } = await db.from("stripe_events").select("id", { count: "exact", head: true }).eq("id", event.id);
    expect(count).toBe(1);
  });

  it("un événement plus ancien que l'état connu est ignoré", async () => {
    const c = await church();
    const recent = next() + 100;
    await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.updated", {}, "communaute_month", recent), deps);
    const outcome = await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.deleted", { status: "canceled" }, "communaute_month", recent - 50), deps);
    expect(outcome).toBe("ignored");
    expect(await churchState(c.churchId)).toMatchObject({ billing_status: "active" });
  });

  it("un événement redélivré après un échec est retraité", async () => {
    const c = await church();
    const event = subscriptionEvent(c, "customer.subscription.created");
    await db.from("stripe_events").insert({ id: event.id, type: event.type }); // reçu mais jamais terminé
    expect(await handleStripeEvent(db, event, deps)).toBe("processed");
    expect((await churchState(c.churchId)).billing_status).toBe("active");
  });

  it("un client inconnu, un prix étranger ou un type inconnu sont ignorés sans rien modifier", async () => {
    const c = await church();
    const unknown = { ...subscriptionEvent(c, "customer.subscription.created"), data: { object: { id: "sub_x", customer: "cus_inconnu", status: "active", items: { data: [{ price: { lookup_key: "communaute_month" } }] } } } };
    expect(await handleStripeEvent(db, unknown, deps)).toBe("ignored");
    expect(await handleStripeEvent(db, subscriptionEvent(c, "customer.subscription.created", {}, "autre_produit"), deps)).toBe("ignored");
    expect(await handleStripeEvent(db, { id: eventId(), type: "charge.refunded", created: next(), data: { object: {} } }, deps)).toBe("ignored");
    expect(await churchState(c.churchId)).toMatchObject({ billing_status: "trialing", offer: null });
  });

  it("une session de paiement qui nomme une autre église n'associe rien", async () => {
    const a = await church({}, "cible");
    const b = await church({}, "autre");
    const forged: StripeEventLike = { id: eventId(), type: "checkout.session.completed", created: next(), data: { object: { mode: "subscription", customer: a.customer, subscription: "sub_pirate", client_reference_id: b.churchId } } };
    expect(await handleStripeEvent(db, forged, deps)).toBe("ignored");
    expect((await subRow(a.churchId)).stripe_subscription_id).toBeNull();
    expect((await subRow(b.churchId)).stripe_subscription_id).toBeNull();
  });

  it("un événement d'une église n'atteint jamais une autre", async () => {
    const a = await church({}, "iso-a");
    const b = await church({}, "iso-b");
    await handleStripeEvent(db, subscriptionEvent(a, "customer.subscription.created", {}, "signature_year"), deps);
    expect(await churchState(b.churchId)).toMatchObject({ billing_status: "trialing", offer: null });
    expect(await subRow(b.churchId)).toMatchObject({ offer: null, status: null });
  });
});

describe("accès aux données de facturation", () => {
  it("le journal des événements est invisible depuis le navigateur", async () => {
    const { anonClient } = await import("./local-supabase");
    const { data } = await anonClient().from("stripe_events").select("*");
    expect(data ?? []).toEqual([]);
  });
});
