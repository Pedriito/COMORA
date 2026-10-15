import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeStore } from "../support/fake-store";

const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeStore> | null }));
const sendEmail = vi.hoisted(() => vi.fn(async () => ({ ok: true })));

vi.mock("@/lib/admin/store", () => fake.current!.store);
vi.mock("@/lib/email/send", () => ({ sendEmail }));

fake.current = createFakeStore();
const { acceptRequest } = await import("@/lib/admin/decisions");
const { checkInvitation, createAccount, signupMessages } = await import("@/lib/signup");

const db = fake.current;
const password = "un-bon-mot-de-passe";

async function acceptedToken() {
  const request = db.addRequest();
  const result = await acceptRequest(request.id);
  if (!result.ok || !result.link) throw new Error("acceptation impossible");
  return { request, token: result.link.split("/inscription/")[1] };
}

beforeEach(() => {
  db.requests.clear();
  db.invitations.length = 0;
  db.profiles.length = 0;
  db.users.length = 0;
});

describe("création de compte depuis l'invitation", () => {
  it("crée l'utilisateur, son profil et consomme le lien", async () => {
    const { request, token } = await acceptedToken();
    const result = await createAccount(token, { nom: " Marie Dupont ", password, confirm: password });

    expect(result).toEqual({ status: "success", email: "marie@exemple.fr" });
    expect(db.users).toEqual([{ id: "user-1", email: "marie@exemple.fr", password }]);
    expect(db.profiles).toEqual([
      { id: "user-1", waitlist_id: request.id, nom: "Marie Dupont", eglise: "Église du Centre", role: "Pasteur" },
    ]);
    expect(await checkInvitation(token)).toEqual({ ok: false, reason: "used" });
  });

  it("refuse un lien déjà utilisé", async () => {
    const { token } = await acceptedToken();
    await createAccount(token, { nom: "Marie", password, confirm: password });
    expect(await createAccount(token, { nom: "Marie", password, confirm: password })).toEqual({
      status: "error",
      message: signupMessages.used,
    });
    expect(db.users).toHaveLength(1);
  });

  it("refuse un lien expiré", async () => {
    const { token } = await acceptedToken();
    db.invitations[0].expires_at = new Date(Date.now() - 1000).toISOString();
    expect(await checkInvitation(token)).toEqual({ ok: false, reason: "expired" });
    expect((await createAccount(token, { nom: "Marie", password, confirm: password })).status).toBe("error");
    expect(db.users).toHaveLength(0);
  });

  it("refuse un lien inconnu ou mal formé", async () => {
    expect(await checkInvitation("x".repeat(43))).toEqual({ ok: false, reason: "invalid" });
    expect(await checkInvitation("../../admin")).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuse un lien dont la demande n'est plus acceptée", async () => {
    const { request, token } = await acceptedToken();
    db.requests.set(request.id, { ...request, statut: "refusee" });
    expect(await checkInvitation(token)).toEqual({ ok: false, reason: "invalid" });
  });

  it("vérifie le nom et le mot de passe avant de toucher au lien", async () => {
    const { token } = await acceptedToken();
    expect(await createAccount(token, { nom: "  ", password, confirm: password })).toMatchObject({ field: "nom" });
    expect(await createAccount(token, { nom: "Marie", password: "court", confirm: "court" })).toMatchObject({
      field: "password",
    });
    expect(await createAccount(token, { nom: "Marie", password, confirm: `${password}!` })).toMatchObject({
      field: "confirm",
    });
    expect(db.users).toHaveLength(0);
    expect((await checkInvitation(token)).ok).toBe(true);
  });

  it("compte existant : message clair, lien consommé", async () => {
    const { token } = await acceptedToken();
    db.users.push({ id: "user-0", email: "marie@exemple.fr", password: "x" });
    expect(await createAccount(token, { nom: "Marie", password, confirm: password })).toEqual({
      status: "error",
      message: signupMessages.exists,
    });
  });

  it("échec technique : le lien redevient utilisable", async () => {
    const { token } = await acceptedToken();
    db.store.createUser.mockResolvedValueOnce({ ok: false, reason: "failed" } as never);
    expect((await createAccount(token, { nom: "Marie", password, confirm: password })).status).toBe("error");
    expect((await checkInvitation(token)).ok).toBe(true);
  });
});
