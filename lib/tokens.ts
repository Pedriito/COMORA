import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/*
 * Jetons des liens publics (calendrier, partage, invitation, activation,
 * réponse à une affectation).
 *
 * • Jetons opaques : 256 bits aléatoires transmis dans le lien ; seule leur
 *   empreinte SHA-256 est stockée, une fuite de la base ne donne aucun lien.
 * • Jetons signés : charge utile + expiration signées par HMAC avec
 *   APP_TOKEN_SECRET, pour les liens qui n'ont pas besoin d'être révoqués
 *   individuellement (réponse à une affectation depuis un e-mail).
 */

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Forme d'un jeton opaque, vérifiée avant toute requête en base. */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}

export function daysFromNow(days: number, now = Date.now()): Date {
  return new Date(now + days * 24 * 60 * 60 * 1000)
}

function secret(): Buffer {
  const value = process.env.APP_TOKEN_SECRET
  if (!value || value.length < 32) throw new Error('APP_TOKEN_SECRET manquant ou trop court (32 caractères minimum)')
  return Buffer.from(value)
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url')
}

/** Jeton signé : `<charge>.<expiration>.<signature>`. `purpose` évite qu'un jeton serve à autre chose. */
export function signToken(purpose: string, payload: string, expiresAt: Date): string {
  const exp = Math.floor(expiresAt.getTime() / 1000).toString(36)
  const body = `${Buffer.from(payload).toString('base64url')}.${exp}`
  return `${body}.${sign(`${purpose}:${body}`)}`
}

/** Charge utile d'un jeton signé valide et non expiré, sinon null. */
export function verifyToken(purpose: string, token: string, now = Date.now()): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [payload, exp, signature] = parts
  const expected = Buffer.from(sign(`${purpose}:${payload}.${exp}`))
  const given = Buffer.from(signature)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  if (parseInt(exp, 36) * 1000 < now) return null
  try {
    return Buffer.from(payload, 'base64url').toString('utf8')
  } catch {
    return null
  }
}
