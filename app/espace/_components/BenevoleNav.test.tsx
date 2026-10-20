import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => '/espace/dashboard') }))

vi.mock('next/navigation', () => ({ usePathname: () => pathnameMock() }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock('next/image', () => ({ default: ({ alt }: any) => <img alt={alt} /> }))
vi.mock('../login/actions', () => ({ logout: vi.fn() }))

const { BenevoleNav } = await import('./BenevoleNav')

/** La pastille de surbrillance est le seul `div[aria-hidden]` de la barre mobile. */
function pillStyle(container: HTMLElement) {
  const pill = container.querySelector('div[aria-hidden="true"]') as HTMLElement | null
  if (!pill) throw new Error('pastille introuvable')
  return pill.style
}

function renderNav(pathname: string, permission = 'admin') {
  pathnameMock.mockReturnValue(pathname)
  return render(<BenevoleNav permission={permission} firstName="Pierre" lastName="Romer" />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BenevoleNav — pastille de surbrillance (mobile)', () => {
  // Les onglets sont des `flex-1` sans espacement dans leur conteneur : chacun occupe
  // exactement 100% / n. Toute compensation de rembourrage ici décalerait la pastille,
  // d'autant plus visiblement que `translateX` se calcule sur sa propre largeur.
  it("fait exactement la largeur d'un onglet, sans décalage horizontal", () => {
    const { container } = renderNav('/espace/dashboard')
    const style = pillStyle(container)

    // jsdom normalise `calc(100% / 5)` en `calc(20%)` : c'est bien une largeur d'onglet
    // pour 5 onglets, et non une valeur amputée d'une compensation de rembourrage.
    expect(style.width).toBe('calc(20%)')
    expect(style.left).toBe('0px')
    // Idem verticalement : la respiration vient du rembourrage de la barre, pas d'un
    // inset sur la pastille, sinon elle est rabotée deux fois et paraît trop basse.
    expect(style.top).toBe('0px')
    expect(style.bottom).toBe('0px')
  })

  it('se positionne sur le premier onglet quand on est sur l’accueil', () => {
    const { container } = renderNav('/espace/dashboard')
    const style = pillStyle(container)

    expect(style.transform).toBe('translateX(calc(0 * 100%))')
    expect(style.opacity).toBe('1')
  })

  it('se déplace d’un onglet entier vers la droite sur la page de planification', () => {
    const { container } = renderNav('/espace/admin/plans')
    const style = pillStyle(container)

    expect(style.transform).toBe('translateX(calc(1 * 100%))')
    expect(style.opacity).toBe('1')
  })

  it('se déplace sur le dernier onglet pour le profil', () => {
    const { container } = renderNav('/espace/profil')
    expect(pillStyle(container).transform).toBe('translateX(calc(4 * 100%))')
  })

  // Les pages admin accessibles uniquement via le bouton « Admin » ne correspondent à aucun
  // onglet : la pastille doit disparaître plutôt que de se rabattre à tort sur « Accueil ».
  it('disparaît sur une page admin qui ne correspond à aucun onglet', () => {
    const { container } = renderNav('/espace/admin/equipes')
    expect(pillStyle(container).opacity).toBe('0')
  })

  it('reste calée sur le nombre réel d’onglets pour un bénévole sans droits admin', () => {
    const { container } = renderNav('/espace/dashboard', 'member')
    expect(pillStyle(container).width).toBe('calc(20%)')
  })
})

describe('BenevoleNav — onglets selon les droits', () => {
  it('expose l’onglet « Planification » et le bouton Admin à un administrateur', () => {
    renderNav('/espace/dashboard', 'admin')
    expect(screen.getAllByText('Planification').length).toBeGreaterThan(0)
    expect(screen.getByLabelText("Menu d'administration")).toBeInTheDocument()
  })

  it('n’expose pas le bouton Admin à un bénévole sans droits', () => {
    renderNav('/espace/dashboard', 'member')
    expect(screen.queryByLabelText("Menu d'administration")).not.toBeInTheDocument()
  })
})
