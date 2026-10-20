import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Button, buttonClasses } from './Button'

afterEach(cleanup)

describe('buttonClasses — variantes', () => {
  it('rend le teal de marque pour la variante principale', () => {
    const c = buttonClasses({ variant: 'primary' })
    expect(c).toContain('bg-teal')
    expect(c).toContain('hover:bg-teal-dark')
  })

  it('rend le coral pour la variante accent', () => {
    expect(buttonClasses({ variant: 'accent' })).toContain('bg-coral')
  })

  it("n'applique ni boîte ni forme à la variante texte nu", () => {
    // 123 liens de ce type existaient dans l'application : leur donner un rayon
    // ou un fond les décalerait du texte qui les entoure.
    const c = buttonClasses({ variant: 'link' })
    expect(c).not.toContain('rounded')
    expect(c).not.toContain('bg-')
    expect(c).toContain('text-teal')
  })

  it('applique la forme pilule quand elle est demandée', () => {
    expect(buttonClasses({ shape: 'pill' })).toContain('rounded-full')
    expect(buttonClasses({ shape: 'rounded' })).toContain('rounded-lg')
  })

  it('occupe toute la largeur sur demande seulement', () => {
    expect(buttonClasses({ fullWidth: true })).toContain('w-full')
    expect(buttonClasses()).not.toContain('w-full')
  })
})

describe('buttonClasses — règles non négociables', () => {
  // L'application comptait 6 valeurs de `disabled:opacity` sans corrélation
  // avec le type de bouton. Une seule, partout.
  it('applique une opacité désactivée unique quelle que soit la variante', () => {
    for (const variant of ['primary', 'accent', 'dark', 'outline', 'ghost', 'link'] as const) {
      expect(buttonClasses({ variant })).toContain('disabled:opacity-40')
    }
  })

  // 17 éléments de l'application supprimaient l'anneau de focus sans rien remettre,
  // cassant la navigation au clavier. Un composant partagé ne doit jamais rouvrir
  // cette porte : `focus-visible` n'affiche l'anneau qu'au clavier, pas au clic.
  it('conserve toujours un indicateur de focus clavier', () => {
    for (const variant of ['primary', 'accent', 'dark', 'outline', 'ghost', 'link'] as const) {
      const c = buttonClasses({ variant })
      expect(c).toContain('focus-visible:ring-2')
      expect(c).not.toMatch(/(^|\s)focus:outline-none(\s|$)/)
    }
  })
})

describe('Button', () => {
  it('rend un bouton de type « button » par défaut, pour ne pas soumettre un formulaire par accident', () => {
    render(<Button>Enregistrer</Button>)
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toHaveAttribute('type', 'button')
  })

  it('laisse passer le type « submit » quand il est demandé', () => {
    render(<Button type="submit">Valider</Button>)
    expect(screen.getByRole('button', { name: 'Valider' })).toHaveAttribute('type', 'submit')
  })

  it('transmet les attributs natifs, dont l’état désactivé', () => {
    render(<Button disabled aria-describedby="aide">Envoyer</Button>)
    const btn = screen.getByRole('button', { name: 'Envoyer' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-describedby', 'aide')
  })
})
