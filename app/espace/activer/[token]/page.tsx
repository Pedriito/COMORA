import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { siteUrl as getSiteUrl } from '@/lib/site'
import { Logo } from '@/components/brand/logo'

async function activate(formData: FormData) {
  'use server'
  const token = formData.get('token') as string
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('pending_invites')
    .select('*')
    .eq('token', token)
    .single()

  if (!invite || (invite.expires_at != null && new Date(invite.expires_at) < new Date())) {
    redirect('/espace/login?error=expired')
  }

  await admin.from('pending_invites').delete().eq('token', token)

  const siteUrl = getSiteUrl()

  // Si l'email est stocké (nouvelle version) → lien régénéré à la volée, jamais expiré
  const email = invite.email ?? null
  if (email) {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${siteUrl}/espace/auth/confirm` },
    })
    if (linkData?.properties?.action_link) {
      redirect(linkData.properties.action_link)
    }
    console.error('[activate] generateLink failed:', linkError?.message)
  }

  // Fallback : ancienne version — utilise l'action_link stocké (peut être expiré si > 1h)
  const actionLink = invite.action_link ?? null
  if (actionLink) {
    redirect(actionLink)
  }

  redirect('/espace/login?error=auth')
}

export default async function ActivatePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('pending_invites')
    .select('expires_at')
    .eq('token', token)
    .single()

  if (!invite || (invite.expires_at != null && new Date(invite.expires_at) < new Date())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4">
        <div className="text-center space-y-3">
          <p className="font-sans text-dark/60">Ce lien d'invitation a expiré ou est invalide.</p>
          <a href="/espace/login" className="text-teal text-sm font-sans hover:underline">
            ← Se connecter
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

          <form action={activate}>
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
