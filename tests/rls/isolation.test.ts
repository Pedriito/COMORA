import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { CHURCH_TABLES, OTHER_TABLES, seedChurch, type ChurchFixture, type TableSpec } from "./fixtures";
import { anonClient, serviceClient, signedInClient } from "./local-supabase";

/*
 * Isolation entre églises, vérifiée sur une vraie base (Supabase local) en
 * appelant l'API avec la clé publique et le jeton de chaque compte : c'est
 * exactement ce que pourrait faire un utilisateur malveillant.
 *
 * L'église A attaque l'église B avec son compte le plus puissant (admin
 * ayant aussi le rôle pastoral), puis chaque rôle est vérifié dans sa propre
 * église.
 */

let A: ChurchFixture;
let B: ChurchFixture;
/** Admin de A, avec aussi le rôle pastoral : le compte le plus puissant de A. */
let attacker: SupabaseClient;

const service = () => serviceClient();

async function stillThere(spec: TableSpec, row: Record<string, unknown>) {
  const { data } = await service().from(spec.table).select().eq(spec.key, row[spec.key] as string).single();
  return data as Record<string, unknown> | null;
}

/** Ligne de B recopiée pour une insertion (sans sa clé générée). */
function copyOf(spec: TableSpec, fixture: ChurchFixture) {
  const row = spec.build(fixture);
  if (spec.key !== "id") return row;
  return row;
}

beforeAll(async () => {
  A = await seedChurch("a");
  B = await seedChurch("b");
  // L'admin de A reçoit aussi le rôle pastoral pour attaquer avec tous les droits
  await service().from("church_memberships").update({ is_pastoral: true }).eq("user_id", A.accounts.admin.userId);
  attacker = A.accounts.admin.client;
}, 120_000);

describe("toutes les tables", () => {
  it("ont la RLS activée, et chaque table de l'espace est couverte par ces tests", async () => {
    const { data, error } = await service().rpc("rls_audit");
    expect(error).toBeNull();
    const tables = data as { table_name: string; rls_enabled: boolean; rls_forced: boolean }[];

    expect(tables.filter((t) => !t.rls_enabled).map((t) => t.table_name)).toEqual([]);

    const covered = new Set([...CHURCH_TABLES.map((s) => s.table), ...OTHER_TABLES]);
    expect(tables.map((t) => t.table_name).filter((name) => !covered.has(name))).toEqual([]);

    const espace = tables.filter((t) => !["waitlist", "invitations", "early_access_accounts"].includes(t.table_name));
    expect(espace.filter((t) => !t.rls_forced).map((t) => t.table_name)).toEqual([]);
  });
});

describe.each(CHURCH_TABLES)("isolation : $table", (spec) => {
  it("un compte de A ne lit aucune donnée de B", async () => {
    const { data, error } = await attacker.from(spec.table).select("*").eq("church_id", B.id);
    // Soit aucune ligne, soit un refus d'accès à la table entière (tables réservées au serveur)
    if (error) expect(error.code).toBe("42501");
    else expect(data).toEqual([]);

    const { data: all } = await attacker.from(spec.table).select("church_id");
    expect((all ?? []).every((row) => row.church_id === A.id)).toBe(true);
  });

  it("un compte de A ne crée rien dans B", async () => {
    const { error } = await attacker.from(spec.table).insert(copyOf(spec, B));
    expect(error).not.toBeNull();
  });

  it("un compte de A ne modifie rien dans B", async () => {
    const target = B.rows[spec.table];
    const { data } = await attacker.from(spec.table).update(spec.patch).eq(spec.key, target[spec.key] as string).select();
    expect(data ?? []).toEqual([]);
    expect(await stillThere(spec, target)).toEqual(target);
  });

  it("un compte de A ne supprime rien dans B", async () => {
    const target = B.rows[spec.table];
    const { data } = await attacker.from(spec.table).delete().eq(spec.key, target[spec.key] as string).select();
    expect(data ?? []).toEqual([]);
    expect(await stillThere(spec, target)).not.toBeNull();
  });

  it("un compte de A ne déplace pas une ligne de A vers B", async () => {
    const own = A.rows[spec.table];
    const { error, data } = await attacker
      .from(spec.table)
      .update({ church_id: B.id })
      .eq(spec.key, own[spec.key] as string)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    expect((await stillThere(spec, own))?.church_id).toBe(A.id);
  });

  it("sans compte (clé publique seule), rien n'est lisible ni modifiable", async () => {
    const anon = anonClient();
    const { data } = await anon.from(spec.table).select("*");
    expect(data ?? []).toEqual([]);
    const { error } = await anon.from(spec.table).insert(spec.build(A));
    expect(error).not.toBeNull();
  });
});

describe("rattachement entre églises", () => {
  it("impossible de relier un chant de B à un plan de A", async () => {
    const { error } = await A.accounts.responsable.client
      .from("plan_songs")
      .insert({ church_id: A.id, plan_id: A.rows.plans.id, song_id: B.rows.songs.id });
    expect(error).not.toBeNull();
  });

  it("impossible d'affecter une personne de B à un plan de A", async () => {
    const { error } = await A.accounts.responsable.client
      .from("plan_assignments")
      .insert({ church_id: A.id, plan_id: A.rows.plans.id, member_id: B.accounts.membre.memberId });
    expect(error).not.toBeNull();
  });
});

describe("églises", () => {
  it("chacun ne voit que ses églises", async () => {
    const { data } = await attacker.from("churches").select("id");
    expect(data).toEqual([{ id: A.id }]);
  });

  it("un admin ne modifie pas une autre église", async () => {
    const { data } = await attacker.from("churches").update({ name: "Piratée" }).eq("id", B.id).select();
    expect(data ?? []).toEqual([]);
  });

  it("un admin ne touche ni à l'abonnement ni à l'adresse de son église", async () => {
    for (const patch of [{ billing_status: "active" }, { offer: "signature" }, { is_founder: true }, { slug: "autre" }, { trial_ends_at: "2099-01-01" }]) {
      const { error } = await attacker.from("churches").update(patch).eq("id", A.id);
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
  });

  it("un membre ne renomme pas son église", async () => {
    const { data } = await A.accounts.membre.client.from("churches").update({ name: "X" }).eq("id", A.id).select();
    expect(data ?? []).toEqual([]);
  });
});

describe("rôles dans une église", () => {
  it("la pastorale est invisible pour un admin sans rôle pastoral", async () => {
    await service().from("church_memberships").update({ is_pastoral: false }).eq("user_id", A.accounts.admin.userId);
    try {
      for (const table of ["prayer_requests", "pastoral_notes"]) {
        const { data } = await A.accounts.admin.client.from(table).select("*");
        expect(data, table).toEqual([]);
      }
    } finally {
      await service().from("church_memberships").update({ is_pastoral: true }).eq("user_id", A.accounts.admin.userId);
    }
  });

  it("la pastorale est lisible par le rôle pastoral de l'église", async () => {
    const { data } = await A.accounts.pastoral.client.from("prayer_requests").select("id");
    expect(data).toEqual([{ id: A.rows.prayer_requests.id }]);
  });

  it("un compte de l'équipe Comora ne lit aucune donnée d'église", async () => {
    const { client, userId } = await signedInClient(`plateforme-${Date.now()}@test.comora.fr`);
    await service().from("platform_admins").insert({ user_id: userId });
    for (const spec of CHURCH_TABLES) {
      const { data } = await client.from(spec.table).select("*");
      expect(data ?? [], spec.table).toEqual([]);
    }
  });

  it("un membre ne planifie pas de culte ; un responsable, si", async () => {
    const plan = { church_id: A.id, title: "Culte", service_date: "2027-03-07T09:00:00Z" };
    expect((await A.accounts.membre.client.from("plans").insert(plan)).error).not.toBeNull();
    expect((await A.accounts.responsable.client.from("plans").insert(plan)).error).toBeNull();
  });

  it("un membre confirme sa propre affectation, sans pouvoir changer le reste", async () => {
    const membre = A.accounts.membre.client;
    const id = A.rows.plan_assignments.id as string;
    expect((await membre.from("plan_assignments").update({ status: "confirmed" }).eq("id", id)).error).toBeNull();
    expect((await membre.from("plan_assignments").update({ position_id: A.rows.positions.id }).eq("id", id)).error).not.toBeNull();
  });

  it("un membre ne répond pas à la place d'un autre", async () => {
    const { data: other } = await service()
      .from("plan_assignments")
      .insert({ church_id: A.id, plan_id: A.rows.plans.id, member_id: A.accounts.responsable.memberId })
      .select()
      .single();
    const { data } = await A.accounts.membre.client.from("plan_assignments").update({ status: "declined" }).eq("id", other!.id).select();
    expect(data ?? []).toEqual([]);
  });

  it("les coordonnées d'une personne ne sont visibles que d'elle-même et des responsables", async () => {
    await service().from("member_contacts").insert({ church_id: A.id, member_id: A.accounts.membre.memberId, phone: "0611111111" });
    const { data: forOther } = await A.accounts.pastoral.client.from("member_contacts").select("member_id");
    expect(forOther ?? []).toEqual([]);
    const { data: forSelf } = await A.accounts.membre.client.from("member_contacts").select("member_id");
    expect(forSelf).toEqual([{ member_id: A.accounts.membre.memberId }]);
    const { data: forLead } = await A.accounts.responsable.client.from("member_contacts").select("member_id");
    expect((forLead ?? []).length).toBe(2);
  });

  it("un membre ne se donne pas de droits", async () => {
    const membre = A.accounts.membre;
    const { data } = await membre.client.from("church_memberships").update({ role: "admin" }).eq("user_id", membre.userId).select();
    expect(data ?? []).toEqual([]);
    const { error } = await membre.client.from("church_memberships").insert({ church_id: A.id, user_id: membre.userId, role: "admin" });
    expect(error).not.toBeNull();
  });

  it("un admin ne s'invite pas dans une autre église", async () => {
    const { error } = await attacker.from("church_memberships").insert({ church_id: B.id, user_id: A.accounts.admin.userId, role: "admin" });
    expect(error).not.toBeNull();
  });

  it("une église garde au moins un admin", async () => {
    const { error } = await attacker.from("church_memberships").update({ role: "membre" }).eq("user_id", A.accounts.admin.userId);
    expect(error).not.toBeNull();
  });

  it("les indisponibilités d'un membre ne sont vues que par lui et les responsables", async () => {
    const { data: pastoral } = await A.accounts.pastoral.client.from("blockout_dates").select("id");
    expect(pastoral ?? []).toEqual([]);
    const { data: own } = await A.accounts.membre.client.from("blockout_dates").select("id");
    expect(own).toEqual([{ id: A.rows.blockout_dates.id }]);
  });

  it("les tâches d'une équipe sont réservées à ses membres et aux responsables", async () => {
    const { data: outsider } = await A.accounts.membre.client.from("tasks").select("id");
    expect(outsider ?? []).toEqual([]);
    const { data: lead } = await A.accounts.responsable.client.from("tasks").select("id");
    expect(lead).toEqual([{ id: A.rows.tasks.id }]);
  });
});

describe("profils", () => {
  it("chacun ne lit que son profil", async () => {
    const { data } = await attacker.from("profiles").select("id");
    expect(data).toEqual([{ id: A.accounts.admin.userId }]);
  });

  it("impossible d'ouvrir une église dont on n'est pas membre", async () => {
    const { error } = await attacker.from("profiles").update({ active_church_id: B.id }).eq("id", A.accounts.admin.userId);
    expect(error).not.toBeNull();
    const { error: ok } = await attacker.from("profiles").update({ active_church_id: A.id }).eq("id", A.accounts.admin.userId);
    expect(ok).toBeNull();
  });

  it("impossible de modifier le profil d'un autre", async () => {
    const { data } = await attacker.from("profiles").update({ first_name: "X" }).eq("id", B.accounts.admin.userId).select();
    expect(data ?? []).toEqual([]);
  });
});

describe("notifications push", () => {
  it("chacun ne voit que ses propres appareils", async () => {
    await service().from("push_subscriptions").insert({ user_id: B.accounts.admin.userId, endpoint: "https://push.exemple/b", p256dh: "k", auth: "a" });
    const { data } = await attacker.from("push_subscriptions").select("*");
    expect(data ?? []).toEqual([]);
    const { error } = await attacker.from("push_subscriptions").insert({ user_id: B.accounts.admin.userId, endpoint: "https://push.exemple/x", p256dh: "k", auth: "a" });
    expect(error).not.toBeNull();
  });
});

describe("équipe Comora", () => {
  it("la table des admins de la plateforme est inaccessible depuis l'API", async () => {
    const { data } = await attacker.from("platform_admins").select("*");
    expect(data ?? []).toEqual([]);
    const { error } = await attacker.from("platform_admins").insert({ user_id: A.accounts.admin.userId });
    expect(error).not.toBeNull();
  });
});

describe("site public", () => {
  it("ne révèle que les champs publics de l'église", async () => {
    const { data, error } = await anonClient().rpc("public_church_site", { target_slug: A.slug });
    expect(error).toBeNull();
    expect(Object.keys(data.church).sort()).toEqual(["branding", "id", "name", "slug"]);
    expect(data.settings.tagline).toBe("Bienvenue");
    expect(JSON.stringify(data)).not.toMatch(/billing|offer|trial|marie@exemple/);
  });

  it("renvoie null pour une église inconnue", async () => {
    const { data } = await anonClient().rpc("public_church_site", { target_slug: "inconnue-xyz" });
    expect(data).toBeNull();
  });
});
