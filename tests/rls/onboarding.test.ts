import { beforeAll, describe, expect, it } from "vitest";
import { seedChurch, type ChurchFixture } from "./fixtures";
import { serviceClient } from "./local-supabase";

/*
 * Démarrage guidé : import des personnes (fonction import_members) et progression.
 * L'import tourne avec les droits de l'appelant : la RLS reste la seule barrière.
 */

let A: ChurchFixture;
let B: ChurchFixture;
const service = () => serviceClient();

const rows = (...r: Array<Record<string, string>>) => r;
const people = [
  { first_name: "Léa", last_name: "Martin", email: "lea@exemple.fr", phone: "06 12 34 56 78", city: "Lyon", birthdate: "1985-03-14" },
  { first_name: "Samuel", last_name: "", email: "", phone: "", city: "", birthdate: "" },
];

beforeAll(async () => {
  A = await seedChurch("onb-a");
  B = await seedChurch("onb-b");
});

async function count(churchId: string) {
  const { count: n } = await service().from("members").select("id", { count: "exact", head: true }).eq("church_id", churchId);
  return n ?? 0;
}

describe("import_members", () => {
  it("l'administrateur importe en une fois, contacts compris, sans compte ni e-mail envoyé", async () => {
    const before = await count(A.id);
    const { data, error } = await A.accounts.admin.client.rpc("import_members", { p_church_id: A.id, p_rows: people });
    expect(error).toBeNull();
    expect(data).toEqual({ imported: 2, skipped: 0 });
    expect(await count(A.id)).toBe(before + 2);

    const { data: lea } = await service().from("members").select("id, user_id, status, church_id").eq("church_id", A.id).eq("first_name", "Léa").single();
    expect(lea).toMatchObject({ user_id: null, status: "active", church_id: A.id });
    const { data: contact } = await service().from("member_contacts").select("email, phone, city, birthdate").eq("member_id", lea!.id).single();
    expect(contact).toEqual({ email: "lea@exemple.fr", phone: "06 12 34 56 78", city: "Lyon", birthdate: "1985-03-14" });
  });

  it("ignore les adresses déjà connues de l'église, sans tenir compte de la casse", async () => {
    const { data } = await A.accounts.admin.client.rpc("import_members", {
      p_church_id: A.id,
      p_rows: rows({ first_name: "Léa", last_name: "Bis", email: "LEA@Exemple.fr" }, { first_name: "Nouvelle", last_name: "", email: "nouvelle@exemple.fr" }),
    });
    expect(data).toEqual({ imported: 1, skipped: 1 });
  });

  it("une même adresse peut exister dans deux églises différentes", async () => {
    const { data, error } = await B.accounts.admin.client.rpc("import_members", { p_church_id: B.id, p_rows: rows({ first_name: "Léa", email: "lea@exemple.fr" }) });
    expect(error).toBeNull();
    expect(data).toEqual({ imported: 1, skipped: 0 });
  });

  it("refuse un responsable, un membre et un administrateur d'une autre église", async () => {
    const before = await count(A.id);
    for (const client of [A.accounts.responsable.client, A.accounts.membre.client, B.accounts.admin.client]) {
      const { error } = await client.rpc("import_members", { p_church_id: A.id, p_rows: rows({ first_name: "Intrus", email: "intrus@exemple.fr" }) });
      expect(error?.code).toBe("42501");
    }
    expect(await count(A.id)).toBe(before);
  });

  it("n'est pas appelable sans être connecté", async () => {
    const { anonClient } = await import("./local-supabase");
    const { error } = await anonClient().rpc("import_members", { p_church_id: A.id, p_rows: rows({ first_name: "X" }) });
    expect(error).not.toBeNull();
  });

  it("annule tout si une ligne est invalide (une seule transaction)", async () => {
    const before = await count(A.id);
    const { error } = await A.accounts.admin.client.rpc("import_members", {
      p_church_id: A.id,
      p_rows: rows({ first_name: "Valide", email: "valide@exemple.fr" }, { first_name: "" }),
    });
    expect(error).not.toBeNull();
    expect(await count(A.id)).toBe(before);
  });

  it("refuse plus de 2000 lignes", async () => {
    const tooMany = Array.from({ length: 2001 }, (_, i) => ({ first_name: `P${i}` }));
    const { error } = await A.accounts.admin.client.rpc("import_members", { p_church_id: A.id, p_rows: tooMany });
    expect(error?.code).toBe("22023");
  });
});

describe("onboarding_progress", () => {
  it("l'administrateur lit et écrit la progression de son église", async () => {
    const admin = A.accounts.admin.client;
    const { error } = await admin.from("onboarding_progress").upsert({ church_id: A.id, skipped: ["team"] });
    expect(error).toBeNull();
    const { data } = await admin.from("onboarding_progress").select("skipped").eq("church_id", A.id).single();
    expect(data?.skipped).toEqual(["team"]);
  });

  it("refuse une étape inconnue", async () => {
    const { error } = await A.accounts.admin.client.from("onboarding_progress").upsert({ church_id: A.id, skipped: ["autre"] });
    expect(error).not.toBeNull();
  });

  it("n'est ni lisible ni modifiable par un responsable, un membre ou une autre église", async () => {
    for (const client of [A.accounts.responsable.client, A.accounts.membre.client, B.accounts.admin.client]) {
      const { data } = await client.from("onboarding_progress").select("*").eq("church_id", A.id);
      expect(data).toEqual([]);
      const { error } = await client.from("onboarding_progress").upsert({ church_id: A.id, skipped: ["import"] });
      expect(error).not.toBeNull();
    }
    const { data } = await service().from("onboarding_progress").select("skipped").eq("church_id", A.id).single();
    expect(data?.skipped).toEqual(["team"]);
  });
});
