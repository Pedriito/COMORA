'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { movePlan } from './actions'

type Props = {
  planId: string
  serviceDate: string
  /** Classes CSS du bouton (état affiché) */
  className?: string
  /** Classes CSS du <input type="time"> (état édition) */
  inputClassName?: string
  /** Empêche la propagation du clic vers un éventuel <Link> parent */
  stopPropagation?: boolean
}

export function PlanTimeEditor({ planId, serviceDate, className, inputClassName, stopPropagation }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const d = new Date(serviceDate)
  const currentTime = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const currentTimeInput = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  // Date locale en YYYY-MM-DD (évite un décalage UTC si le service est tôt le matin)
  const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  function save() {
    const val = inputRef.current?.value
    setIsEditing(false)
    if (!val || val === currentTimeInput) return
    const newServiceDate = `${localDate}T${val}`
    startTransition(async () => {
      await movePlan(planId, newServiceDate)
      router.refresh()
    })
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="time"
        defaultValue={currentTimeInput}
        autoFocus
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur() }
          if (e.key === 'Escape') { setIsEditing(false) }
        }}
        onClick={e => stopPropagation && e.stopPropagation()}
        className={inputClassName ?? 'font-sans text-xs border border-teal/40 rounded px-1.5 py-0.5 bg-transparent text-current focus:outline-none focus:border-teal'}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={e => {
        if (stopPropagation) e.stopPropagation()
        setIsEditing(true)
      }}
      title="Modifier l'heure"
      disabled={isPending}
      className={className ?? 'font-sans text-xs tabular-nums transition-colors cursor-pointer hover:underline decoration-dotted text-dark/50 hover:text-teal'}
    >
      {isPending ? '…' : currentTime}
    </button>
  )
}
