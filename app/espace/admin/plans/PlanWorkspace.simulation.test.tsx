import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { makeCountingArray } from '@/tests/helpers/countingArray'

// Sous-arbre : on ne teste que le cœur "affectation de bénévole" (AssignmentBoard +
// VolunteerPicker + boutons Assigner/Retirer, réellement montés) — les sections annexes
// (chants, annonces, prédication, vidéos, gestion d'équipes…) sont hors périmètre de cette
// simulation de fluidité et sont donc de simples stubs.
vi.mock('./PlanTimeEditor', () => ({ PlanTimeEditor: () => null }))
vi.mock('./[id]/SongsSection', () => ({ SongsSection: () => null }))
vi.mock('./[id]/CopySetlistButton', () => ({ CopySetlistButton: () => null }))
vi.mock('./[id]/AnnoncesSection', () => ({ default: () => null }))
vi.mock('./[id]/SermonSection', () => ({ default: () => null }))
vi.mock('./[id]/VideoSection', () => ({ default: () => null }))
vi.mock('./[id]/ShareButton', () => ({ default: () => null }))
vi.mock('./[id]/AddPlanDateForm', () => ({ AddPlanDateForm: () => null }))
vi.mock('./[id]/PlanTeamsManager', () => ({ PlanTeamsManager: () => null }))

const { addAssignmentAsyncMock, removeAssignmentAsyncMock, stableRouter } = vi.hoisted(() => ({
  addAssignmentAsyncMock: vi.fn(async () => ({ ok: true })),
  removeAssignmentAsyncMock: vi.fn(async () => ({ ok: true })),
  stableRouter: { push: vi.fn(), refresh: vi.fn() },
}))

vi.mock('./actions', () => ({
  deletePlan: vi.fn(),
  sendSingleInvitation: vi.fn(),
  excludePlanPositionAsync: vi.fn(async () => ({ ok: true })),
  addAssignmentAsync: addAssignmentAsyncMock,
  removeAssignmentAsync: removeAssignmentAsyncMock,
}))
vi.mock('next/navigation', () => ({ useRouter: () => stableRouter }))
vi.mock('next/link', () => ({ default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a> }))

const { PlanWorkspace } = await import('./PlanWorkspace')

/** Planning volumineux : 30 équipes × 6 postes (180 postes, ~90 ouverts) — un vrai planning
 *  d'église est bien plus modeste, mais un jeu de données plus large rend mesurable un
 *  recalcul non mémoïsé qui, à petite échelle, passerait inaperçu. */
function buildManyTeams(teamCount: number, positionsPerTeam: number, candidatesPerPosition: number) {
  const teams = []
  let uidSeq = 0
  for (let t = 0; t < teamCount; t++) {
    const positions = []
    const assignments = []
    const candidatesByPosition: Record<string, any[]> = {}
    for (let p = 0; p < positionsPerTeam; p++) {
      const posId = `t${t}-p${p}`
      const label = `T${t}P${p}`
      positions.push({ id: posId, name: label })
      if (p % 2 === 0) {
        // Poste déjà pourvu
        const uid = `user-${uidSeq++}`
        assignments.push({
          id: `a-${posId}`,
          status: 'confirmed',
          member_id: uid,
          position_id: posId,
          team_id: `team-${t}`,
          external_name: null,
          external_email: null,
          invitation_sent_at: null,
          members: { first_name: 'Vol', last_name: String(uidSeq) },
          positions: { id: posId, name: label, team_id: `team-${t}` },
          unavailable: false,
        })
      } else {
        // Poste ouvert, avec quelques candidats
        candidatesByPosition[posId] = Array.from({ length: candidatesPerPosition }, (_, c) => ({
          id: `cand-${posId}-${c}`,
          first_name: 'Cand',
          last_name: `${posId}-${c}`,
          unavailable: false,
          recentCount: 0,
        }))
      }
    }
    teams.push({
      id: `team-${t}`,
      name: `Équipe ${t}`,
      allowsGuests: false,
      isCoordination: false,
      hidePositions: false,
      isPrayerMeeting: false,
      visible: true,
      positions,
      assignments,
      candidateProfiles: [],
      candidatesByPosition,
    })
  }
  return teams
}

function buildDetail(teams: any[]) {
  return {
    plan: {
      id: 'plan-1', title: 'Culte', service_date: '2026-06-01T10:00:00.000Z',
      notes: null, plan_type: 'sunday_service', team_ids: null, excluded_position_ids: null,
    },
    isRehearsal: false,
    teams,
    availableTeams: [],
    noTeamAssignments: [],
    pendingCount: 0,
    planSongs: [],
    allSongs: [],
    announcements: [],
    recurringAnnouncements: [],
    sermons: [],
    videos: [],
  } as any
}

type Commit = { actualDuration: number }
function makeProfilerSpy() {
  const commits: Commit[] = []
  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    commits.push({ actualDuration })
  }
  return { commits, onRender }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Planification — fluidité du flux « affecter / retirer un bénévole »', () => {
  it("n'invoque `teams.filter` qu'une seule fois, même après plusieurs ouvertures de poste et affectations", async () => {
    const rawTeams = buildManyTeams(30, 6, 5)
    const { proxy: teamsProxy, counts } = makeCountingArray(rawTeams)
    const detail = buildDetail(teamsProxy)
    const { commits, onRender } = makeProfilerSpy()

    render(
      <Profiler id="planning" onRender={onRender}>
        <PlanWorkspace planId="plan-1" detail={detail} memberId="viewer-1" isAdmin returnTo="/espace/admin/plans" />
      </Profiler>
    )

    // Le montage initial calcule une fois `visibleTeams`/`totalPositions`/`filledPositions`.
    expect(counts.filter).toBe(1)
    const mountDuration = commits[0].actualDuration

    // Le viewer n'étant membre d'aucune équipe, elles sont toutes repliées par défaut —
    // les déplier avant d'interagir avec leurs postes (aucun de ces replis/dépliages ne
    // doit refaire tourner l'agrégation sur 180 postes non plus).
    for (let t = 0; t < 8; t++) {
      fireEvent.click(screen.getByText(`Équipe ${t}`))
    }
    expect(counts.filter).toBe(1)

    // Ouvre 8 postes différents à la suite (simulateur d'un admin qui parcourt le planning) —
    // aucune de ces ouvertures ne doit refaire tourner l'agrégation sur 180 postes.
    for (let t = 0; t < 8; t++) {
      fireEvent.click(screen.getByText(`T${t}P1`)) // poste ouvert (index impair)
      expect(screen.getByText('Choisir un bénévole')).toBeInTheDocument()
    }
    expect(counts.filter).toBe(1)

    // Affecte un candidat au dernier poste ouvert -> Server Action mockée, puis le panneau se
    // referme (`onAssigned`) et le routeur est rafraîchi.
    const assignButtons = screen.getAllByRole('button', { name: 'Assigner' })
    await act(async () => {
      fireEvent.click(assignButtons[0])
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(addAssignmentAsyncMock).toHaveBeenCalledTimes(1)
    expect(stableRouter.refresh).toHaveBeenCalledTimes(1)
    expect(counts.filter).toBe(1) // toujours pas de recalcul : `teams` n'a pas changé de référence

    // Retire une affectation existante (poste déjà pourvu, index pair) sur une autre équipe.
    const filledPersonCard = screen.getByText('Vol 1').closest('div')!
    const removeButton = within(filledPersonCard.parentElement!).getByLabelText('Retirer')
    await act(async () => {
      fireEvent.click(removeButton)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(removeAssignmentAsyncMock).toHaveBeenCalledTimes(1)
    expect(counts.filter).toBe(1)

    // Fluidité : aucun commit déclenché par ces interactions ne doit coûter plus cher que le
    // rendu initial (qui, lui, construit réellement les 180 postes) — sans quoi une régression
    // aurait réintroduit un recalcul complet à chaque interaction.
    for (const commit of commits.slice(1)) {
      expect(commit.actualDuration).toBeLessThanOrEqual(Math.max(mountDuration * 2, 20))
    }
  })

  it('ouvrir un poste ne recalcule que le panneau latéral, pas tout le tableau des équipes', () => {
    const rawTeams = buildManyTeams(30, 6, 5)
    const { proxy: teamsProxy, counts } = makeCountingArray(rawTeams)
    const detail = buildDetail(teamsProxy)

    render(<PlanWorkspace planId="plan-1" detail={detail} memberId="viewer-1" isAdmin returnTo="/espace/admin/plans" />)

    expect(counts.filter).toBe(1)
    fireEvent.click(screen.getByText('Équipe 5'))
    fireEvent.click(screen.getByText('T5P1'))
    expect(screen.getByText('Choisir un bénévole')).toBeInTheDocument()
    expect(counts.filter).toBe(1)

    fireEvent.click(screen.getByLabelText('Fermer'))
    expect(screen.getByText('Cliquez sur un poste à pourvoir pour affecter un bénévole.')).toBeInTheDocument()
    expect(counts.filter).toBe(1)
  })
})
