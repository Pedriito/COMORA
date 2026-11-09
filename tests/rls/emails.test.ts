import { describe, expect, it } from "vitest";
import { anonClient, serviceClient, signedInClient } from "./local-supabase";

/*
 * Journal des e-mails de cycle de vie : réservation atomique d'un envoi, et table fermée
 * à tout compte (seul le serveur, avec la clé secrète, y accède).
 */

const db = serviceClient();
const run = Math.random().toString(36).slice(2, 8);

async function setup() {
  const { data: church, error } = await db.from("churches").insert({ name: `Église mail ${run}`, slug: `mail-${run}-${Math.random().toString(36).slice(2, 6)}` }).select("id").single();
  if (error) throw new Error(error.message);
  const { client, userId } = await signedInClient(`mail-${run}-${Math.random().toString(36).slice(2, 6)}@example.test`);
  await db.from("church_memberships").insert({ church_id: church.id, user_id: userId, role: "admin" });
  return { churchId: church.id as string, userId, client };
}

const claim = (churchId: string, userId: string, kind: string) =>
  db.rpc("claim_email_send", { p_church_id: churchId, p_user_id: userId, p_kind: kind });

describe("claim_email_send", () => {
  it("accorde la réservation une seule fois par (église, personne, message)", async () => {
    const { churchId, userId } = await setup();
    expect((await claim(churchId, userId, "welcome")).data).toBe(true);
    expect((await claim(churchId, userId, "welcome")).data).toBe(false);
    expect((await claim(churchId, userId, "trial_midway")).data).toBe(true); // autre message
  });

  it("vingt réservations simultanées : une seule l'emporte", async () => {
    const { churchId, userId } = await setup();
    const results = await Promise.all(Array.from({ length: 20 }, () => claim(churchId, userId, "trial_ending_1")));
    expect(results.every((r) => !r.error)).toBe(true);
    expect(results.filter((r) => r.data === true)).toHaveLength(1);
  });

  it("un message déjà envoyé n'est jamais repris, même ancien", async () => {
    const { churchId, userId } = await setup();
    await claim(churchId, userId, "welcome");
    await db.from("email_sends").update({ sent_at: new Date().toISOString(), claimed_at: new Date(Date.now() - 48 * 3600e3).toISOString() }).eq("church_id", churchId).eq("user_id", userId);
    expect((await claim(churchId, userId, "welcome")).data).toBe(false);
  });

  it("une réservation abandonnée depuis plus d'une heure peut être reprise, pas avant", async () => {
    const { churchId, userId } = await setup();
    await claim(churchId, userId, "welcome");
    expect((await claim(churchId, userId, "welcome")).data).toBe(false);
    await db.from("email_sends").update({ claimed_at: new Date(Date.now() - 2 * 3600e3).toISOString() }).eq("church_id", churchId).eq("user_id", userId);
    expect((await claim(churchId, userId, "welcome")).data).toBe(true);
    expect((await claim(churchId, userId, "welcome")).data).toBe(false);
  });

  it("une réservation levée après un échec d'envoi peut être refaite aussitôt", async () => {
    const { churchId, userId } = await setup();
    await claim(churchId, userId, "welcome");
    await db.from("email_sends").delete().eq("church_id", churchId).eq("user_id", userId).is("sent_at", null);
    expect((await claim(churchId, userId, "welcome")).data).toBe(true);
  });

  it("disparaît avec l'église (suppression en cascade)", async () => {
    const { churchId, userId } = await setup();
    await claim(churchId, userId, "welcome");
    await db.from("churches").delete().eq("id", churchId);
    const { data } = await db.from("email_sends").select("id").eq("church_id", churchId);
    expect(data).toEqual([]);
  });
});

describe("accès fermé aux comptes", () => {
  it("un administrateur de l'église ne peut ni lire, ni écrire, ni réserver", async () => {
    const { churchId, userId, client } = await setup();
    await claim(churchId, userId, "welcome");

    const read = await client.from("email_sends").select("id").eq("church_id", churchId);
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
    const insert = await client.from("email_sends").insert({ church_id: churchId, user_id: userId, kind: "forgé" });
    expect(insert.error).not.toBeNull();
    const rpc = await client.rpc("claim_email_send", { p_church_id: churchId, p_user_id: userId, p_kind: "x" });
    expect(rpc.error).not.toBeNull();
    expect((await db.from("email_sends").select("kind").eq("church_id", churchId)).data).toEqual([{ kind: "welcome" }]);
  });

  it("un visiteur anonyme non plus", async () => {
    const { churchId, userId } = await setup();
    const anon = anonClient();
    expect((await anon.rpc("claim_email_send", { p_church_id: churchId, p_user_id: userId, p_kind: "x" })).error).not.toBeNull();
    const read = await anon.from("email_sends").select("id");
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
  });
});
