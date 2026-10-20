import { assignmentStatusLabels } from '@/lib/labels'

const TONES: Record<string, { text: string; dot: string }> = {
  confirmed: { text: 'text-green-600', dot: 'bg-green-500' },
  declined:  { text: 'text-red-500',   dot: 'bg-red-500'   },
  pending:   { text: 'text-amber-500', dot: 'bg-amber-400' },
}

export function StatusDot({ status }: { status: string }) {
  const tone = TONES[status] ?? TONES.pending
  const label = assignmentStatusLabels[status] ?? assignmentStatusLabels.pending

  return (
    <span className={`inline-flex items-center gap-1 ${tone.text} font-sans text-xs font-medium shrink-0`}>
      <span className={`w-2 h-2 rounded-full ${tone.dot} shrink-0`} />
      {label}
    </span>
  )
}
