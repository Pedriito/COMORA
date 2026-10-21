import { requireChurch } from '@/lib/auth/church'
import Link from 'next/link'
import { NewSongForm } from '../NewSongForm'

export default async function NouveauChantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireChurch('responsable')

  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-8 py-4 flex items-center gap-4">
        <Link href="/espace/admin/chants" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm">←</Link>
        <div>
          <h1 className="font-display text-2xl text-dark font-light">Nouveau chant</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        {error === 'titre_manquant' && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="font-sans text-sm text-red-600">Le titre est obligatoire.</p>
          </div>
        )}
        {error && error !== 'titre_manquant' && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="font-sans text-sm text-red-600">Erreur : {error}</p>
          </div>
        )}

        <NewSongForm />
      </main>
    </div>
  )
}
