import type { Metadata, Viewport } from 'next'
import { createClient } from '@/lib/supabase/server'
import { BenevoleNav } from './_components/BenevoleNav'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <>{children}</>

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, permission')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen">
      <BenevoleNav
        permission={profile?.permission ?? 'viewer'}
        firstName={profile?.first_name ?? ''}
        lastName={profile?.last_name ?? ''}
      />
      <div className="flex-1 lg:ml-60 min-w-0 pb-28 lg:pb-0">
        {children}
      </div>
      <PwaInstallBanner />
      <ServiceWorkerRegistrar />
    </div>
  )
}
