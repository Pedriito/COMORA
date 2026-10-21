import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken, isWellFormedToken } from '@/lib/tokens'
import { Logo } from '@/components/brand/logo'
import { activateAccount } from './actions'

/** Le lien est-il encore utilisable ? Lecture seule : rien n'est consommé à l'affichage. */
async function isUsable(token: string): Promise<boolean> {
  if (!isWellFormedToken(token)) return false
  // Clé secrète : page publique à jeton (account_activations n'a aucune policy)
  const { data } = await createAdminClient()
    .from('account_activations')
    .select('id')
    .eq('token_hash', hashToken(token))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return !!data
}

export default async function ActivatePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  if (!(await isUsable(token))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4">
        <div className="text-center space-y-3">
          <p className="font-sans text-dark/60">Ce lien a expiré ou a déjà été utilisé.</p>
          <a href="/espace/mot-de-passe-oublie?premier=1" className="text-teal text-sm font-sans hover:underline">
            Recevoir un nouveau lien
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="flex justify-center"><Logo size={44} word="serif" /></h1>
          <p className="mt-2 text-sm text-teal-dark font-sans uppercase tracking-widest">
            Espace bénévoles
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-teal/20 p-8 text-center">
          <h2 className="font-display text-2xl text-dark font-light mb-3">
            Bienvenue !
          </h2>
          <p className="text-sm text-dark/50 font-sans mb-8">
            Clique sur le bouton ci-dessous pour créer ton mot de passe et activer ton compte bénévole.
          </p>

          <form action={activateAccount}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="w-full py-3 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal-dark transition-colors"
            >
              Activer mon compte →
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
