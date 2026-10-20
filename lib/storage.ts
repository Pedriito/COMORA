import { randomBytes } from 'node:crypto'

/*
 * Stockage cloisonné par église (voir supabase/migrations/…_stockage.sql).
 * Tout fichier vit sous `<church_id>/<dossier>/<nom aléatoire>.<ext>` ; les
 * policies refusent un dépôt hors du dossier d'une église dont le compte est
 * responsable.
 */

/** Images (annonces, médiathèque, fonds, photo des pasteurs) : lien public, nom aléatoire. */
export const PUBLIC_BUCKET = 'church-public'
/** Documents (PDF de prédication) : membres de l'église seulement, via URL signée. */
export const PRIVATE_BUCKET = 'church-private'

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}
const DOCUMENT_TYPES: Record<string, string> = { 'application/pdf': 'pdf' }

export type FileKind = 'image' | 'document'

/** Extension autorisée pour ce type MIME, ou null si le type est refusé. */
export function extensionFor(kind: FileKind, mimeType: string): string | null {
  return (kind === 'image' ? IMAGE_TYPES : DOCUMENT_TYPES)[mimeType] ?? null
}

/** Chemin d'un nouveau fichier d'église : le nom d'origine n'est jamais réutilisé. */
export function churchFilePath(churchId: string, folder: string, extension: string): string {
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'fichiers'
  return `${churchId}/${safeFolder}/${Date.now()}-${randomBytes(8).toString('hex')}.${extension}`
}

/** Le chemin appartient-il bien au dossier de cette église ? (avant toute suppression) */
export function isChurchPath(churchId: string, path: string): boolean {
  return path.startsWith(`${churchId}/`) && !path.includes('..') && !path.includes('//')
}
