import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => ({ current: null as null | { from: (table: string) => { insert: typeof insert } } }));

vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => client.current }));

const { requestAccess } = await import("@/app/(site)/actions");
const { waitlistMessages } = await import("@/lib/waitlist");

function form(entries: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  }
  return data;
}

const valid = {
  eglise: "Église du Centre",
  ville: "Lyon",
  pays: "Suisse",
  nom: "Marie Dupont",
  email: "marie@exemple.fr",
  taille: "100 à 500",
  multi_sites: "on",
  ministeres: ["Enfants", "Accueil"],
  source: "newsletter",
};

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
  client.current = { from: () => ({ insert }) };
});

describe("Server Action « Demander mon accès »", () => {
  it("enregistre le profil complet de l'église", async () => {
    const state = await requestAccess({ status: "idle" }, form(valid));
    expect(state).toEqual({ status: "success", message: waitlistMessages.success });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pays: "Suisse",
        taille: "100 à 500",
        multi_sites: true,
        visio: false,
        ministeres: ["Enfants", "Accueil"],
        source: "newsletter",
      }),
    );
  });

  it("renvoie les champs invalides et la saisie", async () => {
    const state = await requestAccess({ status: "idle" }, form({ ...valid, pays: "" }));
    expect(state).toMatchObject({ status: "error", invalid: ["pays"], values: { eglise: "Église du Centre" } });
    expect(insert).not.toHaveBeenCalled();
  });

  it("le champ piège fait croire au robot que c'est passé", async () => {
    const state = await requestAccess({ status: "idle" }, form({ ...valid, site_web: "spam.example" }));
    expect(state.status).toBe("success");
    expect(insert).not.toHaveBeenCalled();
  });

  it("prévient quand Supabase n'est pas configuré", async () => {
    client.current = null;
    expect(await requestAccess({ status: "idle" }, form(valid))).toMatchObject({
      status: "error",
      message: waitlistMessages.unavailable,
    });
  });

  it("prévient quand la base refuse l'insertion", async () => {
    insert.mockResolvedValue({ error: { code: "42501", message: "denied" } });
    expect(await requestAccess({ status: "idle" }, form(valid))).toMatchObject({
      status: "error",
      message: waitlistMessages.failed,
    });
  });
});
