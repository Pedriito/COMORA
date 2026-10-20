import Link from 'next/link'

export default async function MerciPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const isConfirmed = status === 'confirmed'

  return (
    <div className="min-h-screen bg-teal-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-teal/20 p-8 max-w-md w-full text-center space-y-4">
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full text-2xl ${isConfirmed ? 'bg-green-100' : 'bg-red-50'}`}>
          {isConfirmed ? '✓' : '✕'}
        </div>
        <h1 className="font-display text-2xl text-dark font-light">
          {isConfirmed ? 'Participation confirmée !' : 'Réponse enregistrée'}
        </h1>
        <p className="font-sans text-sm text-dark/50">
          {isConfirmed
            ? 'Merci ! Ton responsable a été notifié de ta disponibilité.'
            : 'Ta réponse a été enregistrée. Tu peux modifier ça depuis ton espace bénévole.'}
        </p>
        <Link
          href="/espace/dashboard"
          className="inline-block px-6 py-2.5 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal-dark transition-colors"
        >
          Mon espace bénévole
        </Link>
      </div>
    </div>
  )
}
