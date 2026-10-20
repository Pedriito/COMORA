// 115 BPM = 60 000 / 115 ≈ 521 ms par temps
const BPM_BEAT = Math.round(60_000 / 115)

export const COUNTDOWN_SECONDS = 5 * 60

export function CountdownDisplay({ seconds, churchName }: { seconds: number; churchName?: string }) {
  const total    = COUNTDOWN_SECONDS
  const mins     = Math.floor(seconds / 60)
  const secs     = seconds % 60
  const timeStr  = `${mins}:${secs.toString().padStart(2, '0')}`
  const progress = seconds / total

  const size   = 260
  const stroke = 10
  const radius = (size - stroke) / 2
  const circ   = 2 * Math.PI * radius
  const dash   = circ * progress

  const ringColor  = seconds < 45  ? '#ef4444'
                   : seconds < 120 ? '#f97316'
                   : '#ffffff'
  const haloStrong = seconds < 45  ? 'rgba(239,68,68,0.55)'
                   : seconds < 120 ? 'rgba(249,115,22,0.55)'
                   : 'rgba(255,255,255,0.45)'
  const haloSoft   = seconds < 45  ? 'rgba(239,68,68,0.18)'
                   : seconds < 120 ? 'rgba(249,115,22,0.18)'
                   : 'rgba(255,255,255,0.12)'

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--color-teal-dark) 80%, black) 0%, var(--color-teal-dark) 45%, var(--color-teal) 100%)' }}
    >
      <style>{`
        @keyframes cdHaloPulse {
          0%, 100% { transform: scale(1);    opacity: 0.55; }
          8%       { transform: scale(1.18); opacity: 1;    }
          25%      { transform: scale(1.08); opacity: 0.65; }
        }
        @keyframes cdFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      <div
        className="flex flex-col items-center"
        style={{ gap: 'clamp(0.9rem, 2vh, 1.8rem)', animation: 'cdFadeIn 0.7s ease-out both' }}
      >

        <p
          className="font-sans uppercase tracking-[0.35em] text-white/60"
          style={{ fontSize: 'clamp(0.6rem, 1.1vw, 0.78rem)' }}
        >
          La célébration commence dans
        </p>

        <div
          className="relative flex items-center justify-center"
          style={{ width: size, height: size, overflow: 'visible' }}
        >
          {/* Halo circulaire */}
          <div
            style={{
              position:      'absolute',
              width:         size,
              height:        size,
              borderRadius:  '50%',
              boxShadow:     `0 0 35px 18px ${haloStrong}, 0 0 80px 40px ${haloSoft}`,
              animation:     `cdHaloPulse ${BPM_BEAT}ms ease-out infinite`,
              pointerEvents: 'none',
            }}
          />

          {/* SVG anneau */}
          <svg
            width={size} height={size}
            className="rotate-[-90deg] absolute inset-0"
            style={{ overflow: 'visible' }}
          >
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke="rgba(255,255,255,0.15)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={ringColor}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.9s linear, stroke 1.5s linear' }}
            />
          </svg>

          <span
            className="font-sans font-light tabular-nums text-white"
            style={{
              fontSize:      'clamp(3rem, 8vw, 5.5rem)',
              letterSpacing: '0.04em',
              textShadow:    '0 0 30px rgba(255,255,255,0.25)',
            }}
          >
            {timeStr}
          </span>
        </div>

        {churchName && (
          <p
            className="font-display text-white font-light tracking-widest text-center"
            style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)' }}
          >
            {churchName}
          </p>
        )}
      </div>
    </div>
  )
}
