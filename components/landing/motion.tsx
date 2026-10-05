import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/**
 * Couche en parallaxe : `speed` reprend les coefficients de la maquette
 * (décalage = distance au centre de l'écran × speed). Le calcul est fait
 * par <ScrollEffects />, par rapport à l'élément parent.
 */
export function Parallax({
  speed,
  className,
  ...rest
}: { speed: number } & ComponentPropsWithoutRef<"div">) {
  return <div data-parallax={speed} className={cx("will-change-transform", className)} {...rest} />;
}

/**
 * Carte qui flotte doucement (animation CSS) : amplitude en pixels et phase
 * en radians, comme dans la maquette (y = sin(0,9 t + phase) × amplitude).
 */
export function FloatCard({
  amplitude,
  phase,
  className,
  children,
}: {
  amplitude: number;
  phase: number;
  className?: string;
  children: ReactNode;
}) {
  // L'animation part du point bas de la sinusoïde : on la décale d'un quart de période.
  const offset = phase + Math.PI / 2;
  const style = {
    "--float-a": `${amplitude}px`,
    animationDelay: `${(-offset / 0.9).toFixed(2)}s, ${(-offset / 0.6).toFixed(2)}s`,
  } as CSSProperties;

  return (
    <div className={cx("animate-float", className)} style={style}>
      {children}
    </div>
  );
}
