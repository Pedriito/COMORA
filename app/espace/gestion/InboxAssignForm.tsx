'use client'

import { useState, useTransition } from 'react'
import { assignDecision, deleteDecision } from './actions'

type Team = { id: string; name: string }
type InboxDecision = {
  id: string
  title: string
  context: string | null
  source: string | null
  created_at: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} j`
  return `il y a ${Math.floor(days / 7)} sem.`
}

export function InboxCard({
  decision,
  teams,
}: {
  decision: InboxDecision
  teams: Team[]
}) {
  const [selectedTeam, setSelectedTeam] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAssign() {
    if (!selectedTeam) return
    const fd = new FormData()
    fd.set('decision_id', decision.id)
    fd.set('team_id', selectedTeam)
    startTransition(() => assignDecision(fd))
  }

  function handleDelete() {
    const fd = new FormData()
    fd.set('decision_id', decision.id)
    fd.set('team_id', '')
    startTransition(() => deleteDecision(fd))
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {decision.source && (
                <span className="font-sans text-xs text-teal-dark bg-teal-50 border border-teal/20 px-2 py-0.5 rounded-full">
                  {decision.source}
                </span>
              )}
              <span className="font-sans text-xs text-dark/30">{timeAgo(decision.created_at)}</span>
            </div>
            <p className="font-sans text-sm text-dark font-medium leading-snug">{decision.title}</p>
            {decision.context && (
              <p className="font-sans text-xs text-dark/50 mt-1">{decision.context}</p>
            )}
          </div>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-dark/20 hover:text-red-400 transition-colors text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>
      </div>

      <div className="border-t border-amber-100 px-5 py-2.5 flex items-center gap-2 flex-wrap">
        <select
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
          className="flex-1 min-w-0 font-sans text-xs text-dark border border-teal/20 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal/30 bg-white"
        >
          <option value="">— Assigner à une équipe —</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={!selectedTeam || isPending}
          className="shrink-0 px-3 py-1.5 bg-teal hover:bg-teal-dark disabled:opacity-40 text-white rounded-lg font-sans text-xs font-semibold transition-colors"
        >
          {isPending ? '…' : 'Assigner →'}
        </button>
      </div>
    </div>
  )
}
