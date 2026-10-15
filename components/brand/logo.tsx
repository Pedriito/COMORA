import { cx } from "@/components/ui/cx";

type LogoProps = {
  /** Taille du symbole en pixels ; le texte suit proportionnellement. */
  size?: number;
  /** Mot-symbole : serif (« Comora »), sans (« COMORA ») ou aucun. */
  word?: "serif" | "sans" | "none";
  tagline?: boolean;
  /** Couleur de l'arche. */
  color?: string;
  /** Couleur de la porte. */
  accent?: string;
  /** Couleur du texte (par défaut celle de l'arche). */
  textColor?: string;
  className?: string;
};

/** Logo Comora : l'arche et sa porte, avec ou sans mot-symbole. */
export function Logo({
  size = 40,
  word = "sans",
  tagline = false,
  color = "#1f362e",
  accent = "#e2693c",
  textColor,
  className,
}: LogoProps) {
  return (
    <span
      className={cx("inline-flex items-center leading-none", className)}
      style={{ gap: Math.round(size * 0.3), color: textColor ?? color }}
    >
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        aria-hidden="true"
        className="block flex-none"
      >
        <path d="M8 43V22a16 16 0 0 1 32 0v21z" fill={color} />
        <path d="M18 43V29a6 6 0 0 1 12 0v14z" fill={accent} />
      </svg>
      {word !== "none" && (
        <span className="flex flex-col" style={{ gap: Math.round(size * 0.14) }}>
          {word === "serif" ? (
            <span
              className="font-display font-semibold tracking-[0.01em]"
              style={{ fontSize: Math.round(size * 0.95) }}
            >
              Comora
            </span>
          ) : (
            <span
              className="font-sans font-bold tracking-[0.16em]"
              style={{ fontSize: Math.round(size * 0.58) }}
            >
              COMORA
            </span>
          )}
          {tagline && (
            <span
              className="font-sans font-medium uppercase tracking-[0.14em] opacity-70"
              style={{ fontSize: Math.max(8, Math.round(size * 0.17)) }}
            >
              Communiquer · Organiser · Rassembler
            </span>
          )}
        </span>
      )}
    </span>
  );
}
