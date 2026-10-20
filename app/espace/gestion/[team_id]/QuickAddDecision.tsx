'use client'

import { useState, useTransition } from 'react'
import { createDecision } from '../actions'

export function QuickAddDecision({ teamId }: { teamId: string }) {
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const fd = new FormData()
    fd.set('title', title)
    fd.set('team_id', teamId)
    if (context.trim()) fd.set('context', context)
    startTransition(async () => {
      await createDecision(fd)
      setTitle('')
      setContext('')
      setShowContext(false)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-teal/20 overflow-hidden focus-within:ring-2 focus-within:ring-teal/30">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-amber-400 font-bold text-base shrink-0 select-none">?</span>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Quoi décider ?"
          className="flex-1 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none bg-transparent"
        />
        <button
          type="button"
          onClick={() => setShowContext(v => !v)}
          className={`font-sans text-xs px-2 py-1 rounded transition-colors shrink-0 ${
            showContext ? 'text-teal bg-teal/5' : 'text-dark/30 hover:text-dark/50'
          }`}
        >
          + contexte
        </button>
        <button
          type="submit"
          disabled={!title.trim() || isPending}
          className="shrink-0 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg font-sans text-xs font-semibold transition-colors"
        >
          {isPending ? '…' : 'Ajouter'}
        </button>
      </div>

      {showContext && (
        <div className="border-t border-teal/10 px-4 pb-3 pt-2">
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Contexte ou détails…"
            rows={2}
            className="w-full font-sans text-xs text-dark placeholder:text-dark/30 focus:outline-none bg-transparent resize-none"
          />
        </div>
      )}
    </form>
  )
}
