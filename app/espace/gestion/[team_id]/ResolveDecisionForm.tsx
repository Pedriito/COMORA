'use client'

import { useState, useTransition } from 'react'
import { resolveDecision } from '../actions'

export function ResolveDecisionForm({
  decisionId,
  teamId,
}: {
  decisionId: string
  teamId: string
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()

  function handle(status: 'decided' | 'dismissed') {
    const fd = new FormData()
    fd.set('decision_id', decisionId)
    fd.set('team_id', teamId)
    fd.set('status', status)
    if (note.trim()) fd.set('decision_note', note)
    startTransition(async () => {
      await resolveDecision(fd)
      setOpen(false)
      setNote('')
    })
  }

  if (!open) {
    return (
      <div className="border-t border-amber-100 px-5 py-2.5 flex items-center gap-4">
        <button
          onClick={() => setOpen(true)}
          className="font-sans text-xs text-amber-600 hover:text-amber-700 font-semibold transition-colors"
        >
          Trancher →
        </button>
        <button
          onClick={() => handle('dismissed')}
          disabled={isPending}
          className="font-sans text-xs text-dark/30 hover:text-dark/50 transition-colors disabled:opacity-40"
        >
          Archiver sans suite
        </button>
      </div>
    )
  }

  return (
    <div className="border-t border-amber-100 bg-amber-50/40 px-5 py-3 space-y-2 focus-within:ring-2 focus-within:ring-amber-300/50">
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Quelle est la décision ? (optionnel)"
        rows={2}
        autoFocus
        className="w-full font-sans text-sm text-dark placeholder:text-dark/30 bg-transparent focus:outline-none resize-none"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => handle('decided')}
          disabled={isPending}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg font-sans text-xs font-semibold transition-colors"
        >
          ✓ Décidé
        </button>
        <button
          onClick={() => setOpen(false)}
          className="font-sans text-xs text-dark/40 hover:text-dark/60 transition-colors px-2 py-1.5"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
