'use client'

import { useActionState, useState } from 'react'
import { confirmMembersImport, createFirstService, createFirstTeam, previewMembersImport, type StepState } from './actions'

const input =
  'w-full px-4 py-2.5 rounded-lg border border-teal/30 bg-teal-50 text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-teal/40 font-sans text-sm'
const primary =
  'px-5 py-2.5 rounded-lg bg-teal text-white font-sans text-sm font-medium hover:bg-teal/90 transition-colors disabled:opacity-60 disabled:cursor-wait'
const label = 'block text-sm font-sans text-dark/70 mb-1.5'

function Message({ state }: { state: StepState }) {
  if (!state?.error) return null
  return <p role="alert" className="text-sm font-sans text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>
}

/** Étape « personnes » : choisir le fichier, vérifier l'aperçu, confirmer. */
export function ImportStep() {
  const [preview, previewAction, previewing] = useActionState(previewMembersImport, null)
  const [result, confirmAction, confirming] = useActionState(confirmMembersImport, null)
  const [key, setKey] = useState(0)

  if (result?.ok && result.imported) {
    const { imported, skipped } = result.imported
    return (
      <div className="space-y-3">
        <p role="status" className="text-sm font-sans text-teal-dark">
          {imported} {imported > 1 ? 'personnes ajoutées' : 'personne ajoutée'}
          {skipped > 0 && ` · ${skipped} déjà connue${skipped > 1 ? 's' : ''} (même adresse e-mail), ignorée${skipped > 1 ? 's' : ''}`}.
        </p>
        <p className="text-sm font-sans text-dark/50">Aucun e-mail n’a été envoyé : vous déciderez plus tard qui inviter.</p>
      </div>
    )
  }

  const rows = preview?.preview?.rows ?? []
  const issues = preview?.preview?.issues ?? []

  return (
    <div className="space-y-4">
      <form key={key} action={previewAction} className="space-y-3">
        <p className="text-sm font-sans text-dark/60">
          Votre fichier peut venir d’Excel ou d’un export CSV.{' '}
          <a href="/espace/demarrage/modele.csv" className="underline text-teal-dark">Télécharger le modèle</a>
        </p>
        <input name="file" type="file" required accept=".csv,.txt,.xlsx,text/csv" className={input} />
        <p className="text-xs font-sans text-dark/40">Colonnes reconnues : Prénom, Nom, E-mail, Téléphone, Ville, Date de naissance. Seul le prénom est obligatoire.</p>
        <button type="submit" disabled={previewing} className={primary}>{previewing ? 'Lecture…' : 'Vérifier le fichier'}</button>
      </form>

      <Message state={preview} />
      <Message state={result} />

      {rows.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-sans text-dark">
            <strong>{rows.length}</strong> {rows.length > 1 ? 'personnes prêtes' : 'personne prête'} à être importée{rows.length > 1 ? 's' : ''}.
            {issues.length > 0 && <> <strong>{issues.length}</strong> ligne{issues.length > 1 ? 's' : ''} à corriger (ignorée{issues.length > 1 ? 's' : ''} pour l’instant).</>}
          </p>
          <div className="overflow-x-auto rounded-lg border border-teal/20">
            <table className="w-full text-sm font-sans">
              <thead className="bg-teal-50/60 text-left text-xs uppercase tracking-widest text-dark/40">
                <tr><th className="px-3 py-2">Prénom</th><th className="px-3 py-2">Nom</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Téléphone</th></tr>
              </thead>
              <tbody className="divide-y divide-teal/10">
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i}><td className="px-3 py-2">{r.first_name}</td><td className="px-3 py-2">{r.last_name}</td><td className="px-3 py-2">{r.email}</td><td className="px-3 py-2">{r.phone}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 8 && <p className="text-xs font-sans text-dark/40">… et {rows.length - 8} autres.</p>}

          {issues.length > 0 && (
            <details className="text-sm font-sans text-dark/70">
              <summary className="cursor-pointer text-red-700">Voir les lignes ignorées</summary>
              <ul className="mt-2 space-y-1 list-disc pl-5">
                {issues.slice(0, 50).map((x, i) => <li key={i}>Ligne {x.line} : {x.message}</li>)}
              </ul>
              {issues.length > 50 && <p className="mt-1 text-xs text-dark/40">… et {issues.length - 50} autres.</p>}
            </details>
          )}

          <form action={confirmAction} className="flex items-center gap-3">
            <input type="hidden" name="rows" value={JSON.stringify(rows)} />
            <button type="submit" disabled={confirming} className={primary}>{confirming ? 'Import en cours…' : `Importer ${rows.length} ${rows.length > 1 ? 'personnes' : 'personne'}`}</button>
            <button type="button" onClick={() => setKey(k => k + 1)} className="text-sm font-sans text-dark/50 underline">Choisir un autre fichier</button>
          </form>
        </div>
      )}
    </div>
  )
}

export function TeamStep() {
  const [state, action, pending] = useActionState(createFirstTeam, null)
  const [name, setName] = useState('')
  const [positions, setPositions] = useState('')
  if (state?.ok) return <p role="status" className="text-sm font-sans text-teal-dark">Votre équipe est créée. Vous pourrez y ajouter des personnes depuis « Équipes ».</p>
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="team-name" className={label}>Nom de l’équipe</label>
        <input id="team-name" name="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} className={input} placeholder="Accueil, Louange, Technique…" />
      </div>
      <div>
        <label htmlFor="team-positions" className={label}>Postes (facultatif)</label>
        <textarea id="team-positions" name="positions" rows={3} value={positions} onChange={e => setPositions(e.target.value)} className={input}
          placeholder={'Un poste par ligne, par exemple :\nAccueil à l’entrée\nCafé d’accueil'} />
      </div>
      <Message state={state} />
      <button type="submit" disabled={pending} className={primary}>{pending ? 'Création…' : 'Créer l’équipe'}</button>
    </form>
  )
}

export function ServiceStep({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState(createFirstService, null)
  const [title, setTitle] = useState('Culte du dimanche')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('10:00')
  if (state?.ok) return <p role="status" className="text-sm font-sans text-teal-dark">Votre premier culte est créé : vous le retrouvez dans « Plans ».</p>
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="service-title" className={label}>Titre</label>
        <input id="service-title" name="title" required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} className={input} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="service-date" className={label}>Date</label>
          <input id="service-date" name="date" type="date" required value={date} onChange={e => setDate(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="service-time" className={label}>Heure</label>
          <input id="service-time" name="time" type="time" required value={time} onChange={e => setTime(e.target.value)} className={input} />
        </div>
      </div>
      <Message state={state} />
      <button type="submit" disabled={pending} className={primary}>{pending ? 'Création…' : 'Créer le culte'}</button>
    </form>
  )
}
