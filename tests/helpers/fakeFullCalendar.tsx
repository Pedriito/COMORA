/**
 * Faux `<FullCalendar>` : au lieu de monter la vraie lib (DOM/canvas lourds, non pertinent
 * en jsdom), on capture les props reçues à chaque rendu (pour vérifier leur stabilité
 * référentielle — la preuve que `useMemo`/`useCallback` empêchent bien FullCalendar de
 * re-traiter ses événements) et on expose des boutons de test pour déclencher
 * eventClick/eventDrop/dateClick comme le ferait un vrai clic/drag utilisateur.
 */
export const fullCalendarRenders: any[] = []

export function resetFullCalendarCaptures() {
  fullCalendarRenders.length = 0
}

export function FakeFullCalendar(props: any) {
  fullCalendarRenders.push(props)
  return (
    <div data-testid="fake-fullcalendar">
      {props.events.map((ev: any) => (
        <div key={ev.id} data-testid={`fc-event-${ev.id}`}>
          <button
            type="button"
            data-testid={`fc-event-click-${ev.id}`}
            onClick={() =>
              props.eventClick?.({
                event: { id: ev.id, title: ev.title, start: new Date(ev.start), extendedProps: ev.extendedProps },
                jsEvent: { preventDefault: () => {} },
              })
            }
          >
            click {ev.title}
          </button>
          <button
            type="button"
            data-testid={`fc-event-drop-${ev.id}`}
            onClick={() =>
              props.eventDrop?.({
                event: { id: ev.id, startStr: '2026-07-01T10:00' },
                oldEvent: { startStr: ev.start },
                revert: () => {},
              })
            }
          >
            drag {ev.title}
          </button>
          {props.eventContent?.({
            event: { id: ev.id, title: ev.title, start: new Date(ev.start), extendedProps: ev.extendedProps },
          })}
        </div>
      ))}
      <button
        type="button"
        data-testid="fc-date-click"
        onClick={() => props.dateClick?.({ dateStr: '2026-07-15T00:00:00.000Z' })}
      >
        date
      </button>
    </div>
  )
}
