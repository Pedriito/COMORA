import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUnsubscribed, setUnsubscribed, verifyUnsubscribeToken } from '@/lib/email/unsubscribe'
import { siteConfig } from '@/lib/site'

async function change(formData: FormData) {
  'use server'
  const token = String(formData.get('token') ?? '')
  const userId = verifyUnsubscribeToken(token)
  if (!userId) redirect(`/espace/desinscription/${encodeURIComponent(token)}`)
  const unsubscribe = formData.get('action') === 'unsubscribe'
  // Clé secrète : la personne n'est pas connectée ; son identité vient du jeton signé.
  await setUnsubscribed(createAdminClient(), userId, unsubscribe)
  redirect(`/espace/desinscription/${encodeURIComponent(token)}`)
}

export default async function DesinscriptionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const userId = verifyUnsubscribeToken(token)

  let unsubscribed = false
  let failed = false
  if (userId) {
    try {
      unsubscribed = await isUnsubscribed(createAdminClient(), userId)
    } catch {
      failed = true
    }
  }

  return (
    <div className="min-h-screen bg-teal-50 flex items-center justify-center px-6 py-16">
      <div className="bg-white rounded-2xl border border-teal/20 p-8 max-w-md w-full space-y-6">
        <div className="text-center">
          <p className="font-sans text-xs tracking-[0.3em] uppercase text-teal mb-1">{siteConfig.name}</p>
          <h1 className="font-display text-2xl text-dark font-light">Rappels par e-mail</h1>
        </div>

        {!userId || failed ? (
          <p className="font-sans text-sm text-dark/60 text-center">
            {failed ? 'Une erreur est survenue. Réessayez dans quelques instants.' : 'Lien invalide ou expiré.'}
          </p>
        ) : (
          <>
            <p className="font-sans text-sm text-dark/70 text-center">
              {unsubscribed
                ? 'Vous êtes désinscrit(e) : vous ne recevrez plus nos conseils de démarrage ni nos rappels de fin d’essai.'
                : 'Voulez-vous ne plus recevoir nos conseils de démarrage et nos rappels de fin d’essai ?'}
            </p>
            <form action={change} className="flex justify-center">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="action" value={unsubscribed ? 'subscribe' : 'unsubscribe'} />
              <button type="submit" className="rounded-xl bg-dark px-6 py-3 font-sans text-sm font-semibold text-white hover:opacity-90">
                {unsubscribed ? 'Me réinscrire' : 'Me désinscrire'}
              </button>
            </form>
            <p className="font-sans text-xs text-dark/50 text-center">
              Vous continuerez à recevoir les messages liés à votre espace : bienvenue, paiement, résiliation et suppression des données.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
