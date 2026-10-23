import { requireChurch } from '@/lib/auth/church'
import { TEMPLATE_CSV } from '@/lib/onboarding/members-import'

/** Modèle de fichier d'import, réservé aux administrateurs connectés. */
export async function GET() {
  await requireChurch('admin')
  return new Response(TEMPLATE_CSV, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modele-import-membres.csv"',
      'Cache-Control': 'private, no-store',
    },
  })
}
