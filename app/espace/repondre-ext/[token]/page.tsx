import { redirect } from 'next/navigation'
import { siteConfig } from '@/lib/site'
import { loadAssignmentByToken, recordResponse } from '../../repondre/respond'

async function respond(formData: FormData) {
  'use server'
  const token = formData.get('token') as string
  const status = formData.get('status') as string
  const done = await recordResponse(token, status, 'external')
  redirect(`/espace/repondre-ext/${encodeURIComponent(token)}${done ? `?done=${status}` : '?error=1'}`)
}

export default async function RepondreExtPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const { token } = await params
  const { done: doneParam, error } = await searchParams
  const done = doneParam === 'confirmed' || doneParam === 'declined' ? doneParam : undefined

  const a = await loadAssignmentByToken(token, 'external')

  if (!a) {
    return (
      <div className="min-h-screen bg-teal-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl border border-teal/20 p-8 max-w-sm w-full text-center">
          <p className="font-sans text-sm text-dark/50">Lien invalide ou expiré.</p>
        </div>
      </div>
    )
  }

  const tz = a.timeZone
  const date = new Date(a.serviceDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz,
  })
  const time = new Date(a.serviceDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: tz,
  })

  const alreadyResponded = a.status === 'confirmed' || a.status === 'declined'
  const confirmedByDone = done === 'confirmed'
  const declinedByDone = done === 'declined'

  return (
    <div className="min-h-screen bg-teal-50 flex items-center justify-center px-6 py-16">
      <div className="bg-white rounded-2xl border border-teal/20 p-8 max-w-md w-full space-y-6">
        {/* Logo / titre */}
        <div className="text-center">
          <p className="font-sans text-xs tracking-[0.3em] uppercase text-teal mb-1">{siteConfig.name}</p>
          <h1 className="font-display text-2xl text-dark font-light">Invitation à servir</h1>
        </div>

        {/* Détails du service */}
        <div className="bg-teal/5 rounded-xl px-5 py-4 space-y-1">
          <p className="font-sans font-semibold text-dark text-base">{a.planTitle}</p>
          <p className="font-sans text-sm text-dark/60 capitalize">{date} à {time}</p>
          {a.teamName && <p className="font-sans text-sm text-teal">Équipe : {a.teamName}</p>}
          {a.positionName && <p className="font-sans text-sm text-teal">Rôle : {a.positionName}</p>}
        </div>

        {/* Résultat si déjà répondu via ce chargement */}
        {confirmedByDone && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-center">
            <p className="font-sans text-green-700 font-medium">✓ Merci, votre participation est confirmée !</p>
          </div>
        )}
        {declinedByDone && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-center">
            <p className="font-sans text-red-600 font-medium">Vous avez décliné cette invitation.</p>
            <p className="font-sans text-sm text-red-400 mt-1">Nous en avons bien pris note.</p>
          </div>
        )}

        {/* Déjà répondu avant ce chargement (statut en base, pas via done) */}
        {!done && alreadyResponded && a.status === 'confirmed' && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-center">
            <p className="font-sans text-green-700 font-medium">✓ Vous avez déjà confirmé votre participation.</p>
          </div>
        )}
        {!done && alreadyResponded && a.status === 'declined' && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-center">
            <p className="font-sans text-red-600 font-medium">Vous avez déjà décliné cette invitation.</p>
          </div>
        )}

        {error && <p className="text-center font-sans text-xs text-red-500">Réponse non enregistrée, réessayez.</p>}

        {/* Boutons de réponse */}
        {!done && !alreadyResponded && (
          <div className="space-y-3">
            <p className="font-sans text-sm text-dark/60 text-center">Pouvez-vous participer ?</p>
            <div className="flex gap-3">
              <form action={respond} className="flex-1">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="status" value="confirmed" />
                <button
                  type="submit"
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-sans font-semibold text-sm transition-colors"
                >
                  ✓ Je confirme
                </button>
              </form>
              <form action={respond} className="flex-1">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="status" value="declined" />
                <button
                  type="submit"
                  className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-sans font-semibold text-sm transition-colors"
                >
                  ✕ Je décline
                </button>
              </form>
            </div>
          </div>
        )}

        <p className="text-center font-sans text-xs text-dark/25">{siteConfig.signature}</p>
      </div>
    </div>
  )
}
