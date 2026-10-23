import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { accessState, isWritable, type AccessState, type BillingStatus, type Offer } from '@/lib/billing/access'
import { createClient } from '@/lib/supabase/server'

/*
 * Église courante et droits du compte connecté, côté serveur.
 *
 * La source de vérité reste la base : les policies RLS vérifient chaque
 * requête avec les mêmes règles (has_church_role, is_church_member). Ces
 * fonctions servent à choisir l'église affichée, à rediriger tôt et à
 * afficher ce que le compte a le droit de faire.
 */

export type ChurchRole = 'admin' | 'responsable' | 'membre'
/** Rôle d'église, ou capacité pastorale (indépendante du rôle). */
export type Capability = ChurchRole | 'pastoral'

export type Membership = {
  churchId: string
  churchName: string
  churchSlug: string
  role: ChurchRole
  isPastoral: boolean
  /** État d'accès (essai, abonnement, lecture seule). Absent dans les contextes de test. */
  access?: AccessState
  trialEndsAt?: string | null
  offer?: Offer | null
  deletionScheduledAt?: string | null
}

export type ChurchContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  /** Toutes les églises du compte (sélecteur d'église). */
  memberships: Membership[]
  /** Église ouverte dans l'espace. */
  church: Membership
  /** Personne liée au compte dans cette église (planning, indisponibilités…). */
  memberId: string | null
}

const RANK: Record<ChurchRole, number> = { membre: 0, responsable: 1, admin: 2 }

/** Le rôle ou la capacité demandés sont-ils accordés par cette appartenance ? */
export function grants(membership: Pick<Membership, 'role' | 'isPastoral'>, required: Capability): boolean {
  if (required === 'pastoral') return membership.isPastoral
  return RANK[membership.role] >= RANK[required]
}

type MembershipRow = {
  church_id: string
  role: ChurchRole
  is_pastoral: boolean
  churches: {
    name: string
    slug: string
    billing_status: BillingStatus
    trial_ends_at: string | null
    grace_ends_at: string | null
    offer: Offer | null
    deletion_scheduled_at: string | null
  } | null
}

/** Compte connecté et église courante, ou null sans session ni église. */
export const getChurchContext = cache(async (): Promise<ChurchContext | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase
      .from('church_memberships')
      .select('church_id, role, is_pastoral, churches(name, slug, billing_status, trial_ends_at, grace_ends_at, offer, deletion_scheduled_at)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at'),
    supabase.from('profiles').select('active_church_id').eq('id', user.id).maybeSingle(),
  ])

  const memberships: Membership[] = ((rows ?? []) as unknown as MembershipRow[])
    .filter(r => r.churches)
    .map(r => ({
      churchId: r.church_id,
      churchName: r.churches!.name,
      churchSlug: r.churches!.slug,
      role: r.role,
      isPastoral: r.is_pastoral,
      access: accessState({ billingStatus: r.churches!.billing_status, trialEndsAt: r.churches!.trial_ends_at, graceEndsAt: r.churches!.grace_ends_at }),
      trialEndsAt: r.churches!.trial_ends_at,
      offer: r.churches!.offer,
      deletionScheduledAt: r.churches!.deletion_scheduled_at,
    }))
  if (memberships.length === 0) return null

  // Même règle que current_church_id() en base : l'église choisie, sinon la plus ancienne
  const church = memberships.find(m => m.churchId === profile?.active_church_id) ?? memberships[0]

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('church_id', church.churchId)
    .eq('user_id', user.id)
    .maybeSingle()

  return { supabase, userId: user.id, memberships, church, memberId: member?.id ?? null }
})

/**
 * Exige un compte connecté, membre de l'église courante, avec le rôle ou la
 * capacité demandés. Redirige sinon (connexion, ou tableau de bord).
 * Utilisable dans les pages comme dans les Server Actions.
 */
export async function requireChurch(required: Capability = 'membre'): Promise<ChurchContext> {
  const ctx = await getChurchContext()
  if (!ctx) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    redirect(user ? '/espace/sans-eglise' : '/espace/login')
  }
  if (!grants(ctx.church, required)) redirect('/espace/dashboard')
  await refuseWriteWhenReadOnly(ctx)
  return ctx
}

/**
 * Garde-fou : en lecture seule (essai terminé, impayé), une Server Action ne peut rien
 * écrire. On renvoie vers un écran qui explique pourquoi, au lieu d'une erreur technique.
 * Les pages (lecture) ne sont pas concernées ; la base refuse de toute façon l'écriture (RLS).
 */
async function refuseWriteWhenReadOnly(ctx: ChurchContext) {
  if (!ctx.church.access || isWritable(ctx.church.access)) return
  const isServerAction = (await headers()).has('next-action')
  if (isServerAction) redirect('/espace/lecture-seule')
}

/** Variante sans redirection, pour les actions qui renvoient une erreur affichable. */
export async function churchOrNull(required: Capability = 'membre'): Promise<ChurchContext | null> {
  const ctx = await getChurchContext()
  return ctx && grants(ctx.church, required) ? ctx : null
}
