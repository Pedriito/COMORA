'use client'

import { useState, useTransition } from 'react'
import { addPastoralNote, deletePastoralNote, resolvePrayerRequest, deletePrayerRequest, addPrayerRequest } from '../actions'
import { IconHome, IconPhone, IconChat, IconDocument } from '@/app/espace/_components/Icons'

type Profile = { id: string; first_name: string; last_name: string; email: string; phone: string | null; city: string | null; birthdate: string | null; status: string; created_at: string }
type PrayerRequest = { id: string; subject: string; notes: string | null; status: string; created_at: string; resolved_at: string | null }
type PastoralNote = { id: string; note_date: string; type: string; notes: string; created_at: string }
type Assignment = { id: string; status: string; plan_id: string; plans: { title: string; service_date: string } }

const TYPE_OPTIONS = [
  { value: 'visit',   label: 'Visite',  Icon: IconHome },
  { value: 'call',    label: 'Appel',   Icon: IconPhone },
  { value: 'message', label: 'Message', Icon: IconChat },
  { value: 'other',   label: 'Autre',   Icon: IconDocument },
]

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'text-green-600', declined: 'text-red-400', pending: 'text-amber-500',
}

export function PastoralMemberClient({ profileId, profile, prayerRequests: initialPrayers, pastoralNotes: initialNotes, assignments }: {
  profileId: string
  profile: Profile
  prayerRequests: PrayerRequest[]
  pastoralNotes: PastoralNote[]
  assignments: Assignment[]
}) {
  const [prayers, setPrayers]   = useState(initialPrayers)
  const [notes, setNotes]       = useState(initialNotes)
  const [addingNote, setAddingNote]     = useState(false)
  const [addingPrayer, setAddingPrayer] = useState(false)
  const [noteError, setNoteError]       = useState<string | null>(null)
  const [prayerError, setPrayerError]   = useState<string | null>(null)
  const [isPending, start]              = useTransition()

  const today = new Date().toISOString().split('T')[0]

  function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setNoteError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('profile_id', profileId)
    start(async () => {
      const res = await addPastoralNote(fd)
      if (res.ok) {
        setAddingNote(false)
        window.location.reload()
      } else setNoteError(res.error ?? 'Erreur')
    })
  }

  function handleAddPrayer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setPrayerError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('profile_id', profileId)
    start(async () => {
      const res = await addPrayerRequest(fd)
      if (res.ok) {
        setAddingPrayer(false)
        window.location.reload()
      } else setPrayerError(res.error ?? 'Erreur')
    })
  }

  function handleResolve(id: string) {
    start(async () => {
      await resolvePrayerRequest(id)
      setPrayers(prev => prev.map(p => p.id === id ? { ...p, status: 'resolved', resolved_at: today } : p))
    })
  }

  function handleDeletePrayer(id: string) {
    start(async () => {
      await deletePrayerRequest(id)
      setPrayers(prev => prev.filter(p => p.id !== id))
    })
  }

  function handleDeleteNote(id: string) {
    start(async () => {
      await deletePastoralNote(id)
      setNotes(prev => prev.filter(n => n.id !== id))
    })
  }

  const activePrayers   = prayers.filter(p => p.status === 'active')
  const resolvedPrayers = prayers.filter(p => p.status !== 'active')

  return (
    <div className="space-y-6">
      {/* Infos rapides */}
      <div className="bg-white rounded-2xl border border-teal/20 px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Email', value: profile.email },
          { label: 'Téléphone', value: profile.phone ?? '—' },
          { label: 'Ville', value: profile.city ?? '—' },
          { label: 'Membre depuis', value: new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="font-sans text-[10px] text-dark/30 uppercase tracking-widest">{label}</p>
            <p className="font-sans text-sm text-dark mt-0.5 break-all">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Notes pastorales ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-dark font-light">Notes pastorales</h2>
            <button onClick={() => setAddingNote(v => !v)}
              className="font-sans text-xs text-teal hover:underline">
              {addingNote ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {addingNote && (
            <form onSubmit={handleAddNote} className="bg-white rounded-xl border border-teal/30 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-sans text-xs text-dark/50 mb-1 block">Type</label>
                  <select name="type" className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark focus:outline-none focus:ring-2 focus:ring-teal/30">
                    {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-sans text-xs text-dark/50 mb-1 block">Date</label>
                  <input name="note_date" type="date" defaultValue={today}
                    className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark focus:outline-none focus:ring-2 focus:ring-teal/30" />
                </div>
              </div>
              <textarea name="notes" required rows={3} placeholder="Notes de la visite, appel ou rencontre…"
                className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none" />
              {noteError && <p className="font-sans text-xs text-red-500">{noteError}</p>}
              <button type="submit" disabled={isPending}
                className="w-full py-2 rounded-lg bg-teal text-white font-sans text-xs font-medium hover:bg-teal/90 disabled:opacity-40">
                Enregistrer
              </button>
            </form>
          )}

          <div className="space-y-2">
            {notes.map(n => (
              <div key={n.id} className="bg-white rounded-xl border border-teal/15 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1 font-sans text-[10px] text-dark/50 uppercase tracking-wide mb-0.5">
                      {(() => { const t = TYPE_OPTIONS.find(o => o.value === n.type); return t ? <><t.Icon className="w-3 h-3" />{t.label}</> : n.type })()}
                      {' · '}
                      {new Date(n.note_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="font-sans text-sm text-dark leading-snug whitespace-pre-wrap">{n.notes}</p>
                  </div>
                  <button onClick={() => handleDeleteNote(n.id)} disabled={isPending} aria-label="Supprimer la note"
                    className="text-dark/20 hover:text-red-400 transition-colors font-sans text-lg leading-none shrink-0">×</button>
                </div>
              </div>
            ))}
            {notes.length === 0 && !addingNote && (
              <p className="font-sans text-xs text-dark/30 italic px-1">Aucune note pastorale.</p>
            )}
          </div>
        </section>

        {/* ── Sujets de prière ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-dark font-light">Prière</h2>
            <button onClick={() => setAddingPrayer(v => !v)}
              className="font-sans text-xs text-teal hover:underline">
              {addingPrayer ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {addingPrayer && (
            <form onSubmit={handleAddPrayer} className="bg-white rounded-xl border border-teal/30 p-4 space-y-3">
              <input name="subject" required placeholder="Sujet de prière *"
                className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30" />
              <textarea name="notes" rows={2} placeholder="Détails (optionnel)"
                className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm font-sans text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none" />
              {prayerError && <p className="font-sans text-xs text-red-500">{prayerError}</p>}
              <button type="submit" disabled={isPending}
                className="w-full py-2 rounded-lg bg-teal text-white font-sans text-xs font-medium hover:bg-teal/90 disabled:opacity-40">
                Ajouter
              </button>
            </form>
          )}

          {/* Actifs */}
          <div className="space-y-2">
            {activePrayers.map(pr => (
              <div key={pr.id} className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-sans text-sm text-dark font-medium">{pr.subject}</p>
                    {pr.notes && <p className="font-sans text-xs text-dark/50 mt-0.5">{pr.notes}</p>}
                    <p className="font-sans text-[10px] text-dark/30 mt-1">
                      {new Date(pr.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleResolve(pr.id)} disabled={isPending} aria-label="Marquer exaucé"
                      className="text-xs text-green-600 hover:text-green-700 font-sans px-2 py-1 rounded hover:bg-green-100 transition-colors" title="Exaucé">✓</button>
                    <button onClick={() => handleDeletePrayer(pr.id)} disabled={isPending} aria-label="Supprimer"
                      className="text-dark/25 hover:text-red-400 font-sans text-lg leading-none px-1">×</button>
                  </div>
                </div>
              </div>
            ))}
            {activePrayers.length === 0 && !addingPrayer && (
              <p className="font-sans text-xs text-dark/30 italic px-1">Aucun sujet de prière actif.</p>
            )}
          </div>

          {/* Exaucés */}
          {resolvedPrayers.length > 0 && (
            <details>
              <summary className="font-sans text-xs text-dark/30 cursor-pointer hover:text-dark/50">
                {resolvedPrayers.length} sujet{resolvedPrayers.length > 1 ? 's' : ''} exaucé{resolvedPrayers.length > 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-1.5">
                {resolvedPrayers.map(pr => (
                  <div key={pr.id} className="bg-white rounded-lg border border-teal/10 px-3 py-2 opacity-60">
                    <p className="font-sans text-xs text-dark">✓ {pr.subject}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      </div>

      {/* ── Historique des services ── */}
      {assignments.length > 0 && (
        <section className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
          <div className="px-5 py-3 border-b border-teal/10 bg-teal-50/50">
            <p className="font-sans text-xs text-dark/50 uppercase tracking-widest font-medium">Historique des services</p>
          </div>
          <div className="divide-y divide-teal/10">
            {assignments.map(a => {
              const plan = a.plans as any
              return (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-sans text-sm text-dark">{plan.title}</p>
                    <p className="font-sans text-xs text-dark/40 mt-0.5 capitalize">
                      {new Date(plan.service_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`font-sans text-xs font-medium ${STATUS_COLORS[a.status] ?? 'text-dark/40'}`}>
                    {a.status === 'confirmed' ? '✓ Confirmé' : a.status === 'declined' ? 'Décliné' : 'En attente'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
