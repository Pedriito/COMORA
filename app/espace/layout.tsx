import type { Metadata, Viewport } from 'next'
import { getChurchContext } from '@/lib/auth/church'
import { BenevoleNav } from './_components/BenevoleNav'
import { AccessBanner } from './_components/AccessBanner'
import { PwaInstallBanner } from './_components/PwaInstallBanner'
import { ServiceWorkerRegistrar } from './_components/ServiceWorkerRegistrar'

export const metadata: Metadata = {
  title: { default: 'Espace bénévoles', template: '%s · Comora' },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Comora' },
}

// Plein écran sur mobile : les pages gèrent elles-mêmes les zones sûres (encoche)
export const viewport: Viewport = {
  viewportFit: 'cover',
}

export default async function BenevoleLayout({ children }: { children: React.ReactNode }) {
  // Pages publiques (connexion, invitation…) ou compte sans église : pas de navigation
  const ctx = await getChurchContext()
  if (!ctx) return <>{children}</>

  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', ctx.userId)
    .maybeSingle()

  return (
    <div className="flex min-h-screen">
      <BenevoleNav
        role={ctx.church.role}
        isPastoral={ctx.church.isPastoral}
        firstName={profile?.first_name ?? ''}
        lastName={profile?.last_name ?? ''}
        churches={ctx.memberships.map(m => ({ id: m.churchId, name: m.churchName }))}
        activeChurchId={ctx.church.churchId}
      />
      <div className="flex-1 lg:ml-60 min-w-0 pb-28 lg:pb-0">
        <AccessBanner church={ctx.church} />
        {children}
      </div>
      <PwaInstallBanner />
      <ServiceWorkerRegistrar />
    </div>
  )
}
