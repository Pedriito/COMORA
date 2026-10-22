/**
 * Redirection interne demandée par un paramètre `next` : uniquement un chemin de
 * l'espace (jamais une adresse externe, ni `//hôte`, ni un chemin qui remonte).
 */
export function safeNextPath(next: string | null | undefined, fallback: string | null = null): string | null {
  if (!next) return fallback;
  if (!next.startsWith("/espace/") && next !== "/espace") return fallback;
  if (next.includes("//") || next.includes("\\") || next.includes("..") || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
