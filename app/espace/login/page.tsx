import { login } from './actions'
import Link from 'next/link'
import { FirstLoginButton } from './FirstLoginButton'
import { PasswordInput } from '../_components/PasswordInput'
import { Logo } from '@/components/brand/logo'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo / titre */}
        <div className="text-center mb-10">
          <h1 className="flex justify-center"><Logo size={44} word="serif" /></h1>
          <p className="mt-2 text-sm text-teal-dark font-sans uppercase tracking-widest">
            Espace bénévoles
          </p>
        </div>

        {/* Carte */}
        <div className="bg-white rounded-2xl shadow-sm border border-teal/20 p-8">
          <h2 className="font-display text-2xl text-dark font-light mb-6">
            Connexion
          </h2>

          <form action={login} className="space-y-5">
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
                className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
                placeholder="prenom@exemple.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-sans text-dark/70">
                  Mot de passe
                </label>
                <Link
                  href="/espace/mot-de-passe-oublie"
                  className="text-xs text-teal font-sans hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <PasswordInput
                id="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <input
                id="remember_me"
                name="remember_me"
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded accent-teal cursor-pointer"
              />
              <label htmlFor="remember_me" className="text-sm font-sans text-dark/60 cursor-pointer select-none">
                Rester connecté sur cet appareil
              </label>
            </div>

            <ErrorMessage searchParams={searchParams} />

            <button
              type="submit"
              className="w-full py-3 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal-dark transition-colors"
            >
              Se connecter
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-teal/10">
            <FirstLoginButton />
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-dark/40 font-sans">
          Accès réservé aux bénévoles invités par l'équipe.
        </p>
      </div>
    </div>
  )
}

const loginErrors: Record<string, string> = {
  credentials: 'Email ou mot de passe incorrect. Vérifie tes identifiants.',
  expired: 'Ce lien a expiré ou a déjà été utilisé. Demande un nouveau lien avec « Première connexion » ou « Mot de passe oublié ».',
  auth: 'La connexion a échoué. Réessaie.',
}

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  if (!params.error) return null
  return (
    <p className="text-sm text-red-500 font-sans">
      {loginErrors[params.error] ?? loginErrors.credentials}
    </p>
  )
}
