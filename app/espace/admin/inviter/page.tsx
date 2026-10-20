import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { inviteBenevole } from '../actions'
import { permissionLabels, frequencyLabels } from '@/lib/labels'

export default async function InviterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/espace/login')

  const params = await searchParams
  const { data: teams } = await supabase.from('teams').select('id, name').order('name')

  return (
    <div className="min-h-screen bg-teal-50">
      <header className="bg-white border-b border-teal/20 px-6 py-4 flex items-center gap-4">
        <Link href="/espace/admin" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm">
          ← Administration
        </Link>
        <h1 className="font-display text-2xl text-dark font-light">Inviter un bénévole</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-teal/20 p-8">
          <p className="text-sm text-dark/50 font-sans mb-6">
            Un email d'invitation sera envoyé automatiquement. La personne pourra créer son mot de passe en cliquant sur le lien.
          </p>

          <form action={inviteBenevole} className="space-y-5">

            {/* Identité */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-sans text-dark/70 mb-1.5">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input name="first_name" type="text" required
                  className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
                  placeholder="Marie" />
              </div>
              <div>
                <label className="block text-sm font-sans text-dark/70 mb-1.5">Nom</label>
                <input name="last_name" type="text"
                  className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
                  placeholder="Dupont" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-sans text-dark/70 mb-1.5">
                Adresse email <span className="text-red-500">*</span>
              </label>
              <input name="email" type="email" required
                className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm"
                placeholder="marie@exemple.com" />
            </div>

            <div>
              <label className="block text-sm font-sans text-dark/70 mb-1.5">Niveau d'accès</label>
              <select name="permission"
                className="w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm">
                {Object.entries(permissionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Équipes */}
            <div className="border-t border-teal/10 pt-5">
              <p className="text-xs font-sans text-dark/40 uppercase tracking-widest mb-3">Équipes (optionnel)</p>

              <div className="rounded-xl border border-teal/20 overflow-hidden divide-y divide-teal/10">
                {/* En-tête */}
                <div className="grid grid-cols-[auto_1fr_120px_150px] gap-3 items-center px-4 py-2 bg-teal-50/60">
                  <div className="w-4" />
                  <p className="text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Équipe</p>
                  <p className="text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Rôle</p>
                  <p className="text-xs font-sans text-dark/40 uppercase tracking-widest font-medium">Fréquence</p>
                </div>

                {teams?.map(t => (
                  <div key={t.id} className="grid grid-cols-[auto_1fr_120px_150px] gap-3 items-center px-4 py-2.5 hover:bg-teal-50/30">
                    <input
                      type="checkbox"
                      name="team_ids"
                      value={t.id}
                      className="accent-teal w-4 h-4"
                    />
                    <span className="font-sans text-sm text-dark">{t.name}</span>
                    <select
                      name={`role_${t.id}`}
                      className="px-2 py-1.5 rounded-lg border border-teal/30 bg-teal-50 text-dark font-sans text-xs focus:outline-none focus:ring-2 focus:ring-teal/40"
                    >
                      <option value="member">Membre</option>
                      <option value="leader">Responsable</option>
                    </select>
                    <select
                      name={`frequency_${t.id}`}
                      className="px-2 py-1.5 rounded-lg border border-teal/30 bg-teal-50 text-dark font-sans text-xs focus:outline-none focus:ring-2 focus:ring-teal/40"
                    >
                      <option value="">—</option>
                      {Object.entries(frequencyLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {params.error && (
              <p className="text-sm text-red-500 font-sans">{params.error}</p>
            )}

            <button type="submit"
              className="w-full py-3 bg-teal text-white rounded-lg font-sans text-sm font-medium hover:bg-teal-dark transition-colors">
              Envoyer l'invitation
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
