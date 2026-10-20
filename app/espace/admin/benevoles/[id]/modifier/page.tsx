import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { updateBenevoleAdmin } from '../../../actions'
import { FlashMessage } from '../../../../_components/FlashMessage'

export default async function ModifierBenevolePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error: flashError } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const { data: me } = await supabase.from('profiles').select('permission').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(me?.permission ?? '')) redirect('/espace/dashboard')

  const admin = createAdminClient()
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    supabase
      .from('profiles')
      .select('first_name, last_name, phone, permission, status, birthdate, city')
      .eq('id', id)
      .single(),
    admin.auth.admin.getUserById(id),
  ])

  if (!profile) redirect('/espace/admin')

  const p = profile as any
  const email = authUser?.user?.email ?? ''

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-6 py-4 flex items-center gap-4">
        <Link href={`/espace/admin/benevoles/${id}`} className="text-dark/40 hover:text-dark transition-colors font-sans text-sm">
          ← Fiche
        </Link>
        <h1 className="font-display text-2xl text-dark font-light">
          Modifier — {p.first_name} {p.last_name}
        </h1>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        {flashError && <FlashMessage message={`Erreur : ${flashError}`} type="error" />}

        <div className="bg-white rounded-2xl border border-teal/20 p-6">
          <form action={updateBenevoleAdmin} className="space-y-5">
            <input type="hidden" name="user_id" value={id} />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Prénom" name="first_name" defaultValue={p.first_name ?? ''} required />
              <Field label="Nom" name="last_name" defaultValue={p.last_name ?? ''} required />
            </div>

            <Field label="Email" name="email" type="email" defaultValue={email} required />
            <Field label="Téléphone" name="phone" type="tel" defaultValue={p.phone ?? ''} />
            <Field label="Ville" name="city" defaultValue={p.city ?? ''} />
            <Field label="Date de naissance" name="birthdate" type="date" defaultValue={p.birthdate ?? ''} />

            <div>
              <label className="block text-sm font-sans text-dark/70 mb-1.5">Niveau d'accès</label>
              <select
                name="permission"
                defaultValue={p.permission ?? 'viewer'}
                className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
              >
                <option value="viewer">Lecture seule</option>
                <option value="editor">Éditeur</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-sans text-dark/70 mb-1.5">Statut</label>
              <select
                name="status"
                defaultValue={p.status ?? 'active'}
                className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
              >
                <option value="active">Actif</option>
                <option value="invited">Invitation envoyée</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 py-3 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal-dark transition-colors"
              >
                Enregistrer
              </button>
              <Link
                href={`/espace/admin/benevoles/${id}`}
                className="px-5 py-3 border border-teal/30 text-dark/60 rounded-lg font-sans text-sm hover:bg-teal-50 transition-colors"
              >
                Annuler
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

function Field({
  label, name, defaultValue, type = 'text', required = false,
}: {
  label: string
  name: string
  defaultValue: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-sans text-dark/70 mb-1.5">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
      />
    </div>
  )
}
