import { expect, test } from "@playwright/test";

test.describe("espace de gestion", () => {
  test("les anciennes adresses /benevoles redirigent vers /espace", async ({ request }) => {
    const response = await request.get("/benevoles/admin/plans?vue=mois", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    const location = new URL(response.headers()["location"], "http://localhost");
    expect(location.pathname + location.search).toBe("/espace/admin/plans?vue=mois");
  });

  test("le manifest décrit l'application Comora", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.name).toBe("Comora");
    expect(manifest.start_url).toBe("/espace/dashboard");
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).ok()).toBe(true);
    }
  });

  test("les pages de l'espace ne sont ni indexées ni mises en cache", async ({ request }) => {
    const response = await request.get("/espace/login", { maxRedirects: 0 });
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response.headers()["cache-control"]).toContain("no-store");
  });
});
