import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { sendPasswordResetEmail, sendInviteEmail } from '@/lib/email/espace'
import Link from 'next/link'
import { siteUrl as getSiteUrl } from '@/lib/site'
import { Logo } from '@/components/brand/logo'

async function requestReset(formData: FormData) {
  'use server'
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const premier = (formData.get('premier') as string) === '1'
  const sentUrl = `/espace/mot-de-passe-oublie?sent=1${premier ? '&premier=1' : ''}`

  const siteUrl = getSiteUrl()

  const admin = createAdminClient()

  // generateLink échoue si l'email n'existe pas dans Supabase Auth → pas d'énumération
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${siteUrl}/espace/auth/confirm` },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    console.log('[requestReset] generateLink failed:', linkErr?.message ?? 'no action_link', { email })
    redirect(sentUrl)
  }

  // generateLink retourne l'objet user complet
  const userId: string = (linkData as any).user?.id
  console.log('[requestReset] user found in auth:', userId, '| email:', email)

  // Récupère le prénom depuis profiles
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name')
    .eq('id', userId)
    .maybeSingle()

  // Corrige l'email manquant dans profiles (anciens comptes)
  await admin.from('profiles').update({ email }).eq('id', userId)

  // Stocke dans pending_invites pour usage via /activer/{token}
  const { data: invite, error: inviteErr } = await admin
    .from('pending_invites')
    .insert({ action_link: linkData.properties.action_link, email, user_id: userId })
    .select('token')
    .single()

  if (inviteErr || !invite) {
    console.error('[requestReset] pending_invites insert failed:', inviteErr?.message, { email, userId })
    redirect(sentUrl)
  }

  const actionUrl = `${siteUrl}/espace/activer/${invite.token}`

  try {
    if (premier) {
      // Première connexion : email d'invitation avec le bon wording
      await sendInviteEmail({
        to: email,
        firstName: profile?.first_name ?? '',
        inviteLink: actionUrl,
      })
    } else {
      // Mot de passe oublié : email de réinitialisation
      await sendPasswordResetEmail({
        to: email,
        firstName: profile?.first_name ?? '',
        resetLink: actionUrl,
      })
    }
    console.log('[requestReset] email sent OK to', email, '| premier:', premier)
  } catch (err: any) {
    console.error('[requestReset] Resend error:', err?.message, { email, premier })
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
