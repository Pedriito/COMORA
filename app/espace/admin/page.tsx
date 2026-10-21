import { requireChurch, type ChurchRole } from '@/lib/auth/church'
import Link from 'next/link'

import { BenevoleList, type Benevole } from './BenevoleList'
import { FlashMessage } from '../_components/FlashMessage'
import InviteTokenPanel from './InviteTokenPanel'
import type { InviteToken } from './invite-token-actions'

const errors: Record<string, string> = {
  self: 'Tu ne peux pas te retirer toi-même de l’église.',
  last_admin: 'L’église doit garder au moins un administrateur.',
  email_failed: 'La personne a été ajoutée, mais l’e-mail d’invitation n’a pas pu être envoyé. Renvoie l’invitation depuis la liste.',
  failed: 'Une erreur est survenue. Réessaie.',
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const ctx = await requireChurch('responsable')
  const churchId = ctx.church.churchId
  const isAdmin = ctx.church.role === 'admin'

  const [{ data: members }, { data: memberships }, { data: inviteTokens }] = await Promise.all([
    ctx.supabase
      .from('members')
      .select('id, user_id, first_name, last_name, status')
      .eq('church_id', churchId)
      .order('first_name'),
    // Les rôles ne sont lisibles que par les administrateurs (RLS)
    isAdmin
      ? ctx.supabase.from('church_memberships').select('user_id, role').eq('church_id', churchId)
      : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
    isAdmin
      ? ctx.supabase
          .from('invite_tokens')
          .select('id, label, expires_at, max_uses, uses_count, created_at, revoked_at')
          .eq('church_id', churchId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as InviteToken[] }),
  ])

  const roleByUser = new Map((memberships ?? []).map(m => [m.user_id, m.role as ChurchRole]))
  const benevoles: Benevole[] = (members ?? []).map(m => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    status: m.status,
    role: m.user_id ? roleByUser.get(m.user_id) ?? null : null,
    hasAccount: !!m.user_id,
  }))

  const params = await searchParams
  const total = benevoles.length
  const actifs = benevoles.filter(b => b.status === 'active').length
  const invites = benevoles.filter(b => b.status === 'invited').length

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-4 md:px-6 pb-4 flex items-center gap-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium">Communauté</p>
          <h1 className="font-display text-2xl text-dark font-light">Bénévoles</h1>
        </div>
        {isAdmin && (
        <Link
          href="/espace/admin/inviter"
          className="shrink-0 px-3 md:px-4 py-2 bg-coral text-white rounded-lg font-sans text-sm font-medium hover:bg-coral/90 transition-colors"
        >
          + Inviter
        </Link>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {params.success === 'invited' && (
          <FlashMessage message="Invitation envoyée avec succès." type="success" />
        )}
        {params.error && (
          <FlashMessage message={errors[params.error] ?? errors.failed} type="error" />
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-teal/20 p-5 text-center">
            <p className="font-display text-4xl text-dark font-light">{total}</p>
            <p className="text-xs text-dark/50 font-sans mt-1 uppercase tracking-widest">Total</p>
          </div>
          <div className="bg-white rounded-xl border border-teal/20 p-5 text-center">
            <p className="font-display text-4xl text-teal font-light flex items-center justify-center gap-1.5">
              {actifs}<span className="text-green-500 text-2xl leading-none">●</span>
            </p>
            <p className="text-xs text-dark/50 font-sans mt-1 uppercase tracking-widest">Actifs</p>
          </div>
          <div className="bg-amber-50/60 rounded-xl border border-amber-100 p-5 text-center">
            <p className="font-display text-4xl text-amber-600 font-light">{invites}</p>
            <p className="text-xs text-amber-600/70 font-sans mt-1 uppercase tracking-widest">En attente</p>
          </div>
        </div>

        {/* Liens d'inscription */}
        {isAdmin && (
        <section className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
          <div className="px-5 py-3 border-b border-teal/10 bg-teal-50/50">
            <p className="font-sans text-xs text-dark/50 uppercase tracking-widest font-medium">Liens d'inscription</p>
            <p className="font-sans text-xs text-dark/30 mt-0.5">Partage un lien pour que les bénévoles s'inscrivent eux-mêmes</p>
          </div>
          <div className="p-4">
            <InviteTokenPanel initial={inviteTokens ?? []} />
          </div>
        </section>
        )}

        <BenevoleList benevoles={benevoles} canManage={isAdmin} />
      </main>
    </div>
  )
}
