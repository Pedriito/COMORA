'use client'

import { useState, useTransition } from 'react'
import { createTask } from '../actions'

type Profile = { id: string; first_name: string; last_name: string }

export function QuickAddTask({
  teamId,
  teamMembers,
}: {
  teamId: string
  teamMembers: Profile[]
}) {
  const [title, setTitle] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [showExtras, setShowExtras] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const fd = new FormData()
    fd.set('title', title)
    fd.set('team_id', teamId)
    if (assignedTo) fd.set('assigned_to', assignedTo)
    if (dueDate) fd.set('due_date', dueDate)
    startTransition(async () => {
      await createTask(fd)
      setTitle('')
      setAssignedTo('')
      setDueDate('')
      setShowExtras(false)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-teal/20 overflow-hidden focus-within:ring-2 focus-within:ring-teal/30">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-teal/30 text-lg shrink-0 select-none">○</span>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Nouvelle tâche…"
          className="flex-1 font-sans text-sm text-dark placeholder:text-dark/30 focus:outline-none bg-transparent"
        />
        <button
          type="button"
          onClick={() => setShowExtras(v => !v)}
          className={`font-sans text-xs px-2 py-1 rounded transition-colors shrink-0 ${
            showExtras ? 'text-teal bg-teal/5' : 'text-dark/30 hover:text-dark/50'
          }`}
        >
          + options
        </button>
        <button
          type="submit"
          disabled={!title.trim() || isPending}
          className="shrink-0 px-3 py-1.5 bg-teal hover:bg-teal-dark disabled:opacity-40 text-white rounded-lg font-sans text-sm font-semibold transition-colors"
        >
          {isPending ? '…' : '+'}
        </button>
      </div>

      {showExtras && (
        <div className="border-t border-teal/10 px-4 pb-3 pt-2 flex flex-wrap gap-4">
          {teamMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="font-sans text-xs text-dark/40 shrink-0">Assigner à</label>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                className="font-sans text-xs text-dark border border-teal/20 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal/30 bg-white"
              >
                <option value="">— Personne —</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="font-sans text-xs text-dark/40 shrink-0">Pour le</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="font-sans text-xs text-dark border border-teal/20 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal/30 bg-white"
            />
          </div>
        </div>
      )}
    </form>
  )
}
