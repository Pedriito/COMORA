import { requireChurch } from '@/lib/auth/church'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { updateBenevoleAdmin } from '../../../actions'
import { FlashMessage } from '../../../../_components/FlashMessage'
import { churchRoleLabels, statusLabels } from '@/lib/labels'

const errors: Record<string, string> = {
  invalid: 'Indique au moins un prénom, et une adresse e-mail valide si elle est renseignée.',
  last_admin: 'L’église doit garder au moins un administrateur : nomme d’abord un autre administrateur.',
  failed: 'Les modifications n’ont pas pu être enregistrées. Réessaie.',
}

export default async function ModifierBenevolePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error: flashError } = await searchParams

  const ctx = await requireChurch('responsable')
  const churchId = ctx.church.churchId
  const isAdmin = ctx.church.role === 'admin'

  const { data: member } = await ctx.supabase
    .from('members')
    .select('id, user_id, first_name, last_name, status')
    .eq('church_id', churchId)
    .eq('id', id)
    .maybeSingle()

  if (!member) redirect('/espace/admin')

  const [{ data: contact }, { data: membership }] = await Promise.all([
    ctx.supabase
      .from('member_contacts')
      .select('email, phone, city, birthdate')
      .eq('church_id', churchId)
      .eq('member_id', id)
      .maybeSingle(),
    member.user_id && isAdmin
      ? ctx.supabase
          .from('church_memberships')
          .select('role, is_pastoral')
          .eq('church_id', churchId)
          .eq('user_id', member.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const p = { ...member, ...contact }

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
        {flashError && <FlashMessage message={errors[flashError] ?? errors.failed} type="error" />}

        <div className="bg-white rounded-2xl border border-teal/20 p-6">
          <form action={updateBenevoleAdmin} className="space-y-5">
            <input type="hidden" name="member_id" value={id} />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Prénom" name="first_name" defaultValue={p.first_name ?? ''} required />
              <Field label="Nom" name="last_name" defaultValue={p.last_name ?? ''} required />
            </div>

            <Field label="Email de contact" name="email" type="email" defaultValue={p.email ?? ''} />
            <Field label="Téléphone" name="phone" type="tel" defaultValue={p.phone ?? ''} />
            <Field label="Ville" name="city" defaultValue={p.city ?? ''} />
            <Field label="Date de naissance" name="birthdate" type="date" defaultValue={p.birthdate ?? ''} />

            {membership && (
              <>
                <div>
                  <label className="block text-sm font-sans text-dark/70 mb-1.5">Rôle dans l’église</label>
                  <select
                    name="role"
                    defaultValue={membership.role}
                    className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
                  >
                    {Object.entries(churchRoleLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 font-sans text-sm text-dark/70">
                  <input type="checkbox" name="is_pastoral" defaultChecked={membership.is_pastoral} className="accent-teal w-4 h-4" />
                  Accès à la pastorale
                </label>
              </>
            )}

            {isAdmin && (
            <div>
              <label className="block text-sm font-sans text-dark/70 mb-1.5">Statut</label>
              <select
                name="status"
                defaultValue={p.status ?? 'active'}
                className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
              >
                {Object.entries(statusLabels).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            )}

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
