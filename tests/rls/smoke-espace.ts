/*
 * Parcours de fumée de l'espace : se connecte avec un vrai navigateur et ouvre
 * chaque page, pour un administrateur (avec rôle pastoral) et un simple membre.
 * Vérifie le statut HTTP, l'absence d'erreur serveur et que le membre ne voit
 * pas les pages d'administration ni la pastorale.
 *
 *   FLOWS_BASE_URL=http://localhost:3200 npx tsx tests/rls/smoke-espace.ts
 *
 * Nécessite Supabase local (`supabase start`) et un serveur Next lancé sur cette base.
 */
import { chromium, type Browser } from "@playwright/test";
import { seedChurch, type ChurchFixture } from "./fixtures";
import { serviceClient } from "./local-supabase";

const BASE = process.env.FLOWS_BASE_URL ?? "http://localhost:3200";
const PASSWORD = "Mot-de-passe-de-test-Aa1!";

async function user(email: string, church: ChurchFixture, role: string, pastoral: boolean) {
  const service = serviceClient();
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`${email} : ${error?.message}`);
  await service.from("church_memberships").insert({ church_id: church.id, user_id: data.user.id, role, is_pastoral: pastoral });
  await service.from("members").insert({ church_id: church.id, user_id: data.user.id, first_name: "Test", last_name: role });
  await service.from("profiles").update({ first_name: "Test", last_name: role, active_church_id: church.id }).eq("id", data.user.id);
  return email;
}

type Check = { path: string; admin: "ok" | "redirect"; membre: "ok" | "redirect" };

async function main() {
  const A = await seedChurch("fumee");
  const run = Date.now();
  const adminEmail = await user(`admin-${run}@test.comora.fr`, A, "admin", true);
  const membreEmail = await user(`membre-${run}@test.comora.fr`, A, "membre", false);

  const planId = A.rows.plans.id as string;
  const teamId = A.rows.teams.id as string;
  const songId = A.rows.songs.id as string;
  const memberId = A.rows.members.id as string;

  const pages: Check[] = [
    { path: "/espace/dashboard", admin: "ok", membre: "ok" },
    { path: "/espace/historique", admin: "ok", membre: "ok" },
    { path: "/espace/mes-indisponibilites", admin: "ok", membre: "ok" },
    { path: "/espace/profil", admin: "ok", membre: "ok" },
    { path: "/espace/chants", admin: "ok", membre: "ok" },
    { path: `/espace/chants/${songId}`, admin: "ok", membre: "ok" },
    { path: "/espace/gestion", admin: "ok", membre: "ok" },
    { path: `/espace/gestion/${teamId}`, admin: "ok", membre: "redirect" },
    { path: "/espace/admin/plans", admin: "ok", membre: "ok" },
    { path: `/espace/admin/plans/${planId}`, admin: "ok", membre: "ok" },
    { path: `/espace/admin/plans/${planId}/setlist`, admin: "ok", membre: "ok" },
    { path: `/espace/admin/plans/${planId}/setlist/projector`, admin: "ok", membre: "ok" },
    { path: "/espace/admin/plans/nouveau", admin: "ok", membre: "redirect" },
    { path: "/espace/admin", admin: "ok", membre: "redirect" },
    { path: `/espace/admin/benevoles/${memberId}`, admin: "ok", membre: "redirect" },
    { path: "/espace/admin/inviter", admin: "ok", membre: "redirect" },
    { path: "/espace/admin/equipes", admin: "ok", membre: "redirect" },
    // Un simple membre ne voit la page que d'une équipe dont il fait partie
    { path: `/espace/admin/equipes/${teamId}`, admin: "ok", membre: "redirect" },
    { path: "/espace/admin/chants", admin: "ok", membre: "redirect" },
    { path: "/espace/admin/chants/nouveau", admin: "ok", membre: "redirect" },
    { path: "/espace/admin/mediatheque", admin: "ok", membre: "redirect" },
    { path: "/espace/admin/parametres", admin: "ok", membre: "redirect" },
    { path: "/espace/admin/parametres/projection", admin: "ok", membre: "redirect" },
    { path: "/espace/admin/pastorale", admin: "ok", membre: "redirect" },
    { path: "/espace/admin/site", admin: "ok", membre: "redirect" },
    { path: "/espace/admin/stats", admin: "ok", membre: "redirect" },
  ];

  const browser: Browser = await chromium.launch();
  const problems: string[] = [];

  for (const [who, email] of [["admin", adminEmail], ["membre", membreEmail]] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE}/espace/login`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await Promise.all([page.waitForURL(/\/espace\/(dashboard|set-password)/, { timeout: 20_000 }), page.click('button[type="submit"]')]);
    if (!page.url().includes("/espace/dashboard")) problems.push(`${who} : connexion → ${page.url()}`);

    for (const check of pages) {
      const expected = check[who];
      const response = await page.goto(`${BASE}${check.path}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const finalPath = new URL(page.url()).pathname;
      const status = response?.status() ?? 0;
      const html = await page.content();
      const crashed = status >= 500 || /Application error|__next_error__|Internal Server Error/.test(html) || /This page couldn.t load/i.test(html);
      const redirected = finalPath !== check.path.split("?")[0];
      if (crashed) problems.push(`${who} ${check.path} → erreur (${status})`);
      else if (expected === "ok" && redirected) problems.push(`${who} ${check.path} → redirigé vers ${finalPath} (attendu : affiché)`);
      else if (expected === "redirect" && !redirected) problems.push(`${who} ${check.path} → affiché (attendu : redirigé)`);
      console.log(`${crashed ? "✗" : "✓"} ${who.padEnd(6)} ${check.path} → ${redirected ? `→ ${finalPath}` : status}`);
    }
    await context.close();
  }

  await browser.close();
  if (problems.length > 0) {
    console.error(`\n${problems.length} problème(s) :\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log("\nTout est conforme.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
