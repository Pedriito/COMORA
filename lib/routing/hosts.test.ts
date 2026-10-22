import { describe, expect, it } from "vitest";
import { classifyHost, routeRequest } from "./hosts";

const ROOT = "comora.fr";
const route = (href: string) => {
  const url = new URL(href);
  return routeRequest(url, url.host, ROOT);
};

describe("classifyHost", () => {
  it.each([
    ["comora.fr", { kind: "marketing" }],
    ["www.comora.fr", { kind: "marketing" }],
    ["app.comora.fr", { kind: "app" }],
    ["la-source.comora.fr", { kind: "site", slug: "la-source" }],
    ["app.localhost:3000", { kind: "app" }],
    ["la-source.localhost:3000", { kind: "site", slug: "la-source" }],
    ["localhost:3000", { kind: "path" }],
    ["comora-git-feature-pedriito.vercel.app", { kind: "path" }],
    ["admin.comora.fr", { kind: "path" }],
    ["api.comora.fr", { kind: "path" }],
    ["a.b.comora.fr", { kind: "path" }],
    ["evil-comora.fr", { kind: "path" }],
    ["", { kind: "path" }],
  ])("%s", (host, expected) => {
    expect(classifyHost(host, ROOT)).toEqual(expected);
  });
});

describe("routeRequest", () => {
  it("sert l'espace sur app.comora.fr", () => {
    expect(route("https://app.comora.fr/")).toEqual({ action: "redirect", url: "https://app.comora.fr/espace/dashboard", status: 307 });
    expect(route("https://app.comora.fr/espace/admin/plans")).toEqual({ action: "next" });
    expect(route("https://app.comora.fr/chants")).toEqual({ action: "rewrite", pathname: "/espace/chants" });
  });

  it("sert le site public d'une église sur son sous-domaine", () => {
    expect(route("https://la-source.comora.fr/")).toEqual({ action: "rewrite", pathname: "/sites/la-source" });
    expect(route("https://la-source.comora.fr/espace/dashboard")).toEqual({
      action: "redirect",
      url: "https://app.comora.fr/espace/dashboard",
      status: 308,
    });
  });

  it("envoie l'espace et les sites vers leur domaine depuis comora.fr", () => {
    expect(route("https://comora.fr/espace/login")).toEqual({ action: "redirect", url: "https://app.comora.fr/espace/login", status: 308 });
    expect(route("https://comora.fr/sites/la-source")).toEqual({ action: "redirect", url: "https://la-source.comora.fr/", status: 308 });
    expect(route("https://comora.fr/")).toEqual({ action: "next" });
  });

  it("redirige les anciennes adresses /benevoles", () => {
    expect(route("https://comora.fr/benevoles/admin/plans?vue=mois")).toEqual({
      action: "redirect",
      url: "https://app.comora.fr/espace/admin/plans?vue=mois",
      status: 308,
    });
    expect(route("http://localhost:3000/benevoles/login")).toEqual({ action: "redirect", url: "http://localhost:3000/espace/login", status: 308 });
  });

  it("garde le routage par chemin en local et en prévisualisation", () => {
    expect(route("http://localhost:3000/espace/dashboard")).toEqual({ action: "next" });
    expect(route("https://comora-abc.vercel.app/sites/la-source")).toEqual({ action: "next" });
  });

  it("fonctionne avec les sous-domaines de localhost", () => {
    expect(route("http://la-source.localhost:3000/")).toEqual({ action: "rewrite", pathname: "/sites/la-source" });
    expect(route("http://la-source.localhost:3000/espace/login")).toEqual({
      action: "redirect",
      url: "http://app.localhost:3000/espace/login",
      status: 308,
    });
  });

  it("sert les pages légales sur tous les domaines, sans les réécrire", () => {
    for (const host of ["https://comora.fr", "https://app.comora.fr", "https://la-source.comora.fr"]) {
      for (const page of ["/cgv", "/confidentialite", "/mentions-legales"]) {
        expect(route(`${host}${page}`), `${host}${page}`).toEqual({ action: "next" });
      }
    }
  });

  it("laisse passer les fichiers partagés et l'API sur tous les domaines", () => {
    for (const href of ["https://la-source.comora.fr/_next/static/x.js", "https://app.comora.fr/api/cron/reminders", "https://la-source.comora.fr/icons/icon-192.png", "https://app.comora.fr/sw.js"]) {
      expect(route(href), href).toEqual({ action: "next" });
    }
  });
});
