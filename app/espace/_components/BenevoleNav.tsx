'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { logout } from '../login/actions'
import { churchRoleLabels } from '@/lib/labels'
import type { ChurchRole } from '@/lib/auth/church'
import { ChurchSwitcher } from './ChurchSwitcher'
import {
  IconHome, IconCalendar, IconClock, IconClipboard,
  IconUsers, IconMusicalNote, IconHeart, IconUser,
  IconGlobe, IconProjector, IconLogout, IconBan,
  IconGrid, IconClose,
} from './Icons'
import { Logo } from '@/components/brand/logo'

type Props = {
  role: ChurchRole
  isPastoral: boolean
  firstName: string
  lastName: string
  /** Églises du compte ; le sélecteur n'apparaît qu'à partir de deux. */
  churches: { id: string; name: string }[]
  activeChurchId: string
}

type IconComponent = (props: { className?: string }) => React.ReactElement

type NavItem = {
  label: string
  href: string
  icon: IconComponent
  match: (p: string) => boolean
}

type NavGroup = {
  section?: string
  items: NavItem[]
}

const BOTTOM_TABS_DEFAULT: NavItem[] = [
  { label: 'Accueil',  href: '/espace/dashboard',             icon: IconHome,        match: p => p === '/espace/dashboard' },
  { label: 'Planning', href: '/espace/historique',            icon: IconCalendar,    match: p => p.startsWith('/espace/historique') },
  { label: 'Chants',   href: '/espace/chants',                icon: IconMusicalNote, match: p => p.startsWith('/espace/chants') || p.startsWith('/espace/admin/chants') },
  { label: 'Indispos', href: '/espace/mes-indisponibilites',  icon: IconBan,         match: p => p.startsWith('/espace/mes-indisponibilites') },
  { label: 'Profil',   href: '/espace/profil',                icon: IconUser,        match: p => p === '/espace/profil' },
]

const BOTTOM_TABS_ADMIN: NavItem[] = [
  { label: 'Accueil',       href: '/espace/dashboard',            icon: IconHome,        match: p => p === '/espace/dashboard' },
  { label: 'Planification', href: '/espace/admin/plans',          icon: IconCalendar,    match: p => p.startsWith('/espace/admin/plans') },
  { label: 'Chants',        href: '/espace/admin/chants',         icon: IconMusicalNote, match: p => p.startsWith('/espace/chants') || p.startsWith('/espace/admin/chants') },
  { label: 'Indispos',      href: '/espace/mes-indisponibilites', icon: IconBan,         match: p => p.startsWith('/espace/mes-indisponibilites') },
  { label: 'Profil',        href: '/espace/profil',               icon: IconUser,        match: p => p === '/espace/profil' },
]

export function BenevoleNav({ role, isPastoral, firstName, lastName, churches, activeChurchId }: Props) {
  const pathname = usePathname()

  const isAdmin = role === 'admin'
  const isEditor = role === 'responsable'
  const activeChurch = churches.find(c => c.id === activeChurchId)

  const groups: NavGroup[] = []

  groups.push({
    items: [
      { label: 'Mon espace', href: '/espace/dashboard', icon: IconHome, match: p => p === '/espace/dashboard' },
    ],
  })

  groups.push({
    section: 'Planifier',
    items: [
      { label: 'Planification',    href: '/espace/admin/plans',          icon: IconCalendar,  match: p => p.startsWith('/espace/admin/plans') },
      { label: 'Mes indispos',     href: '/espace/mes-indisponibilites', icon: IconClock,     match: p => p.startsWith('/espace/mes-indisponibilites') },
      { label: 'Tâches & décisions', href: '/espace/gestion',            icon: IconClipboard, match: p => p.startsWith('/espace/gestion') },
    ],
  })

  const adminItems: NavItem[] = []
  if (isAdmin || isEditor) {
    adminItems.push({ label: 'Équipes',  href: '/espace/admin/equipes', icon: IconUsers,       match: p => p.startsWith('/espace/admin/equipes') })
    adminItems.push({ label: 'Chants',   href: '/espace/admin/chants',  icon: IconMusicalNote, match: p => p.startsWith('/espace/admin/chants') })
  }
  if (isPastoral) {
    adminItems.push({ label: 'Pastorale', href: '/espace/admin/pastorale', icon: IconHeart, match: p => p.startsWith('/espace/admin/pastorale') })
  }
  if (isAdmin) {
    adminItems.push({ label: 'Bénévoles', href: '/espace/admin', icon: IconUser, match: p => p === '/espace/admin' || p.startsWith('/espace/admin/benevoles') || p.startsWith('/espace/admin/inviter') })
    adminItems.push({ label: 'Site web',  href: '/espace/admin/site', icon: IconGlobe, match: p => p.startsWith('/espace/admin/site') })
  }
  if (adminItems.length > 0) groups.push({ section: 'Administration', items: adminItems })

  if (isAdmin || isEditor) {
    groups.push({
      section: 'Réglages',
      items: [
        { label: 'Vidéoprojection', href: '/espace/admin/parametres', icon: IconProjector, match: p => p.startsWith('/espace/admin/parametres') || p.startsWith('/espace/admin/mediatheque') },
      ],
    })
  }

  // Sections admin déjà dans la sidebar desktop mais absentes des 5 onglets mobiles —
  // réutilisées telles quelles dans le sheet mobile pour ne pas dupliquer la logique de permission.
  // "Chants" est retiré ici : déjà présent en tant qu'onglet dans la bottom nav mobile.
  const extraAdminGroups = groups
    .filter(g => g.section === 'Administration' || g.section === 'Réglages')
    .map(g => g.section === 'Administration' ? { ...g, items: g.items.filter(item => item.href !== '/espace/admin/chants') } : g)
    .filter(g => g.items.length > 0)
  const hasExtraAdmin = extraAdminGroups.length > 0
  const extraAdminActive = extraAdminGroups.some(g => g.items.some(item => item.match(pathname)))

  const [adminMenuOpen, setAdminMenuOpen] = useState(false)

  useEffect(() => {
    setAdminMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!adminMenuOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAdminMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = original
      window.removeEventListener('keydown', onKey)
    }
  }, [adminMenuOpen])

  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || 'B'

  return (
    <>
      {/* ── Sidebar desktop ── */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-ink min-h-screen flex-col fixed top-0 left-0 bottom-0 z-20">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-ink-light flex items-center justify-center shrink-0">
            <Logo size={22} word="none" color="#efece3" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-[15px] text-white font-medium leading-tight truncate">Comora</p>
            <p className="font-sans text-[9px] uppercase tracking-[0.18em] text-white/35 mt-0.5 truncate">{activeChurch?.name ?? 'Espace bénévoles'}</p>
          </div>
        </div>
        {churches.length > 1 && (
          <div className="px-4 pb-2">
            <ChurchSwitcher churches={churches} activeChurchId={activeChurchId} />
          </div>
        )}

        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-5' : 'mt-1'}>
              {group.section && (
                <p className="px-3 pb-1.5 pt-1 font-sans text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">
                  {group.section}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = item.match(pathname)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-sans text-sm transition-colors ${
                        active ? 'bg-teal-dark text-white font-medium' : 'text-white/55 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <Link
            href="/espace/profil"
            className={`flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors ${pathname === '/espace/profil' ? 'bg-white/5' : 'hover:bg-white/5'}`}
          >
            <div className="w-8 h-8 rounded-full bg-teal-dark flex items-center justify-center shrink-0">
              <span className="font-sans text-xs font-semibold text-white">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-sans text-sm text-white truncate">{firstName} {lastName}</p>
              <p className="font-sans text-[11px] text-white/40 truncate">{churchRoleLabels[role] ?? role}</p>
            </div>
          </Link>
          <form action={logout}>
            <button type="submit" className="w-full mt-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 font-sans text-xs transition-colors">
              <IconLogout className="w-3.5 h-3.5" />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* ── Bottom navigation mobile — Liquid Glass ── */}
      <nav
        className="lg:hidden fixed z-30"
        style={{
          bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          left: '12px',
          right: '12px',
          background: 'rgba(255,255,255,0.38)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: '28px',
          border: '0.5px solid rgba(255,255,255,0.6)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 0.5px 0 rgba(255,255,255,0.8)',
        }}
      >
        {(() => {
          const BOTTOM_TABS = isAdmin || isEditor ? BOTTOM_TABS_ADMIN : BOTTOM_TABS_DEFAULT
          const activeIndex = BOTTOM_TABS.findIndex(tab => tab.match(pathname))
          return (
            <div className="relative flex items-center gap-0.5 px-2 py-2">
              <div className="relative flex-1 flex items-center min-w-0">
                {/* Sliding pill indicator */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    // Géométrie calée exactement sur un onglet : ils sont `flex-1` sans
                    // espacement dans CE conteneur, donc chacun mesure 100% / n. Le rembourrage
                    // de 8px appartient au conteneur parent — le compenser ici rendait la
                    // pastille trop étroite et décalée, d'autant plus visible que `translateX`
                    // se calcule sur sa propre largeur : l'erreur se déplaçait avec l'onglet.
                    // Épouse exactement l'onglet, verticalement comme horizontalement. La
                    // respiration vis-à-vis du bord de la barre vient du `py-2` du parent :
                    // l'ajouter ici aussi rabotait la pastille deux fois.
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `calc(100% / ${BOTTOM_TABS.length})`,
                    borderRadius: '18px',
                    background: 'rgba(90,158,166,0.13)',
                    transform: `translateX(calc(${Math.max(0, activeIndex)} * 100%))`,
                    // Aucun des 5 onglets n'est actif quand on est sur une page admin accessible
                    // uniquement via le bouton "Admin" (Équipes, Pastorale...) — on masque alors
                    // la pastille plutôt que de la laisser se rabattre à tort sur "Accueil"
                    // (index -1 → Math.max(0, -1) = 0), ce qui la faisait apparaître au mauvais
                    // endroit avec la mauvaise taille perçue.
                    opacity: activeIndex === -1 ? 0 : 1,
                    transition: 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
                  }}
                />
                {BOTTOM_TABS.map(tab => {
                  const active = tab.match(pathname)
                  const Icon = tab.icon
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className="relative flex-1 flex flex-col items-center gap-0.5 py-1.5"
                    >
                      <span style={{ transform: active ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)', display: 'flex' }}>
                        <Icon className={`w-6 h-6 transition-colors duration-200 ${active ? 'text-teal' : 'text-dark/35'}`} />
                      </span>
                      <span
                        className={`font-sans text-[10px] font-medium transition-colors duration-200 ${active ? 'text-teal' : 'text-dark/35'}`}
                      >
                        {tab.label}
                      </span>
                    </Link>
                  )
                })}
              </div>

              {hasExtraAdmin && (
                <button
                  type="button"
                  onClick={() => setAdminMenuOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={adminMenuOpen}
                  aria-label="Menu d'administration"
                  className="relative shrink-0 flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-2xl"
                >
                  <span style={{ transform: extraAdminActive ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)', display: 'flex' }}>
                    <IconGrid className={`w-6 h-6 transition-colors duration-200 ${extraAdminActive ? 'text-teal' : 'text-dark/35'}`} />
                  </span>
                  <span className={`font-sans text-[10px] font-medium transition-colors duration-200 ${extraAdminActive ? 'text-teal' : 'text-dark/35'}`}>
                    Admin
                  </span>
                </button>
              )}
            </div>
          )
        })()}
      </nav>

      {/* ── Sheet admin mobile — sections desktop non exposées dans les 5 onglets ── */}
      {hasExtraAdmin && adminMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          role="presentation"
          onClick={() => setAdminMenuOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu d'administration"
            className="w-full max-h-[75vh] overflow-y-auto bg-white rounded-t-3xl shadow-2xl"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-center pt-2.5 pb-1">
              <div className="w-9 h-1 rounded-full bg-dark/15" />
            </div>
            <div className="px-5 pb-2 pt-1 flex items-center justify-between">
              <p className="font-display text-lg text-dark font-medium">Administration</p>
              <button
                type="button"
                onClick={() => setAdminMenuOpen(false)}
                aria-label="Fermer"
                className="p-1.5 -mr-1.5 text-dark/40 hover:text-dark transition-colors"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 pb-2">
              {extraAdminGroups.map((group, gi) => (
                <div key={gi} className={gi > 0 ? 'mt-4' : 'mt-1'}>
                  {group.section && (
                    <p className="px-3 pb-1.5 font-sans text-[10px] uppercase tracking-[0.16em] text-dark/35 font-semibold">
                      {group.section}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const active = item.match(pathname)
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-3 py-3 rounded-2xl font-sans text-[15px] transition-colors ${
                            active ? 'bg-teal/10 text-teal font-medium' : 'text-dark/70 active:bg-dark/5'
                          }`}
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
