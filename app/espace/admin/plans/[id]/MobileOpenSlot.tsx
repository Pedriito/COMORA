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
  unavailable: boolean
  recentCount: number
  desired_frequency: string | null
  servedThisMonth: number
}

function optionLabel(p: Profile) {
  return p.desired_frequency
    ? `${p.first_name} ${p.last_name}${p.recentCount >= 3 ? ` ⚡${p.recentCount}×` : ''} · ${frequencyLabels[p.desired_frequency] ?? p.desired_frequency} (${p.servedThisMonth} ce mois)`
    : `${p.first_name} ${p.last_name}${p.recentCount >= 3 ? ` ⚡${p.recentCount}×` : ''}`
}

export function MobileOpenSlot({
  planId,
  teamId,
  positionId,
  positionName,
  candidates,
  isInviteTeam,
  variant = 'open',
}: {
  planId: string
  teamId: string
  positionId: string | null
  positionName: string
  candidates: Profile[]
  isInviteTeam: boolean
  /** 'open' = poste vide à pourvoir (orange). 'more' = poste déjà pourvu mais qui accepte
   *  plusieurs bénévoles (ex : Chorale) — style neutre pour ne pas laisser croire qu'il est vide. */
  variant?: 'open' | 'more'
}) {
  const [expanded, setExpanded] = useState(false)
  const [userId, setUserId]     = useState('')
  const isExternal = userId === EXTERNAL_CHOICE
  const isOpen = variant === 'open'

  const available   = candidates.filter(p => !p.unavailable)
  const unavailable = candidates.filter(p => p.unavailable)
  const selected    = candidates.find(p => p.id === userId)

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`w-full flex items-center gap-3 border-2 border-dashed rounded-xl px-3.5 py-2.5 text-left ${
          isOpen ? 'border-orange-200 bg-orange-50/30' : 'border-teal/25 bg-teal/5'
        }`}
      >
        <div className={`w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center shrink-0 ${
          isOpen ? 'border-orange-300 text-orange-300' : 'border-teal/40 text-teal'
        }`}>
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 5a5 5 0 0 1 10 0H3Z" />
          </svg>
        </div>
        <span className="font-sans text-sm text-dark/50 flex-1 min-w-0 truncate">
          {isOpen ? positionName : `Ajouter · ${positionName}`}
        </span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4 text-teal/50 shrink-0">
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>
    )
  }

  return (
    <form action={addAssignment} className="border-2 border-teal/20 rounded-xl overflow-hidden">
      <input type="hidden" name="plan_id"  value={planId} />
      <input type="hidden" name="team_id"  value={teamId} />
      {positionId && <input type="hidden" name="position_id" value={positionId} />}

      {/* En-tête du poste */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-teal/5 border-b border-teal/10">
        <span className="font-sans text-xs font-semibold text-dark/60 uppercase tracking-wider">
          {positionName}
        </span>
        <button
          type="button"
          onClick={() => { setExpanded(false); setUserId('') }}
          className="text-dark/30 hover:text-dark/60 font-sans text-xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="px-3.5 py-2.5 space-y-2">
        {/* Sélecteur de bénévole + bouton */}
        <div className="flex gap-2">
          <select
            name="member_id"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-teal/30 bg-white text-dark font-sans text-xs focus:outline-none focus:ring-1 focus:ring-teal/40"
          >
            <option value="">— Choisir un bénévole —</option>
            {isInviteTeam && <option value={EXTERNAL_CHOICE}>Invité (Ext)</option>}

            {available.length > 0 && unavailable.length > 0 ? (
              <optgroup label="Disponibles">
                {available.map(p => (
                  <option key={p.id} value={p.id}>{optionLabel(p)}</option>
                ))}
              </optgroup>
            ) : available.map(p => (
              <option key={p.id} value={p.id}>{optionLabel(p)}</option>
            ))}

            {unavailable.length > 0 && available.length > 0 ? (
              <optgroup label="Indisponibles">
                {unavailable.map(p => (
                  <option key={p.id} value={p.id}>✗ {p.first_name} {p.last_name}</option>
                ))}
              </optgroup>
            ) : unavailable.map(p => (
              <option key={p.id} value={p.id}>✗ {p.first_name} {p.last_name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="shrink-0 px-3 py-1.5 bg-teal text-white rounded-lg font-sans text-xs font-semibold hover:bg-teal-dark transition-colors"
          >
            ✓
          </button>
        </div>

        {candidates.length === 0 && !isInviteTeam && (
          <p className="font-sans text-[10px] text-dark/40">
            Aucun bénévole n&apos;est coché pour ce poste. Ajoutez-le depuis la page Équipe.
          </p>
        )}

        {selected?.unavailable && (
          <p className="font-sans text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 flex items-center gap-1">
            <IconWarning className="w-3 h-3 shrink-0" />
            {selected.first_name} a déclaré une indisponibilité ce jour.
          </p>
        )}

        {selected && !selected.unavailable && selected.recentCount >= 3 && (
          <p className="font-sans text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
            ⚡ {selected.first_name} a déjà été planifié(e) {selected.recentCount} fois ces 60 derniers jours.
          </p>
        )}

        {selected?.desired_frequency && (
          <p className="font-sans text-[10px] text-dark/40 px-0.5">
            Rythme souhaité : {frequencyLabels[selected.desired_frequency] ?? selected.desired_frequency} · {selected.servedThisMonth} ce mois-ci
          </p>
        )}

        {isExternal && (
          <div className="space-y-1.5">
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
      </div>
    </form>
  )
}
