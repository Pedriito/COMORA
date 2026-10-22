import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("accepte un chemin de l'espace", () => {
    expect(safeNextPath("/espace/creer")).toBe("/espace/creer");
    expect(safeNextPath("/espace/admin/plans?vue=mois")).toBe("/espace/admin/plans?vue=mois");
  });

  it.each([
    "https://pirate.example/espace/creer",
    "//pirate.example",
    "/\\pirate.example",
    "/espace/../admin",
    "/espace//pirate.example",
    "/autre-page",
    "espace/creer",
    "javascript:alert(1)",
    "/espace/\nSet-Cookie: x=1",
  ])("refuse %j", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it("utilise la valeur de repli", () => {
    expect(safeNextPath(null, "/espace/dashboard")).toBe("/espace/dashboard");
    expect(safeNextPath("https://x", "/espace/dashboard")).toBe("/espace/dashboard");
  });
});
