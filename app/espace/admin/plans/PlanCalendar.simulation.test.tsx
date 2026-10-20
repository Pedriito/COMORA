import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { makeCountingArray } from '@/tests/helpers/countingArray'

vi.mock('@fullcalendar/react', async () => {
  const mod = await import('@/tests/helpers/fakeFullCalendar')
  return { default: mod.FakeFullCalendar }
})
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))
vi.mock('@fullcalendar/core/locales/fr', () => ({ default: {} }))
vi.mock('./actions', () => ({ movePlan: vi.fn(async () => ({ ok: true })), copyPlan: vi.fn(async () => ({ ok: true })) }))
vi.mock('./SubscribeCalendarButton', () => ({ SubscribeCalendarButton: () => null }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
  useLinkStatus: () => ({ pending: false }),
}))
// Le vrai `useRouter()` de Next.js renvoie un objet stable entre deux rendus (sinon tout
// `useCallback` qui en dépend serait invalidé à chaque render, ce qui n'est pas le cas en
// production) — on reproduit cette stabilité ici plutôt que de recréer l'objet à chaque appel.
const { stableRouter } = vi.hoisted(() => ({ stableRouter: { push: vi.fn(), refresh: vi.fn() } }))
vi.mock('next/navigation', () => ({ useRouter: () => stableRouter }))

const { fullCalendarRenders, resetFullCalendarCaptures } = await import('@/tests/helpers/fakeFullCalendar')
const { PlanCalendar } = await import('./PlanCalendar')

/** Génère un planning volumineux (2 ans, ~500 services) pour que le coût d'un recalcul
 *  non mémoïsé soit détectable — un vrai planning d'église est bien plus petit, mais un jeu
 *  de données plus large rend le test de non-régression significatif. */
function buildManyPlans(count: number) {
  const plans = []
  const types = ['sunday_service', 'prayer_meeting', 'rehearsal'] as const
  for (let i = 0; i < count; i++) {
    const d = new Date(2025, 0, 1 + i * 1.5)
    plans.push({
      id: `plan-${i}`,
      title: `Service ${i}`,
      service_date: d.toISOString(),
      plan_type: types[i % types.length],
    })
  }
  return plans as any[]
}

type Commit = { phase: string; actualDuration: number }

function makeProfilerSpy() {
  const commits: Commit[] = []
  const onRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
    commits.push({ phase, actualDuration })
  }
  return { commits, onRender }
}

beforeEach(() => {
  resetFullCalendarCaptures()
})

// `cleanup()` après chaque test pour éviter les fuites entre montages successifs de PlanCalendar.
afterEach(() => cleanup())

describe('PlanCalendar — fluidité des interactions', () => {
  it('ne recalcule jamais `events` (mémoïsé) en cliquant sur plusieurs événements de suite', () => {
    const plans = buildManyPlans(500)
    const { commits, onRender } = makeProfilerSpy()

    render(
      <Profiler id="calendar" onRender={onRender}>
        <PlanCalendar plans={plans} icalUrl="https://x/y.ics" canManage countByPlan={{}} />
      </Profiler>
    )

    expect(fullCalendarRenders).toHaveLength(1)
    const eventsAtMount = fullCalendarRenders[0].events

    // Simule un utilisateur qui clique successivement sur 10 services différents
    // (ouverture de la modale de résumé) — l'interaction la plus fréquente sur ce calendrier.
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByTestId(`fc-event-click-plan-${i}`))
    }

    expect(fullCalendarRenders.length).toBeGreaterThan(1) // le calendrier a bien re-rendu à chaque clic
    for (const capturedProps of fullCalendarRenders) {
      expect(capturedProps.events).toBe(eventsAtMount) // toujours la même référence -> `fcEvents` bien mémoïsé
    }

    // Chaque commit d'interaction doit rester une opération bon marché (pas de recalcul en O(n)
    // du tableau d'événements à chaque clic) : aucun commit ne doit dépasser trivialement le premier.
    const mountDuration = commits[0].actualDuration
    const interactionDurations = commits.slice(1).map(c => c.actualDuration)
    for (const d of interactionDurations) {
      expect(d).toBeLessThanOrEqual(Math.max(mountDuration * 2, 20))
    }
  })

  it('garde des callbacks stables (`useCallback`) tant que leurs dépendances ne changent pas', () => {
    const plans = buildManyPlans(500)
    render(<PlanCalendar plans={plans} icalUrl="https://x/y.ics" canManage countByPlan={{}} />)

    const initialEventClick = fullCalendarRenders[0].eventClick
    const initialDateClick = fullCalendarRenders[0].dateClick

    // `onEventDrop` dépend de `currentView` (utilisé pour décider si l'heure est modifiable) —
    // changer de vue en fait légitimement changer la référence, ce n'est pas un défaut de mémoïsation.
    fireEvent.click(screen.getByRole('button', { name: 'Jour' }))
    const eventDropAfterViewChange = fullCalendarRenders.at(-1).eventDrop

    // En revanche, `eventClick`/`dateClick` (dépendances stables : `[]` et `[canManage, router]`)
    // et `eventDrop` lui-même (une fois la vue stabilisée) ne doivent plus bouger sur de simples
    // clics d'événement, qui ne touchent ni `currentView`, ni `canManage`, ni `router`.
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId(`fc-event-click-plan-${i}`))
    }

    const last = fullCalendarRenders.at(-1)
    expect(last.eventClick).toBe(initialEventClick)
    expect(last.dateClick).toBe(initialDateClick)
    expect(last.eventDrop).toBe(eventDropAfterViewChange)
  })

  it("ne recalcule pas la liste latérale (`upcoming`/`thisWeek`/`later`) quand on ouvre un événement", () => {
    const rawPlans = buildManyPlans(500)
    const { proxy, counts } = makeCountingArray(rawPlans)

    render(<PlanCalendar plans={proxy as any} icalUrl="https://x/y.ics" canManage countByPlan={{}} />)

    // Au montage : un seul passage pour `fcEvents` (.map) et un seul pour la liste latérale
    // (spread `[...plans]`, donc l'itérateur, avant filter/sort sur la copie).
    const mapCallsAtMount = counts.map ?? 0
    const iteratorCallsAtMount = counts['Symbol.iterator'] ?? 0
    expect(mapCallsAtMount).toBe(1)
    expect(iteratorCallsAtMount).toBe(1)

    // Ouvrir/fermer la modale de résumé de service à répétition ne doit PAS refaire tourner
    // ces calculs, puisque ni `plans` ni `countByPlan` ne changent.
    for (let i = 0; i < 15; i++) {
      fireEvent.click(screen.getByTestId(`fc-event-click-plan-${i}`))
    }

    expect(counts.map).toBe(mapCallsAtMount)
    expect(counts['Symbol.iterator']).toBe(iteratorCallsAtMount)
  })

  it('simule un glisser-déplacer (déplacement de service) sans provoquer de recalcul superflu', async () => {
    const plans = buildManyPlans(500)
    render(<PlanCalendar plans={plans} icalUrl="https://x/y.ics" canManage countByPlan={{}} />)

    const eventsAtMount = fullCalendarRenders[0].events
    fireEvent.click(screen.getByTestId('fc-event-drop-plan-10'))
    // `onEventDrop` déclenche une Server Action (mockée) puis `router.refresh()` — on laisse
    // la micro-tâche se résoudre.
    await Promise.resolve()
    await Promise.resolve()

    expect(fullCalendarRenders.at(-1).events).toBe(eventsAtMount)
  })
})
