/** Séparateur décoratif : une vague discrète dans la couleur donnée. */
export default function WaveDivider({ color = "currentColor", className = "" }: { color?: string; className?: string }) {
  return (
    <div className={`w-full flex justify-center ${className}`} aria-hidden>
      <svg viewBox="0 0 120 12" width="120" height="12" fill="none" style={{ color }}>
        <path
          d="M2 6c9.5-6 19-6 28.5 0s19 6 28.5 0 19-6 28.5 0 19 6 28.5 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
