import { request } from "node:http";
import { beforeAll, describe, expect, it } from "vitest";
import { seedChurch, type ChurchFixture } from "./fixtures";
import { serviceClient } from "./local-supabase";
import { daysFromNow, generateToken, hashToken, signToken } from "@/lib/tokens";

/*
 * Parcours à jeton et routage par domaine, contre un vrai serveur Next branché
 * sur la base locale. Ignorés sans serveur :
 *
 *   FLOWS_BASE_URL=http://localhost:3200 \
 *   APP_TOKEN_SECRET=<même valeur que le serveur> CRON_SECRET=<idem> \
 *   npm run test:rls
 */

const BASE = process.env.FLOWS_BASE_URL;
const run = BASE ? describe : describe.skip;

type Reply = { status: number; body: string; headers: Record<string, string | string[] | undefined> };

/** Requête HTTP avec un en-tête Host choisi (routage par sous-domaine). */
function get(path: string, init: { host?: string; headers?: Record<string, string> } = {}): Promise<Reply> {
  const url = new URL(path, BASE);
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: "GET", headers: { ...(init.host ? { host: init.host } : {}), ...init.headers } },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

let A: ChurchFixture;
let B: ChurchFixture;
const service = () => serviceClient();

beforeAll(async () => {
  if (!BASE) return;
  process.env.APP_TOKEN_SECRET ??= "secret-local-de-test-0123456789-abcdefghij-klmnop";
  A = await seedChurch("flow-a");
  B = await seedChurch("flow-b");
  await service().from("plans").insert({ church_id: A.id, title: "Culte de la Source", service_date: new Date(Date.now() + 5 * 864e5).toISOString() });
  await service().from("plans").insert({ church_id: B.id, title: "Culte secret de B", service_date: new Date(Date.now() + 5 * 864e5).toISOString() });
  await service().from("church_settings").update({ tagline: "Une église pour tous" }).eq("church_id", A.id);
}, 180_000);

run("cron des rappels", () => {
  it("refuse sans secret, avec un mauvais secret, ou avec « Bearer undefined »", async () => {
    expect((await get("/api/cron/reminders")).status).toBe(401);
    expect((await get("/api/cron/reminders", { headers: { authorization: "Bearer mauvais" } })).status).toBe(401);
    expect((await get("/api/cron/reminders", { headers: { authorization: "Bearer undefined" } })).status).toBe(401);
  });

  it("répond avec le bon secret", async () => {
    const reply = await get("/api/cron/reminders", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.body)).toMatchObject({ ok: true });
  });
});

run("calendrier (ICS)", () => {
  it("refuse un lien inconnu ou mal formé", async () => {
    expect((await get("/api/calendar/inconnu.ics")).status).toBe(404);
    expect((await get(`/api/calendar/${generateToken()}.ics`)).status).toBe(404);
  });

  it("n'exporte que les plans de l'église du lien, sans mise en cache", async () => {
    const token = generateToken();
    await service().from("calendar_feeds").insert({ church_id: A.id, user_id: A.accounts.membre.userId, token_hash: hashToken(token) });
    const reply = await get(`/api/calendar/${token}.ics`);
    expect(reply.status).toBe(200);
    expect(reply.body).toContain("Culte de la Source");
    expect(reply.body).not.toContain("Culte secret de B");
    expect(String(reply.headers["cache-control"])).toContain("no-store");
  });

  it("cesse de fonctionner une fois le lien révoqué", async () => {
    const token = generateToken();
    await service().from("calendar_feeds").insert({ church_id: A.id, user_id: A.accounts.membre.userId, token_hash: hashToken(token) });
    expect((await get(`/api/calendar/${token}.ics`)).status).toBe(200);
    await service().from("calendar_feeds").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hashToken(token));
    expect((await get(`/api/calendar/${token}.ics`)).status).toBe(404);
  });

  it("cesse de fonctionner quand le compte quitte l'église", async () => {
    const { userId } = A.accounts.pastoral;
    const token = generateToken();
    await service().from("calendar_feeds").insert({ church_id: A.id, user_id: userId, token_hash: hashToken(token) });
    expect((await get(`/api/calendar/${token}.ics`)).status).toBe(200);
    await service().from("church_memberships").update({ status: "inactive" }).eq("user_id", userId);
    expect((await get(`/api/calendar/${token}.ics`)).status).toBe(404);
  });
});

run("partage de setlist", () => {
  async function link(church: ChurchFixture, patch: Record<string, unknown> = {}) {
    const token = generateToken();
    await service().from("plan_share_links").insert({
      church_id: church.id,
      plan_id: church.rows.plans.id,
      token_hash: hashToken(token),
      expires_at: daysFromNow(30).toISOString(),
      ...patch,
    });
    return token;
  }

  it("affiche le plan du lien, et lui seul", async () => {
    const reply = await get(`/partage/${await link(A)}`);
    expect(reply.status).toBe(200);
    expect(reply.body).toContain("Culte");
    expect(reply.body).not.toContain("Culte secret de B");
    expect(reply.body).toContain("noindex");
  });

  it("refuse un lien expiré, révoqué, inconnu ou mal formé", async () => {
    expect((await get(`/partage/${await link(A, { expires_at: new Date(Date.now() - 1000).toISOString() })}`)).status).toBe(404);
    expect((await get(`/partage/${await link(A, { revoked_at: new Date().toISOString() })}`)).status).toBe(404);
    expect((await get(`/partage/${generateToken()}`)).status).toBe(404);
    expect((await get("/partage/n-importe-quoi")).status).toBe(404);
  });
});

run("réponse à une affectation par lien signé", () => {
  const sign = (assignmentId: string, expiresAt = daysFromNow(30)) => signToken("assignment-response", assignmentId, expiresAt);

  /** Page affichée à la place des détails : message neutre, aucune donnée du service. */
  async function expectRefused(path: string) {
    const reply = await get(path);
    expect(reply.body).toContain("Lien invalide ou expiré");
    expect(reply.body).not.toContain("Culte de la Source");
    expect(reply.body).not.toContain("Culte secret de B");
  }

  it("accepte un lien signé valide pour une personne de l'église", async () => {
    const reply = await get(`/espace/repondre/${sign(A.rows.plan_assignments.id as string)}?status=confirmed`);
    expect(reply.status).toBe(200);
    expect(reply.body).not.toContain("Lien invalide ou expiré");
  });

  it("refuse un identifiant brut, un jeton modifié, expiré ou d'un autre usage", async () => {
    const id = A.rows.plan_assignments.id as string;
    await expectRefused(`/espace/repondre/${id}?status=confirmed`);
    const [, exp, signature] = sign(id).split(".");
    const tampered = `${Buffer.from(B.rows.plan_assignments.id as string).toString("base64url")}.${exp}.${signature}`;
    await expectRefused(`/espace/repondre/${tampered}?status=confirmed`);
    await expectRefused(`/espace/repondre/${sign(id, new Date(Date.now() - 1000))}?status=confirmed`);
    await expectRefused(`/espace/repondre/${signToken("autre-usage", id, daysFromNow(1))}?status=confirmed`);
  });

  it("le lien « invité externe » ne marche pas pour une personne de l'église", async () => {
    await expectRefused(`/espace/repondre-ext/${sign(A.rows.plan_assignments.id as string)}`);
  });

  it("le lien « invité externe » marche pour un invité sans compte", async () => {
    const { data } = await service()
      .from("plan_assignments")
      .insert({ church_id: A.id, plan_id: A.rows.plans.id, external_name: "Invité", external_email: "invite@exemple.fr", team_id: A.rows.teams.id })
      .select("id")
      .single();
    const reply = await get(`/espace/repondre-ext/${sign(data!.id)}`);
    expect(reply.status).toBe(200);
    expect(reply.body).not.toContain("Lien invalide ou expiré");
    // ... mais pas sur la page des personnes de l'église
    await expectRefused(`/espace/repondre/${sign(data!.id)}?status=confirmed`);
  });
});

run("activation d'un compte", () => {
  it("ne consomme pas le lien au simple affichage de la page", async () => {
    const token = generateToken();
    await service().from("account_activations").insert({
      church_id: A.id, user_id: A.accounts.membre.userId, token_hash: hashToken(token), expires_at: daysFromNow(3).toISOString(),
    });
    expect((await get(`/espace/activer/${token}`)).status).toBe(200);
    expect((await get(`/espace/activer/${token}`)).status).toBe(200);
    const { data } = await service().from("account_activations").select("used_at").eq("token_hash", hashToken(token)).single();
    expect(data?.used_at).toBeNull();
  });
});

run("routage par domaine", () => {
  it("sert le site public d'une église sur son sous-domaine", async () => {
    const reply = await get("/", { host: `${A.slug}.comora.fr` });
    expect(reply.status).toBe(200);
    expect(reply.body).toContain("Église flow-a");
    expect(reply.body).toContain("Une église pour tous");
    expect(reply.body).not.toContain("Église flow-b");
  });

  it("renvoie 404 pour un sous-domaine sans église", async () => {
    expect((await get("/", { host: "eglise-inconnue.comora.fr" })).status).toBe(404);
  });

  it("l'espace est protégé : sans session, la connexion est demandée", async () => {
    const reply = await get("/espace/admin/plans", { host: "app.comora.fr" });
    expect(reply.status).toBe(307);
    expect(String(reply.headers.location)).toContain("/espace/login");
  });

  it("les anciennes adresses /benevoles redirigent", async () => {
    const reply = await get("/benevoles/admin/plans");
    expect(reply.status).toBe(308);
    expect(String(reply.headers.location)).toContain("/espace/admin/plans");
  });
});
