'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { computeAutoFillProposal } from './autofill/computeAutoFill'
import { commitAutoFillProposal, type CommitRow } from './autofill/commitAutoFill'
import type { AutoFillProposal, AutoFillSkipped } from './autofill/buildAutoFillProposal'
import { IconCalendar } from '@/app/espace/_components/Icons'

/** Date locale au format "YYYY-MM-DD". Construite avec les accesseurs locaux plutôt que via
 *  `toISOString()`, qui convertirait l'instant en UTC et renverrait la veille entre minuit
 *  et 2 h du matin heure de Paris. */
function todayISO(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function keyOf(p: { planId: string; positionId: string }) {
  return `${p.planId}:${p.positionId}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

type Step = 'config' | 'loading' | 'preview' | 'saving'

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-dark/30 backdrop-blur-[2px] z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 sm:hidden shrink-0">
          <span className="w-10 h-1 rounded-full bg-dark/15" />
        </div>
        {children}
      </div>
    </div>
  )
}

/** Bouton admin déclenchant l'auto-remplissage du planning sur une plage de dates : calcule
 *  une proposition côté serveur (`computeAutoFillProposal`, rien n'est écrit en base), l'affiche
 *  dans une modale éditable groupée par date, puis persiste via `commitAutoFillProposal` une
 *  fois validée. */
export function AutoFillButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('config')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO(30))
  const [proposals, setProposals] = useState<AutoFillProposal[]>([])
  const [skipped, setSkipped] = useState<AutoFillSkipped[]>([])
  const [showSkipped, setShowSkipped] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setStep('config')
    setError(null)
  }

  async function generate() {
    setStep('loading')
    setError(null)
    const res = await computeAutoFillProposal(startDate, endDate)
    if (!res.ok) {
      setError(res.error)
      setStep('config')
      return
    }
    setProposals(res.proposals)
    setSkipped(res.skipped)
    setStep('preview')
  }

  function updateProposal(key: string, userId: string, userName: string) {
    setProposals(prev => prev.map(p => (keyOf(p) === key ? { ...p, userId, userName } : p)))
  }

  function removeProposal(key: string) {
    setProposals(prev => prev.filter(p => keyOf(p) !== key))
  }

  async function validate() {
    setStep('saving')
    setError(null)
    const rows: CommitRow[] = proposals.map(p => ({
      planId: p.planId,
      serviceDate: p.serviceDate,
      teamId: p.teamId,
      positionId: p.positionId,
      positionName: p.positionName,
      allowMultiple: p.allowMultiple,
      userId: p.userId,
    }))
    const res = await commitAutoFillProposal(rows)
    if (!res.ok) {
      setError(res.error)
      setStep('preview')
      return
    }
    close()
    router.refresh()
  }

  // Regroupement par date (les propositions arrivent déjà triées chronologiquement).
  const groups: { date: string; items: AutoFillProposal[] }[] = []
  for (const p of proposals) {
    const date = p.serviceDate.split('T')[0]
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.items.push(p)
    else groups.push({ date, items: [p] })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-teal/30 text-teal-dark rounded-full font-sans text-sm font-medium hover:bg-teal/5 transition-colors"
      >
        <IconCalendar className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Auto-remplissage</span>
      </button>

      {open && (
        <Modal onClose={close}>
          {(step === 'config' || step === 'loading') && (
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl text-dark font-light">Auto-remplissage du planning</h2>
                <button onClick={close} className="text-dark/30 hover:text-dark transition-colors text-xl leading-none">×</button>
              </div>
              <p className="font-sans text-sm text-dark/50">
                Propose des affectations sur les postes nommés, en respectant le rythme de service souhaité par chaque bénévole. Vous pourrez tout modifier avant de valider.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block font-sans text-xs text-dark/50 mb-1">Du</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    // text-base (16px) évite le zoom automatique de Safari iOS au focus ; bg/text
                    // explicites pour que le rendu du champ natif reste cohérent avec le reste de
                    // la modale plutôt que de dépendre du chrome par défaut d'iOS.
                    className="w-full min-w-0 min-h-11 px-3 py-2.5 rounded-lg border border-teal/30 bg-white text-dark font-sans text-base focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-sans text-xs text-dark/50 mb-1">Au</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full min-w-0 min-h-11 px-3 py-2.5 rounded-lg border border-teal/30 bg-white text-dark font-sans text-base focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </div>
              </div>
              {error && <p className="font-sans text-xs text-red-500">{error}</p>}
              <button
                type="button"
                onClick={generate}
                disabled={step === 'loading'}
                className="w-full py-3 bg-teal text-white rounded-lg font-sans text-sm font-semibold hover:bg-teal-dark transition-colors disabled:opacity-60"
              >
                {step === 'loading' ? 'Génération…' : 'Générer'}
              </button>
            </div>
          )}

          {(step === 'preview' || step === 'saving') && (
            <>
              <div className="px-6 pt-5 pb-3 border-b border-teal/10 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="font-display text-xl text-dark font-light">Aperçu de l'auto-remplissage</h2>
                  <p className="font-sans text-xs text-dark/40 mt-0.5">
                    {proposals.length} poste{proposals.length > 1 ? 's' : ''} proposé{proposals.length > 1 ? 's' : ''} · {skipped.length} non pourvu{skipped.length > 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={close} className="text-dark/30 hover:text-dark transition-colors text-xl leading-none">×</button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {groups.length === 0 && (
                  <p className="font-sans text-sm text-dark/40 italic text-center py-6">Aucun poste à proposer sur cette plage.</p>
                )}
                {groups.map(g => (
                  <div key={g.date}>
                    <p className="font-sans text-[10px] uppercase tracking-widest font-semibold text-dark/35 mb-2 capitalize">{fmtDate(g.date)}</p>
                    <div className="space-y-2">
                      {g.items.map(p => {
                        const key = keyOf(p)
                        return (
                          <div key={key} className="flex items-center gap-3 bg-teal-50/60 rounded-xl px-3.5 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="font-sans text-xs text-dark/40">{p.teamName} · {p.positionName}</p>
                            </div>
                            <select
                              value={p.userId}
                              onChange={e => {
                                const val = e.target.value
                                if (val === '') removeProposal(key)
                                else {
                                  const alt = [{ id: p.userId, name: p.userName }, ...p.alternatives].find(a => a.id === val)
                                  if (alt) updateProposal(key, alt.id, alt.name)
                                }
                              }}
                              className="shrink-0 px-2.5 py-1.5 rounded-lg border border-teal/30 bg-white font-sans text-xs max-w-[45%]"
                            >
                              <option value={p.userId}>{p.userName}</option>
                              {p.alternatives.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                              <option value="">— Ne pas assigner —</option>
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {skipped.length > 0 && (
                  <div className="pt-2 border-t border-teal/10">
                    <button
                      type="button"
                      onClick={() => setShowSkipped(v => !v)}
                      className="font-sans text-xs text-dark/40 hover:text-dark transition-colors flex items-center gap-1"
                    >
                      Créneaux non pourvus ({skipped.length}) <span className={`transition-transform inline-block ${showSkipped ? 'rotate-90' : ''}`}>›</span>
                    </button>
                    {showSkipped && (
                      <div className="mt-2 space-y-1.5">
                        {skipped.map((s, i) => (
                          <p key={i} className="font-sans text-xs text-dark/35">
                            {fmtDate(s.serviceDate.split('T')[0])} · {s.teamName} · {s.positionName} —{' '}
                            {s.reason === 'no_eligible' ? 'aucun bénévole qualifié' : 'personne dans son rythme souhaité'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-teal/10 shrink-0 space-y-2">
                {error && <p className="font-sans text-xs text-red-500">{error}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={close} className="flex-1 py-3 border border-teal/30 text-dark/60 rounded-lg font-sans text-sm hover:bg-teal-50 transition-colors">
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={validate}
                    disabled={step === 'saving' || proposals.length === 0}
                    className="flex-1 py-3 bg-teal text-white rounded-lg font-sans text-sm font-semibold hover:bg-teal-dark transition-colors disabled:opacity-60"
                  >
                    {step === 'saving' ? 'Validation…' : `Valider (${proposals.length})`}
                  </button>
                </div>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  )
}
