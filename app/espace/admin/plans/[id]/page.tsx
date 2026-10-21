import { requireChurch, grants } from '@/lib/auth/church'
import { churchTimeZone } from '../notifyTeamLeaders'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { deletePlan, sendSingleInvitation } from '../actions'
import { IconEnvelope, IconMusicalNote, IconPlay, IconProjector, IconWarning } from '@/app/espace/_components/Icons'
import { StatusDot } from '../../../_components/StatusDot'
import { FlashMessage } from '../../../_components/FlashMessage'
import { AddAssignmentForm } from './AddAssignmentForm'
import { AddSongForm } from './AddSongForm'
import AnnoncesSection from './AnnoncesSection'
import SermonSection from './SermonSection'
import VideoSection from './VideoSection'
import ShareButton from './ShareButton'
import { getPlanDetail } from '../getPlanDetail'
import { PlanWorkspace } from '../PlanWorkspace'
import { MyAssignmentPanel } from '../RespondAssignmentButtons'
import { RemoveAssignmentButton } from '../RemoveAssignmentButton'
import { MobileSongsList } from './MobileSongsList'
import { AddPlanDateForm } from './AddPlanDateForm'
import { PlanTeamsManager } from './PlanTeamsManager'
import { DmSelector } from '../DmSelector'
import { MobileTeamBlock } from './MobileTeamBlock'
import { MobileTeamPositions } from './MobileTeamPositions'
import { Badge, SectionHeader } from '@comora/ui'

/** Postes instrumentaux éligibles au rôle DM (cf. DmSelector). */
const DM_SOURCE_POSITIONS = ['Piano', 'Basse', 'Batterie']

const PLAN_TYPE_LABELS: Record<string, string> = {
  sunday_service: 'Culte',
  prayer_meeting: 'Prière',
  rehearsal:      'Répétition',
  other:          'Événement',
}

export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; sent?: string; fill?: string }>
}) {
  const { id } = await params
  const { error: flashError, sent: flashSent, fill: fillParam } = await searchParams
  const fillKey = fillParam ?? null
  const ctx = await requireChurch('membre')
  const { supabase } = ctx
  const memberId = ctx.memberId

  const isAdmin   = ctx.church.role === 'admin'
  const canManage = grants(ctx.church, 'responsable')

  const timeZone = await churchTimeZone(supabase, ctx.church.churchId)
  const detail = await getPlanDetail(supabase, id, {
    churchId: ctx.church.churchId,
    memberId,
    canManage,
    timeZone,
  })
  if (!detail) redirect('/espace/admin/plans')

  const {
    plan, isRehearsal, teams, noTeamAssignments,
    planSongs, allSongs, announcements, recurringAnnouncements, sermons, videos,
    availableTeams,
  } = detail

  const allAssignments = [...teams.flatMap(t => t.assignments), ...noTeamAssignments]
  const myAssignment = allAssignments.find(a => memberId !== null && a.member_id === memberId) ?? null

  const dateObj  = new Date(plan.service_date)
  const dateLong = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone })
  const dateMed  = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone })
  const time     = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone })
  const typeLabel = PLAN_TYPE_LABELS[plan.plan_type ?? ''] ?? 'Événement'

  const visibleTeams = teams.filter(t => t.visible)

  return (
    <div className="min-h-screen bg-teal-50">

      {/* ════════════════════════════════════════════════════
          MOBILE  (< lg)
      ════════════════════════════════════════════════════ */}
      <div className="lg:hidden">

        {/* Barre supérieure */}
        <div
          className="px-4 pb-3 flex items-center justify-between"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 12px, 52px)' }}
        >
          <Link
            href="/espace/historique"
            className="w-9 h-9 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-dark/60 hover:text-dark transition-colors shrink-0"
          >
            <span className="font-sans text-xl leading-none -translate-x-px">‹</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/espace/admin/plans/${id}/setlist`}
              className="inline-flex items-center gap-1.5 bg-teal text-white px-3 py-2 rounded-full font-sans text-xs font-semibold"
            >
              <IconPlay className="w-3 h-3" /> Live
            </Link>
            {(canManage) && (
              <Link
                href={`/espace/admin/plans/${id}/setlist?projection=1`}
                className="inline-flex items-center gap-1.5 bg-dark text-white px-3 py-2 rounded-full font-sans text-xs font-semibold"
              >
                <IconProjector className="w-3 h-3" /> Proj.
              </Link>
            )}
            {canManage && <ShareButton planId={id} />}
          </div>
        </div>

        {/* Hero card */}
        <div className="mx-4 mb-4">
          <div
            className="rounded-3xl overflow-hidden text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-teal-dark))' }}
          >
            <div className="p-5">
              <p className="font-sans text-[10px] uppercase tracking-widest text-white/55 font-semibold mb-1">
                {typeLabel}
              </p>
              <h1 className="font-display text-[2rem] font-light leading-tight">{plan.title}</h1>
              <p className="font-sans text-sm text-white/65 capitalize mt-1 flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0 opacity-70" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="12" height="11" rx="2" />
                  <path d="M5 1v4M11 1v4M2 7h12" />
                </svg>
                {dateMed} · {time}
              </p>

              {/* Mon affectation */}
              {myAssignment && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <MyAssignmentPanel
                    assignmentId={myAssignment.id}
                    planId={id}
                    positionName={myAssignment.positions?.name ?? null}
                    initialStatus={myAssignment.status as 'pending' | 'confirmed' | 'declined'}
                  />
                </div>
              )}

              {/* Équipes + planifier une autre date */}
              {canManage && (
                <div className="mt-3 pt-3 border-t border-white/15 space-y-2">
                  {!isRehearsal && (
                    <PlanTeamsManager
                      planId={id}
                      teams={availableTeams}
                      currentTeamIds={plan.team_ids ?? null}
                    />
                  )}
                  <AddPlanDateForm planId={id} currentServiceDate={plan.service_date} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="px-4 pb-28 space-y-3">

          {flashError && <FlashMessage message={`Erreur : ${flashError}`} type="error" />}
          {flashSent  && <FlashMessage message="Invitation envoyée." type="success" />}

          {plan.notes && (
            <div className="bg-teal/10 rounded-2xl px-4 py-3 font-sans text-sm text-dark/70">
              {plan.notes}
            </div>
          )}

          {/* Chants */}
          {((planSongs as unknown[]).length > 0 || true) && (
            <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="px-4 py-3 border-b border-teal/10 flex items-center justify-between bg-teal-50/50">
                <p className="font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold">
                  <IconMusicalNote className="w-3 h-3 inline-block mr-1 text-dark/30" />
                  Chants
                </p>
                {(planSongs as unknown[]).length > 0 && (
                  <Link href={`/espace/admin/plans/${id}/setlist`} className="font-sans text-xs text-teal">
                    Setlist →
                  </Link>
                )}
              </div>
              <MobileSongsList planId={id} planSongs={planSongs as any} />
              <div className="border-t border-teal/10 px-4 py-3 bg-teal-50/20">
                <AddSongForm planId={id} songs={allSongs as any} />
              </div>
            </div>
          )}

          {/* Équipes */}
          {!isRehearsal && visibleTeams.length > 0 && (
            <>
              <p className="font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold px-1 pt-1">
                Équipe du culte
              </p>
              {visibleTeams.map(team => {
                const excludedIds = new Set(plan.excluded_position_ids ?? [])
                const filledPositionIds = new Set(team.assignments.map(a => a.position_id).filter(Boolean) as string[])
                // "DM" se règle exclusivement via le DmSelector (choix parmi Piano/Basse/Batterie).
                const openPositions = team.positions.filter(p => !filledPositionIds.has(p.id) && !excludedIds.has(p.id) && p.name !== 'DM')
                const noNamedPos = team.positions.length === 0
                // Badge d'en-tête seulement : le détail des postes est géré par MobileTeamPositions.
                const hasOpenSlots = openPositions.length > 0 || (noNamedPos && team.assignments.length === 0)
                const dmPosition = team.positions.find(p => p.name === 'DM')
                const dmInstruments = team.positions.filter(p => DM_SOURCE_POSITIONS.includes(p.name))
                const showDmSelector = !!dmPosition && dmInstruments.length > 0

                const isMember = team.isMyTeam || team.assignments.some(a => memberId !== null && a.member_id === memberId)

                return (
                  <MobileTeamBlock
                    key={team.id}
                    defaultExpanded={isMember}
                    header={
                      <>
                        <SectionHeader>{team.name}</SectionHeader>
                        {hasOpenSlots ? (
                          <Badge tone="orange">À pourvoir</Badge>
                        ) : team.assignments.length > 0 ? (
                          <span className="font-sans text-xs text-dark/25 tabular-nums">{team.assignments.length}</span>
                        ) : null}
                      </>
                    }
                  >
                      {team.assignments.map(a => {
                        const isMe     = memberId !== null && a.member_id === memberId
                        const isInvite = a.member_id === null
                        const name = isInvite
                          ? (a.external_name ?? 'Invité')
                          : `${a.members?.first_name ?? ''} ${a.members?.last_name ?? ''}`
                        const canSendInvite = isInvite ? !!a.external_email : a.status === 'pending'
                        return (
                          <div key={a.id} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 ${isMe ? 'bg-teal/10' : 'bg-teal/5'}`}>
                            <StatusDot status={a.status} />
                            <div className="flex-1 min-w-0">
                              <p className={`font-sans text-sm truncate ${isMe ? 'font-semibold text-teal-dark' : 'text-dark'}`}>
                                {name}{isMe ? ' · moi' : ''}
                              </p>
                              {a.positions && !team.hidePositions && (
                                <p className="font-sans text-xs text-dark/40 mt-0.5">{a.positions.name}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!isInvite && a.unavailable && (
                                <span className="text-red-400" title="Indisponible"><IconWarning className="w-3.5 h-3.5" /></span>
                              )}
                              {canManage && canSendInvite && (
                                <form action={sendSingleInvitation}>
                                  <input type="hidden" name="assignment_id" value={a.id} />
                                  <input type="hidden" name="plan_id" value={id} />
                                  <button type="submit" title="Envoyer l'invitation" className="p-1.5 text-dark/30 hover:text-teal transition-colors">
                                    <IconEnvelope className="w-4 h-4" />
                                  </button>
                                </form>
                              )}
                              {canManage && (
                                <RemoveAssignmentButton
                                  assignmentId={a.id}
                                  planId={id}
                                  className="p-1.5 text-dark/20 hover:text-red-400 transition-colors font-sans text-xl leading-none disabled:opacity-40"
                                />
                              )}
                            </div>
                          </div>
                        )
                      })}

                      <MobileTeamPositions
                        planId={id}
                        teamId={team.id}
                        positions={team.positions}
                        filledPositionIds={[...filledPositionIds]}
                        initialExcludedIds={plan.excluded_position_ids ?? []}
                        candidatesByPosition={team.candidatesByPosition}
                        candidateProfiles={team.candidateProfiles}
                        assignmentsCount={team.assignments.length}
                        allowsGuests={team.allowsGuests}
                        hidePositions={team.hidePositions}
                        canManage={canManage}
                        isAdmin={isAdmin}
                      />

                      {showDmSelector && (
                        <DmSelector
                          planId={id}
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

                      {canManage && (
                        <AddAssignmentForm
                          planId={id}
                          teamId={team.id}
                          // "DM" exclu : se règle exclusivement via le DmSelector ci-dessus.
                          teamPositions={team.positions.filter(p => p.name !== 'DM')}
                          teamProfiles={team.candidateProfiles}
                          candidatesByPosition={team.candidatesByPosition}
                          isInviteTeam={team.allowsGuests}
                          hidePositions={team.hidePositions}
                        />
                      )}
                  </MobileTeamBlock>
                )
              })}
            </>
          )}

          {/* Annonces */}
          <section className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-4 py-3 border-b border-teal/10 bg-teal-50/50">
              <p className="font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold">Annonces</p>
            </div>
            <div className="p-4">
              <AnnoncesSection planId={id} initial={announcements as any} initialRecurring={recurringAnnouncements as any} canManage={canManage} />
            </div>
          </section>

          {/* Prédication */}
          <section className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-4 py-3 border-b border-teal/10 bg-teal-50/50">
              <p className="font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold">Prédication</p>
            </div>
            <div className="p-4">
              <SermonSection planId={id} initial={sermons as any} canManage={canManage} />
            </div>
          </section>

          {/* Vidéos */}
          <section className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-4 py-3 border-b border-teal/10 bg-teal-50/50">
              <p className="font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold">Vidéos</p>
            </div>
            <div className="p-4">
              <VideoSection planId={id} initial={videos as any} canManage={canManage} />
            </div>
          </section>

          {/* Affectations sans équipe */}
          {noTeamAssignments.length > 0 && (
            <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="px-4 py-3 border-b border-teal/10 bg-teal-50/50">
                <p className="font-sans text-[10px] uppercase tracking-widest text-dark/40 font-semibold">Sans équipe</p>
              </div>
              <div className="divide-y divide-teal/8">
                {noTeamAssignments.map(a => (
                  <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                    <StatusDot status={a.status} />
                    <p className="font-sans text-sm text-dark font-medium flex-1 min-w-0 truncate">
                      {a.members?.first_name} {a.members?.last_name}
                    </p>
                    {canManage && (
                      <RemoveAssignmentButton
                        assignmentId={a.id}
                        planId={id}
                        className="p-1.5 text-dark/20 hover:text-red-400 transition-colors font-sans text-xl leading-none disabled:opacity-40"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supprimer (admin only) */}
          {isAdmin && (
            <div className="pt-2 flex justify-center">
              <form action={deletePlan}>
                <input type="hidden" name="plan_id" value={id} />
                <button type="submit" className="font-sans text-xs text-dark/25 hover:text-red-400 transition-colors px-4 py-2">
                  Supprimer ce service
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          DESKTOP  (lg+)
      ════════════════════════════════════════════════════ */}
      <div className="hidden lg:block bg-sand min-h-screen">
        {canManage ? (
          <div className="flex gap-5 items-start max-w-5xl mx-auto px-6 py-6">
            <PlanWorkspace
              planId={id}
              detail={detail}
              memberId={memberId}
              isAdmin={isAdmin}
              flashError={flashError ?? undefined}
              flashSent={flashSent ?? undefined}
              returnTo={`/espace/admin/plans/${id}`}
              initialFillKey={fillKey}
            />
          </div>
        ) : (
          <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/espace/admin/plans" className="text-dark/40 hover:text-dark transition-colors font-sans text-sm">←</Link>
              <div>
                <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium capitalize">{dateLong} · {time}</p>
                <h1 className="font-display text-2xl text-dark font-light">{plan.title}</h1>
              </div>
            </div>
            {plan.notes && (
              <div className="bg-teal/10 rounded-xl px-5 py-3 font-sans text-sm text-dark/70">{plan.notes}</div>
            )}
            {myAssignment && (
              <div className="bg-white rounded-2xl border border-teal/20 px-5 py-4">
                <p className="font-sans text-xs text-dark/40 uppercase tracking-widest font-medium mb-1">Mon rôle</p>
                <p className="font-sans text-sm font-medium text-dark">{myAssignment.positions?.name ?? 'Bénévole'}</p>
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  )
}
