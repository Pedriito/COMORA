import { beforeAll, describe, expect, it } from "vitest";
import { OFFERS, OFFER_LIMITS } from "../../lib/offers";
import { accessState } from "../../lib/billing/access";
import { seedChurch, type ChurchFixture } from "./fixtures";
import { anonClient, serviceClient } from "./local-supabase";

/*
 * Limites par offre : la base elle-même refuse l'ajout au-delà de la limite, même par un appel
 * direct à l'API. Une église déjà au-dessus (rétrogradation) garde ses données.
 */

const service = () => serviceClient();
const DAY = 864e5;

async function setChurch(id: string, patch: Record<string, unknown>) {
  const { error } = await service().from("churches").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

const subscribe = (id: string, offer: string) => setChurch(id, { billing_status: "active", offer, is_solidarity: false });

async function activeMembers(churchId: string) {
  const { count } = await service().from("members").select("id", { count: "exact", head: true }).eq("church_id", churchId).neq("status", "inactive");
  return count ?? 0;
}

/** Complète l'église jusqu'à `target` membres comptés. */
async function fillMembers(churchId: string, target: number) {
  const missing = target - (await activeMembers(churchId));
  if (missing <= 0) return;
  const rows = Array.from({ length: missing }, (_, i) => ({ church_id: churchId, first_name: `Personne${i}`, last_name: "Test" }));
  const { error } = await service().from("members").insert(rows);
  if (error) throw new Error(error.message);
}

const addMember = (churchId: string, name = "Nouveau") => service().from("members").insert({ church_id: churchId, first_name: name, last_name: "Test" });

describe("offer_limits : la base et lib/offers.ts disent la même chose", () => {
  it.each(OFFERS)("%s", async offer => {
    const { data } = await service().from("offer_limits").select().eq("offer", offer).single();
    const l = OFFER_LIMITS[offer];
    expect(data).toMatchObject({
      max_members: l.maxMembers,
      max_admins: l.maxAdmins,
      public_site: l.publicSite,
      custom_branding: l.customBranding,
      custom_domain: l.customDomain,
      multi_site: l.multiSite,
      advanced_roles: l.advancedRoles,
    });
  });

  it("personne ne peut modifier les limites", async () => {
    const A = await seedChurch("lim-write");
    const { error } = await A.accounts.admin.client.from("offer_limits").update({ max_members: 100000 }).eq("offer", "essentiel");
    expect(error).not.toBeNull();
    const { data } = await service().from("offer_limits").select("max_members").eq("offer", "essentiel").single();
    expect(data?.max_members).toBe(100);
  });
});

describe("limite de membres (Essentiel : 100)", () => {
  let A: ChurchFixture;
  beforeAll(async () => {
    A = await seedChurch("lim-m");
    await subscribe(A.id, "essentiel");
  });

  it("99 → 100 accepté, 101 refusé", async () => {
    await fillMembers(A.id, 99);
    expect((await addMember(A.id, "Cent")).error).toBeNull();
    expect(await activeMembers(A.id)).toBe(100);
    const { error } = await addMember(A.id, "CentUn");
    expect(error?.message).toContain("limite_membres");
    expect(await activeMembers(A.id)).toBe(100);
  });

  it("modifier une personne existante reste possible à la limite", async () => {
    const { error } = await service().from("members").update({ first_name: "Renommé" }).eq("id", A.accounts.membre.memberId);
    expect(error).toBeNull();
  });

  it("une personne désactivée ne compte pas, et la réactiver est refusé si l'église est pleine", async () => {
    await service().from("members").update({ status: "inactive" }).eq("id", A.accounts.membre.memberId);
    expect(await activeMembers(A.id)).toBe(99);
    expect((await addMember(A.id, "Remplaçant")).error).toBeNull();
    const { error } = await service().from("members").update({ status: "active" }).eq("id", A.accounts.membre.memberId);
    expect(error?.message).toContain("limite_membres");
  });

  it("une personne invitée qui active son compte ne change pas le total", async () => {
    await service().from("members").update({ status: "invited" }).eq("id", A.accounts.responsable.memberId);
    const { error } = await service().from("members").update({ status: "active" }).eq("id", A.accounts.responsable.memberId);
    expect(error).toBeNull();
  });

  it("deux ajouts en même temps ne dépassent pas la limite ensemble", async () => {
    const B = await seedChurch("lim-race");
    await subscribe(B.id, "essentiel");
    await fillMembers(B.id, 98);
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => addMember(B.id, `Course${i}`)));
    expect(results.filter(r => !r.error)).toHaveLength(2);
    expect(await activeMembers(B.id)).toBe(100);
  });

  it("l'import refuse le fichier en entier, et l'accepte juste sous la limite", async () => {
    const C = await seedChurch("lim-import");
    await subscribe(C.id, "essentiel");
    await fillMembers(C.id, 98);
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ first_name: `Import${i}`, last_name: "X", email: `imp${i}-${C.slug}@exemple.fr` }));

    const refused = await C.accounts.admin.client.rpc("import_members", { p_church_id: C.id, p_rows: rows(3) });
    expect(refused.error?.message).toContain("limite_membres");
    expect(await activeMembers(C.id)).toBe(98); // rien d'importé

    const accepted = await C.accounts.admin.client.rpc("import_members", { p_church_id: C.id, p_rows: rows(2) });
    expect(accepted.error).toBeNull();
    expect(accepted.data).toMatchObject({ imported: 2 });
    expect(await activeMembers(C.id)).toBe(100);
  });

  it("Communauté : 500, Signature : illimité", async () => {
    const D = await seedChurch("lim-big");
    await subscribe(D.id, "communaute");
    await fillMembers(D.id, 500);
    expect((await addMember(D.id)).error?.message).toContain("limite_membres");
    await subscribe(D.id, "signature");
    expect((await addMember(D.id)).error).toBeNull();
  });

  it("pendant l'essai, les limites de Communauté s'appliquent", async () => {
    const E = await seedChurch("lim-trial");
    await setChurch(E.id, { billing_status: "trialing", trial_ends_at: new Date(Date.now() + 10 * DAY).toISOString(), offer: null });
    await fillMembers(E.id, 101);
    expect((await addMember(E.id)).error).toBeNull();
  });

  it("rétrogradation : rien n'est supprimé, seul l'ajout est refusé", async () => {
    const F = await seedChurch("lim-down");
    await subscribe(F.id, "signature");
    await fillMembers(F.id, 130);
    await subscribe(F.id, "essentiel");
    expect(await activeMembers(F.id)).toBe(130);
    expect((await addMember(F.id)).error?.message).toContain("limite_membres");
    // On peut toujours retirer des personnes, puis ajouter de nouveau sous la limite
    const { data: rows } = await service().from("members").select("id").eq("church_id", F.id).like("first_name", "Personne%").limit(31);
    await service().from("members").delete().in("id", rows!.map(r => r.id));
    expect(await activeMembers(F.id)).toBe(99);
    expect((await addMember(F.id)).error).toBeNull();
  });

  it("une autre église n'est jamais comptée", async () => {
    const G = await seedChurch("lim-other");
    await subscribe(G.id, "essentiel");
    expect((await addMember(G.id)).error).toBeNull();
  });
});

describe("limite d'administrateurs (Essentiel : 3)", () => {
  let A: ChurchFixture;
  beforeAll(async () => {
    A = await seedChurch("lim-a");
    await subscribe(A.id, "essentiel");
  });

  it("le 4e administrateur (actif ou invité) est refusé", async () => {
    const promote = (user: string, status = "active") => service().from("church_memberships").update({ role: "admin", status }).eq("church_id", A.id).eq("user_id", user);
    expect((await promote(A.accounts.responsable.userId)).error).toBeNull();
    expect((await promote(A.accounts.membre.userId, "invited")).error).toBeNull();
    const { error } = await promote(A.accounts.pastoral.userId);
    expect(error?.message).toContain("limite_administrateurs");
  });

  it("modifier un administrateur existant reste possible", async () => {
    const { error } = await service().from("church_memberships").update({ is_pastoral: true }).eq("church_id", A.id).eq("user_id", A.accounts.admin.userId);
    expect(error).toBeNull();
  });

  it("retirer un droit d'administration libère une place", async () => {
    await service().from("church_memberships").update({ role: "responsable" }).eq("church_id", A.id).eq("user_id", A.accounts.responsable.userId);
    const { error } = await service().from("church_memberships").update({ role: "admin" }).eq("church_id", A.id).eq("user_id", A.accounts.pastoral.userId);
    expect(error).toBeNull();
  });

  it("Communauté : administrateurs illimités", async () => {
    await subscribe(A.id, "communaute");
    const { error } = await service().from("church_memberships").update({ role: "admin" }).eq("church_id", A.id).eq("user_id", A.accounts.responsable.userId);
    expect(error).toBeNull();
  });
});

describe("site public selon l'offre", () => {
  const site = async (slug: string) => (await anonClient().rpc("public_church_site", { target_slug: slug })).data as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any

  it("Essentiel : le site n'est pas publié, rien d'autre que le nom n'est exposé", async () => {
    const A = await seedChurch("site-ess");
    await subscribe(A.id, "essentiel");
    const data = await site(A.slug);
    expect(data?.published).toBe(false);
    expect(data?.church).toEqual({ name: expect.any(String), slug: A.slug });
    expect(data?.settings).toBeUndefined();
    expect(data?.schedules).toBeUndefined();
  });

  it("Communauté : publié, sans couleurs personnalisées", async () => {
    const A = await seedChurch("site-com");
    await subscribe(A.id, "communaute");
    await setChurch(A.id, { branding: { primary: "#ff0000" } });
    const data = await site(A.slug);
    expect(data?.published).toBe(true);
    expect(data?.church.branding).toEqual({});
    expect(data?.settings).toBeDefined();
  });

  it("Signature : publié, avec les couleurs de l'église", async () => {
    const A = await seedChurch("site-sig");
    await subscribe(A.id, "signature");
    await setChurch(A.id, { branding: { primary: "#ff0000" } });
    const data = await site(A.slug);
    expect(data?.published).toBe(true);
    expect(data?.church.branding).toEqual({ primary: "#ff0000" });
  });

  it("pendant l'essai, le site est publié", async () => {
    const A = await seedChurch("site-trial");
    await setChurch(A.id, { billing_status: "trialing", trial_ends_at: new Date(Date.now() + 10 * DAY).toISOString(), offer: null });
    expect((await site(A.slug))?.published).toBe(true);
  });

  it("une église solidaire (Essentiel) n'a pas de site public", async () => {
    const A = await seedChurch("site-sol");
    await setChurch(A.id, { billing_status: "active", offer: "essentiel", is_solidarity: true });
    expect((await site(A.slug))?.published).toBe(false);
  });

  it("un slug inconnu donne rien", async () => {
    expect(await site("n-existe-pas-du-tout")).toBeNull();
  });
});

describe("tarif solidaire", () => {
  it("la demande et la validation ne passent que par le serveur", async () => {
    const A = await seedChurch("sol-perm");
    const admin = A.accounts.admin.client;
    expect((await admin.from("churches").update({ is_solidarity: true }).eq("id", A.id)).error).not.toBeNull();
    expect((await admin.from("churches").update({ solidarity_requested_at: new Date().toISOString() }).eq("id", A.id)).error).not.toBeNull();
    expect((await admin.rpc("approve_solidarity", { p_church: A.id })).error).not.toBeNull();
    expect((await admin.rpc("revoke_solidarity", { p_church: A.id })).error).not.toBeNull();
    expect((await anonClient().rpc("approve_solidarity", { p_church: A.id })).error).not.toBeNull();
    const { data } = await service().from("churches").select("is_solidarity").eq("id", A.id).single();
    expect(data?.is_solidarity).toBe(false);
  });

  it("sans demande, rien n'est accordé", async () => {
    const A = await seedChurch("sol-nodemand");
    const { data } = await service().rpc("approve_solidarity", { p_church: A.id });
    expect(data).toMatchObject({ ok: false, error: "not_requested" });
  });

  it("accordé sous 30 membres : Essentiel gratuit, accès actif", async () => {
    const A = await seedChurch("sol-ok");
    await setChurch(A.id, { solidarity_requested_at: new Date().toISOString() });
    expect((await service().rpc("approve_solidarity", { p_church: A.id })).data).toEqual({ ok: true });
    expect((await service().rpc("church_effective_offer", { p_church: A.id })).data).toBe("essentiel");
    expect((await service().rpc("church_access", { p_church: A.id })).data).toBe("active");
  });

  it("refusé à partir de 30 membres", async () => {
    const A = await seedChurch("sol-big");
    await fillMembers(A.id, 30);
    await setChurch(A.id, { solidarity_requested_at: new Date().toISOString() });
    expect((await service().rpc("approve_solidarity", { p_church: A.id })).data).toMatchObject({ ok: false, error: "too_many_members" });
  });

  describe("à 30 membres, 30 jours pour choisir une offre", () => {
    let A: ChurchFixture;
    beforeAll(async () => {
      A = await seedChurch("sol-30");
      await setChurch(A.id, { solidarity_requested_at: new Date().toISOString() });
      await service().rpc("approve_solidarity", { p_church: A.id });
    });

    const exceededAt = async () => (await service().from("churches").select("solidarity_exceeded_at").eq("id", A.id).single()).data?.solidarity_exceeded_at as string | null;

    it("29 membres : aucune échéance", async () => {
      await fillMembers(A.id, 29);
      expect(await exceededAt()).toBeNull();
    });

    it("le 30e membre démarre l'échéance ; l'espace reste ouvert", async () => {
      await addMember(A.id, "Trentieme");
      expect(await exceededAt()).not.toBeNull();
      expect((await service().rpc("church_access", { p_church: A.id })).data).toBe("active");
    });

    it("le compte à rebours ne repart pas à chaque ajout", async () => {
      const first = await exceededAt();
      await addMember(A.id, "Trente-et-un");
      expect(await exceededAt()).toBe(first);
    });

    it("après 30 jours sans offre : lecture seule, la base refuse les écritures", async () => {
      await setChurch(A.id, { solidarity_exceeded_at: new Date(Date.now() - 31 * DAY).toISOString() });
      const { data } = await service().rpc("church_access", { p_church: A.id });
      expect(data).toBe("read_only");
      expect(accessState({ billingStatus: "active", trialEndsAt: null, isSolidarity: true, solidarityExceededAt: new Date(Date.now() - 31 * DAY) })).toBe("read_only");
      const { error } = await A.accounts.admin.client.from("teams").insert({ church_id: A.id, name: `Refusée ${Math.random()}` });
      expect(error).not.toBeNull();
    });

    it("repasser sous 30 membres supprime l'échéance", async () => {
      await setChurch(A.id, { solidarity_exceeded_at: new Date().toISOString() });
      const { data: rows } = await service().from("members").select("id").eq("church_id", A.id).like("first_name", "Personne%").limit(3);
      await service().from("members").delete().in("id", rows!.map(r => r.id));
      expect(await exceededAt()).toBeNull();
      expect((await service().rpc("church_access", { p_church: A.id })).data).toBe("active");
    });

    it("l'application et la base disent la même chose avant 30 jours", async () => {
      await setChurch(A.id, { solidarity_exceeded_at: new Date(Date.now() - 29 * DAY).toISOString() });
      const { data } = await service().rpc("church_access", { p_church: A.id });
      expect(data).toBe("active");
      expect(accessState({ billingStatus: "active", trialEndsAt: null, isSolidarity: true, solidarityExceededAt: new Date(Date.now() - 29 * DAY) })).toBe("active");
    });
  });

  it("le retrait redonne à l'église l'état de son essai", async () => {
    const A = await seedChurch("sol-revoke");
    await setChurch(A.id, { solidarity_requested_at: new Date().toISOString() });
    await service().rpc("approve_solidarity", { p_church: A.id });
    await service().rpc("revoke_solidarity", { p_church: A.id });
    const { data } = await service().from("churches").select("is_solidarity, billing_status, offer, solidarity_requested_at").eq("id", A.id).single();
    expect(data).toMatchObject({ is_solidarity: false, billing_status: "trialing", offer: null, solidarity_requested_at: null });
  });
});
