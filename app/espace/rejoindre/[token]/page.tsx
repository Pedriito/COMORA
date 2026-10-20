import { createAdminClient } from '@/lib/supabase/admin'
import { RegisterForm } from './RegisterForm'
import { Logo } from '@/components/brand/logo'

export default async function RejoindreTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: tk } = await admin
    .from('invite_tokens')
    .select('id, label, expires_at, max_uses, uses_count, revoked_at')
    .eq('token', token)
    .single()

  const invalid =
    !tk ||
    !!tk.revoked_at ||
    (tk.expires_at && new Date(tk.expires_at) < new Date()) ||
    (tk.max_uses && tk.uses_count >= tk.max_uses)

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="flex justify-center"><Logo size={44} word="serif" /></h1>
          <p className="mt-2 text-sm text-teal font-sans uppercase tracking-widest">
            Rejoindre l'équipe bénévoles
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-teal/20 p-8">
          {invalid ? (
            <div className="text-center space-y-3 py-4">
              <div className="text-4xl">🔒</div>
              <h2 className="font-display text-xl text-dark font-light">Lien invalide</h2>
              <p className="font-sans text-sm text-dark/50">
                Ce lien d'inscription n'est plus valide.<br />
                Demande un nouveau lien à l'équipe.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-display text-2xl text-dark font-light mb-1">Créer mon compte</h2>
                {tk.label && (
                  <p className="font-sans text-xs text-teal/60 uppercase tracking-wide">{tk.label}</p>
                )}
                <p className="font-sans text-sm text-dark/50 mt-1">
                  Remplis le formulaire pour rejoindre l'espace bénévoles.
                </p>
              </div>
              <RegisterForm token={token} />
            </>
          )}
        </div>

        <p className="text-center mt-6 text-xs text-dark/30 font-sans">
          Tu as déjà un compte ?{' '}
          <a href="/espace/login" className="text-teal hover:underline">Se connecter</a>
        </p>
      </div>
    </div>
  )
}
