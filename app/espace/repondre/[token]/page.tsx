import { redirect } from 'next/navigation'
import Link from 'next/link'
import { loadAssignmentByToken, recordResponse, isResponseStatus } from '../respond'

async function confirmResponse(formData: FormData) {
  'use server'
  const token = formData.get('token') as string
  const status = formData.get('status')
  if (!(await recordResponse(token, status, 'member'))) {
    redirect(`/espace/repondre/${encodeURIComponent(token)}?status=${isResponseStatus(status) ? status : 'confirmed'}&error=1`)
  }
  redirect(`/espace/repondre/${encodeURIComponent(token)}/merci?status=${status}`)
}

function InvalidLink() {
  return (
    <div className="min-h-screen bg-teal-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-teal/20 p-8 max-w-sm w-full text-center space-y-3">
        <p className="font-sans text-sm text-dark/60">Lien invalide ou expiré.</p>
        <Link href="/espace/dashboard" className="font-sans text-xs text-teal hover:underline">
          Accéder à mon espace
        </Link>
      </div>
    </div>
  )
}

export default async function RepondrePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ status?: string; error?: string }>
}) {
  const { token } = await params
  const { status, error } = await searchParams

  if (status !== 'confirmed' && status !== 'declined') {
    redirect('/espace/login')
  }

  const assignment = await loadAssignmentByToken(token, 'member')
  if (!assignment) return <InvalidLink />

  const tz = assignment.timeZone
  const date = new Date(assignment.serviceDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz,
  })
  const time = new Date(assignment.serviceDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: tz,
  })

  const isConfirmed = status === 'confirmed'

  return (
    <div className="min-h-screen bg-teal-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-teal/20 p-8 max-w-md w-full text-center space-y-5">
        <h1 className="font-display text-2xl text-dark font-light">
          {isConfirmed ? 'Confirmer ma participation' : 'Décliner ma participation'}
        </h1>

        <div className="bg-teal/5 rounded-xl px-5 py-4 text-left space-y-1">
          <p className="font-sans text-sm font-medium text-dark">{assignment.planTitle}</p>
          <p className="font-sans text-xs text-dark/50 capitalize">{date}{time ? ` à ${time}` : ''}</p>
          {assignment.positionName && <p className="font-sans text-xs text-teal">{assignment.positionName}</p>}
        </div>

        <p className="font-sans text-sm text-dark/60">
          {isConfirmed
            ? 'Clique sur le bouton ci-dessous pour confirmer ta disponibilité.'
            : 'Clique sur le bouton ci-dessous pour signaler que tu ne seras pas disponible.'}
        </p>

        {error && <p className="font-sans text-xs text-red-500">Réponse non enregistrée, réessaie.</p>}

        <form action={confirmResponse}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="status" value={status} />
          <button
            type="submit"
            className={`w-full py-3 rounded-lg font-sans text-sm font-medium transition-colors ${
              isConfirmed
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {isConfirmed ? '✓ Confirmer ma participation' : '✕ Signaler mon indisponibilité'}
          </button>
        </form>

        <Link
          href="/espace/dashboard"
          className="block font-sans text-xs text-dark/40 hover:text-dark transition-colors"
        >
          Accéder à mon espace sans répondre
        </Link>
      </div>
    </div>
  )
}
