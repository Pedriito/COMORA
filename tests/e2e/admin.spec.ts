import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { E2E_ADMIN_PASSWORD } from "../../playwright.config";

test.describe("page /admin", () => {
  test("refuse un mauvais mot de passe", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
    await page.getByLabel("Mot de passe").fill("pas-le-bon");
    await page.getByRole("button", { name: "Entrer" }).click();
    await expect(page.locator("#login-error")).toHaveText("Mot de passe incorrect.");
    await expect(page.getByText("Demandes d’accès anticipé")).toHaveCount(0);
  });

  test("le bon mot de passe ouvre le tableau de bord, session invisible du JavaScript", async ({ page, context }) => {
    await page.goto("/admin");
    await page.getByLabel("Mot de passe").fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Entrer" }).click();
    await expect(page.getByRole("heading", { name: "Demandes d’accès anticipé" })).toBeVisible();
    await expect(page.getByText("Supabase n’est pas configuré")).toBeVisible();

    const [session] = (await context.cookies()).filter((cookie) => cookie.name === "comora_admin");
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/admin" });
    expect(session.value).not.toContain(E2E_ADMIN_PASSWORD);
    expect(await page.evaluate(() => document.cookie)).not.toContain("comora_admin");

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page.getByRole("button", { name: "Entrer" })).toBeVisible();
  });

  test("pages privées : non indexées, sans cache ni referrer", async ({ request }) => {
    for (const url of ["/admin", "/inscription/inconnu"]) {
      const response = await request.get(url);
      expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
      expect(response.headers()["referrer-policy"]).toBe("no-referrer");
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
  });

  test("le mot de passe n'apparaît ni dans les pages ni dans le JavaScript envoyé", async ({ request }) => {
    for (const url of ["/", "/demande-acces", "/admin", "/connexion"]) {
      expect(await (await request.get(url)).text()).not.toContain(E2E_ADMIN_PASSWORD);
    }
    const dir = path.join(process.cwd(), ".next", "static");
    const files = (await readdir(dir, { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile());
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = await readFile(path.join(file.parentPath, file.name), "utf8");
      expect(content, file.name).not.toContain(E2E_ADMIN_PASSWORD);
      expect(content, file.name).not.toContain("ADMIN_SESSION_SECRET");
    }
  });
});

test("un lien d'inscription invalide est refusé proprement", async ({ page }) => {
  await page.goto("/inscription/lien-invalide");
  await expect(page.getByRole("heading", { name: "Lien indisponible" })).toBeVisible();
  await expect(page.getByText("Ce lien n’est pas valide")).toBeVisible();
});
