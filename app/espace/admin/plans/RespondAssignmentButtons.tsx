'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { respondAssignmentAsync } from './actions'

type Status = 'pending' | 'confirmed' | 'declined'

function useOptimisticRespond(assignmentId: string, planId: string | undefined, initialStatus: Status) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<Status>(initialStatus)

  function respond(next: Status) {
    setStatus(next)
    startTransition(async () => {
      try {
        const result = await respondAssignmentAsync(assignmentId, next, planId)
        if (!result.ok) {
          console.error('[respondAssignment]', result.error)
          setStatus(initialStatus)
          return
        }
      } catch (err) {
        console.error('[respondAssignment]', err)
        setStatus(initialStatus)
        return
      }
      router.refresh()
    })
  }

  return { status, respond, isPending }
}

/** Bloc « mon affectation » de la hero card mobile (plans/[id]/page.tsx). */
export function MyAssignmentPanel({
  assignmentId,
  planId,
  positionName,
  initialStatus,
}: {
  assignmentId: string
  planId: string
  positionName: string | null
  initialStatus: Status
}) {
  const { status, respond, isPending } = useOptimisticRespond(assignmentId, planId, initialStatus)

  if (status === 'pending') {
    return (
      <>
        <p className="font-sans text-xs text-white/55 mb-3">
          {positionName ? `Demande · ${positionName}` : 'Demande en attente de confirmation'}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => respond('declined')}
            className="flex-1 py-2.5 rounded-2xl font-sans text-sm border border-white/30 bg-white/10 text-white flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
            Décliner
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => respond('confirmed')}
            className="flex-1 py-2.5 rounded-2xl font-sans text-sm font-semibold bg-white text-teal-dark flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.5 7.5l3.5 3.5 7-7" />
            </svg>
            Je serai là
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="font-sans text-[10px] uppercase tracking-widest text-white/55 font-semibold">Mon rôle</p>
        <p className="font-sans text-base text-white font-semibold mt-0.5">{positionName ?? 'Bénévole'}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-sans text-xs font-medium ${
          status === 'confirmed' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
        }`}>
          {status === 'confirmed' ? '✓ Confirmé·e' : 'Décliné'}
        </span>
        {status === 'confirmed' && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => respond('declined')}
            className="font-sans text-xs text-white/50 hover:text-white transition-colors disabled:opacity-60"
          >
            Se désister
          </button>
        )}
      </div>
    </div>
  )
}

/** Actions rapides confirmer/décliner sur une PlanCard (liste plans/page.tsx). */
export function MyAssignmentQuickActions({
  assignmentId,
  initialStatus,
  count,
}: {
  assignmentId: string
  initialStatus: Status
  count: number
}) {
  const { status, respond, isPending } = useOptimisticRespond(assignmentId, undefined, initialStatus)

  if (status === 'pending') {
    return (
      <>
        <button
          type="button"
          disabled={isPending}
          aria-label="Décliner"
          onClick={() => respond('declined')}
          className="w-9 h-9 rounded-full border border-red-200 bg-white flex items-center justify-center text-red-400 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-60"
        >
          <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
        <button
          type="button"
          disabled={isPending}
          aria-label="Confirmer"
          onClick={() => respond('confirmed')}
          className="w-9 h-9 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-green-600 hover:bg-green-100 active:scale-95 transition-all disabled:opacity-60"
        >
          <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 7.5l3.5 3.5 7-7" />
          </svg>
        </button>
      </>
    )
  }

  return (
    <>
      {status === 'confirmed' && (
        <span className="w-5 h-5 rounded-full bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-green-600" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 7.5l3.5 3.5 7-7" />
          </svg>
        </span>
      )}
      {status === 'declined' && (
        <span className="w-5 h-5 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-red-400" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </span>
      )}
      {count > 0 && <span className="font-sans text-xs text-dark/40 tabular-nums">{count} pers.</span>}
      <span className="text-teal font-sans text-sm">→</span>
    </>
  )
}
