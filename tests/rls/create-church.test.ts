import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, serviceClient, signedInClient } from "./local-supabase";

/*
 * Création d'un espace : fonction create_church(), réservée au serveur.
 * Vérifie ce qu'elle crée, ses refus, et que le navigateur ne peut pas l'appeler.
 */

const service = () => serviceClient();
const run = Math.random().toString(36).slice(2, 8);
const FUTURE = new Date(Date.now() + 30 * 864e5).toISOString();

type Result = { ok: boolean; error?: string; church_id?: string; slug?: string };

async function create(userId: string, over: Record<string, unknown> = {}): Promise<Result> {
  const { data, error } = await service().rpc("create_church", {
    p_user_id: userId,
    p_name: "Église de la Source",
    p_slug: `source-${run}-${Math.random().toString(36).slice(2, 6)}`,
    p_city: "Lyon",
    p_country: "FR",
    p_size_bracket: "30_100",
    p_is_founder: true,
    p_trial_ends_at: FUTURE,
    p_cgv_version: "v-test",
    p_privacy_version: "v-test",
    ...over,
  });
  if (error) throw new Error(error.message);
  return data as Result;
}

async function newUser(label: string, confirmed = true) {
  const { data, error } = await service().auth.admin.createUser({
    email: `${label}-${run}@test.comora.fr`,
    password: `Mot-de-passe-${run}-Aa1!`,
    email_confirm: confirmed,
    user_metadata: { first_name: "Camille", last_name: "Martin" },
  });
  if (error || !data.user) throw new Error(error?.message);
  return data.user.id;
}

let creator: string;

beforeAll(async () => {
  creator = await newUser("createur");
});

describe("create_church", () => {
  it("crée l'église, son administrateur et les acceptations légales en une fois", async () => {
    const result = await create(creator, { p_slug: `complete-${run}` });
    expect(result).toMatchObject({ ok: true, slug: `complete-${run}` });
    const churchId = result.church_id!;

    const { data: church } = await service().from("churches").select("*").eq("id", churchId).single();
    expect(church).toMatchObject({
      name: "Église de la Source", city: "Lyon", country: "FR", size_bracket: "30_100",
      billing_status: "trialing", is_founder: true, is_solidarity: false, offer: null,
    });
    expect(new Date(church!.trial_ends_at).toISOString()).toBe(FUTURE);

    const { data: membership } = await service().from("church_memberships").select("role, status, is_pastoral").eq("church_id", churchId).eq("user_id", creator).single();
    expect(membership).toEqual({ role: "admin", status: "active", is_pastoral: false });

    const { data: member } = await service().from("members").select("first_name, last_name, status").eq("church_id", churchId).eq("user_id", creator).single();
    expect(member).toEqual({ first_name: "Camille", last_name: "Martin", status: "active" });

    const { data: contact } = await service().from("member_contacts").select("email, city").eq("church_id", churchId).single();
    expect(contact).toEqual({ email: `createur-${run}@test.comora.fr`, city: "Lyon" });

    const { data: profile } = await service().from("profiles").select("active_church_id").eq("id", creator).single();
    expect(profile?.active_church_id).toBe(churchId);

    const { data: acceptances } = await service().from("legal_acceptances").select("document, version, user_id").eq("church_id", churchId).order("document");
    expect(acceptances).toEqual([
      { document: "cgv", version: "v-test", user_id: creator },
      { document: "confidentialite", version: "v-test", user_id: creator },
    ]);

    const { data: settings } = await service().from("church_settings").select("address_city").eq("church_id", churchId).single();
    expect(settings?.address_city).toBe("Lyon");
  });

  it("l'espace créé est visible de son administrateur seulement", async () => {
    const { client, userId } = await signedInClient(`admin2-${run}@test.comora.fr`);
    const result = await create(userId, { p_slug: `visible-${run}` });
    const { data } = await client.from("churches").select("id");
    expect(data).toEqual([{ id: result.church_id }]);
    // ... y compris ses acceptations légales
    const { data: legal } = await client.from("legal_acceptances").select("document");
    expect((legal ?? []).length).toBe(2);
    // Un autre compte ne voit rien de cet espace
    const other = await signedInClient(`autre-${run}@test.comora.fr`);
    expect((await other.client.from("churches").select("id")).data).toEqual([]);
    expect((await other.client.from("legal_acceptances").select("id")).data).toEqual([]);
  });

  it("marque la fin d'essai et le statut fondateur tels que le serveur les décide", async () => {
    const user = await newUser("non-fondateur");
    const result = await create(user, { p_slug: `standard-${run}`, p_is_founder: false });
    const { data } = await service().from("churches").select("is_founder").eq("id", result.church_id!).single();
    expect(data?.is_founder).toBe(false);
  });

  it("refuse une adresse déjà prise, sans créer de doublon", async () => {
    const user = await newUser("doublon");
    const slug = `prise-${run}`;
    expect((await create(user, { p_slug: slug })).ok).toBe(true);
    const second = await create(await newUser("doublon2"), { p_slug: slug });
    expect(second).toEqual({ ok: false, error: "slug_taken" });
    const { count } = await service().from("churches").select("id", { count: "exact", head: true }).eq("slug", slug);
    expect(count).toBe(1);
  });

  it("l'unicité des adresses ne dépend pas de la casse", async () => {
    const slug = `casse-${run}`;
    expect((await create(await newUser("casse1"), { p_slug: slug })).ok).toBe(true);
    // Contourne la validation de la fonction : c'est la base elle-même qui doit refuser
    const { error } = await service().from("churches").insert({ name: "Doublon", slug: slug.toUpperCase() });
    expect(error?.code).toBe("23505");
  });

  it("refuse un compte dont l'e-mail n'est pas vérifié, sans rien créer", async () => {
    const user = await newUser("non-verifie", false);
    const slug = `nonverifie-${run}`;
    expect(await create(user, { p_slug: slug })).toEqual({ ok: false, error: "email_not_confirmed" });
    const { count } = await service().from("churches").select("id", { count: "exact", head: true }).eq("slug", slug);
    expect(count).toBe(0);
  });

  it("refuse un compte inconnu, une adresse ou un nom invalides", async () => {
    expect(await create("00000000-0000-0000-0000-00000000dead", { p_slug: `inconnu-${run}` })).toEqual({ ok: false, error: "unknown_user" });
    const user = await newUser("invalide");
    for (const slug of ["Ab", "ab", "-abc", "abc-", "a b c", "é-glise", "x".repeat(70)]) {
      expect((await create(user, { p_slug: slug })).error, slug).toBe("invalid_slug");
    }
    expect((await create(user, { p_slug: `nom-${run}`, p_name: "   " })).error).toBe("invalid_name");
    expect((await create(user, { p_slug: `nom2-${run}`, p_name: "x".repeat(161) })).error).toBe("invalid_name");
  });

  it("limite à trois espaces administrés par compte", async () => {
    const user = await newUser("serie");
    for (let i = 0; i < 3; i++) expect((await create(user, { p_slug: `serie-${run}-${i}` })).ok).toBe(true);
    expect(await create(user, { p_slug: `serie-${run}-4` })).toEqual({ ok: false, error: "too_many" });
  });

  it("annule tout en cas d'échec : aucune église à moitié créée", async () => {
    const user = await newUser("atomique");
    // Taille hors liste : refusée par la contrainte de la table, après le début de la transaction
    const { error } = await service().rpc("create_church", {
      p_user_id: user, p_name: "Église X", p_slug: `atomique-${run}`, p_city: "Lyon", p_country: "FR",
      p_size_bracket: "énorme", p_is_founder: false, p_trial_ends_at: FUTURE, p_cgv_version: "v", p_privacy_version: "v",
    });
    expect(error).not.toBeNull();
    const { count } = await service().from("churches").select("id", { count: "exact", head: true }).eq("slug", `atomique-${run}`);
    expect(count).toBe(0);
    // Ni appartenance, ni acceptation légale, ni église active laissées derrière
    const { count: memberships } = await service().from("church_memberships").select("id", { count: "exact", head: true }).eq("user_id", user);
    expect(memberships).toBe(0);
    const { data: profile } = await service().from("profiles").select("active_church_id").eq("id", user).single();
    expect(profile?.active_church_id).toBeNull();
  });
});

describe("accès depuis le navigateur", () => {
  const args = (userId: string) => ({
    p_user_id: userId, p_name: "Pirate", p_slug: `pirate-${run}`, p_city: "X", p_country: "FR", p_size_bracket: "lt30",
    p_is_founder: true, p_trial_ends_at: "2099-01-01T00:00:00Z", p_cgv_version: "v", p_privacy_version: "v",
  });

  it("un compte connecté ne peut pas appeler create_church (ni se déclarer fondateur)", async () => {
    const { client, userId } = await signedInClient(`pirate-${run}@test.comora.fr`);
    const { error } = await client.rpc("create_church", args(userId));
    expect(error).not.toBeNull();
    const { count } = await service().from("churches").select("id", { count: "exact", head: true }).eq("slug", `pirate-${run}`);
    expect(count).toBe(0);
  });

  it("sans compte, l'appel est refusé aussi", async () => {
    const { error } = await anonClient().rpc("create_church", args("00000000-0000-0000-0000-000000000000"));
    expect(error).not.toBeNull();
  });

  it("un administrateur ne peut ni écrire ni effacer les acceptations légales", async () => {
    const { client, userId } = await signedInClient(`legal-${run}@test.comora.fr`);
    const created = await create(userId, { p_slug: `legal-${run}` });
    expect((await client.from("legal_acceptances").insert({ church_id: created.church_id, document: "cgv", version: "fausse" })).error).not.toBeNull();
    expect((await client.from("legal_acceptances").update({ version: "fausse" }).eq("church_id", created.church_id).select()).data ?? []).toEqual([]);
    expect((await client.from("legal_acceptances").delete().eq("church_id", created.church_id).select()).data ?? []).toEqual([]);
    const { count } = await service().from("legal_acceptances").select("id", { count: "exact", head: true }).eq("church_id", created.church_id);
    expect(count).toBe(2);
  });
});
