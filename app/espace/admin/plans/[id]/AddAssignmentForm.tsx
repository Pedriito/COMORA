'use client'

import { useState } from 'react'
import { addAssignment } from '../actions'
import { IconWarning } from '@/app/espace/_components/Icons'
import { frequencyLabels } from '@/lib/labels'

// Valeur du champ `member_id` qui désigne un invité externe (voir addAssignment)
const EXTERNAL_CHOICE = 'external'

type Profile = {
  id: string
  first_name: string
  last_name: string
  unavailable: boolean   // blockout ce jour
  recentCount: number    // nb de services les 60 derniers jours
  desired_frequency: string | null
  servedThisMonth: number
}
type Position = { id: string; name: string }

export function AddAssignmentForm({
  planId,
  teamId,
  teamPositions,
  teamProfiles,
  candidatesByPosition,
  isInviteTeam,
  hidePositions,
}: {
  planId: string
  teamId: string
  teamPositions: Position[]
  teamProfiles: Profile[]
  candidatesByPosition: Record<string, Profile[]>
  isInviteTeam: boolean
  hidePositions: boolean
}) {
  // Si l'équipe a des postes nommés, on ne propose que les bénévoles cochés
  // pour le poste sélectionné (page Équipe) — sinon, tout le pool de l'équipe.
  const usesPositions = !hidePositions && teamPositions.length > 0
  const [selectedPositionId, setSelectedPositionId] = useState(
    usesPositions && teamPositions.length === 1 ? teamPositions[0].id : ''
  )
  const [selectedUserId, setSelectedUserId] = useState('')
  const isExternal = selectedUserId === EXTERNAL_CHOICE

  const pool = usesPositions
    ? (selectedPositionId ? (candidatesByPosition[selectedPositionId] ?? []) : [])
    : teamProfiles

  const selected = pool.find(p => p.id === selectedUserId)

  // Trier : disponibles en premier, indisponibles à la fin
  const available   = pool.filter(p => !p.unavailable)
  const unavailable = pool.filter(p => p.unavailable)

  function label(p: Profile) {
    const name = `${p.first_name} ${p.last_name}`
    const freqPart = p.desired_frequency
      ? ` · ${frequencyLabels[p.desired_frequency] ?? p.desired_frequency} (${p.servedThisMonth} ce mois)`
      : ''
    if (p.unavailable) return `✗ ${name} — indisponible`
    if (p.recentCount >= 3) return `${name} ⚡ ${p.recentCount}×${freqPart}`
    return `${name}${freqPart}`
  }

  return (
    <form action={addAssignment} className="space-y-2">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="team_id" value={teamId} />

      <div className="flex gap-2 items-center">
        {usesPositions && teamPositions.length > 1 && (
          <select
            name="position_id"
            value={selectedPositionId}
            onChange={e => { setSelectedPositionId(e.target.value); setSelectedUserId('') }}
            className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-teal/30 bg-white text-dark font-sans text-xs focus:outline-none focus:ring-1 focus:ring-teal/40"
          >
            <option value="">— Poste —</option>
            {teamPositions.map(pos => (
              <option key={pos.id} value={pos.id}>{pos.name}</option>
            ))}
          </select>
        )}
        {usesPositions && teamPositions.length === 1 && (
          <input type="hidden" name="position_id" value={teamPositions[0].id} />
        )}

        <select
          name="member_id"
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          disabled={usesPositions && !selectedPositionId}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-teal/30 bg-white text-dark font-sans text-xs focus:outline-none focus:ring-1 focus:ring-teal/40 disabled:opacity-50"
        >
          <option value="">— Bénévole —</option>
          {isInviteTeam && (
            <option value={EXTERNAL_CHOICE}>Invité (Ext)</option>
          )}

          {/* Disponibles */}
          {available.length > 0 && unavailable.length > 0 && (
            <optgroup label="Disponibles">
              {available.map(p => (
                <option key={p.id} value={p.id}>{label(p)}</option>
              ))}
            </optgroup>
          )}
          {(available.length === 0 || unavailable.length === 0) && available.map(p => (
            <option key={p.id} value={p.id}>{label(p)}</option>
          ))}

          {/* Indisponibles */}
          {unavailable.length > 0 && available.length > 0 && (
            <optgroup label="Indisponibles ce jour">
              {unavailable.map(p => (
                <option key={p.id} value={p.id}>{label(p)}</option>
              ))}
            </optgroup>
          )}
          {unavailable.length > 0 && available.length === 0 && unavailable.map(p => (
            <option key={p.id} value={p.id}>{label(p)}</option>
          ))}
        </select>

        <button
          type="submit"
          className="px-3 py-1.5 bg-teal text-white rounded-lg font-sans text-xs font-medium hover:bg-teal-dark transition-colors shrink-0"
        >
          +
        </button>
      </div>

      {/* Aucun bénévole coché pour ce poste */}
      {usesPositions && selectedPositionId && pool.length === 0 && (
        <p className="font-sans text-[10px] text-dark/40">
          Aucun bénévole n'est coché pour ce poste. Ajoutez-le depuis la page Équipe.
        </p>
      )}

      {/* Avertissement si sélection indisponible */}
      {selected?.unavailable && (
        <p className="font-sans text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
          <span className="inline-flex items-center gap-1"><IconWarning className="w-3 h-3 shrink-0" /> {selected.first_name} a déclaré une indisponibilité ce jour.</span>
        </p>
      )}

      {/* Avertissement si très fréquent */}
      {selected && !selected.unavailable && selected.recentCount >= 3 && (
        <p className="font-sans text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
          ⚡ {selected.first_name} a déjà été planifié(e) {selected.recentCount} fois ces 60 derniers jours.
        </p>
      )}

      {/* Rythme souhaité */}
      {selected?.desired_frequency && (
        <p className="font-sans text-[10px] text-dark/40 px-1">
          Rythme souhaité : {frequencyLabels[selected.desired_frequency] ?? selected.desired_frequency} · {selected.servedThisMonth} ce mois-ci
        </p>
      )}

      {/* Champs supplémentaires pour invité externe */}
      {isExternal && (
        <div className="space-y-1.5 pt-1">
          <input
            type="text"
            name="external_name"
            required
            placeholder="Prénom Nom de l'invité"
            className="w-full px-2 py-1.5 rounded-lg border border-teal/30 bg-white text-dark placeholder:text-dark/30 font-sans text-xs focus:outline-none focus:ring-1 focus:ring-teal/40"
          />
          <input
            type="email"
            name="external_email"
            placeholder="email@exemple.com (optionnel)"
            className="w-full px-2 py-1.5 rounded-lg border border-teal/30 bg-white text-dark placeholder:text-dark/30 font-sans text-xs focus:outline-none focus:ring-1 focus:ring-teal/40"
          />
        </div>
      )}
    </form>
  )
}
