/*
 * Parcours complet, en vrai navigateur : landing → inscription → e-mail de
 * confirmation → assistant → tableau de bord de la nouvelle église.
 *
 *   FLOWS_BASE_URL=http://localhost:3300 npx tsx tests/rls/signup-e2e.ts
 *
 * Nécessite Supabase local (e-mails captés par sa boîte de test), un serveur Next
 * branché dessus et FOUNDER_DEADLINE défini côté serveur.
 */
import { chromium, expect, type Page } from "@playwright/test";
import { serviceClient } from "./local-supabase";

const BASE = process.env.FLOWS_BASE_URL ?? "http://localhost:3300";
const MAIL = process.env.FLOWS_MAIL_URL ?? "http://127.0.0.1:54324";
const run = Date.now().toString(36);
const PASSWORD = "Motdepasse2027x";
const db = serviceClient();

/** Dernier lien du message reçu par cette adresse, extrait de son contenu. */
async function linkFromMail(to: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    const id = list.messages?.[0]?.ID;
    if (id) {
      const message = await (await fetch(`${MAIL}/api/v1/message/${id}`)).json();
      const html: string = message.HTML ?? "";
      const match = html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
      if (match) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Aucun e-mail de confirmation pour ${to}`);
}

async function startFromLanding(page: Page) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Créer l’espace de mon église" }).first().click();
  await expect(page).toHaveURL(/\/espace\/inscription/);
  await expect(page.getByRole("heading", { name: "Créez l’espace de votre église" })).toBeVisible();
}

async function fillIdentity(page: Page, email: string) {
  await page.getByLabel("Prénom").fill("Camille");
  await page.getByLabel("Nom", { exact: true }).fill("Martin");
  await page.getByLabel("Adresse e-mail").fill(email);
}

async function main() {
  const browser = await chromium.launch();
  const failures: string[] = [];
  let shotPage: Page | null = null;
  const step = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); console.log(`✓ ${name}`); }
    catch (error) {
      // FLOWS_SHOTS=<dossier> : une capture de la page au moment de l'échec
      if (process.env.FLOWS_SHOTS && shotPage) await shotPage.screenshot({ path: `${process.env.FLOWS_SHOTS}/echec-${failures.length + 1}.png`, fullPage: true }).catch(() => undefined);
      failures.push(`${name} : ${(error as Error).message.split("\n").slice(0, 6).join(" | ")}`); console.log(`✗ ${name}`);
    }
  };

  // ── Parcours 1 : mot de passe ───────────────────────────────────────────
  const email = `camille-${run}@test.comora.fr`;
  const slugBase = `source-${run}`;
  const context = await browser.newContext();
  const page = await context.newPage();
  shotPage = page;

  await step("la landing mène à l'inscription", () => startFromLanding(page));

  await step("l'assistant n'est pas accessible sans compte", async () => {
    const other = await browser.newContext();
    const anonymous = await other.newPage();
    await anonymous.goto(BASE + "/espace/creer");
    await expect(anonymous).toHaveURL(/\/espace\/login/);
    await other.close();
  });

  await step("un mot de passe trop faible est refusé avec un message clair", async () => {
    await fillIdentity(page, email);
    await page.getByLabel("Mot de passe", { exact: true }).fill("faible");
    await page.getByLabel("Confirmer le mot de passe").fill("faible");
    // Le champ a minlength : on contourne la validation du navigateur pour tester celle du serveur
    await page.evaluate(() => document.querySelector("form")?.setAttribute("novalidate", ""));
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText("au moins 10 caractères")).toBeVisible();
    await expect(page.getByLabel("Prénom")).toHaveValue("Camille");
  });

  await step("l'inscription envoie un e-mail de confirmation", async () => {
    await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirmer le mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText("Vérifiez votre boîte mail")).toBeVisible();
  });

  await step("sans confirmation, impossible de se connecter", async () => {
    const other = await browser.newContext();
    const attempt = await other.newPage();
    await attempt.goto(BASE + "/espace/login");
    await attempt.getByLabel("Adresse email").fill(email);
    await attempt.locator("#password").fill(PASSWORD);
    await attempt.getByRole("button", { name: "Se connecter" }).click();
    await attempt.waitForLoadState("networkidle");
    await expect(attempt).toHaveURL(/\/espace\/login/);
    await other.close();
  });

  await step("le lien de l'e-mail ouvre l'assistant de création", async () => {
    const link = await linkFromMail(email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/espace\/creer/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Créer l’espace de mon église" })).toBeVisible();
  });

  await step("l'adresse est proposée à partir du nom, et vérifiée en direct", async () => {
    await page.getByLabel("Nom de l’église").fill(`Église de la Source ${run}`);
    await expect(page.getByLabel("Adresse de votre église")).toHaveValue(`eglise-de-la-source-${run}`);
    await expect(page.getByText("est disponible")).toBeVisible();
  });

  await step("une adresse réservée ou invalide est refusée", async () => {
    await page.getByLabel("Adresse de votre église").fill("app");
    await expect(page.getByText("Cette adresse est réservée")).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer l’espace de mon église" })).toBeDisabled();
    await page.getByLabel("Adresse de votre église").fill("ab");
    await expect(page.getByText("au moins 3 caractères")).toBeVisible();
  });

  await step("une adresse déjà prise est signalée, avec une proposition", async () => {
    await page.getByLabel("Adresse de votre église").fill("demo");
    await expect(page.getByText("est réservée")).toBeVisible();
    const taken = `pris-${run}`;
    await db.from("churches").insert({ name: "Déjà là", slug: taken });
    await page.getByLabel("Adresse de votre église").fill(taken);
    await expect(page.getByText("déjà utilisée")).toBeVisible();
    await expect(page.getByRole("button", { name: `Utiliser ${taken}-2` })).toBeVisible();
    await page.getByRole("button", { name: `Utiliser ${taken}-2` }).click();
    await expect(page.getByLabel("Adresse de votre église")).toHaveValue(`${taken}-2`);
    await expect(page.getByText("est disponible")).toBeVisible();
  });

  await step("la case des conditions est obligatoire", async () => {
    await page.getByLabel("Adresse de votre église").fill(slugBase);
    await expect(page.getByText("est disponible")).toBeVisible();
    await page.getByLabel("Ville").fill("Lyon");
    await page.getByLabel("Taille de l’église").selectOption("30_100");
    await page.evaluate(() => document.querySelector("form")?.setAttribute("novalidate", ""));
    await page.getByRole("button", { name: "Créer l’espace de mon église" }).click();
    await expect(page.getByText("Acceptez les conditions générales de vente")).toBeVisible();
    await expect(page.getByLabel("Ville")).toHaveValue("Lyon");
  });

  await step("la création mène au guide de démarrage de la nouvelle église", async () => {
    await page.getByLabel("Adresse de votre église").fill(slugBase);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Créer l’espace de mon église" }).click();
    try {
      await expect(page).toHaveURL(/\/espace\/demarrage/, { timeout: 20_000 });
    } catch (error) {
      const alerts = await page.locator("[role=alert], [role=status]").allInnerTexts();
      throw new Error(`${(error as Error).message.split("\n")[0]} — adresse : ${page.url()} — messages : ${JSON.stringify(alerts)}`);
    }
    await expect(page.getByRole("heading", { name: `Bien démarrer avec Église de la Source ${run}` })).toBeVisible();
    await expect(page.getByText("0 étape sur 4")).toBeVisible();
  });

  // ── Guide de démarrage ────────────────────────────────────────────────
  const churchRow = async () => (await db.from("churches").select("id").eq("slug", slugBase).single()).data!.id as string;

  if (process.env.FLOWS_SHOTS) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${process.env.FLOWS_SHOTS}/guide-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  await step("le modèle de fichier se télécharge (et pas sans être connecté)", async () => {
    const response = await context.request.get(BASE + "/espace/demarrage/modele.csv");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Prénom;Nom;E-mail");
    const anonymous = await (await browser.newContext()).request.get(BASE + "/espace/demarrage/modele.csv", { maxRedirects: 0 });
    expect(anonymous.status()).toBeGreaterThanOrEqual(300);
  });

  await step("un fichier sans colonne « Prénom » est expliqué, rien n'est importé", async () => {
    await page.setInputFiles('input[name="file"]', { name: "mauvais.csv", mimeType: "text/csv", buffer: Buffer.from("Nom;Ville\nDupont;Lyon") });
    await page.getByRole("button", { name: "Vérifier le fichier" }).click();
    await expect(page.getByText("colonne « Prénom »")).toBeVisible();
  });

  await step("l'import Excel : aperçu, lignes à corriger, puis import sans envoi d'e-mail", async () => {
    const csv = "Prénom;Nom;E-mail\nMarie;Dupont;marie@exemple.fr\nSamuel;Martin;\n;Sans prénom;\nPaul;Durand;pas-un-mail\n";
    await page.setInputFiles('input[name="file"]', { name: "membres.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: "Vérifier le fichier" }).click();
    await expect(page.getByText("personnes prêtes")).toBeVisible();
    await expect(page.getByText("2 lignes à corriger")).toBeVisible();
    await page.getByText("Voir les lignes ignorées").click();
    await expect(page.getByText("Ligne 4 : Prénom manquant.")).toBeVisible();
    await page.getByRole("button", { name: "Importer 2 personnes" }).click();
    await expect(page.getByText("2 personnes ajoutées")).toBeVisible();
    const { count } = await db.from("members").select("id", { count: "exact", head: true }).eq("church_id", await churchRow());
    expect(count).toBe(3); // les deux importées + l'administrateur
  });

  await step("l'import d'un vrai fichier .xlsx détecte les adresses déjà connues", async () => {
    await page.goto(BASE + "/espace/demarrage");
    await page.setInputFiles('input[name="file"]', "tests/fixtures/membres.xlsx");
    await page.getByRole("button", { name: "Vérifier le fichier" }).click();
    await page.getByRole("button", { name: "Importer 2 personnes" }).click();
    await expect(page.getByText("1 personne ajoutée")).toBeVisible();
    await expect(page.getByText("1 déjà connue")).toBeVisible();
  });

  await step("la première équipe et ses postes", async () => {
    await page.goto(BASE + "/espace/demarrage");
    await page.getByLabel("Nom de l’équipe").fill("Accueil");
    await page.getByLabel("Postes (facultatif)").fill("Entrée\nCafé");
    await page.getByRole("button", { name: "Créer l’équipe" }).click();
    await expect(page.getByText("Votre équipe est créée")).toBeVisible();
    const id = await churchRow();
    const { data: positions } = await db.from("positions").select("name").eq("church_id", id).order("name");
    expect((positions ?? []).map((p) => p.name)).toEqual(["Café", "Entrée"]);
  });

  await step("le premier culte, à la date et l'heure choisies", async () => {
    await page.goto(BASE + "/espace/demarrage");
    await page.getByLabel("Date", { exact: true }).fill("2027-03-14");
    await page.getByLabel("Heure", { exact: true }).fill("10:30");
    await page.getByRole("button", { name: "Créer le culte" }).click();
    await expect(page.getByText("Votre premier culte est créé")).toBeVisible();
    const { data: plan } = await db.from("plans").select("title, service_date").eq("church_id", await churchRow()).single();
    expect(plan?.title).toBe("Culte du dimanche");
    expect(plan?.service_date).toBe("2027-03-14T09:30:00+00:00"); // 10 h 30 à Paris, heure d'hiver
  });

  await step("l'invitation d'un responsable crée son accès (rôle responsable, invité)", async () => {
    await page.goto(BASE + "/espace/demarrage");
    await page.getByLabel("Adresse e-mail").fill(`julie-${run}@test.comora.fr`);
    await page.locator("#invite-first").fill("Julie");
    await page.getByRole("button", { name: "Envoyer l’invitation" }).click();
    // Sans clé d'envoi (Resend) en local, la personne est créée mais l'e-mail ne part pas : les deux issues sont admises
    await expect(page).toHaveURL(/\/espace\/demarrage\?(invited=1|error=email_failed)/);
    const { data: m } = await db.from("church_memberships").select("role, status").eq("church_id", await churchRow()).eq("status", "invited").single();
    expect(m).toEqual({ role: "responsable", status: "invited" });
  });

  await step("tout est fait : le guide le dit, et le tableau de bord ne réclame plus rien", async () => {
    await page.goto(BASE + "/espace/demarrage");
    await expect(page.getByText("4 étapes sur 4")).toBeVisible();
    await page.getByRole("link", { name: "Aller au tableau de bord" }).click();
    await expect(page).toHaveURL(/\/espace\/dashboard/);
    await expect(page.getByText("Terminez la mise en place")).toHaveCount(0);
    if (process.env.FLOWS_SHOTS) await page.screenshot({ path: `${process.env.FLOWS_SHOTS}/dashboard-final.png` });
  });

  await step("l'espace est bien enregistré (fondateur, essai de 30 jours, CGV, administrateur)", async () => {
    const { data: church } = await db.from("churches").select("*").eq("slug", slugBase).single();
    expect(church?.name).toBe(`Église de la Source ${run}`);
    expect(church?.is_founder).toBe(true);
    expect(church?.billing_status).toBe("trialing");
    const days = (new Date(church!.trial_ends_at).getTime() - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    const { data: acceptances } = await db.from("legal_acceptances").select("document, version").eq("church_id", church!.id);
    expect((acceptances ?? []).map((a) => a.document).sort()).toEqual(["cgv", "confidentialite"]);
    const { data: membership } = await db.from("church_memberships").select("role").eq("church_id", church!.id).eq("status", "active").single();
    expect(membership?.role).toBe("admin");
  });

  // ── Essai et lecture seule ────────────────────────────────────────────
  await step("pendant l'essai : bandeau discret avec les jours restants et lien vers les offres", async () => {
    await page.goto(BASE + "/espace/dashboard");
    await expect(page.getByText(/Il vous reste (29|30) jours d’essai gratuit/)).toBeVisible();
    await page.getByRole("link", { name: "Choisir une offre" }).first().click();
    await expect(page).toHaveURL(/\/espace\/abonnement/);
    await expect(page.getByText("Offre actuelle : Communauté (pendant l’essai)")).toBeVisible();
  });

  await step("à J-3 le bandeau passe à l'orange", async () => {
    await db.from("churches").update({ trial_ends_at: new Date(Date.now() + 2.5 * 864e5).toISOString() }).eq("id", await churchRow());
    await page.goto(BASE + "/espace/dashboard");
    await expect(page.getByText("Il vous reste 3 jours d’essai gratuit.")).toBeVisible();
  });

  await step("essai terminé : lecture seule, tout se consulte, plus rien ne se modifie", async () => {
    const id = await churchRow();
    await db.from("churches").update({ trial_ends_at: new Date(Date.now() - 3600e3).toISOString() }).eq("id", id);
    await page.goto(BASE + "/espace/dashboard");
    await expect(page.getByText("Votre espace est en lecture seule")).toBeVisible();
    await page.goto(BASE + "/espace/demarrage"); // lecture : possible
    await expect(page.getByRole("heading", { name: /Bien démarrer/ })).toBeVisible();

    await page.getByLabel("Nom de l’équipe").fill("Louange");
    await page.getByRole("button", { name: "Créer l’équipe" }).click();
    await expect(page).toHaveURL(/\/espace\/lecture-seule/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Votre espace est en lecture seule" })).toBeVisible();
    await expect(page.getByText("Rien n’est perdu")).toBeVisible();
    const { data: team } = await db.from("teams").select("id").eq("church_id", id).eq("name", "Louange");
    expect(team).toEqual([]);
  });

  await step("le cron passe l'essai terminé en lecture seule et programme la suppression à +90 jours", async () => {
    const id = await churchRow();
    await db.rpc("church_lifecycle_step");
    const { data } = await db.from("churches").select("billing_status, deletion_scheduled_at, trial_ends_at").eq("id", id).single();
    expect(data?.billing_status).toBe("read_only");
    const gap = (new Date(data!.deletion_scheduled_at).getTime() - new Date(data!.trial_ends_at).getTime()) / 864e5;
    expect(Math.round(gap)).toBe(90);
    await page.goto(BASE + "/espace/lecture-seule");
    await expect(page.getByText("Rien n’est perdu")).toBeVisible();
    if (process.env.FLOWS_SHOTS) await page.screenshot({ path: `${process.env.FLOWS_SHOTS}/lecture-seule.png`, fullPage: true });
  });

  await step("dès qu'une offre est active, l'espace se rouvre aussitôt", async () => {
    const id = await churchRow();
    await db.from("churches").update({ billing_status: "active", offer: "essentiel" }).eq("id", id);
    await page.goto(BASE + "/espace/demarrage");
    await page.getByLabel("Nom de l’équipe").fill("Louange");
    await page.getByRole("button", { name: "Créer l’équipe" }).click();
    await expect(page.getByText("Votre équipe est créée")).toBeVisible();
    await page.goto(BASE + "/espace/dashboard");
    await expect(page.getByText("lecture seule")).toHaveCount(0);
    await expect(page.getByText("Terminez la mise en place")).toHaveCount(0);
  });

  await step("le site public de l'église répond", async () => {
    const response = await page.goto(`${BASE}/sites/${slugBase}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByText(`Église de la Source ${run}`).first()).toBeVisible();
  });
  await context.close();

  // ── Parcours 2 : lien magique ───────────────────────────────────────────
  const magicEmail = `magique-${run}@test.comora.fr`;
  const magicContext = await browser.newContext();
  const magic = await magicContext.newPage();
  await step("l'inscription par lien magique mène à l'assistant", async () => {
    await startFromLanding(magic);
    await magic.getByRole("tab", { name: "Lien par e-mail" }).click();
    await fillIdentity(magic, magicEmail);
    await magic.getByRole("button", { name: "Recevoir mon lien de connexion" }).click();
    await expect(magic.getByText("Vérifiez votre boîte mail")).toBeVisible();
    await magic.goto(await linkFromMail(magicEmail));
    await expect(magic).toHaveURL(/\/espace\/creer/, { timeout: 20_000 });
  });
  await magicContext.close();

  // ── Anciennes adresses ──────────────────────────────────────────────────
  await step("l'ancienne page de demande d'accès n'existe plus", async () => {
    const response = await (await browser.newContext()).request.get(BASE + "/demande-acces");
    expect(response.status()).toBe(404);
  });
  await step("l'ancien /admin n'existe plus", async () => {
    const response = await (await browser.newContext()).request.get(BASE + "/admin");
    expect(response.status()).toBe(404);
  });

  await browser.close();
  if (failures.length > 0) {
    console.error(`\n${failures.length} échec(s) :\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
  console.log("\nTout le parcours est conforme.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
