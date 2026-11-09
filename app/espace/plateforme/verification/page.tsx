import { redirect } from 'next/navigation'
import { getPlatformAdmin } from '@/lib/auth/platform'
import { TotpPanel } from './TotpPanel'

export const metadata = { title: 'Vérification en deux étapes' }

export default async function VerificationPage() {
  const admin = await getPlatformAdmin() // 404 pour un compte qui n'est pas de l'équipe
  if (admin.secondFactorDone) redirect('/espace/plateforme')
  return (
    <main className="min-h-screen bg-teal-50 flex items-center justify-center px-6 py-16">
      <div className="bg-white rounded-2xl border border-teal/20 p-8 max-w-md w-full space-y-6">
        <div className="text-center">
          <p className="font-sans text-xs tracking-[0.3em] uppercase text-teal mb-1">Comora</p>
          <h1 className="font-display text-2xl text-dark font-light">Vérification en deux étapes</h1>
        </div>
        <TotpPanel />
      </div>
    </main>
  )
}
