import 'server-only'
import { readSheet } from 'read-excel-file/node'
import { buildPreview, decodeCsv, MAX_IMPORT_BYTES, parseDelimited, type ImportPreview } from './members-import'

export type ReadResult = { ok: true; preview: ImportPreview } | { ok: false; error: string }

const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04] // « PK » : un .xlsx est une archive zip
const XLS_MAGIC = [0xd0, 0xcf, 0x11, 0xe0] // ancien format Excel (.xls)

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((b, i) => bytes[i] === b)

/** Lit un fichier CSV ou Excel envoyé par la personne et renvoie l'aperçu contrôlé. */
export async function readMembersFile(file: File | null): Promise<ReadResult> {
  if (!file || file.size === 0) return { ok: false, error: 'Choisissez un fichier à importer.' }
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: 'Ce fichier est trop volumineux (2 Mo au maximum).' }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  try {
    if (startsWith(bytes, XLS_MAGIC)) {
      return { ok: false, error: 'Ce fichier est au très ancien format Excel (.xls). Enregistrez-le en « .xlsx » ou en « CSV », puis réessayez.' }
    }
    if (startsWith(bytes, XLSX_MAGIC)) {
      const table = await readSheet(Buffer.from(bytes))
      return { ok: true, preview: buildPreview(table) }
    }
    if (name.endsWith('.csv') || name.endsWith('.txt') || file.type.startsWith('text/')) {
      return { ok: true, preview: buildPreview(parseDelimited(decodeCsv(bytes))) }
    }
  } catch {
    return { ok: false, error: 'Ce fichier n’a pas pu être lu. Vérifiez qu’il n’est pas protégé par un mot de passe, ou enregistrez-le en CSV.' }
  }
  return { ok: false, error: 'Format non pris en charge. Utilisez un fichier Excel (.xlsx) ou CSV.' }
}
