'use client'

import { useState, useTransition } from 'react'
import { copySetlist, getOtherPlans } from './copy-setlist-action'

type Plan = { id: string; title: string; date: string }

export function CopySetlistButton({ planId, songCount }: { planId: string; songCount: number }) {
  const [open, setOpen]         = useState(false)
  const [plans, setPlans]       = useState<Plan[]>([])
  const [destId, setDestId]     = useState('')
  const [result, setResult]     = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  function handleOpen() {
    setOpen(true)
    setResult(null)
    setError(null)
    if (plans.length === 0) {
      start(async () => {
        const list = await getOtherPlans(planId)
        setPlans(list)
        if (list.length > 0) setDestId(list[0].id)
      })
    }
  }

  function handleCopy() {
    if (!destId) return
    setResult(null); setError(null)
    start(async () => {
      const res = await copySetlist(planId, destId)
      if (!res.ok) { setError(res.error ?? 'Erreur'); return }
      const dest = plans.find(p => p.id === destId)
      if (res.copied === 0) {
        setResult(`Tous les chants sont déjà dans "${dest?.title}".`)
      } else {
        setResult(`✓ ${res.copied} chant${res.copied > 1 ? 's' : ''} copié${res.copied > 1 ? 's' : ''} vers "${dest?.title}".`)
      }
    })
  }

  if (songCount === 0) return null

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal/20 font-sans text-xs text-dark/50 hover:text-teal hover:border-teal/40 transition-colors"
        title="Copier cette liste de chants vers un autre plan"
      >
        📋 Copier vers…
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg text-dark font-light">Copier la setlist</h2>
                <p className="font-sans text-xs text-dark/40 mt-0.5">
                  {songCount} chant{songCount > 1 ? 's' : ''} seront copiés vers le plan choisi
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-dark/30 hover:text-dark text-xl leading-none">×</button>
            </div>

            {isPending && plans.length === 0 ? (
              <p className="font-sans text-sm text-dark/40 text-center py-4">Chargement…</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="font-sans text-xs text-dark/50 uppercase tracking-widest">Plan destination</label>
                  <select
                    value={destId}
                    onChange={e => { setDestId(e.target.value); setResult(null); setError(null) }}
                    className="w-full border border-teal/20 rounded-lg px-3 py-2.5 font-sans text-sm text-dark focus:outline-none focus:border-teal/40 bg-teal-50/30"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title} · {p.date}
                      </option>
                    ))}
                    {plans.length === 0 && <option disabled>Aucun autre plan</option>}
                  </select>
                </div>

                {result && (
                  <p className="font-sans text-sm text-teal bg-teal/10 border border-teal/20 rounded-lg px-3 py-2">{result}</p>
                )}
                {error && (
                  <p className="font-sans text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <p className="font-sans text-[11px] text-dark/30 leading-snug">
                  Les chants déjà présents dans le plan destination ne seront pas dupliqués.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-teal/20 font-sans text-sm text-dark/60 hover:bg-teal/5"
                  >
                    Fermer
                  </button>
                  {!result && (
                    <button
                      onClick={handleCopy}
                      disabled={isPending || !destId || plans.length === 0}
                      className="flex-1 py-2.5 rounded-xl bg-teal text-white font-sans text-sm font-medium hover:bg-teal/90 disabled:opacity-40"
                    >
                      {isPending ? 'Copie…' : 'Copier'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
