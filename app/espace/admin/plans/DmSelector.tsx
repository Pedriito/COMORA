'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setDmHolder } from './actions'
import type { AssignmentRow } from './getPlanDetail'

type Instrument = { positionId: string; positionName: string; assignment: AssignmentRow | null }

/** Sélecteur mutuellement exclusif : choisit lequel de Piano/Basse/Batterie porte le rôle DM
 *  pour ce service, plutôt que de créer deux affectations manuelles indépendantes. Seuls les
 *  postes actuellement pourvus sont proposés (impossible de désigner "personne" comme DM). */
export function DmSelector({
  planId, teamId, dmPositionId, dmAssignment, instruments,
}: {
  planId: string
  teamId: string
  dmPositionId: string
  dmAssignment: AssignmentRow | null
  instruments: Instrument[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const currentSourceId = instruments.find(
    i => dmAssignment && i.assignment?.user_id === dmAssignment.user_id
  )?.positionId ?? ''

  function handleChange(value: string) {
    setError(null)
    startTransition(async () => {
      const result = await setDmHolder(planId, teamId, dmPositionId, value || null)
      if (!result.ok) setError(result.error ?? 'Échec.')
      else router.refresh()
    })
  }

  const available = instruments.filter(i => i.assignment)

  return (
    <div className="flex items-center gap-2 bg-teal/5 rounded-xl px-3 py-2">
      <span className="font-sans text-[10px] font-semibold text-dark/50 uppercase tracking-wide shrink-0">DM</span>
      <select
        value={currentSourceId}
        onChange={e => handleChange(e.target.value)}
        disabled={isPending || available.length === 0}
        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-teal/30 bg-white text-dark font-sans text-xs focus:outline-none focus:ring-1 focus:ring-teal/40 disabled:opacity-60"
      >
        <option value="">— Aucun —</option>
        {available.map(i => (
          <option key={i.positionId} value={i.positionId}>
            {i.positionName} — {i.assignment!.profiles?.first_name} {i.assignment!.profiles?.last_name}
          </option>
        ))}
      </select>
      {error && <p className="font-sans text-[10px] text-red-500 shrink-0">{error}</p>}
    </div>
  )
}
