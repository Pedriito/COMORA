import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou de l'étape 1 : aucune référence à l'église d'origine de l'appli
 * (nom, ville, domaine, personnes) ne doit revenir dans le code de Comora.
 * Seule exception : la section « origine » de la landing, qui raconte
 * l'histoire du projet avec l'accord de l'église.
 */
const ROOT = join(__dirname, "../..");
const SCANNED = ["app", "components", "lib", "packages", "public", "scripts", "tests", "proxy.ts", "README.md", "package.json", "next.config.ts"];
const ALLOWED = new Set(["components/landing/origin.tsx", "tests/unit/brand.test.ts"]);
const FORBIDDEN = /la rencontre|lieusaint|egliselarencontre|eglise-la-rencontre|salafranque|audrey_nico/i;
const TEXT = /\.(tsx?|mjs|js|css|html|json|md|txt|svg)$/;

function walk(path: string): string[] {
  const stats = statSync(path);
  if (!stats.isDirectory()) return [path];
  return readdirSync(path)
    .filter((name) => name !== "node_modules" && name !== "dist")
    .flatMap((name) => walk(join(path, name)));
}

describe("branding Comora", () => {
  it("ne contient plus de référence à l'église d'origine", () => {
    const offenders = SCANNED.flatMap((entry) => walk(join(ROOT, entry)))
      .filter((file) => TEXT.test(file))
      .map((file) => relative(ROOT, file))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => FORBIDDEN.test(readFileSync(join(ROOT, file), "utf8")));

    expect(offenders).toEqual([]);
  });

  it("n'embarque plus les visuels de l'église d'origine dans public/", () => {
    const files = walk(join(ROOT, "public")).map((file) => relative(ROOT, file));
    expect(files.filter((file) => /^public\/logo\.png$|audrey|countdown-music|visuel-|thumbnail_youtube/.test(file))).toEqual([]);
  });
});
