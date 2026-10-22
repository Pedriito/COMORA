import "server-only";
import { headers } from "next/headers";
import { appUrl } from "@/lib/site";
import { rootDomain } from "@/lib/routing/hosts";

/** Hôte appartenant à Comora (domaine racine, sous-domaines) ou au poste local. */
export function isTrustedHost(host: string, root = rootDomain()): boolean {
  const hostname = host.toLowerCase().split(":")[0];
  return (
    hostname === root ||
    hostname.endsWith(`.${root}`) ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * Origine de la requête en cours, pour les liens envoyés par e-mail (confirmation,
 * connexion). Un hôte inconnu est ignoré : on retombe sur l'adresse configurée.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host && isTrustedHost(host)) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return appUrl() || `https://app.${rootDomain()}`;
}
