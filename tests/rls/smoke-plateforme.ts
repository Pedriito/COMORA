/*
 * Parcours de fumée du back-office des fondateurs, dans un vrai navigateur :
 *   connexion → vérification en deux étapes (inscription de l'application, puis code) →
 *   tableau de bord → prolongation d'un essai → 404 pour un compte qui n'est pas de l'équipe.
 *
 *   FLOWS_BASE_URL=http://localhost:3200 SHOTS=/chemin/captures npx tsx tests/rls/smoke-plateforme.ts
 *
 * Nécessite Supabase local (`supabase start`) et un serveur Next lancé sur cette base
 * (jamais sur un projet hébergé : le script crée des comptes).
 */
import { chromium, type Page } from "@playwright/test";
import { serviceClient, localEnv } from "./local-supabase";
import { totpCode } from "./totp";

const BASE = process.env.FLOWS_BASE_URL ?? "http://localhost:3200";
const SHOTS = process.env.SHOTS;
const PASSWORD = "Mot-de-passe-de-test-Aa1!";
const run = Date.now();

async function account(email: string, platform: boolean) {
  const db = serviceClient();
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`${email} : ${error?.message}`);
  await db.from("profiles").upsert({ id: data.user.id, first_name: platform ? "Fondatrice" : "Simple" });
  if (platform) await db.from("platform_admins").insert({ user_id: data.user.id });
  return data.user.id;
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/espace/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20_000 }), page.click('button[type="submit"]')]);
}

const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); };
const failures: string[] = [];
const check = (ok: boolean, label: string) => { console.log(`${ok ? "OK  " : "ÉCHEC"} ${label}`); if (!ok) failures.push(label); };

async function enterCode(page: Page, secret: string) {
  // Un code déjà utilisé dans la même fenêtre de 30 s est refusé : on essaie alors la fenêtre suivante
  for (const shift of [0, 30_000]) {
    await page.fill('input[aria-label="Code à 6 chiffres"]', totpCode(secret, Date.now() + shift));
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL(/\/espace\/plateforme$/, { timeout: 20_000 });
      return true;
    } catch {
      await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 20_000 }).catch(() => {});
    }
  }
  return false;
}

async function main() {
  if (!localEnv().url.includes("127.0.0.1") && !localEnv().url.includes("localhost")) throw new Error("Base locale uniquement");
  const db = serviceClient();
  const teamEmail = `equipe-${run}@test.comora.fr`;
  const plainEmail = `simple-${run}@test.comora.fr`;
  await account(teamEmail, true);
  await account(plainEmail, false);
  const { data: church } = await db.from("churches").insert({ name: `Église fumée ${run}`, slug: `fumee-${run}`, billing_status: "trialing", trial_ends_at: new Date(Date.now() + 3 * 864e5).toISOString() }).select("id").single();

  const browser = await chromium.launch();
  try {
    // 1. Première visite : inscription de l'application d'authentification
    const page = await (await browser.newContext()).newPage();
    await login(page, teamEmail);
    await page.goto(`${BASE}/espace/plateforme`);
    await page.waitForURL(/\/espace\/plateforme\/verification/);
    check(true, "sans deuxième étape : redirigé vers la vérification");
    await page.waitForSelector('img[alt^="QR code"]', { timeout: 15_000 });
    const secret = (await page.locator("code").first().innerText()).trim();
    check(secret.length >= 16, "le QR code et la clé sont affichés à la première visite");
    await shot(page, "1-verification-premiere-visite");
    check(await enterCode(page, secret), "un code valide ouvre le back-office");

    check(await page.getByRole("heading", { name: "Back-office des fondateurs" }).isVisible(), "le tableau de bord s'affiche");
    const row = page.locator("tr", { hasText: `fumee-${run}` });
    check(await row.count() === 1, "l'église de test est listée");
    await shot(page, "2-tableau-de-bord");

    // 2. Prolonger l'essai
    await row.getByRole("button", { name: "Prolonger l’essai" }).click();
    await page.waitForURL(/resultat=essai-prolonge/);
    check(await page.getByText("Essai prolongé.").isVisible(), "la prolongation est confirmée");
    const journal = page.locator('section[aria-label="Journal"]');
    const entry = journal.locator("li", { hasText: `fumee-${run}` });
    check((await entry.count()) === 1 && (await entry.innerText()).includes("+14 j") && (await entry.innerText()).includes("Fondatrice"), "l'action apparaît dans le journal, avec son auteur");
    const { data: after } = await db.from("churches").select("trial_ends_at").eq("id", church!.id).single();
    check(Math.abs(new Date(after!.trial_ends_at!).getTime() - (Date.now() + 17 * 864e5)) < 36e5, "l'essai est bien prolongé de 14 jours en base");
    await shot(page, "3-apres-prolongation");

    // 3. Nouvelle session : l'application est déjà enregistrée, on demande seulement le code
    const page2 = await (await browser.newContext()).newPage();
    if (process.env.DEBUG) {
      page2.on("response", (r) => { if (r.url().includes("/auth/v1/") || r.url().includes("plateforme")) console.log("  réseau", r.status(), r.request().method(), r.url().replace(/^https?:\/\/[^/]+/, "")); });
      page2.on("console", (m) => console.log("  console", m.type(), m.text().slice(0, 200)));
    }
    await login(page2, teamEmail);
    await page2.goto(`${BASE}/espace/plateforme`);
    await page2.waitForURL(/verification/);
    await page2.waitForSelector('input[aria-label="Code à 6 chiffres"]');
    check((await page2.locator('img[alt^="QR code"]').count()) === 0, "deuxième session : pas de nouveau QR code, seulement le code");
    await page2.fill('input[aria-label="Code à 6 chiffres"]', "000000");
    await page2.click('button[type="submit"]');
    // (Next.js a lui-même un élément role="alert" : on cible le message de la page)
    const refusal = page2.locator("form [role=alert]");
    check(await refusal.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false), "un mauvais code est refusé avec un message");
    check((await page2.locator('button[type="submit"]').innerText()) === "Valider", "après un refus, le bouton est de nouveau utilisable");
    await shot(page2, "4-mauvais-code");
    check(await enterCode(page2, secret), "le bon code ouvre le back-office");

    // 4. Un compte qui n'est pas de l'équipe : 404
    const page3 = await (await browser.newContext()).newPage();
    await login(page3, plainEmail);
    const response = await page3.goto(`${BASE}/espace/plateforme`);
    check(response?.status() === 404, "un compte hors équipe reçoit une 404");
    const verif = await page3.goto(`${BASE}/espace/plateforme/verification`);
    check(verif?.status() === 404, "la page de vérification est aussi une 404 pour lui");

    // 5. Sans connexion : renvoi à la connexion
    const page4 = await (await browser.newContext()).newPage();
    await page4.goto(`${BASE}/espace/plateforme`);
    check(/\/espace\/login/.test(page4.url()), "sans connexion : renvoi à la page de connexion");
  } finally {
    await browser.close();
  }
  if (failures.length) { console.error(`\n${failures.length} échec(s)`); process.exit(1); }
  console.log("\nParcours complet réussi");
}

main().catch((e) => { console.error(e); process.exit(1); });
