'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { deletePlan, sendSingleInvitation } from './actions'
import { ExcludePositionButton } from './ExcludePositionButton'
import { PlanTimeEditor } from './PlanTimeEditor'
import { RemoveAssignmentButton } from './RemoveAssignmentButton'
import type { PlanDetail, TeamDetail } from './getPlanDetail'
import { IconEnvelope, IconMusicalNote, IconPlay, IconProjector, IconWarning } from '@/app/espace/_components/Icons'
import { StatusDot } from '../../_components/StatusDot'
import { FlashMessage } from '../../_components/FlashMessage'
import { SongsSection } from './[id]/SongsSection'
import { CopySetlistButton } from './[id]/CopySetlistButton'
import AnnoncesSection from './[id]/AnnoncesSection'
import SermonSection from './[id]/SermonSection'
import VideoSection from './[id]/VideoSection'
import ShareButton from './[id]/ShareButton'
import { AddPlanDateForm } from './[id]/AddPlanDateForm'
import { PlanTeamsManager } from './[id]/PlanTeamsManager'
import { DmSelector } from './DmSelector'

/** Postes instrumentaux éligibles au rôle DM (cf. DmSelector). */
const DM_SOURCE_POSITIONS = ['Piano', 'Basse', 'Batterie']

type Props = {
  planId: string
  detail: PlanDetail
  /** Personne liée au compte courant dans l'église (null si aucune fiche) */
  memberId: string | null
  fillKey: string | null
  isAdmin: boolean
  flashError?: string
  flashSent?: string
  returnTo: string
  onSlotClick: (key: string) => void
}

function initials(firstName?: string, lastName?: string) {
  return `${(firstName ?? '')[0] ?? ''}${(lastName ?? '')[0] ?? ''}`.toUpperCase()
}

function PersonCard({ planId, a, returnTo }: { planId: string; a: TeamDetail['assignments'][number]; returnTo: string }) {
  const isInvite = a.member_id === null
  const displayName = isInvite ? (a.external_name ?? 'Invité (Ext)') : `${a.members?.first_name} ${a.members?.last_name}`
  const canSendInvite = isInvite ? !!a.external_email : a.status === 'pending'
  return (
    <div className="bg-white border border-teal/15 rounded-xl px-3.5 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-teal/10 text-teal-dark flex items-center justify-center font-sans text-xs font-bold shrink-0">
        {isInvite ? '✦' : initials(a.members?.first_name, a.members?.last_name)}
      </div>
      <div className="flex-1 min-w-0">
        {a.positions && (
          <p className="font-sans text-[10px] text-teal/60 uppercase tracking-wide leading-none mb-0.5">{a.positions.name}</p>
        )}
        <p className="font-sans text-sm font-medium text-dark truncate">{displayName}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!isInvite && a.unavailable && (
          <span className="text-red-400" title="Indisponible ce jour-là"><IconWarning className="w-3.5 h-3.5" /></span>
        )}
        <StatusDot status={a.status} />
        {canSendInvite && (
          <form action={sendSingleInvitation}>
            <input type="hidden" name="assignment_id" value={a.id} />
            <input type="hidden" name="plan_id" value={planId} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button type="submit" title="Envoyer l'invitation" aria-label="Envoyer l'invitation" className="text-dark/40 hover:text-teal transition-colors">
              <IconEnvelope className="w-4 h-4" />
            </button>
          </form>
        )}
        <RemoveAssignmentButton
          assignmentId={a.id}
          planId={planId}
          className="text-dark/20 hover:text-red-400 transition-colors font-sans text-lg leading-none disabled:opacity-40"
        />
      </div>
    </div>
  )
}

function OpenSlotCard({
  label, onClick, active, variant = 'open',
}: {
  label: string
  onClick: () => void
  active: boolean
  /** 'open' = poste vide à pourvoir (orange). 'more' = poste déjà pourvu mais qui accepte
   *  plusieurs bénévoles (ex : Chorale) — style neutre pour ne pas laisser croire qu'il est vide. */
  variant?: 'open' | 'more'
}) {
  const isOpen = variant === 'open'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3.5 py-3 flex items-center gap-3 border-2 border-dashed transition-colors text-left ${
        active
          ? 'border-teal bg-teal/5'
          : isOpen
            ? 'border-orange-200 hover:border-orange-300 bg-orange-50/40'
            : 'border-teal/25 hover:border-teal/40 bg-teal/5'
      }`}
    >
      <div className={`w-9 h-9 rounded-full border-2 border-dashed flex items-center justify-center text-lg shrink-0 ${
        isOpen ? 'border-orange-300 text-orange-400' : 'border-teal/40 text-teal'
      }`}>+</div>
      <div className="min-w-0">
        <p className="font-sans text-sm font-medium text-dark truncate">{label}</p>
        <p className={`font-sans text-xs font-medium ${isOpen ? 'text-orange-500' : 'text-teal'}`}>
          {isOpen ? 'Poste à pourvoir' : 'Ajouter quelqu’un d’autre'}
        </p>
      </div>
    </button>
  )
}

export function AssignmentBoard({ planId, detail, memberId, fillKey, isAdmin, flashError, flashSent, returnTo, onSlotClick }: Props) {
  const { plan, isRehearsal, teams, noTeamAssignments, planSongs, allSongs, announcements, recurringAnnouncements, sermons, videos } = detail

  const { visibleTeams, totalPositions, filledPositions } = useMemo(() => {
    const visibleTeams = teams.filter(t => t.visible)
    const positionTeams = visibleTeams.filter(t => t.positions.length > 0)
    const totalPositions = positionTeams.reduce((s, t) => s + t.positions.length, 0)
    const filledPositions = positionTeams.reduce((s, t) => {
      const filledIds = new Set(t.assignments.map(a => a.position_id).filter(Boolean))
      return s + t.positions.filter(p => filledIds.has(p.id)).length
    }, 0)
    return { visibleTeams, totalPositions, filledPositions }
  }, [teams])

  // Dépliées si le viewer est membre de l'équipe, ou s'il y est affecté sur ce service.
  // L'appartenance seule ne suffit pas côté affectation : une équipe encore vide (aucune
  // affectation sur ce service) doit rester dépliée pour ses membres.
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(teams.map(t => [t.id, t.isMyTeam || t.assignments.some(a => memberId !== null && a.member_id === memberId)]))
  )
  function toggleTeam(teamId: string) {
    setExpandedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }))
  }

  // Postes masqués pilotés localement : le rafraîchissement serveur produit bien un rendu avec
  // la bonne donnée, mais React l'abandonne parfois sans le committer (rendu sans commit,
  // constaté en production). Un état mis à jour par le clic lui-même est toujours appliqué.
  const serverExcluded = plan.excluded_position_ids ?? []
  const serverExcludedKey = serverExcluded.join(',')
  const [localExcluded, setLocalExcluded] = useState<string[]>(serverExcluded)
  useEffect(() => {
    setLocalExcluded(serverExcluded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverExcludedKey])

  function applyToggle(positionId: string, exclude: boolean) {
    setLocalExcluded(prev => (
      exclude
        ? (prev.includes(positionId) ? prev : [...prev, positionId])
        : prev.filter(id => id !== positionId)
    ))
  }

  const date = new Date(plan.service_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: detail.timeZone })

  return (
    <div className="flex-1 min-w-0 space-y-5">
      {flashError && <FlashMessage message={`Erreur : ${flashError}`} type="error" />}
      {flashSent && <FlashMessage message="Invitation envoyée avec succès." type="success" />}

      {/* Hero */}
      <div className="bg-gradient-to-br from-teal to-teal-dark rounded-2xl px-6 py-5 text-white shadow-lg shadow-teal/20">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-sans text-[10px] uppercase tracking-widest font-semibold text-white/70 capitalize">
              {date} ·{' '}
              <PlanTimeEditor
                planId={planId}
                serviceDate={plan.service_date}
                timeZone={detail.timeZone}
                className="font-sans text-[10px] uppercase tracking-widest font-semibold text-white/70 hover:text-white transition-colors cursor-pointer hover:underline decoration-dotted tabular-nums"
                inputClassName="font-sans text-[10px] border border-white/30 rounded px-1 bg-white/10 text-white focus:outline-none focus:border-white/60"
              />
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="font-display text-2xl font-semibold leading-tight truncate">{plan.title}</h2>
              {isRehearsal && (
                <span className="inline-flex items-center gap-1 font-sans text-[11px] bg-white/15 px-2 py-0.5 rounded-full shrink-0"><IconMusicalNote className="w-3 h-3" /> Répétition</span>
              )}
            </div>
            {detail.pendingCount > 0 && (
              <p className="font-sans text-xs text-white/80 mt-2">{detail.pendingCount} réponse{detail.pendingCount > 1 ? 's' : ''} en attente</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ShareButton planId={planId} />
            <Link href={`/espace/admin/plans/${planId}/setlist`} className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-colors">
              <IconPlay className="w-3.5 h-3.5" /> Live
            </Link>
            <Link href={`/espace/admin/plans/${planId}/setlist?projection=1`} className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-colors">
              <IconProjector className="w-3.5 h-3.5" /> Projection
            </Link>
            {isAdmin && (
              <form action={deletePlan}>
                <input type="hidden" name="plan_id" value={planId} />
                <button type="submit" className="font-sans text-xs text-white/60 hover:text-white transition-colors px-1">Supprimer</button>
              </form>
            )}
          </div>
        </div>

        {/* Équipes + planifier une autre date */}
        <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
          {!isRehearsal && (
            <PlanTeamsManager
              planId={planId}
              teams={detail.availableTeams}
              currentTeamIds={plan.team_ids ?? null}
            />
          )}
          <AddPlanDateForm planId={planId} currentServiceDate={plan.service_date} />
        </div>

        {totalPositions > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-sans text-white/80 mb-1.5">
              <span>Postes pourvus</span>
              <span className="font-semibold">{filledPositions} / {totalPositions}</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: totalPositions }).map((_, i) => (
                <span key={i} className={`flex-1 h-1.5 rounded-full ${i < filledPositions ? 'bg-white' : 'bg-white/25'}`} />
              ))}
            </div>
          </div>
        )}
      </div>

      {plan.notes && (
        <div className="bg-teal/10 rounded-xl px-5 py-3 font-sans text-sm text-dark/70">{plan.notes}</div>
      )}

      {/* Chants */}
      <div className="space-y-2">
        {planSongs.length > 0 && (
          <div className="flex justify-end">
            <CopySetlistButton planId={planId} songCount={planSongs.length} />
          </div>
        )}
        <SongsSection planId={planId} planSongs={planSongs as any} allSongs={allSongs as any} />
      </div>

      {/* Équipes — masquées pour les répétitions */}
      {!isRehearsal && visibleTeams.map(team => {
        const excludedIds = new Set(localExcluded)
        const filledPositionIds = new Set(team.assignments.map(a => a.position_id).filter(Boolean) as string[])
        // "DM" est retiré des créneaux ouverts classiques : il se règle exclusivement via le
        // DmSelector ci-dessous (choix parmi Piano/Basse/Batterie), pour éviter deux façons
        // différentes et potentiellement incohérentes d'assigner ce rôle.
        const openPositions = team.positions.filter(p => !filledPositionIds.has(p.id) && !excludedIds.has(p.id) && p.name !== 'DM')
        const excludedPositions = team.positions.filter(p => excludedIds.has(p.id))
        // Postes déjà pourvus mais qui acceptent plusieurs bénévoles (ex : Chorale, Choriste)
        const multiPositions = team.positions.filter(p => p.allow_multiple && filledPositionIds.has(p.id))
        const noNamedPositions = team.positions.length === 0

        const dmPosition = team.positions.find(p => p.name === 'DM')
        const dmInstruments = team.positions.filter(p => DM_SOURCE_POSITIONS.includes(p.name))
        const showDmSelector = !!dmPosition && dmInstruments.length > 0

        const expanded = expandedTeams[team.id] ?? true

        return (
          <section key={team.id} className="space-y-2.5">
            <button
              type="button"
              onClick={() => toggleTeam(team.id)}
              className="w-full flex items-center justify-between gap-2 px-1 text-left"
            >
              <span className="font-sans text-[10px] uppercase tracking-widest font-semibold text-dark/40">{team.name}</span>
              <span className="flex items-center gap-2 shrink-0">
                {team.assignments.length > 0 && (
                  <span className="font-sans text-xs text-dark/30 tabular-nums">{team.assignments.length}</span>
                )}
                <svg
                  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`w-3 h-3 text-dark/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </span>
            </button>

            {expanded && (
              <>
            {team.assignments.length === 0 && openPositions.length === 0 && !noNamedPositions && excludedPositions.length === 0 && (
              <p className="font-sans text-xs text-dark/40 italic px-1">Aucun bénévole</p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {team.assignments.map(a => (
                <PersonCard key={a.id} planId={planId} a={a} returnTo={returnTo} />
              ))}
              {openPositions.map(pos => (
                <div key={pos.id} className="relative group">
                  <OpenSlotCard
                    label={pos.name}
                    onClick={() => onSlotClick(`pos:${pos.id}`)}
                    active={fillKey === `pos:${pos.id}`}
                  />
                  {isAdmin && (
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExcludePositionButton
                        planId={planId}
                        positionId={pos.id}
                        exclude
                        onToggle={applyToggle}
                        title="Masquer ce poste pour ce service"
                        className="w-5 h-5 rounded-full bg-white shadow-sm border border-dark/10 text-dark/30 hover:text-red-400 hover:border-red-200 flex items-center justify-center text-xs font-bold transition-colors"
                      >×</ExcludePositionButton>
                    </div>
                  )}
                </div>
              ))}
              {multiPositions.map(pos => (
                <OpenSlotCard
                  key={`more:${pos.id}`}
                  label={pos.name}
                  variant="more"
                  onClick={() => onSlotClick(`pos:${pos.id}`)}
                  active={fillKey === `pos:${pos.id}`}
                />
              ))}
              {noNamedPositions && (
                <OpenSlotCard
                  label="Ajouter un bénévole"
                  onClick={() => onSlotClick(`team:${team.id}`)}
                  active={fillKey === `team:${team.id}`}
                />
              )}
            </div>

            {showDmSelector && (
              <DmSelector
                planId={planId}
                teamId={team.id}
                dmPositionId={dmPosition!.id}
                dmAssignment={team.assignments.find(a => a.position_id === dmPosition!.id) ?? null}
                instruments={dmInstruments.map(pos => ({
                  positionId: pos.id,
                  positionName: pos.name,
                  assignment: team.assignments.find(a => a.position_id === pos.id) ?? null,
                }))}
              />
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
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-dark/20 text-dark/30 hover:text-dark/60 hover:border-dark/40 font-sans text-[10px] transition-colors"
                  >
                    + {pos.name}
                  </ExcludePositionButton>
                ))}
              </div>
            )}
              </>
            )}
          </section>
        )
      })}

      {/* Annonces */}
      <section className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
        <div className="px-5 py-3 border-b border-teal/10 bg-teal-50/50">
          <p className="font-sans text-xs text-dark/50 uppercase tracking-widest font-medium">Annonces</p>
        </div>
        <div className="p-4">
          <AnnoncesSection planId={planId} initial={announcements as any} initialRecurring={recurringAnnouncements as any} canManage />
        </div>
      </section>

      {/* Prédication */}
      <section className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
        <div className="px-5 py-3 border-b border-teal/10 bg-teal-50/50">
          <p className="font-sans text-xs text-dark/50 uppercase tracking-widest font-medium">Prédication</p>
        </div>
        <div className="p-4">
          <SermonSection planId={planId} initial={sermons as any} canManage />
        </div>
      </section>

      {/* Vidéos */}
      <section className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
        <div className="px-5 py-3 border-b border-teal/10 bg-teal-50/50">
          <p className="font-sans text-xs text-dark/50 uppercase tracking-widest font-medium">Vidéos</p>
        </div>
        <div className="p-4">
          <VideoSection planId={planId} initial={videos as any} canManage />
        </div>
      </section>

      {/* Sans équipe (ancien format) */}
      {noTeamAssignments.length > 0 && (
        <div className="bg-white rounded-2xl border border-teal/20 overflow-hidden">
          <div className="px-5 py-3 border-b border-teal/10 bg-teal-50/50">
            <p className="font-sans text-xs text-dark/50 uppercase tracking-widest font-medium">Sans équipe</p>
          </div>
          <div className="divide-y divide-teal/10">
            {noTeamAssignments.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <p className="font-sans text-sm text-dark font-medium">{a.members?.first_name} {a.members?.last_name}</p>
                <div className="flex gap-2 items-center">
                  <StatusDot status={a.status} />
                  <RemoveAssignmentButton
                    assignmentId={a.id}
                    planId={planId}
                    className="text-dark/20 hover:text-red-400 font-sans text-lg leading-none disabled:opacity-40"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
