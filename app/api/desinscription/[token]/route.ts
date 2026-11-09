import { createAdminClient } from '@/lib/supabase/admin'
import { setUnsubscribed, verifyUnsubscribeToken } from '@/lib/email/unsubscribe'

/*
 * Désinscription « en un clic » (RFC 8058) : la messagerie (Gmail, Apple Mail…) envoie un POST
 * sur l'adresse de l'en-tête List-Unsubscribe. Le jeton signé suffit : aucune session.
 * Un simple GET ne désinscrit personne (les antivirus ouvrent les liens) : il renvoie vers la page de confirmation.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const userId = verifyUnsubscribeToken(token)
  if (!userId) return new Response('Lien invalide ou expiré', { status: 400 })
  try {
    // Clé secrète : la personne n'est pas connectée ; son identité vient du jeton signé.
    await setUnsubscribed(createAdminClient(), userId, true)
  } catch {
    return new Response('Erreur', { status: 500 })
  }
  return new Response(null, { status: 200 })
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return Response.redirect(new URL(`/espace/desinscription/${encodeURIComponent(token)}`, req.url), 303)
}
