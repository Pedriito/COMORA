/**
 * Routage par domaine.
 *
 *   comora.fr, www.comora.fr   → landing (et pages légales, inscription)
 *   app.comora.fr              → espace de gestion (routes /espace/…)
 *   <slug>.comora.fr           → site public de l'église (routes /sites/<slug>)
 *
 * En local : `app.localhost:3000` et `<slug>.localhost:3000` (les navigateurs
 * résolvent *.localhost sans configuration). Sur les URL de prévisualisation
 * Vercel (et sur `localhost` seul), pas de sous-domaine : les chemins
 * `/espace/…` et `/sites/<slug>` restent accessibles directement.
 *
 * Fonctions pures : testées sans serveur (lib/routing/hosts.test.ts).
 */

export type HostKind =
  | { kind: "marketing" }
  | { kind: "app" }
  | { kind: "site"; slug: string }
  /** Prévisualisation, localhost seul, domaine inconnu : routage par chemin. */
  | { kind: "path" };

export type RouteDecision =
  | { action: "next" }
  | { action: "rewrite"; pathname: string }
  | { action: "redirect"; url: string; status: 307 | 308 };

/** Sous-domaines qui ne peuvent pas être des slugs d'église. */
export const RESERVED_SUBDOMAINS = new Set([
  "app", "www", "admin", "api", "aide", "blog", "status", "mail", "docs", "support",
  "static", "assets", "cdn", "help", "legal", "compte", "connexion",
]);

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Chemins servis tels quels quel que soit le domaine (fichiers, API, PWA). */
const SHARED_PREFIXES = ["/_next", "/api", "/icons", "/email", "/videos"];
const SHARED_FILES = new Set([
  // Pages légales : accessibles depuis tous les domaines (espace, sites d'église, e-mails)
  "/cgv", "/confidentialite", "/mentions-legales",
  "/sw.js", "/offline.html", "/manifest.webmanifest", "/favicon.ico", "/icon.svg",
  "/apple-icon.png", "/robots.txt", "/sitemap.xml", "/opengraph-image.jpg",
]);

export function isSharedPath(pathname: string) {
  return SHARED_FILES.has(pathname) || SHARED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function rootDomain(): string {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "comora.fr").toLowerCase();
}

/** Nature du domaine demandé. `host` peut contenir un port. */
export function classifyHost(host: string | null | undefined, root = rootDomain()): HostKind {
  const hostname = (host ?? "").toLowerCase().split(":")[0];
  if (!hostname) return { kind: "path" };

  for (const base of [root, "localhost"]) {
    if (hostname === base) return base === root ? { kind: "marketing" } : { kind: "path" };
    if (hostname.endsWith(`.${base}`)) {
      const sub = hostname.slice(0, -(base.length + 1));
      if (sub === "www") return { kind: "marketing" };
      if (sub === "app") return { kind: "app" };
      if (!sub.includes(".") && SLUG.test(sub) && !RESERVED_SUBDOMAINS.has(sub)) return { kind: "site", slug: sub };
      return { kind: "path" };
    }
  }
  return { kind: "path" };
}

/** Domaine de l'espace et d'un site, avec le même schéma et port que la requête. */
export function appOrigin(requestOrigin: URL, root = rootDomain()) {
  return subdomainOrigin("app", requestOrigin, root);
}

export function siteOrigin(slug: string, requestOrigin: URL, root = rootDomain()) {
  return subdomainOrigin(slug, requestOrigin, root);
}

function subdomainOrigin(sub: string, requestOrigin: URL, root: string) {
  const isLocal = requestOrigin.hostname === "localhost" || requestOrigin.hostname.endsWith(".localhost");
  const base = isLocal ? "localhost" : root;
  const port = requestOrigin.port ? `:${requestOrigin.port}` : "";
  return `${requestOrigin.protocol}//${sub}.${base}${port}`;
}

/**
 * Décide quoi faire d'une requête : la laisser passer, la réécrire vers une
 * route interne, ou rediriger vers le bon domaine.
 */
export function routeRequest(url: URL, host: string | null, root = rootDomain()): RouteDecision {
  const { pathname, search } = url;
  const where = classifyHost(host, root);

  // Anciennes adresses de l'espace bénévoles
  if (pathname === "/benevoles" || pathname.startsWith("/benevoles/")) {
    const target = pathname.replace(/^\/benevoles/, "/espace");
    const origin = where.kind === "marketing" ? appOrigin(url, root) : url.origin;
    return { action: "redirect", url: `${origin}${target}${search}`, status: 308 };
  }

  if (isSharedPath(pathname)) return { action: "next" };

  switch (where.kind) {
    case "app": {
      // L'espace vit sous /espace : la racine et les chemins courts y mènent.
      if (pathname === "/") return { action: "redirect", url: `${url.origin}/espace/dashboard`, status: 307 };
      if (pathname === "/espace" || pathname.startsWith("/espace/")) return { action: "next" };
      if (pathname.startsWith("/partage/")) return { action: "next" };
      return { action: "rewrite", pathname: `/espace${pathname}` };
    }
    case "site": {
      // Le site d'une église n'expose que ses propres pages.
      if (pathname.startsWith("/espace")) {
        return { action: "redirect", url: `${appOrigin(url, root)}${pathname}${search}`, status: 308 };
      }
      const rest = pathname === "/" ? "" : pathname;
      return { action: "rewrite", pathname: `/sites/${where.slug}${rest}` };
    }
    case "marketing": {
      // En production, l'espace et les sites ont leur propre domaine.
      if (pathname === "/espace" || pathname.startsWith("/espace/") || pathname.startsWith("/partage/")) {
        return { action: "redirect", url: `${appOrigin(url, root)}${pathname}${search}`, status: 308 };
      }
      const site = pathname.match(/^\/sites\/([^/]+)(\/.*)?$/);
      if (site) return { action: "redirect", url: `${siteOrigin(site[1], url, root)}${site[2] ?? "/"}${search}`, status: 308 };
      return { action: "next" };
    }
    case "path":
      return { action: "next" };
  }
}
