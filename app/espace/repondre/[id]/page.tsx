import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function confirmResponse(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const status = formData.get('status') as string
  if (status !== 'confirmed' && status !== 'declined') return
  const admin = createAdminClient()
  await admin.from('plan_assignments').update({ status }).eq('id', id)
  redirect(`/espace/repondre/${id}/merci?status=${status}`)
}

export default async function RepondrePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}) {
  const { id } = await params
  const { status } = await searchParams

  if (status !== 'confirmed' && status !== 'declined') {
    redirect('/espace/login')
  }

  const admin = createAdminClient()
  const { data: assignment } = await admin
    .from('plan_assignments')
    .select('id, user_id, status, plans(title, service_date), positions(name)')
    .eq('id', id)
    .single()

  if (!assignment) redirect('/espace/dashboard')

  const plan = assignment.plans as any
  const position = assignment.positions as any
  const date = plan ? new Date(plan.service_date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }) : '—'
  const time = plan ? new Date(plan.service_date).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  }) : ''

  const isConfirmed = status === 'confirmed'

  return (
    <div className="min-h-screen bg-teal-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-teal/20 p-8 max-w-md w-full text-center space-y-5">
        <h1 className="font-display text-2xl text-dark font-light">
          {isConfirmed ? 'Confirmer ma participation' : 'Décliner ma participation'}
        </h1>

        <div className="bg-teal/5 rounded-xl px-5 py-4 text-left space-y-1">
          <p className="font-sans text-sm font-medium text-dark">{plan?.title}</p>
          <p className="font-sans text-xs text-dark/50 capitalize">{date}{time ? ` à ${time}` : ''}</p>
          {position && <p className="font-sans text-xs text-teal">{position.name}</p>}
        </div>

        <p className="font-sans text-sm text-dark/60">
          {isConfirmed
            ? 'Clique sur le bouton ci-dessous pour confirmer ta disponibilité.'
            : 'Clique sur le bouton ci-dessous pour signaler que tu ne seras pas disponible.'}
        </p>

        <form action={confirmResponse}>
          <input type="hidden" name="id" value={id} />
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
