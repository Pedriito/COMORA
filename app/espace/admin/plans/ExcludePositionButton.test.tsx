import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

// Le correctif du bug « rendu sans commit » repose sur une mise à jour d'état local déclenchée
// par le clic lui-même (`onToggle`), appliquée AVANT l'aller-retour serveur — et sur l'absence
// d'un second rafraîchissement client concurrent. Ces tests verrouillent ces deux points.
const { excludePlanPositionAsyncMock, stableRouter } = vi.hoisted(() => ({
  excludePlanPositionAsyncMock: vi.fn(),
  stableRouter: { push: vi.fn(), refresh: vi.fn() },
}))

vi.mock('./actions', () => ({ excludePlanPositionAsync: excludePlanPositionAsyncMock }))
vi.mock('next/navigation', () => ({ useRouter: () => stableRouter }))

const { ExcludePositionButton } = await import('./ExcludePositionButton')

type ActionResult = { ok: boolean; error?: string }

/** Promesse dont on maîtrise l'instant de résolution : indispensable pour observer l'état du
 *  composant PENDANT l'appel serveur, et non seulement après. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function renderButton(props: Partial<Parameters<typeof ExcludePositionButton>[0]> = {}) {
  const onToggle = vi.fn()
  render(
    <ExcludePositionButton
      planId="plan-1"
      positionId="pos-1"
      exclude
      onToggle={onToggle}
      title="Masquer ce poste pour ce service"
      className="btn-masquer"
      {...props}
    >×</ExcludePositionButton>
  )
  return { onToggle }
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  excludePlanPositionAsyncMock.mockReset()
  excludePlanPositionAsyncMock.mockResolvedValue({ ok: true } satisfies ActionResult)
  stableRouter.refresh.mockClear()
  stableRouter.push.mockClear()
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  consoleErrorSpy.mockRestore()
})

describe('ExcludePositionButton — masquer / réafficher un poste', () => {
  it('appelle la Server Action avec (planId, positionId, exclude)', async () => {
    renderButton()

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(excludePlanPositionAsyncMock).toHaveBeenCalledTimes(1)
    expect(excludePlanPositionAsyncMock).toHaveBeenCalledWith('plan-1', 'pos-1', true)
  })

  it('transmet `exclude: false` lorsqu\'il sert à réafficher un poste', async () => {
    renderButton({ exclude: false, title: 'Réafficher ce poste' })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(excludePlanPositionAsyncMock).toHaveBeenCalledWith('plan-1', 'pos-1', false)
  })

  it('invoque `onToggle` dès le clic, AVANT que la promesse de l\'action ne soit résolue', async () => {
    const pending = deferred<ActionResult>()
    let settled = false
    pending.promise.then(() => { settled = true })
    excludePlanPositionAsyncMock.mockReturnValue(pending.promise)

    const { onToggle } = renderButton()

    // Clic « nu » : on ne laisse volontairement AUCUNE micro-tâche s'écouler.
    fireEvent.click(screen.getByRole('button'))

    expect(settled).toBe(false)                       // l'aller-retour serveur est toujours en vol
    expect(onToggle).toHaveBeenCalledTimes(1)          // …et pourtant le parent est déjà prévenu
    expect(onToggle).toHaveBeenCalledWith('pos-1', true)

    await act(async () => {
      pending.resolve({ ok: true })
      await pending.promise
    })

    // Succès : aucun second appel, donc aucune annulation du changement optimiste.
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('annule le changement optimiste quand l\'action répond `{ ok: false }`', async () => {
    excludePlanPositionAsyncMock.mockResolvedValue({ ok: false, error: 'boom' } satisfies ActionResult)
    const { onToggle } = renderButton()

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(onToggle).toHaveBeenCalledTimes(2)
    expect(onToggle).toHaveBeenNthCalledWith(1, 'pos-1', true)
    expect(onToggle).toHaveBeenNthCalledWith(2, 'pos-1', false)  // valeur inverse = rollback
  })

  it('annule le changement optimiste quand l\'action lève une exception', async () => {
    excludePlanPositionAsyncMock.mockRejectedValue(new Error('réseau indisponible'))
    const { onToggle } = renderButton({ exclude: false })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(onToggle).toHaveBeenCalledTimes(2)
    expect(onToggle).toHaveBeenNthCalledWith(1, 'pos-1', false)
    expect(onToggle).toHaveBeenNthCalledWith(2, 'pos-1', true)
  })

  it('désactive le bouton et affiche « … » pendant l\'attente, puis restaure son contenu', async () => {
    const pending = deferred<ActionResult>()
    excludePlanPositionAsyncMock.mockReturnValue(pending.promise)

    renderButton()
    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()
    expect(button).toHaveTextContent('×')

    fireEvent.click(button)

    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('…')
    expect(button).not.toHaveTextContent('×')

    await act(async () => {
      pending.resolve({ ok: true })
      await pending.promise
    })

    expect(button).not.toBeDisabled()
    expect(button).toHaveTextContent('×')
  })

  it('n\'appelle jamais `router.refresh()` — deux rafraîchissements concurrents rendaient le comportement intermittent', async () => {
    renderButton()

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(excludePlanPositionAsyncMock).toHaveBeenCalledTimes(1)
    expect(stableRouter.refresh).not.toHaveBeenCalled()
    expect(stableRouter.push).not.toHaveBeenCalled()
  })

  it('n\'appelle pas non plus `router.refresh()` quand l\'action échoue', async () => {
    excludePlanPositionAsyncMock.mockResolvedValue({ ok: false, error: 'boom' } satisfies ActionResult)
    renderButton()

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(stableRouter.refresh).not.toHaveBeenCalled()
  })
})
