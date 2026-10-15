import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, { value: string; options?: Record<string, unknown> }>());
const decisions = vi.hoisted(() => ({
  acceptRequest: vi.fn(async () => ({ ok: true, message: "acceptée", emailSent: true, link: "https://x/inscription/t" })),
  refuseRequest: vi.fn(async () => ({ ok: true, message: "refusée", emailSent: true })),
  resendDecision: vi.fn(async () => ({ ok: true, message: "renvoyé", emailSent: true })),
}));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => jar.set(name, { value, options }),
    delete: (options: { name: string }) => jar.delete(options.name),
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/decisions", () => decisions);

process.env.ADMIN_PASSWORD = "mot-de-passe-de-test-123";
process.env.ADMIN_SESSION_SECRET = "secret-de-test-".repeat(4);

const { decide, login, logout } = await import("@/app/admin/actions");
const { ADMIN_COOKIE } = await import("@/lib/admin/session");

const ID = "6f1c2b9e-1d2a-4b3c-8d4e-5f6a7b8c9d0e";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

beforeEach(() => {
  jar.clear();
  vi.clearAllMocks();
});

describe("connexion à /admin", () => {
  it("refuse un mauvais mot de passe sans créer de session", async () => {
    const state = await login({ error: null }, form({ password: "mauvais" }));
    expect(state).toEqual({ error: "Mot de passe incorrect." });
    expect(jar.has(ADMIN_COOKIE)).toBe(false);
  });

  it("le bon mot de passe ouvre une session HttpOnly limitée à /admin", async () => {
    await expect(login({ error: null }, form({ password: process.env.ADMIN_PASSWORD! }))).rejects.toThrow(
      "REDIRECT:/admin",
    );
    const cookie = jar.get(ADMIN_COOKIE)!;
    expect(cookie.value).not.toContain(process.env.ADMIN_PASSWORD);
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/admin" });
  });

  it("la déconnexion supprime la session", async () => {
    await login({ error: null }, form({ password: process.env.ADMIN_PASSWORD! })).catch(() => {});
    await logout().catch(() => {});
    expect(jar.has(ADMIN_COOKIE)).toBe(false);
  });
});

describe("décisions", () => {
  it("refuse toute action sans session", async () => {
    const state = await decide(null, form({ id: ID, intent: "accepter" }));
    expect(state).toEqual({ ok: false, message: "Session expirée : reconnectez-vous." });
    expect(decisions.acceptRequest).not.toHaveBeenCalled();
  });

  it("refuse un cookie forgé", async () => {
    jar.set(ADMIN_COOKIE, { value: `${Math.floor(Date.now() / 1000) + 3600}.faux` });
    expect((await decide(null, form({ id: ID, intent: "refuser" })))?.ok).toBe(false);
    expect(decisions.refuseRequest).not.toHaveBeenCalled();
  });

  it("avec une session, appelle la bonne décision", async () => {
    await login({ error: null }, form({ password: process.env.ADMIN_PASSWORD! })).catch(() => {});
    expect(await decide(null, form({ id: ID, intent: "accepter" }))).toMatchObject({ ok: true });
    expect(decisions.acceptRequest).toHaveBeenCalledWith(ID);
    await decide(null, form({ id: ID, intent: "refuser" }));
    expect(decisions.refuseRequest).toHaveBeenCalledWith(ID);
    await decide(null, form({ id: ID, intent: "renvoyer" }));
    expect(decisions.resendDecision).toHaveBeenCalledWith(ID);
  });

  it("rejette un identifiant ou une intention invalides", async () => {
    await login({ error: null }, form({ password: process.env.ADMIN_PASSWORD! })).catch(() => {});
    expect(await decide(null, form({ id: "1 or 1=1", intent: "accepter" }))).toEqual({
      ok: false,
      message: "Requête invalide.",
    });
    expect(await decide(null, form({ id: ID, intent: "supprimer" }))).toEqual({ ok: false, message: "Requête invalide." });
    expect(await decide(null, form({ id: ID, intent: "constructor" }))).toEqual({ ok: false, message: "Requête invalide." });
  });
});
