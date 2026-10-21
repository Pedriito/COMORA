import { requireChurch } from '@/lib/auth/church'
import Link from 'next/link'
import { saveProfile, changePassword } from './actions'
import { logout } from '../login/actions'
import { FlashMessage } from '../_components/FlashMessage'
import { PasswordInput } from '../_components/PasswordInput'
import { PushManager } from '../_components/PushManager'
import { churchRoleLabels, frequencyLabels } from '@/lib/labels'
import { Logo } from '@/components/brand/logo'
import { siteConfig } from '@/lib/site'

// Du plus au moins fréquent, pour un choix plus lisible que l'ordre du dictionnaire de libellés.
const FREQUENCY_ORDER = ['weekly', 'twice_month', 'monthly', 'every_6_weeks', 'as_needed']

const errors: Record<string, string> = {
  failed: 'Une erreur est survenue. Réessaie.',
  email_taken: 'Cet email est déjà utilisé par un autre compte.',
}

const pwdErrors: Record<string, string> = {
  short: 'Le mot de passe doit faire au moins 8 caractères.',
  mismatch: 'Les mots de passe ne correspondent pas.',
  wrong_current: 'Mot de passe actuel incorrect.',
  failed: 'Une erreur est survenue. Réessaie.',
}

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string; email_sent?: string; pwd_error?: string; pwd_success?: string }>
}) {
  const ctx = await requireChurch('membre')
  const supabase = ctx.supabase
  const churchId = ctx.church.churchId
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: account }, { data: member }, { data: contact }, { data: teamMemberships }] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name').eq('id', user.id).maybeSingle(),
    ctx.memberId
      ? supabase.from('members').select('desired_frequency').eq('church_id', churchId).eq('id', ctx.memberId).maybeSingle()
      : Promise.resolve({ data: null }),
    ctx.memberId
      ? supabase.from('member_contacts').select('phone, city, birthdate').eq('church_id', churchId).eq('member_id', ctx.memberId).maybeSingle()
      : Promise.resolve({ data: null }),
    ctx.memberId
      ? supabase.from('team_members').select('role, teams(name)').eq('church_id', churchId).eq('member_id', ctx.memberId)
      : Promise.resolve({ data: [] as { role: string; teams: unknown }[] }),
  ])
  const profile = { ...account, ...member, ...contact }

  const params = await searchParams
  const errorMsg    = params.error     ? errors[params.error]       : null
  const emailSent   = !!params.email_sent
  const pwdErrorMsg = params.pwd_error ? pwdErrors[params.pwd_error] : null
  const pwdSuccess  = !!params.pwd_success
  // Première visite : arrivée par le lien d'activation
  const isFirstTime = params.from === 'activation'

  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase() || 'B'
  const roleLabel  = churchRoleLabels[ctx.church.role] ?? 'Bénévole'
  const firstTeam  = (teamMemberships ?? []).map(t => (t.teams as unknown as { name: string } | null)?.name).filter(Boolean)[0]
  const subtitle   = firstTeam ? `${roleLabel} · ${firstTeam}` : roleLabel

  return (
    <>
      {/* ══ MOBILE ══ */}
      <div className="lg:hidden min-h-screen bg-teal-50">
        <div
          className="flex flex-col items-center px-5 pb-6"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 24px, 60px)' }}
        >
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full border-2 border-teal/20 bg-teal-50 flex items-center justify-center mb-4">
            <span className="font-display text-2xl text-teal-dark font-light">{initials}</span>
          </div>

          {/* Nom */}
          <h1 className="font-display text-[1.9rem] text-dark font-light text-center leading-tight">
            {profile?.first_name} {profile?.last_name}
          </h1>
          <p className="font-sans text-[11px] uppercase tracking-widest text-teal font-semibold mt-1.5">
            {subtitle}
          </p>
        </div>

        <div className="px-4 space-y-3 pb-6">
          {/* Settings card */}
          <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
            <Link
              href="/espace/historique"
              className="flex items-center gap-3.5 px-4 py-4 border-b border-dark/6 hover:bg-dark/2 transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              </div>
              <span className="flex-1 font-sans text-sm font-medium text-dark">Historique des services</span>
              <svg className="w-4 h-4 text-dark/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>

            <div className="flex items-center gap-3.5 px-4 py-4 border-b border-dark/6">
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </div>
              <span className="flex-1 font-sans text-sm font-medium text-dark">Notifications push</span>
              <PushManager variant="toggle" />
            </div>

            <Link
              href={`mailto:${siteConfig.supportEmail}`}
              className="flex items-center gap-3.5 px-4 py-4 hover:bg-dark/2 transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
              </div>
              <span className="flex-1 font-sans text-sm font-medium text-dark">Aide &amp; contact</span>
              <svg className="w-4 h-4 text-dark/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>

          {/* Formulaire modifier le profil */}
          <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-5">
            <h2 className="font-display text-lg text-dark font-light mb-1">Modifier mon profil</h2>
            <p className="font-sans text-xs text-dark/40 mb-4">Mets à jour tes informations personnelles.</p>

            {emailSent && (
              <div className="mb-4 bg-teal/10 rounded-xl px-4 py-3 font-sans text-xs text-teal-dark">
                Un email de confirmation a été envoyé à ta nouvelle adresse.
              </div>
            )}

            <form action={saveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label htmlFor="m_first_name" className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">Prénom</label>
                  <input id="m_first_name" name="first_name" type="text" defaultValue={profile?.first_name ?? ''} required className="w-full px-3 py-2.5 rounded-xl border border-dark/10 bg-teal-50 text-dark font-sans text-[13px] focus:outline-none focus:ring-2 focus:ring-teal/30" />
                </div>
                <div className="min-w-0">
                  <label htmlFor="m_last_name" className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">Nom</label>
                  <input id="m_last_name" name="last_name" type="text" defaultValue={profile?.last_name ?? ''} required className="w-full px-3 py-2.5 rounded-xl border border-dark/10 bg-teal-50 text-dark font-sans text-[13px] focus:outline-none focus:ring-2 focus:ring-teal/30" />
                </div>
              </div>
              <div>
                <label htmlFor="m_email" className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">Email</label>
                <input id="m_email" name="email" type="email" defaultValue={user.email ?? ''} required className="w-full px-3 py-2.5 rounded-xl border border-dark/10 bg-teal-50 text-dark font-sans text-[13px] focus:outline-none focus:ring-2 focus:ring-teal/30" />
              </div>
              <div>
                <label htmlFor="m_phone" className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">Téléphone</label>
                <input id="m_phone" name="phone" type="tel" defaultValue={profile?.phone ?? ''} placeholder="06 12 34 56 78" className="w-full px-3 py-2.5 rounded-xl border border-dark/10 bg-teal-50 text-dark placeholder:text-dark/30 font-sans text-[13px] focus:outline-none focus:ring-2 focus:ring-teal/30" />
              </div>
              <div>
                <label htmlFor="m_birthdate" className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">Date de naissance</label>
                <input id="m_birthdate" name="birthdate" type="date" defaultValue={profile?.birthdate ?? ''} className="w-full px-3 py-2.5 rounded-xl border border-dark/10 bg-teal-50 text-dark font-sans text-[13px] focus:outline-none focus:ring-2 focus:ring-teal/30" />
              </div>
              <div>
                <label htmlFor="m_city" className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">Ville</label>
                <input id="m_city" name="city" type="text" defaultValue={profile?.city ?? ''} placeholder="Ta ville" className="w-full px-3 py-2.5 rounded-xl border border-dark/10 bg-teal-50 text-dark placeholder:text-dark/30 font-sans text-[13px] focus:outline-none focus:ring-2 focus:ring-teal/30" />
              </div>
              <div>
                <label htmlFor="m_desired_frequency" className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">Rythme de service souhaité</label>
                <select id="m_desired_frequency" name="desired_frequency" defaultValue={profile?.desired_frequency ?? ''} className="w-full px-3 py-2.5 rounded-xl border border-dark/10 bg-teal-50 text-dark font-sans text-[13px] focus:outline-none focus:ring-2 focus:ring-teal/30">
                  <option value="">Non précisé</option>
                  {FREQUENCY_ORDER.map(key => (
                    <option key={key} value={key}>{frequencyLabels[key]}</option>
                  ))}
                </select>
                <p className="font-sans text-[11px] text-dark/35 mt-1">Utilisé pour respecter ton rythme lors de la planification.</p>
              </div>
              {errorMsg && <p className="font-sans text-xs text-red-500">{errorMsg}</p>}
              <button
                type="submit"
                className="w-full py-3.5 text-white rounded-xl font-sans text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-teal-dark))' }}
              >
                Enregistrer
              </button>
            </form>
          </div>

          {/* Changer le mot de passe */}
          {!isFirstTime && (
            <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-5">
              <h2 className="font-display text-lg text-dark font-light mb-1">Mot de passe</h2>
              <p className="font-sans text-xs text-dark/40 mb-4">Modifie ton mot de passe de connexion.</p>
              {pwdSuccess && (
                <div className="mb-4 bg-teal/10 rounded-xl px-4 py-3 font-sans text-xs text-teal-dark">Mot de passe modifié avec succès.</div>
              )}
              <form action={changePassword} className="space-y-4">
                <div>
                  <label htmlFor="m_current_password" className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">Mot de passe actuel</label>
                  <PasswordInput id="m_current_password" name="current_password" required autoComplete="current-password" />
                </div>
                <div>
                  <label htmlFor="m_new_password" className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">Nouveau mot de passe</label>
                  <PasswordInput id="m_new_password" name="new_password" required minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" />
                </div>
                <div>
                  <label htmlFor="m_confirm_password" className="block font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold mb-1.5">Confirmer</label>
                  <PasswordInput id="m_confirm_password" name="confirm_password" required autoComplete="new-password" />
                </div>
                {pwdErrorMsg && <p className="font-sans text-xs text-red-500">{pwdErrorMsg}</p>}
                <button
                  type="submit"
                  className="w-full py-3.5 text-white rounded-xl font-sans text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-teal-dark))' }}
                >
                  Changer le mot de passe
                </button>
              </form>
            </div>
          )}

          {/* Déconnexion */}
          <form action={logout}>
            <button
              type="submit"
              className="w-full py-3.5 bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] font-sans text-sm font-medium text-coral border border-coral/15 hover:bg-coral/5 transition-colors"
            >
              Déconnexion
            </button>
          </form>

          <p className="text-center font-sans text-xs text-dark/25 pt-2">
            {siteConfig.name} · Espace bénévoles
          </p>
        </div>
      </div>

      {/* ══ DESKTOP ══ */}
      <div className="hidden lg:block min-h-screen flex items-center justify-center bg-teal-50 px-4 py-12">
        <div className="w-full max-w-lg mx-auto">
          <div className="text-center mb-10">
            <h1 className="flex justify-center"><Logo size={44} word="serif" /></h1>
            <p className="mt-2 text-sm text-teal-dark font-sans uppercase tracking-widest">Espace bénévoles</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-teal/20 p-8">
            <h2 className="font-display text-2xl text-dark font-light mb-1">
              {isFirstTime ? 'Bienvenue ! Complète ta fiche' : 'Mon profil'}
            </h2>
            <p className="text-sm text-dark/50 font-sans mb-6">
              {isFirstTime ? "Ces informations permettent à l'équipe de te contacter." : 'Mets à jour tes informations personnelles.'}
            </p>

            {emailSent && (
              <div className="mb-5">
                <FlashMessage message="Un email de confirmation a été envoyé à ta nouvelle adresse. Clique sur le lien pour valider le changement." type="info" />
              </div>
            )}

            <form action={saveProfile} className="space-y-5">
              {isFirstTime && <p className="text-xs font-sans text-red-500/80">Les champs marqués <span className="font-semibold">*</span> sont obligatoires.</p>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-sans text-dark/70 mb-1.5">Prénom {isFirstTime && <span className="text-red-500">*</span>}</label>
                  <input id="first_name" name="first_name" type="text" defaultValue={profile?.first_name ?? ''} required className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm" />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-sans text-dark/70 mb-1.5">Nom {isFirstTime && <span className="text-red-500">*</span>}</label>
                  <input id="last_name" name="last_name" type="text" defaultValue={profile?.last_name ?? ''} required className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-sans text-dark/70 mb-1.5">Email {isFirstTime && <span className="text-red-500">*</span>}</label>
                <input id="email" name="email" type="email" defaultValue={user.email ?? ''} required className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm" />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-sans text-dark/70 mb-1.5">Téléphone {isFirstTime && <span className="text-red-500">*</span>}</label>
                <input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ''} required={isFirstTime} placeholder="06 12 34 56 78" className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm" />
              </div>
              <div>
                <label htmlFor="birthdate" className="block text-sm font-sans text-dark/70 mb-1.5">Date de naissance <span className="text-dark/30 text-xs">(facultatif)</span></label>
                <input id="birthdate" name="birthdate" type="date" defaultValue={profile?.birthdate ?? ''} className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm" />
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-sans text-dark/70 mb-1.5">Ville {isFirstTime && <span className="text-red-500">*</span>}</label>
                <input id="city" name="city" type="text" defaultValue={profile?.city ?? ''} required={isFirstTime} placeholder="Ta ville" className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm" />
              </div>
              <div>
                <label htmlFor="desired_frequency" className="block text-sm font-sans text-dark/70 mb-1.5">Rythme de service souhaité</label>
                <select id="desired_frequency" name="desired_frequency" defaultValue={profile?.desired_frequency ?? ''} className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm">
                  <option value="">Non précisé</option>
                  {FREQUENCY_ORDER.map(key => (
                    <option key={key} value={key}>{frequencyLabels[key]}</option>
                  ))}
                </select>
                <p className="text-xs font-sans text-dark/40 mt-1.5">Utilisé pour respecter ton rythme lors de la planification.</p>
              </div>
              {errorMsg && <p className="text-sm text-red-500 font-sans">{errorMsg}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 py-3 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal-dark transition-colors">
                  {isFirstTime ? 'Enregistrer et accéder à mon espace' : 'Enregistrer'}
                </button>
                {!isFirstTime && (
                  <a href="/espace/dashboard" className="px-5 py-3 border border-teal/30 text-dark/60 rounded-lg font-sans text-sm hover:bg-teal-50 transition-colors">Annuler</a>
                )}
              </div>
            </form>
          </div>

          {!isFirstTime && (
            <div className="bg-white rounded-2xl shadow-sm border border-teal/20 p-8 mt-4">
              <h2 className="font-display text-xl text-dark font-light mb-1">Mot de passe</h2>
              <p className="text-sm text-dark/50 font-sans mb-6">Modifie ton mot de passe de connexion.</p>
              {pwdSuccess && <div className="mb-5"><FlashMessage message="Mot de passe modifié avec succès." type="success" /></div>}
              <form action={changePassword} className="space-y-4">
                <div>
                  <label htmlFor="current_password" className="block text-sm font-sans text-dark/70 mb-1.5">Mot de passe actuel</label>
                  <PasswordInput id="current_password" name="current_password" required autoComplete="current-password" />
                </div>
                <div>
                  <label htmlFor="new_password" className="block text-sm font-sans text-dark/70 mb-1.5">Nouveau mot de passe</label>
                  <PasswordInput id="new_password" name="new_password" required minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" />
                </div>
                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-sans text-dark/70 mb-1.5">Confirmer le nouveau mot de passe</label>
                  <PasswordInput id="confirm_password" name="confirm_password" required autoComplete="new-password" />
                </div>
                {pwdErrorMsg && <p className="text-sm text-red-500 font-sans">{pwdErrorMsg}</p>}
                <button type="submit" className="w-full py-3 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal-dark transition-colors">Changer le mot de passe</button>
              </form>
            </div>
          )}

          <div className="mt-4 text-center">
            <form action={logout}>
              <button type="submit" className="font-sans text-sm text-dark/40 hover:text-dark transition-colors">Déconnexion</button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
