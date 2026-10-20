import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react'
import type { Position } from '../getPlanDetail'

// Server Actions mockées : aucun aller-retour serveur n'aboutit pendant ces tests. Tout ce qui
// bouge à l'écran vient donc de l'état local piloté par le clic — c'est exactement le correctif
// du bug « React abandonne le rendu issu du rafraîchissement sans jamais le committer ».
const { excludePlanPositionAsyncMock, addAssignmentMock, stableRouter } = vi.hoisted(() => ({
  excludePlanPositionAsyncMock: vi.fn(),
  addAssignmentMock: vi.fn(),
  stableRouter: { push: vi.fn(), refresh: vi.fn() },
}))

vi.mock('../actions', () => ({
  excludePlanPositionAsync: excludePlanPositionAsyncMock,
  addAssignment: addAssignmentMock,
}))
vi.mock('next/navigation', () => ({ useRouter: () => stableRouter }))

const { MobileTeamPositions } = await import('./MobileTeamPositions')

type ActionResult = { ok: boolean; error?: string }

/** Promesse résolue à la main : permet d'observer l'écran PENDANT que l'action est encore en vol. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

const POSITIONS: Position[] = [
  { id: 'p-piano', name: 'Piano' },
  { id: 'p-basse', name: 'Basse' },
  { id: 'p-batterie', name: 'Batterie' },
  { id: 'p-dm', name: 'DM' },
]

const MASQUER = 'Masquer ce poste pour ce service'

function renderPositions(overrides: Record<string, unknown> = {}) {
  return render(
    <MobileTeamPositions
      planId="plan-1"
      teamId="team-1"
      positions={POSITIONS}
      filledPositionIds={[]}
      initialExcludedIds={[]}
      candidatesByPosition={{}}
      candidateProfiles={[]}
      assignmentsCount={1}
      allowsGuests={false}
      hidePositions={false}
      canManage
      isAdmin
      {...(overrides as any)}
    />
  )
}

/** Le bouton « × » rattaché au créneau d'un poste donné (une rangée = créneau + bouton masquer). */
function hideButtonFor(positionName: string) {
  const slot = screen.getByRole('button', { name: positionName })
  const row = slot.closest('div')!.parentElement!
  return within(row).getByTitle(MASQUER)
}

beforeEach(() => {
  excludePlanPositionAsyncMock.mockReset()
  excludePlanPositionAsyncMock.mockResolvedValue({ ok: true } satisfies ActionResult)
  stableRouter.refresh.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('MobileTeamPositions — postes à pourvoir et postes masqués', () => {
  it('affiche les postes libres en créneaux, et les postes de `initialExcludedIds` en chips « + Nom »', () => {
    renderPositions({ initialExcludedIds: ['p-basse'] })

    expect(screen.getByRole('button', { name: 'Piano' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Batterie' })).toBeInTheDocument()

    // Basse est masquée : pas de créneau, mais un chip de restauration.
    expect(screen.queryByRole('button', { name: 'Basse' })).not.toBeInTheDocument()
    const chip = screen.getByRole('button', { name: '+ Basse' })
    expect(chip).toHaveAttribute('title', 'Réafficher ce poste')
  })

  it('réafficher un poste depuis son chip le fait apparaître en créneau sans aucun rafraîchissement serveur', async () => {
    const pending = deferred<ActionResult>()
    excludePlanPositionAsyncMock.mockReturnValue(pending.promise)

    renderPositions({ initialExcludedIds: ['p-basse'] })

    fireEvent.click(screen.getByRole('button', { name: '+ Basse' }))

    // L'action est toujours en vol : c'est bien l'état local qui vient de repeindre l'écran.
    expect(screen.getByRole('button', { name: 'Basse' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Basse' })).not.toBeInTheDocument()
    expect(stableRouter.refresh).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve({ ok: true })
      await pending.promise
    })

    expect(excludePlanPositionAsyncMock).toHaveBeenCalledWith('plan-1', 'p-basse', false)
    expect(screen.getByRole('button', { name: 'Basse' })).toBeInTheDocument()
    expect(stableRouter.refresh).not.toHaveBeenCalled()
  })

  it('masquer un poste via son « × » le déplace vers les chips, sans rafraîchissement non plus', async () => {
    const pending = deferred<ActionResult>()
    excludePlanPositionAsyncMock.mockReturnValue(pending.promise)

    renderPositions()

    fireEvent.click(hideButtonFor('Piano'))

    expect(screen.queryByRole('button', { name: 'Piano' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Piano' })).toBeInTheDocument()
    expect(stableRouter.refresh).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve({ ok: true })
      await pending.promise
    })

    expect(excludePlanPositionAsyncMock).toHaveBeenCalledWith('plan-1', 'p-piano', true)
    expect(screen.getByRole('button', { name: '+ Piano' })).toBeInTheDocument()
    expect(stableRouter.refresh).not.toHaveBeenCalled()
  })

  it('n\'affiche jamais le poste « DM » parmi les créneaux à pourvoir (il se règle via son sélecteur dédié)', () => {
    renderPositions()

    expect(screen.queryByRole('button', { name: 'DM' })).not.toBeInTheDocument()
    expect(screen.queryByText('DM')).not.toBeInTheDocument()
    // …et il n'apparaît pas non plus en chip masquable.
    expect(screen.queryByRole('button', { name: '+ DM' })).not.toBeInTheDocument()
  })

  it('n\'affiche pas en créneau à pourvoir les postes déjà pourvus', () => {
    renderPositions({ filledPositionIds: ['p-batterie'] })

    expect(screen.queryByRole('button', { name: 'Batterie' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Piano' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Basse' })).toBeInTheDocument()
  })

  it('ne rend ni les boutons « × » ni les chips de restauration pour un non-administrateur', () => {
    renderPositions({ isAdmin: false, initialExcludedIds: ['p-basse'] })

    expect(screen.queryAllByTitle(MASQUER)).toHaveLength(0)
    expect(screen.queryByTitle('Réafficher ce poste')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Basse' })).not.toBeInTheDocument()
    // Le poste masqué reste masqué, il n'est simplement plus restaurable.
    expect(screen.queryByRole('button', { name: 'Basse' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Piano' })).toBeInTheDocument()
  })

  it('rend un bouton « × » par créneau à pourvoir pour un administrateur', () => {
    renderPositions()

    // Piano, Basse, Batterie — DM exclu.
    expect(screen.queryAllByTitle(MASQUER)).toHaveLength(3)
  })
})
