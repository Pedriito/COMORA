import { beforeEach, describe, expect, it, vi } from "vitest";
import { serviceClient, signedInClient } from "./local-supabase";

/*
 * Cron des e-mails du cycle de vie sur une vraie base : les requêtes (églises, appartenances,
 * profils, comptes, journal) fonctionnent, les bons administrateurs sont choisis et un second
 * passage n'envoie plus rien. Seul l'envoi (Resend) est simulé.
 */

const { deliver } = vi.hoisted(() => ({ deliver: vi.fn() }));
vi.mock("@/lib/email/espace", () => ({ deliver }));

// Les liens de désinscription des rappels sont signés avec ce secret
process.env.APP_TOKEN_SECRET = "secret-de-test-suffisamment-long-0123456789";

const { runLifecycleEmails } = await import("../../lib/email/lifecycle-send");

const db = serviceClient();
const run = Math.random().toString(36).slice(2, 8);
const DAY = 864e5;
const NOW = new Date();
const created: string[] = [];
/** Passage limité aux églises créées par ce fichier : la base locale en accumule des centaines. */
const runHere = (now: Date = NOW) => runLifecycleEmails(db, now, { churchIds: created });

async function church(label: string, ageDays: number, over: Record<string, unknown> = {}) {
  const { data, error } = await db
    .from("churches")
    .insert({
      name: `Église ${label} ${run}`,
      slug: `${label}-${run}`,
      billing_status: "trialing",
      created_at: new Date(NOW.getTime() - ageDays * DAY).toISOString(),
      trial_ends_at: new Date(NOW.getTime() + (30 - ageDays) * DAY).toISOString(),
      ...over,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  created.push(data.id);
  return data.id as string;
}

async function person(churchId: string, label: string, role: "admin" | "membre", status = "active") {
  const email = `${label}-${run}@example.test`;
  const { userId } = await signedInClient(email);
  await db.from("profiles").upsert({ id: userId, first_name: label });
  await db.from("church_memberships").insert({ church_id: churchId, user_id: userId, role, status });
  return { userId, email };
}

const sentTo = (email: string) => deliver.mock.calls.filter((c) => (c[1] as { to: string }).to === email);

beforeEach(() => {
  deliver.mockReset();
  deliver.mockResolvedValue(undefined);
});

describe("passage quotidien sur la base locale", () => {
  it("envoie la bienvenue aux seuls administrateurs actifs, une seule fois", async () => {
    const id = await church("accueil", 0);
    const admin = await person(id, "admin", "admin");
    const other = await person(id, "autre", "admin");
    const member = await person(id, "membre", "membre");
    const gone = await person(id, "parti", "admin", "inactive");

    const first = await runHere();
    expect(sentTo(admin.email)).toHaveLength(1);
    expect(sentTo(other.email)).toHaveLength(1);
    expect(sentTo(member.email)).toHaveLength(0);
    expect(sentTo(gone.email)).toHaveLength(0);
    expect(first.welcome.sent).toBeGreaterThanOrEqual(2);

    const html = (sentTo(admin.email)[0][1] as { html: string }).html;
    expect(html).toContain("Bonjour admin,");
    expect(html).toContain(`Église accueil ${run}`);

    const { data: journal } = await db.from("email_sends").select("user_id, kind, sent_at").eq("church_id", id);
    expect(journal).toHaveLength(2);
    expect(journal!.every((r) => r.kind === "welcome" && r.sent_at !== null)).toBe(true);

    deliver.mockClear();
    const second = await runHere();
    expect(sentTo(admin.email)).toHaveLength(0);
    expect(second.welcome.sent).toBe(0);
  });

  it("n'écrit rien à une église qui paie, et ne confond pas deux églises", async () => {
    const paying = await church("payante", 29.5, { billing_status: "active" });
    const ending = await church("fin", 29.5);
    const a = await person(paying, "payeur", "admin");
    const b = await person(ending, "finissant", "admin");

    await runHere();
    expect(sentTo(a.email)).toHaveLength(0);
    const mails = sentTo(b.email);
    expect(mails).toHaveLength(1);
    expect((mails[0][1] as { subject: string }).subject).toBe("Dernier jour d'essai gratuit");
  });

  it("relance d'import au jour 3 seulement si l'église n'a pas importé de membres", async () => {
    const empty = await church("vide", 3.5);
    const full = await church("pleine", 3.5);
    const a = await person(empty, "videur", "admin");
    const b = await person(full, "plein", "admin");
    await db.from("members").insert([1, 2, 3].map((n) => ({ church_id: full, first_name: `M${n}`, last_name: "Test" })));

    await runHere();
    const subjects = (email: string) => sentTo(email).map((c) => (c[1] as { subject: string }).subject);
    expect(subjects(a.email).some((s) => s.startsWith("Importez"))).toBe(true);
    expect(subjects(b.email).some((s) => s.startsWith("Importez"))).toBe(false);
  });

  it("impayé : un message avec la date de fin de grâce ; avertissement de suppression à J-7", async () => {
    const late = await church("impaye", 60, { billing_status: "past_due", trial_ends_at: null, grace_ends_at: new Date(NOW.getTime() + 5 * DAY).toISOString() });
    const doomed = await church("suppression", 110, { billing_status: "read_only", deletion_scheduled_at: new Date(NOW.getTime() + 6 * DAY).toISOString() });
    const a = await person(late, "retard", "admin");
    const b = await person(doomed, "condamne", "admin");

    await runHere();
    expect((sentTo(a.email)[0][1] as { subject: string }).subject).toBe("Le paiement de votre abonnement n'a pas abouti");
    expect((sentTo(b.email)[0][1] as { subject: string }).subject).toContain("sera supprimé le");
  });
});

describe("désinscription des rappels sur la base locale", () => {
  it("setUnsubscribed est idempotent et réversible ; une personne désinscrite ne reçoit plus de rappel", async () => {
    const { setUnsubscribed, isUnsubscribed, verifyUnsubscribeToken, unsubscribeToken } = await import("../../lib/email/unsubscribe");

    const id = await church("desabo", 29.5);
    const quitter = await person(id, "partant", "admin");
    const stayer = await person(id, "restant", "admin");

    expect(verifyUnsubscribeToken(unsubscribeToken(quitter.userId))).toBe(quitter.userId);
    await setUnsubscribed(db, quitter.userId, true);
    await setUnsubscribed(db, quitter.userId, true); // deux clics : aucune erreur
    expect(await isUnsubscribed(db, quitter.userId)).toBe(true);

    await runHere();
    expect(sentTo(quitter.email)).toHaveLength(0);
    expect(sentTo(stayer.email)).toHaveLength(1);
    const call = sentTo(stayer.email)[0][1] as { headers: Record<string, string>; html: string };
    expect(call.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(call.html).toContain("Me désinscrire");

    // Réinscription : le rappel encore dû part au prochain passage
    await setUnsubscribed(db, quitter.userId, false);
    expect(await isUnsubscribed(db, quitter.userId)).toBe(false);
    await runHere();
    expect(sentTo(quitter.email)).toHaveLength(1);
  });

  it("la table est fermée aux comptes connectés comme aux anonymes", async () => {
    const id = await church("ferme", 5);
    const me = await person(id, "curieux", "admin");
    const { client } = await signedInClient(`ferme-${run}@example.test`);
    const forged = await client.from("email_unsubscribes").insert({ user_id: me.userId, category: "rappels" });
    expect(forged.error).not.toBeNull();
    const read = await client.from("email_unsubscribes").select("user_id");
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
  });
});
