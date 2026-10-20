import { Logo } from '@/components/brand/logo'
import { logout } from '../login/actions'

export const metadata = { title: 'Aucune église' }

/** Compte connecté mais rattaché à aucune église (invitation retirée, église supprimée…). */
export default function SansEglisePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center"><Logo size={44} word="serif" /></div>
        <div className="bg-white rounded-2xl shadow-sm border border-teal/20 p-8 space-y-4">
          <h1 className="font-display text-2xl text-dark font-light">Votre compte n’est rattaché à aucune église</h1>
          <p className="font-sans text-sm text-dark/60 leading-relaxed">
            Demandez à un responsable de votre église de vous inviter à nouveau, ou créez l’espace de votre église.
          </p>
          <form action={logout}>
            <button type="submit" className="px-5 py-2.5 rounded-lg border border-teal/30 font-sans text-sm text-dark/70 hover:bg-teal-50">
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
