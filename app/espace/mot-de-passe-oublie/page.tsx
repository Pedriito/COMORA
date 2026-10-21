import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { sendPasswordResetEmail, sendInviteEmail } from '@/lib/email/espace'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { activationUrl, createActivation, isEmail } from '../activer/activation'

/**
 * Envoie un lien d'activation (même nature que l'invitation : jeton haché,
 * 72 h, usage unique). La réponse est identique que le compte existe ou non.
 */
async function requestReset(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const premier = formData.get('premier') === '1'
  const sentUrl = `/espace/mot-de-passe-oublie?sent=1${premier ? '&premier=1' : ''}`
  if (!isEmail(email)) redirect(sentUrl)

  // Clé secrète : recherche du compte (API Auth) et création du lien d'activation
  const admin = createAdminClient()

  // generateLink renvoie le compte de cette adresse, ou une erreur s'il n'existe pas.
  // Le lien produit n'est ni envoyé ni stocké : celui de Supabase sera généré au clic.
  const { data: linkData } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  const userId = linkData?.user?.id
  if (!userId) redirect(sentUrl)

  // Église du lien : la plus ancienne appartenance encore ouverte du compte
  const { data: membership } = await admin
    .from('church_memberships')
    .select('church_id')
    .eq('user_id', userId)
    .in('status', ['active', 'invited'])
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!membership) redirect(sentUrl)

  const token = await createActivation(admin, membership.church_id, userId)
  if (!token) redirect(sentUrl)

  const { data: profile } = await admin.from('profiles').select('first_name').eq('id', userId).maybeSingle()
  const firstName = profile?.first_name ?? ''

  try {
    if (premier) {
      await sendInviteEmail({ to: email, firstName, inviteLink: activationUrl(token) })
    } else {
      await sendPasswordResetEmail({ to: email, firstName, resetLink: activationUrl(token) })
    }
  } catch {
    console.error('[requestReset] envoi de l’e-mail impossible')
  }

  redirect(sentUrl)
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; premier?: string }>
}) {
  const params = await searchParams
  const sent = !!params.sent
  const isFirstLogin = !!params.premier

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="flex justify-center"><Logo size={44} word="serif" /></h1>
          <p className="mt-2 text-sm text-teal-dark font-sans uppercase tracking-widest">
            Espace bénévoles
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-teal/20 p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-teal/10 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-display text-2xl text-dark font-light">Email envoyé !</h2>
              <p className="text-sm text-dark/50 font-sans">
                {isFirstLogin
                  ? "Si ton adresse est dans notre système, tu vas recevoir un lien pour créer ton mot de passe."
                  : "Si ton adresse est dans notre système, tu vas recevoir un lien pour réinitialiser ton mot de passe."}
              </p>
              <Link
                href="/espace/login"
                className="inline-block mt-2 text-sm text-teal font-sans hover:underline"
              >
                ← Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl text-dark font-light mb-2">
                {isFirstLogin ? 'Créer mon mot de passe' : 'Mot de passe oublié'}
              </h2>
              <p className="text-sm text-dark/50 font-sans mb-6">
                {isFirstLogin
                  ? "Saisis ton adresse email et tu recevras un lien pour créer ton mot de passe et accéder à ton espace."
                  : "Saisis ton adresse email et tu recevras un lien pour choisir un nouveau mot de passe."}
              </p>

              <form action={requestReset} className="space-y-5">
                <input type="hidden" name="premier" value={isFirstLogin ? '1' : '0'} />
                <div>
                  <label htmlFor="email" className="block text-sm font-sans text-dark/70 mb-1.5">
                    Adresse email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="prenom@exemple.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal-dark transition-colors"
                >
                  {isFirstLogin ? 'Recevoir mon lien de création' : 'Envoyer le lien'}
                </button>
              </form>

              <Link
                href="/espace/login"
                className="block text-center mt-5 text-sm text-dark/40 font-sans hover:text-dark/70 transition-colors"
              >
                ← Retour à la connexion
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
