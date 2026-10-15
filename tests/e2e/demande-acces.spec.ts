import { expect, test } from "@playwright/test";

test.describe("bouton « Demander mon accès »", () => {
  test("le bouton de l'accueil ouvre le formulaire", async ({ page }) => {
    await page.goto("/");
    await page.locator("#top").getByRole("link", { name: "Demander mon accès" }).click();
    await expect(page).toHaveURL(/\/demande-acces$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("20 églises fondatrices");
    await expect(page.getByLabel("Nom de l’église")).toBeVisible();
  });

  test("tous les boutons de la page mènent au formulaire", async ({ page }) => {
    await page.goto("/");
    const links = page.locator("main").getByRole("link", { name: "Demander mon accès" });
    expect(await links.count()).toBeGreaterThanOrEqual(4);
    for (const href of await links.evaluateAll((items) => items.map((a) => a.getAttribute("href")))) {
      expect(href).toBe("/demande-acces");
    }
    await expect(page.getByRole("link", { name: "Parler à l’équipe" })).toHaveAttribute(
      "href",
      "/demande-acces?offre=reseau",
    );
  });

  test("l'offre Réseau pré-coche « plusieurs sites »", async ({ page }) => {
    await page.goto("/demande-acces?offre=reseau");
    await expect(page.getByLabel(/Plusieurs sites/)).toBeChecked();
    await page.goto("/demande-acces");
    await expect(page.getByLabel(/Plusieurs sites/)).not.toBeChecked();
  });

  test("le navigateur signale les champs obligatoires", async ({ page }) => {
    await page.goto("/demande-acces");
    await page.getByLabel("Nom de l’église").fill("Église du Centre");
    await page.getByRole("button", { name: "Demander mon accès" }).click();
    await expect(page.getByRole("status")).toContainText("Merci d’indiquer au moins");
    await expect(page.getByLabel("Ville")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Pays")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Ville")).toBeFocused();
  });

  test("une demande complète part au serveur (non configuré ici)", async ({ page }) => {
    await page.goto("/demande-acces");
    await page.getByLabel("Nom de l’église").fill("Église du Centre");
    await page.getByLabel("Ville").fill("Lyon");
    await page.getByLabel("Pays").selectOption("France");
    await page.getByLabel("Nombre de membres").selectOption("30 à 100");
    await page.getByRole("checkbox", { name: "Louange" }).check();
    await page.getByLabel("Votre prénom et nom").fill("Marie Dupont");
    await page.getByLabel("E-mail").fill("marie@exemple.fr");
    await page.getByRole("button", { name: "Demander mon accès" }).click();
    // Sans Supabase, le serveur répond que les demandes ouvrent bientôt, et la saisie reste en place.
    await expect(page.getByRole("status")).toContainText("Les demandes d’accès ouvrent dans quelques jours");
    await expect(page.getByLabel("Ville")).toHaveValue("Lyon");
  });
});
