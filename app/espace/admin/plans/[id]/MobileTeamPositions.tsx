'use client'

import { useEffect, useState } from 'react'
import { MobileOpenSlot } from './MobileOpenSlot'
import { ExcludePositionButton } from '../ExcludePositionButton'
import type { Position, Profile } from '../getPlanDetail'

/** Zone « postes » d'une équipe sur mobile.
 *
 *  Composant client — et non du balisage serveur — parce que la liste des postes masqués est
 *  pilotée par un état local mis à jour par le clic lui-même. Le rafraîchissement déclenché par
 *  l'action produit bien un rendu avec la bonne donnée, mais React l'abandonne parfois sans le
 *  committer ; une mise à jour issue d'un événement utilisateur, elle, est toujours appliquée.
 *  Même approche que l'arbre desktop (AssignmentBoard). */
export function MobileTeamPositions({
  planId,
  teamId,
  positions,
  filledPositionIds,
  initialExcludedIds,
  candidatesByPosition,
  candidateProfiles,
  assignmentsCount,
  allowsGuests,
  hidePositions,
  canManage,
  isAdmin,
}: {
  planId: string
  teamId: string
  positions: Position[]
  filledPositionIds: string[]
  initialExcludedIds: string[]
  candidatesByPosition: Record<string, Profile[]>
  candidateProfiles: Profile[]
  assignmentsCount: number
  allowsGuests: boolean
  hidePositions: boolean
  canManage: boolean
  isAdmin: boolean
}) {
  const serverKey = initialExcludedIds.join(',')
  const [localExcluded, setLocalExcluded] = useState<string[]>(initialExcludedIds)
  useEffect(() => {
    setLocalExcluded(initialExcludedIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey])

  function applyToggle(positionId: string, exclude: boolean) {
    setLocalExcluded(prev => (
      exclude
        ? (prev.includes(positionId) ? prev : [...prev, positionId])
        : prev.filter(id => id !== positionId)
    ))
  }

  const filled = new Set(filledPositionIds)
  const excluded = new Set(localExcluded)
  // "DM" se règle exclusivement via le DmSelector (choix parmi Piano/Basse/Batterie).
  const openPositions = positions.filter(p => !filled.has(p.id) && !excluded.has(p.id) && p.name !== 'DM')
  const excludedPositions = positions.filter(p => excluded.has(p.id))
  const multiPositions = positions.filter(p => p.allow_multiple && filled.has(p.id))
  const noNamedPos = positions.length === 0
  const hasOpenSlots = openPositions.length > 0 || (noNamedPos && assignmentsCount === 0)

  return (
    <>
      {canManage ? (
        openPositions.length > 0 ? openPositions.map(pos => (
          <div key={pos.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <MobileOpenSlot
                planId={planId}
                teamId={teamId}
                positionId={pos.id}
                positionName={hidePositions ? 'Poste disponible' : pos.name}
                candidates={candidatesByPosition[pos.id] ?? []}
                isInviteTeam={allowsGuests}
              />
            </div>
            {isAdmin && (
              <ExcludePositionButton
                planId={planId}
                positionId={pos.id}
                exclude
                onToggle={applyToggle}
                title="Masquer ce poste pour ce service"
                className="shrink-0 w-7 h-7 rounded-full bg-white shadow-sm border border-dark/10 text-dark/30 flex items-center justify-center text-sm font-bold"
              >×</ExcludePositionButton>
            )}
          </div>
        )) : hasOpenSlots ? (
          <MobileOpenSlot
            planId={planId}
            teamId={teamId}
            positionId={null}
            positionName="Ajouter un bénévole"
            candidates={candidateProfiles}
            isInviteTeam={allowsGuests}
          />
        ) : null
      ) : null}

      {canManage && multiPositions.map(pos => (
        <MobileOpenSlot
          key={`more:${pos.id}`}
          planId={planId}
          teamId={teamId}
          positionId={pos.id}
          positionName={hidePositions ? 'Poste disponible' : pos.name}
          candidates={candidatesByPosition[pos.id] ?? []}
          isInviteTeam={allowsGuests}
          variant="more"
        />
      ))}

      {!canManage && (
        openPositions.length > 0 ? openPositions.map(pos => (
          <div key={pos.id} className="flex items-center gap-3 border-2 border-dashed border-orange-200 rounded-xl px-3.5 py-2.5 bg-orange-50/30">
            <div className="w-7 h-7 rounded-full border-2 border-dashed border-orange-300 flex items-center justify-center shrink-0 text-orange-300">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 5a5 5 0 0 1 10 0H3Z" />
              </svg>
            </div>
            <span className="font-sans text-sm text-dark/40 italic">
              {hidePositions ? 'Poste disponible' : pos.name}
            </span>
          </div>
        )) : hasOpenSlots ? (
          <div className="flex items-center gap-3 border-2 border-dashed border-orange-200 rounded-xl px-3.5 py-2.5 bg-orange-50/30">
            <div className="w-7 h-7 rounded-full border-2 border-dashed border-orange-300 flex items-center justify-center shrink-0 text-orange-300">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 5a5 5 0 0 1 10 0H3Z" />
              </svg>
            </div>
            <span className="font-sans text-sm text-dark/30 italic">Aucun bénévole</span>
          </div>
        ) : null
      )}

      {/* Postes masqués — restaurables */}
      {isAdmin && excludedPositions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {excludedPositions.map(pos => (
            <ExcludePositionButton
              key={pos.id}
              planId={planId}
              positionId={pos.id}
              exclude={false}
              onToggle={applyToggle}
              title="Réafficher ce poste"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-dark/20 text-dark/30 font-sans text-[10px]"
            >
              + {pos.name}
            </ExcludePositionButton>
          ))}
        </div>
      )}
    </>
  )
}
