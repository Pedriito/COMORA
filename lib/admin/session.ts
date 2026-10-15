import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/*
 * Accès à /admin par mot de passe unique.
 * - ADMIN_PASSWORD et ADMIN_SESSION_SECRET restent côté serveur (pas de
 *   préfixe NEXT_PUBLIC_) : ils ne sont jamais inclus dans le JavaScript envoyé.
 * - Le cookie ne contient pas le mot de passe, seulement une date d'expiration
 *   signée (HMAC). Il est HttpOnly : illisible depuis le JavaScript de la page.
 * - Changer le mot de passe ou le secret invalide toutes les sessions.
 */

export const ADMIN_COOKIE = "comora_admin";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

type AdminConfig = { password: string; secret: string };

export function readAdminConfig(env: Record<string, string | undefined> = process.env): AdminConfig | null {
  const password = env.ADMIN_PASSWORD ?? "";
  const secret = env.ADMIN_SESSION_SECRET ?? "";
  // Un secret court se devine : on refuse plutôt que d'ouvrir une porte fragile.
  if (password.length < 12 || secret.length < 32) return null;
  return { password, secret };
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/** Comparaison en temps constant, quelle que soit la longueur saisie. */
export function passwordMatches(input: string, expected: string) {
  return timingSafeEqual(sha256(input), sha256(expected));
}

function signature(expiresAt: number, config: AdminConfig) {
  return createHmac("sha256", config.secret)
    .update(`admin:${expiresAt}:`)
    .update(sha256(config.password))
    .digest("base64url");
}

export function signSession(config: AdminConfig, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + ADMIN_SESSION_SECONDS;
  return `${expiresAt}.${signature(expiresAt, config)}`;
}

export function verifySession(value: string | undefined, config: AdminConfig, now = Date.now()) {
  if (!value) return false;
  const [rawExpiry, sig, ...rest] = value.split(".");
  const expiresAt = Number(rawExpiry);
  if (rest.length > 0 || !sig || !Number.isInteger(expiresAt)) return false;
  if (expiresAt <= Math.floor(now / 1000)) return false;

  const expected = Buffer.from(signature(expiresAt, config));
  const received = Buffer.from(sig);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function isAdmin() {
  // Lire les cookies d'abord : la page reste rendue à chaque requête, même si
  // les variables manquent au moment du build.
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  const config = readAdminConfig();
  return config ? verifySession(value, config) : false;
}

/** À appeler en tête de chaque Server Action d'administration. */
export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Accès administrateur requis.");
}

export async function startAdminSession() {
  const config = readAdminConfig();
  if (!config) throw new Error("ADMIN_PASSWORD ou ADMIN_SESSION_SECRET manquant.");
  (await cookies()).set(ADMIN_COOKIE, signSession(config), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: ADMIN_SESSION_SECONDS,
  });
}

export async function endAdminSession() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
}
