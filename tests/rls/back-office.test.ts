import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, serviceClient, signedInClient } from "./local-supabase";
import { seedChurch, type ChurchFixture } from "./fixtures";
import { totpCode } from "./totp";

/*
 * Back-office des fondateurs : qui y entre, ce qu'il montre, ce qu'il modifie, ce qu'il journalise.
 * Les sessions « en deux étapes » sont de vraies sessions aal2 : une application d'authentification
 * est simulée avec le calcul TOTP standard.
 */

const db = serviceClient();
const run = Math.random().toString(36).slice(2, 8);
const DAY = 864e5;
let seq = 0;

async function platformAdmin({ secondFactor }: { secondFactor: boolean }) {
  const { client, userId } = await signedInClient(`equipe-${run}-${++seq}@test.comora.fr`);
  await db.from("platform_admins").insert({ user_id: userId });
  await db.from("profiles").upsert({ id: userId, first_name: "Fondatrice" });
  if (secondFactor) {
    const { data: enrolled, error } = await client.auth.mfa.enroll({ factorType: "totp" });
    if (error || !enrolled) throw new Error(`Inscription TOTP : ${error?.message}`);
    const { data: challenge } = await client.auth.mfa.challenge({ factorId: enrolled.id });
    const { error: verifyError } = await client.auth.mfa.verify({ factorId: enrolled.id, challengeId: challenge!.id, code: totpCode(enrolled.totp.secret) });
    if (verifyError) throw new Error(`Vérification TOTP : ${verifyError.message}`);
  }
  return client;
}

async function church(over: Record<string, unknown> = {}) {
  const { data, error } = await db
    .from("churches")
    .insert({ name: `Église bo ${run}-${++seq}`, slug: `bo-${run}-${seq}`, billing_status: "trialing", trial_ends_at: new Date(Date.now() + 5 * DAY).toISOString(), ...over })
    .select("id, slug")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; slug: string };
}

const auditFor = async (churchId: string) => (await db.from("platform_audit_log").select("*").eq("church_id", churchId).order("created_at")).data ?? [];

let team: Awaited<ReturnType<typeof platformAdmin>>;
let teamNoSecondFactor: Awaited<ReturnType<typeof platformAdmin>>;
let A: ChurchFixture;

beforeAll(async () => {
  team = await platformAdmin({ secondFactor: true });
  teamNoSecondFactor = await platformAdmin({ secondFactor: false });
  A = await seedChurch(`bo${run}`);
}, 60_000);

const ALL_CALLS = (client: { rpc: typeof team.rpc }, churchId: string) => [
  ["platform_list_churches", client.rpc("platform_list_churches")],
  ["platform_overview", client.rpc("platform_overview")],
  ["platform_audit_recent", client.rpc("platform_audit_recent")],
  ["platform_extend_trial", client.rpc("platform_extend_trial", { p_church: churchId, p_days: 7 })],
  ["platform_approve_solidarity", client.rpc("platform_approve_solidarity", { p_church: churchId })],
  ["platform_revoke_solidarity", client.rpc("platform_revoke_solidarity", { p_church: churchId })],
] as const;

describe("accès : équipe Comora en deux étapes uniquement", () => {
  it("un visiteur anonyme est refusé partout", async () => {
    const target = await church();
    for (const [name, call] of ALL_CALLS(anonClient() as never, target.id)) {
      expect((await call).error, name).not.toBeNull();
    }
  });

  it("l'administrateur d'une église n'y accède pas, même connecté", async () => {
    const target = await church();
    for (const [name, call] of ALL_CALLS(A.accounts.admin.client as never, target.id)) {
      const { error } = await call;
      expect(error?.code, name).toBe("42501");
    }
    expect(await auditFor(target.id)).toEqual([]);
  });

  it("un compte de l'équipe sans deuxième étape est refusé, et rien n'est modifié", async () => {
    const target = await church();
    for (const [name, call] of ALL_CALLS(teamNoSecondFactor as never, target.id)) {
      const { error } = await call;
      expect(error?.code, name).toBe("42501");
      expect(error?.hint, name).toBe("mfa_required");
    }
    const { data } = await db.from("churches").select("trial_ends_at, billing_status").eq("id", target.id).single();
    expect(data!.billing_status).toBe("trialing");
    expect(await auditFor(target.id)).toEqual([]);
  });

  it("avec la deuxième étape, l'équipe accède aux fonctions", async () => {
    expect((await team.rpc("platform_overview")).error).toBeNull();
    expect((await team.rpc("platform_list_churches")).error).toBeNull();
  });

  it("même en deux étapes, l'équipe ne lit aucune table d'église ni le journal directement", async () => {
    for (const table of ["churches", "members", "member_contacts", "prayer_requests", "pastoral_notes", "platform_audit_log", "email_sends"]) {
      const { data } = await team.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
    expect((await team.from("platform_audit_log").insert({ action: "extend_trial", church_slug: "x" })).error).not.toBeNull();
  });
});

describe("lectures : compteurs et métadonnées, aucune donnée de personne", () => {
  const CHURCH_KEYS = [
    "access", "billing_interval", "billing_status", "created_at", "founder_price", "id", "is_founder", "is_solidarity",
    "last_activity_at", "member_count", "name", "offer", "slug", "solidarity_requested_at", "subscription_status", "trial_ends_at",
  ];
  const PERSONAL = ["Durand", "marie@exemple.fr", "0600000000", "Sujet confidentiel", "Note confidentielle", "@"];

  it("la liste des églises n'a que les champs prévus et aucune donnée de membre", async () => {
    const { data, error } = await team.rpc("platform_list_churches", { p_limit: 1000 });
    expect(error).toBeNull();
    const rows = data as Array<Record<string, unknown>>;
    const mine = rows.find((r) => r.id === A.id)!;
    expect(mine).toBeDefined();
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(CHURCH_KEYS);
    const text = JSON.stringify(rows);
    for (const needle of PERSONAL) expect(text, needle).not.toContain(needle);
  });

  it("compte les membres actifs de l'église, et seulement les siens", async () => {
    const { data } = await team.rpc("platform_list_churches", { p_limit: 1000 });
    const mine = (data as Array<{ id: string; member_count: number }>).find((r) => r.id === A.id)!;
    const { count } = await db.from("members").select("id", { count: "exact", head: true }).eq("church_id", A.id).neq("status", "inactive");
    expect(mine.member_count).toBe(count);
    expect(mine.member_count).toBeGreaterThan(0);
  });

  it("l'aperçu ne donne que des nombres et la répartition des abonnements", async () => {
    const paying = await church({ billing_status: "active", offer: "communaute" });
    await db.from("subscriptions").insert({ church_id: paying.id, stripe_customer_id: `cus_bo_${run}`, offer: "communaute", billing_interval: "year", founder_price: true, status: "active" });
    const { data, error } = await team.rpc("platform_overview");
    expect(error).toBeNull();
    const overview = data as { churches: number; by_status: Record<string, number>; subscriptions: Array<{ offer: string; interval: string; founder: boolean; count: number }>; solidarity: number; solidarity_requests: number };
    expect(Object.keys(overview).sort()).toEqual(["by_status", "churches", "solidarity", "solidarity_requests", "subscriptions"]);
    expect(overview.subscriptions.find((s) => s.offer === "communaute" && s.interval === "year" && s.founder)!.count).toBeGreaterThanOrEqual(1);
    const text = JSON.stringify(overview);
    for (const needle of PERSONAL) expect(text, needle).not.toContain(needle);
  });
});

describe("prolonger un essai", () => {
  it("ajoute les jours à la fin actuelle, journalise, et garde l'église en essai", async () => {
    const end = new Date(Date.now() + 5 * DAY);
    const target = await church({ trial_ends_at: end.toISOString() });
    const { data, error } = await team.rpc("platform_extend_trial", { p_church: target.id, p_days: 14 });
    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true });

    const { data: after } = await db.from("churches").select("billing_status, trial_ends_at").eq("id", target.id).single();
    expect(after!.billing_status).toBe("trialing");
    expect(new Date(after!.trial_ends_at!).getTime()).toBeCloseTo(end.getTime() + 14 * DAY, -4);

    const log = await auditFor(target.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "extend_trial", church_slug: target.slug });
    expect(log[0].admin_user_id).toBeTruthy();
    expect(log[0].details).toMatchObject({ days: 14, previous_status: "trialing" });
  });

  it("une église en lecture seule revient en essai, sans suppression programmée", async () => {
    const target = await church({ billing_status: "read_only", trial_ends_at: new Date(Date.now() - 3 * DAY).toISOString(), deletion_scheduled_at: new Date(Date.now() + 80 * DAY).toISOString() });
    const { data } = await team.rpc("platform_extend_trial", { p_church: target.id, p_days: 7 });
    expect(data).toMatchObject({ ok: true });
    const { data: after } = await db.from("churches").select("billing_status, trial_ends_at, deletion_scheduled_at").eq("id", target.id).single();
    expect(after).toMatchObject({ billing_status: "trialing", deletion_scheduled_at: null });
    // Fin passée : on repart d'aujourd'hui, pas de la date dépassée
    expect(new Date(after!.trial_ends_at!).getTime()).toBeCloseTo(Date.now() + 7 * DAY, -4);
    expect((await db.rpc("church_is_writable", { p_church: target.id })).data).toBe(true);
  });

  it("refuse une église qui paie, une église solidaire, une durée hors limites et une église inconnue, sans journal", async () => {
    const paying = await church({ billing_status: "active", offer: "essentiel" });
    const solidarity = await church({ billing_status: "active", is_solidarity: true, offer: "essentiel" });
    const trial = await church();
    expect((await team.rpc("platform_extend_trial", { p_church: paying.id, p_days: 7 })).data).toMatchObject({ ok: false, error: "not_extendable" });
    expect((await team.rpc("platform_extend_trial", { p_church: solidarity.id, p_days: 7 })).data).toMatchObject({ ok: false, error: "not_extendable" });
    for (const days of [0, -5, 91, null]) {
      expect((await team.rpc("platform_extend_trial", { p_church: trial.id, p_days: days })).data, String(days)).toMatchObject({ ok: false, error: "invalid_days" });
    }
    expect((await team.rpc("platform_extend_trial", { p_church: "00000000-0000-4000-8000-000000000000", p_days: 7 })).data).toMatchObject({ ok: false, error: "not_found" });
    for (const c of [paying, solidarity, trial]) expect(await auditFor(c.id)).toEqual([]);
  });
});

describe("tarif solidaire", () => {
  it("valide une demande, journalise, puis le retire", async () => {
    const target = await church({ solidarity_requested_at: new Date().toISOString() });
    expect((await team.rpc("platform_approve_solidarity", { p_church: target.id })).data).toMatchObject({ ok: true });
    expect((await db.from("churches").select("is_solidarity, billing_status, offer").eq("id", target.id).single()).data).toMatchObject({ is_solidarity: true, billing_status: "active", offer: "essentiel" });

    expect((await team.rpc("platform_revoke_solidarity", { p_church: target.id })).data).toMatchObject({ ok: true });
    expect((await db.from("churches").select("is_solidarity").eq("id", target.id).single()).data).toMatchObject({ is_solidarity: false });

    const log = await auditFor(target.id);
    expect(log.map((l) => l.action)).toEqual(["approve_solidarity", "revoke_solidarity"]);
  });

  it("refuse sans demande, au-delà de 30 membres, et le retrait d'une église non solidaire, sans journal", async () => {
    const noRequest = await church();
    expect((await team.rpc("platform_approve_solidarity", { p_church: noRequest.id })).data).toMatchObject({ ok: false, error: "not_requested" });
    expect((await team.rpc("platform_revoke_solidarity", { p_church: noRequest.id })).data).toMatchObject({ ok: false, error: "not_solidarity" });

    const big = await church({ solidarity_requested_at: new Date().toISOString() });
    await db.from("members").insert(Array.from({ length: 30 }, (_, i) => ({ church_id: big.id, first_name: `M${i}`, last_name: "Grand" })));
    expect((await team.rpc("platform_approve_solidarity", { p_church: big.id })).data).toMatchObject({ ok: false, error: "too_many_members" });

    for (const c of [noRequest, big]) expect(await auditFor(c.id)).toEqual([]);
    expect((await team.rpc("platform_approve_solidarity", { p_church: "00000000-0000-4000-8000-000000000000" })).data).toMatchObject({ ok: false, error: "not_found" });
  });
});

describe("journal", () => {
  it("liste les actions récentes avec le prénom de l'auteur et sans autre donnée de personne", async () => {
    const target = await church();
    await team.rpc("platform_extend_trial", { p_church: target.id, p_days: 7 });
    const { data, error } = await team.rpc("platform_audit_recent", { p_limit: 200 });
    expect(error).toBeNull();
    const rows = data as Array<Record<string, unknown>>;
    const mine = rows.find((r) => r.church_slug === target.slug)!;
    expect(Object.keys(mine).sort()).toEqual(["action", "admin_first_name", "church_slug", "created_at", "details", "id"]);
    expect(mine).toMatchObject({ action: "extend_trial", admin_first_name: "Fondatrice" });
    expect(JSON.stringify(mine)).not.toContain("@");
  });

  it("garde la trace d'une action même si l'église est supprimée ensuite", async () => {
    const target = await church();
    await team.rpc("platform_extend_trial", { p_church: target.id, p_days: 7 });
    await db.from("churches").delete().eq("id", target.id);
    const { data } = await db.from("platform_audit_log").select("church_id, church_slug, action").eq("church_slug", target.slug);
    expect(data).toEqual([{ church_id: null, church_slug: target.slug, action: "extend_trial" }]);
  });
});
