import { createHash, randomBytes } from "node:crypto";
import { siteConfig } from "@/lib/site";

/** Durée de validité d'un lien d'inscription. */
export const INVITATION_DAYS = 14;

/** Jeton aléatoire (256 bits) transmis dans le lien ; seule son empreinte est stockée. */
export function generateInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiry(now = Date.now()) {
  return new Date(now + INVITATION_DAYS * 24 * 60 * 60 * 1000);
}

export function invitationUrl(token: string) {
  return `${siteConfig.url}/inscription/${token}`;
}

/** Forme attendue d'un jeton, vérifiée avant toute requête en base. */
export function isWellFormedToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
