'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addAssignmentAsync } from './actions'

type Props = {
  planId: string
  teamId: string
  userId: string
  positionId: string | null
  className?: string
  children: React.ReactNode
  onAssigned?: () => void
}

/** Bouton « Assigner » — appelle l'action directement (pas de <form>/redirect),
 *  feedback immédiat puis rafraîchit la vue en arrière-plan. */
export function AssignVolunteerButton({ planId, teamId, userId, positionId, className, children, onAssigned }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            try {
              const result = await addAssignmentAsync({ planId, teamId, userId, positionId })
              if (result.ok) {
                onAssigned?.()
                router.refresh()
              } else {
                setError(result.error ?? 'Échec de l’affectation.')
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Échec de l’affectation.')
            }
          })
        }}
        className={className}
      >
        {isPending ? '…' : children}
      </button>
      {error && <p className="font-sans text-[10px] text-red-500 text-right max-w-40">{error}</p>}
    </div>
  )
}
