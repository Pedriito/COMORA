export const TYPE_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  sunday_service: { bg: 'bg-teal/15',    border: 'border-teal/40',    dot: 'bg-teal' },
  prayer_meeting: { bg: 'bg-purple-50',  border: 'border-purple-300', dot: 'bg-purple-400' },
  rehearsal:      { bg: 'bg-orange-50',  border: 'border-orange-300', dot: 'bg-orange-400' },
}

export const TYPE_LABELS: Record<string, string> = {
  sunday_service: 'Culte',
  prayer_meeting: 'Prière',
  rehearsal:      'Répétition',
}

/** Couleurs des "calendars" schedule-x — même palette que TYPE_COLORS, en hexa. */
export const SX_CALENDAR_COLORS: Record<string, { main: string; container: string; onContainer: string }> = {
  sunday_service: { main: 'var(--color-teal)', container: 'var(--color-teal-light)', onContainer: 'var(--color-dark)' },
  prayer_meeting: { main: '#8B6FC4', container: '#EFE6F6', onContainer: '#3D2E63' },
  rehearsal:      { main: '#E08A3C', container: '#FBEEDF', onContainer: '#7A4314' },
}
