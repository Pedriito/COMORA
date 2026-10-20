import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { siteConfig } from '@/lib/site'

async function respond(formData: FormData) {
  'use server'
  const assignmentId = formData.get('assignment_id') as string
  const status = formData.get('status') as string
  if (!assignmentId || !['confirmed', 'declined'].includes(status)) return

  const admin = createAdminClient()
  await admin
    .from('plan_assignments')
    .update({ status })
    .eq('id', assignmentId)

  redirect(`/espace/repondre-ext/${assignmentId}?done=${status}`)
}

export default async function RepondreExtPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ done?: string }>
}) {
  const { id } = await params
  const { done } = await searchParams

  const admin = createAdminClient()
  const { data: a } = await admin
    .from('plan_assignments')
    .select('id, status, external_name, plans(title, service_date), positions(name), teams(name)')
    .eq('id', id)
    .single()

  if (!a) {
    return (
      <div className="min-h-screen bg-teal-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl border border-teal/20 p-8 max-w-sm w-full text-center">
          <p className="font-sans text-sm text-dark/50">Invitation introuvable ou expirée.</p>
        </div>
      </div>
    )
  }

  const plan = a.plans as any
  const position = a.positions as any
  const team = a.teams as any

  const date = new Date(plan.service_date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const time = new Date(plan.service_date).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
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
          <p className="font-sans font-semibold text-dark text-base">{plan.title}</p>
          <p className="font-sans text-sm text-dark/60 capitalize">{date} à {time}</p>
          {team?.name && <p className="font-sans text-sm text-teal">Équipe : {team.name}</p>}
          {position?.name && <p className="font-sans text-sm text-teal">Rôle : {position.name}</p>}
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

        {/* Boutons de réponse */}
        {!done && !alreadyResponded && (
          <div className="space-y-3">
            <p className="font-sans text-sm text-dark/60 text-center">Pouvez-vous participer ?</p>
            <div className="flex gap-3">
              <form action={respond} className="flex-1">
                <input type="hidden" name="assignment_id" value={id} />
                <input type="hidden" name="status" value="confirmed" />
                <button
                  type="submit"
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-sans font-semibold text-sm transition-colors"
                >
                  ✓ Je confirme
                </button>
              </form>
              <form action={respond} className="flex-1">
                <input type="hidden" name="assignment_id" value={id} />
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
