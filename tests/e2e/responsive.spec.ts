import { expect, test, type Page } from "@playwright/test";

/** Du plus petit téléphone courant (iPhone SE 1re gén.) au grand écran. */
const WIDTHS = [320, 375, 414, 768, 1024, 1440];
const PAGES = ["/", "/cgv", "/confidentialite", "/espace/inscription", "/page-inexistante"];

/** Éléments visibles qui dépassent à droite du viewport, sans ancêtre qui les rogne. */
async function overflowingElements(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const clipped = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const { overflowX } = getComputedStyle(p);
        if (overflowX !== "visible") return true;
      }
      return false;
    };
    const out: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      // Rien à voir, ou volontairement hors écran (champ piège anti-spam, lien d'évitement).
      if (r.width === 0 || r.height === 0 || r.right <= 0) continue;
      if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) {
        const id = el.id ? `#${el.id}` : "";
        const cls = typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 4).join(".")}` : "";
        out.push(`${el.tagName.toLowerCase()}${id}${cls} [${Math.round(r.left)}→${Math.round(r.right)}]`);
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, vw, offenders: out.slice(0, 10) };
  });
}

test.describe("responsive : aucun défilement horizontal", () => {
  // Les largeurs sont imposées à la main : inutile de tout rejouer sur le projet mobile.
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop"));

  for (const width of WIDTHS) {
    for (const url of PAGES) {
      test(`${url} à ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        // Fait défiler toute la page pour déclencher les apparitions au défilement.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 30));
          }
          window.scrollTo(0, 0);
        });
        const result = await overflowingElements(page);
        expect(result.scrollWidth, JSON.stringify(result, null, 2)).toBeLessThanOrEqual(result.vw);
        expect(result.offenders, JSON.stringify(result, null, 2)).toEqual([]);
      });
    }
  }

  // Sous 16 px, Safari iOS zoome sur le champ dès qu'on le touche, et la page reste agrandie.
  for (const url of ["/", "/espace/inscription"]) {
    test(`${url} : champs lisibles sans zoom sur iPhone`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto(url);
      const small = await page
        .locator("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea")
        .evaluateAll((fields) =>
          fields
            .filter((field) => parseFloat(getComputedStyle(field).fontSize) < 16)
            .map((field) => field.getAttribute("name") ?? field.getAttribute("aria-label")),
        );
      expect(small).toEqual([]);
    });
  }
});
