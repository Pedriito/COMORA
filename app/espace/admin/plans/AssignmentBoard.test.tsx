import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

// Sections annexes hors périmètre : on ne teste ici que le repli des blocs d'équipe et
// l'affichage optimiste des postes masqués.
vi.mock('./PlanTimeEditor', () => ({ PlanTimeEditor: () => null }))
vi.mock('./[id]/SongsSection', () => ({ SongsSection: () => null }))
vi.mock('./[id]/CopySetlistButton', () => ({ CopySetlistButton: () => null }))
vi.mock('./[id]/AnnoncesSection', () => ({ default: () => null }))
vi.mock('./[id]/SermonSection', () => ({ default: () => null }))
vi.mock('./[id]/VideoSection', () => ({ default: () => null }))
vi.mock('./[id]/ShareButton', () => ({ default: () => null }))
vi.mock('./[id]/AddPlanDateForm', () => ({ AddPlanDateForm: () => null }))
vi.mock('./[id]/PlanTeamsManager', () => ({ PlanTeamsManager: () => null }))

const { excludeMock, stableRouter } = vi.hoisted(() => ({
  excludeMock: vi.fn(async () => ({ ok: true })),
  stableRouter: { push: vi.fn(), refresh: vi.fn() },
}))

vi.mock('./actions', () => ({
  deletePlan: vi.fn(),
  sendSingleInvitation: vi.fn(),
  excludePlanPositionAsync: excludeMock,
  addAssignmentAsync: vi.fn(async () => ({ ok: true })),
  removeAssignmentAsync: vi.fn(async () => ({ ok: true })),
  setDmHolder: vi.fn(async () => ({ ok: true })),
}))
vi.mock('next/navigation', () => ({ useRouter: () => stableRouter }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}))

const { AssignmentBoard } = await import('./AssignmentBoard')

const VIEWER = 'viewer-1'

function makeTeam(overrides: any = {}) {
  return {
    id: 'team-1',
    name: 'Louange',
    allowsGuests: false,
    isCoordination: false,
    hidePositions: false,
    isPrayerMeeting: false,
    visible: true,
    isMyTeam: false,
    positions: [{ id: 'pos-1', name: 'Piano' }, { id: 'pos-2', name: 'Basse' }],
    assignments: [],
    candidateProfiles: [],
    candidatesByPosition: {},
    ...overrides,
  }
}

function makeDetail(teams: any[], excludedPositionIds: string[] | null = null) {
  return {
    plan: {
      id: 'plan-1', title: 'Culte', service_date: '2026-06-07T10:00:00.000Z',
      notes: null, plan_type: 'sunday_service', team_ids: null,
      excluded_position_ids: excludedPositionIds,
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

function renderBoard(detail: any, isAdmin = true) {
  return render(
    <AssignmentBoard
      planId="plan-1"
      detail={detail}
      userId={VIEWER}
      fillKey={null}
      isAdmin={isAdmin}
      returnTo="/espace/admin/plans"
      onSlotClick={() => {}}
    />
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AssignmentBoard — repli par défaut des blocs d’équipe', () => {
  it("déplie l'équipe dont le viewer est membre, même sans aucune affectation sur ce service", () => {
    // Cas réel qui avait causé un bug : une équipe encore vide (ex. « Production ») ne se
    // dépliait jamais pour ses propres membres, car le critère portait sur l'affectation.
    renderBoard(makeDetail([makeTeam({ isMyTeam: true, assignments: [] })]))
    expect(screen.getByText('Piano')).toBeInTheDocument()
  })

  it("replie l'équipe dont le viewer n'est ni membre ni affecté", () => {
    renderBoard(makeDetail([makeTeam({ isMyTeam: false, assignments: [] })]))
    expect(screen.queryByText('Piano')).not.toBeInTheDocument()
  })

  it("déplie l'équipe où le viewer est affecté sans en être membre", () => {
    const team = makeTeam({
      isMyTeam: false,
      assignments: [{
        id: 'a-1', status: 'confirmed', user_id: VIEWER, position_id: 'pos-1', team_id: 'team-1',
        external_name: null, external_email: null, invitation_sent_at: null,
        profiles: { first_name: 'Moi', last_name: 'Test' },
        positions: { id: 'pos-1', name: 'Piano', team_id: 'team-1' }, unavailable: false,
      }],
    })
    renderBoard(makeDetail([team]))
    expect(screen.getByText('Basse')).toBeInTheDocument()
  })

  it("laisse replier et déplier une équipe en cliquant sur son en-tête", () => {
    renderBoard(makeDetail([makeTeam({ isMyTeam: true })]))
    expect(screen.getByText('Piano')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Louange'))
    expect(screen.queryByText('Piano')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Louange'))
    expect(screen.getByText('Piano')).toBeInTheDocument()
  })
})

describe('AssignmentBoard — affichage optimiste des postes masqués', () => {
  it('retire le poste de la grille dès le clic sur ×, sans attendre le serveur', async () => {
    // Verrou anti-régression : le rafraîchissement serveur produit un rendu que React
    // abandonne parfois sans le committer. L'affichage ne doit donc dépendre que de
    // l'état local mis à jour par le clic lui-même.
    let resolveAction: (v: { ok: boolean }) => void = () => {}
    excludeMock.mockImplementation(() => new Promise(res => { resolveAction = res as any }))

    renderBoard(makeDetail([makeTeam({ isMyTeam: true })]))
    expect(screen.getByText('Piano')).toBeInTheDocument()

    fireEvent.click(screen.getAllByTitle('Masquer ce poste pour ce service')[0])

    // L'action est toujours en vol : la grille doit DÉJÀ avoir été mise à jour.
    expect(excludeMock).toHaveBeenCalledWith('plan-1', 'pos-1', true)
    expect(screen.queryByText('Piano')).not.toBeInTheDocument()
    expect(screen.getByTitle('Réafficher ce poste')).toBeInTheDocument()

    await act(async () => { resolveAction({ ok: true }) })
  })

  it('réaffiche le poste dès le clic sur le chip, sans attendre le serveur', async () => {
    let resolveAction: (v: { ok: boolean }) => void = () => {}
    excludeMock.mockImplementation(() => new Promise(res => { resolveAction = res as any }))

    renderBoard(makeDetail([makeTeam({ isMyTeam: true })], ['pos-1']))
    expect(screen.queryByText('Piano')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Réafficher ce poste'))

    expect(excludeMock).toHaveBeenCalledWith('plan-1', 'pos-1', false)
    expect(screen.getByText('Piano')).toBeInTheDocument()

    await act(async () => { resolveAction({ ok: true }) })
  })

  it('annule le changement optimiste si l’action échoue', async () => {
    excludeMock.mockResolvedValue({ ok: false, error: 'db down' } as any)

    renderBoard(makeDetail([makeTeam({ isMyTeam: true })]))

    await act(async () => {
      fireEvent.click(screen.getAllByTitle('Masquer ce poste pour ce service')[0])
    })

    // Le poste doit être revenu dans la grille : l'écran ne doit jamais prétendre
    // qu'un changement a été enregistré alors que la base l'a refusé.
    expect(screen.getByText('Piano')).toBeInTheDocument()
  })

  it("n'expose ni le × ni les chips de restauration à un non-administrateur", () => {
    renderBoard(makeDetail([makeTeam({ isMyTeam: true })], ['pos-1']), false)
    expect(screen.queryByTitle('Masquer ce poste pour ce service')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Réafficher ce poste')).not.toBeInTheDocument()
  })
})
