import { beforeAll, describe, expect, it } from "vitest";
import { accessState, isWritable, type BillingStatus } from "../../lib/billing/access";
import { CHURCH_TABLES, seedChurch, type ChurchFixture } from "./fixtures";
import { serviceClient } from "./local-supabase";

/*
 * Essai et lecture seule : l'écriture est refusée par la base elle-même (policies
 * restrictives), pour chaque table de l'église, sans jamais toucher à la lecture.
 */

const service = () => serviceClient();
const DAY = 864e5;
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString();
/** Tables laissées volontairement hors de la lecture seule. */
const EXEMPT = new Set(["legal_acceptances", "onboarding_progress", "calendar_feeds", "account_activations"]);

let A: ChurchFixture; // passera en lecture seule
let B: ChurchFixture; // reste en essai : ne doit jamais être touchée

async function setChurch(id: string, patch: Record<string, unknown>) {
  const { error } = await service().from("churches").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

beforeAll(async () => {
  A = await seedChurch("ro-a");
  B = await seedChurch("ro-b");
});

describe("church_access : la base et l'application disent la même chose", () => {
  const cases: Array<{ name: string; patch: { billing_status: BillingStatus; trial_ends_at: string | null; grace_ends_at: string | null } }> = [
    { name: "essai en cours", patch: { billing_status: "trialing", trial_ends_at: iso(10), grace_ends_at: null } },
    { name: "essai sans date", patch: { billing_status: "trialing", trial_ends_at: null, grace_ends_at: null } },
    { name: "essai terminé", patch: { billing_status: "trialing", trial_ends_at: iso(-1), grace_ends_at: null } },
    { name: "abonnement actif", patch: { billing_status: "active", trial_ends_at: iso(-40), grace_ends_at: null } },
    { name: "impayé en période de grâce", patch: { billing_status: "past_due", trial_ends_at: null, grace_ends_at: iso(3) } },
    { name: "impayé, grâce terminée", patch: { billing_status: "past_due", trial_ends_at: null, grace_ends_at: iso(-1) } },
    { name: "impayé sans date de grâce", patch: { billing_status: "past_due", trial_ends_at: null, grace_ends_at: null } },
    { name: "résiliée", patch: { billing_status: "canceled", trial_ends_at: iso(10), grace_ends_at: null } },
    { name: "lecture seule", patch: { billing_status: "read_only", trial_ends_at: iso(10), grace_ends_at: null } },
    { name: "suppression programmée", patch: { billing_status: "pending_deletion", trial_ends_at: iso(10), grace_ends_at: null } },
  ];

  it.each(cases)("$name", async ({ patch }) => {
    await setChurch(A.id, patch);
    const state = accessState({ billingStatus: patch.billing_status, trialEndsAt: patch.trial_ends_at, graceEndsAt: patch.grace_ends_at });
    const { data: access } = await service().rpc("church_access", { p_church: A.id });
    const { data: writable } = await service().rpc("church_is_writable", { p_church: A.id });
    expect(access).toBe(state);
    expect(writable).toBe(isWritable(state));
  });

  it("une église inconnue n'est pas modifiable", async () => {
    const { data } = await service().rpc("church_is_writable", { p_church: "00000000-0000-0000-0000-000000000000" });
    expect(data).toBe(false);
  });

  it("Communauté s'applique pendant l'essai seulement", async () => {
    await setChurch(A.id, { billing_status: "trialing", trial_ends_at: iso(5), offer: null, grace_ends_at: null });
    expect((await service().rpc("church_effective_offer", { p_church: A.id })).data).toBe("communaute");
    await setChurch(A.id, { billing_status: "trialing", trial_ends_at: iso(5), offer: "essentiel" });
    expect((await service().rpc("church_effective_offer", { p_church: A.id })).data).toBe("essentiel");
    await setChurch(A.id, { billing_status: "read_only", offer: null });
    expect((await service().rpc("church_effective_offer", { p_church: A.id })).data).toBeNull();
  });
});

describe("lecture seule : aucune écriture, lecture intacte", () => {
  const tables = CHURCH_TABLES.filter((spec) => !EXEMPT.has(spec.table));
  const counts: Record<string, number> = {};

  beforeAll(async () => {
    await setChurch(A.id, { billing_status: "trialing", trial_ends_at: iso(5), offer: null });
    // Ce que l'administrateur peut lire pendant l'essai
    for (const spec of tables) {
      const { data } = await A.accounts.admin.client.from(spec.table).select("*").eq("church_id", A.id);
      counts[spec.table] = (data ?? []).length;
    }
    await setChurch(A.id, { billing_status: "trialing", trial_ends_at: iso(-1) }); // essai terminé hier
  });

  it.each(tables.map((s) => [s.table, s] as const))("%s : ajout, modification et suppression refusés", async (_name, spec) => {
    const admin = A.accounts.admin.client;
    const row = A.rows[spec.table];

    const insert = await admin.from(spec.table).insert(spec.build(A));
    expect(insert.error, "ajout").not.toBeNull();

    const update = await admin.from(spec.table).update(spec.patch).eq(spec.key, row[spec.key] as string).select();
    expect(update.data ?? [], "modification").toEqual([]);

    const del = await admin.from(spec.table).delete().eq(spec.key, row[spec.key] as string).select();
    expect(del.data ?? [], "suppression").toEqual([]);

    const { data: still } = await service().from(spec.table).select("*").eq(spec.key, row[spec.key] as string).single();
    expect(still).toEqual(row);
  });

  it.each(tables.map((s) => [s.table, s] as const))("%s : la lecture reste identique", async (_name, spec) => {
    const { data } = await A.accounts.admin.client.from(spec.table).select("*").eq("church_id", A.id);
    expect((data ?? []).length).toBe(counts[spec.table]);
  });

  it("l'import de personnes est refusé", async () => {
    const { error } = await A.accounts.admin.client.rpc("import_members", { p_church_id: A.id, p_rows: [{ first_name: "Zoé" }] });
    expect(error).not.toBeNull();
  });

  it("le dépôt de fichiers est refusé, la lecture des fichiers existants reste possible", async () => {
    const file = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
    const refused = await A.accounts.admin.client.storage.from("church-public").upload(`${A.id}/note.png`, file);
    expect(refused.error?.message).toMatch(/row-level security|violates/i);
    const put = await service().storage.from("church-public").upload(`${A.id}/existant.png`, file, { upsert: true });
    expect(put.error).toBeNull();
    const { data, error } = await A.accounts.admin.client.storage.from("church-public").list(A.id);
    expect(error).toBeNull();
    expect((data ?? []).map((f) => f.name)).toContain("existant.png");
  });

  it("un lien d'inscription ne fonctionne plus", async () => {
    const hash = `ro-hash-${Math.random()}`;
    await service().from("invite_tokens").insert({ church_id: A.id, token_hash: hash });
    const { data } = await service().rpc("consume_invite_token", { target_hash: hash });
    expect(data).toBeNull();
    const { data: row } = await service().from("invite_tokens").select("uses_count").eq("token_hash", hash).single();
    expect(row?.uses_count).toBe(0);
  });

  it("ce qui est propre à la personne reste possible : progression du guide, abonnement au calendrier", async () => {
    const { error } = await A.accounts.admin.client.from("onboarding_progress").upsert({ church_id: A.id, skipped: ["team"] });
    expect(error).toBeNull();
    const { error: feed } = await A.accounts.membre.client
      .from("calendar_feeds")
      .insert({ church_id: A.id, user_id: A.accounts.membre.userId, token_hash: `ro-feed-${Math.random()}` });
    expect(feed).toBeNull();
  });

  it("le profil de la personne et le changement d'église ne sont pas bloqués", async () => {
    const { error } = await A.accounts.admin.client.from("profiles").update({ first_name: "Camille" }).eq("id", A.accounts.admin.userId);
    expect(error).toBeNull();
  });

  it("l'autre église n'est pas affectée", async () => {
    const { error } = await B.accounts.admin.client.from("church_settings").update({ tagline: "Toujours ouverte" }).eq("church_id", B.id);
    expect(error).toBeNull();
    const { data } = await service().from("church_settings").select("tagline").eq("church_id", B.id).single();
    expect(data?.tagline).toBe("Toujours ouverte");
  });

  it("tout redevient possible dès que l'église a un abonnement actif", async () => {
    await setChurch(A.id, { billing_status: "active" });
    const { error } = await A.accounts.admin.client.from("church_settings").update({ tagline: "Réouverte" }).eq("church_id", A.id);
    expect(error).toBeNull();
    const { data } = await service().from("church_settings").select("tagline").eq("church_id", A.id).single();
    expect(data?.tagline).toBe("Réouverte");
    const upload = await A.accounts.admin.client.storage.from("church-public").upload(`${A.id}/note.png`, new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }));
    expect(upload.error).toBeNull();
  });
});

describe("church_lifecycle_step : passage en lecture seule et conservation de 90 jours", () => {
  async function newChurch(label: string, patch: Record<string, unknown>) {
    const { data, error } = await service().from("churches").insert({ name: label, slug: `${label}-${Math.random().toString(36).slice(2, 8)}`, ...patch }).select("id").single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }
  const read = async (id: string) => (await service().from("churches").select("billing_status, deletion_scheduled_at, grace_ends_at").eq("id", id).single()).data!;

  it("programme la suppression à la fin de l'essai + 90 jours, une seule fois", async () => {
    const ended = iso(-2);
    const expired = await newChurch("lc-expire", { billing_status: "trialing", trial_ends_at: ended });
    const running = await newChurch("lc-cours", { billing_status: "trialing", trial_ends_at: iso(10) });
    const paying = await newChurch("lc-paye", { billing_status: "active", trial_ends_at: iso(-40) });

    const first = (await service().rpc("church_lifecycle_step")).data as { trials_ended: number };
    expect(first.trials_ended).toBeGreaterThanOrEqual(1);

    const a = await read(expired);
    expect(a.billing_status).toBe("read_only");
    expect(new Date(a.deletion_scheduled_at!).getTime()).toBe(new Date(ended).getTime() + 90 * DAY);
    expect(await read(running)).toMatchObject({ billing_status: "trialing", deletion_scheduled_at: null });
    expect(await read(paying)).toMatchObject({ billing_status: "active", deletion_scheduled_at: null });

    await service().rpc("church_lifecycle_step"); // idempotent
    expect((await read(expired)).deletion_scheduled_at).toBe(a.deletion_scheduled_at);
  });

  it("une grâce expirée passe en lecture seule, une grâce en cours reste ouverte", async () => {
    const lapsed = await newChurch("lc-grace-finie", { billing_status: "past_due", grace_ends_at: iso(-1) });
    const open = await newChurch("lc-grace-ouverte", { billing_status: "past_due", grace_ends_at: iso(3) });
    await service().rpc("church_lifecycle_step");
    expect(await read(lapsed)).toMatchObject({ billing_status: "read_only" });
    expect((await read(lapsed)).deletion_scheduled_at).not.toBeNull();
    expect(await read(open)).toMatchObject({ billing_status: "past_due", deletion_scheduled_at: null });
  });

  it("le paiement annule la suppression programmée", async () => {
    const id = await newChurch("lc-reprise", { billing_status: "trialing", trial_ends_at: iso(-3) });
    await service().rpc("church_lifecycle_step");
    expect((await read(id)).deletion_scheduled_at).not.toBeNull();
    await setChurch(id, { billing_status: "active" });
    expect(await read(id)).toMatchObject({ billing_status: "active", deletion_scheduled_at: null, grace_ends_at: null });
  });

  it("n'est pas appelable depuis un compte connecté", async () => {
    const { error } = await A.accounts.admin.client.rpc("church_lifecycle_step");
    expect(error).not.toBeNull();
  });

  it("un administrateur ne peut pas prolonger son essai ni rouvrir son église", async () => {
    for (const patch of [{ trial_ends_at: "2099-01-01T00:00:00Z" }, { billing_status: "active" }, { deletion_scheduled_at: null }, { grace_ends_at: "2099-01-01T00:00:00Z" }]) {
      const { error } = await B.accounts.admin.client.from("churches").update(patch).eq("id", B.id);
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
  });
});
