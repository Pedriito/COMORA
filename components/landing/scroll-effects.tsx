"use client";

import { useEffect } from "react";

/**
 * Effets liés au défilement, repris de la maquette :
 * - [data-reveal]       apparition quand l'élément entre à l'écran ;
 * - [data-parallax]     décalage vertical proportionnel à la distance au centre ;
 * - [data-scroll-stage] variable CSS --p (0 → 1) pour les sections collantes ;
 * - [data-hero-copy]    texte d'accueil qui s'efface en descendant.
 * Les mouvements décoratifs sont coupés si l'utilisateur limite les animations.
 */
export function ScrollEffects() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          revealObserver.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => revealObserver.observe(el));

    const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    const stages = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-stage]"));
    const heroCopy = document.querySelector<HTMLElement>("[data-hero-copy]");

    let frame = 0;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const still = reduceMotion.matches;
      // Sur écran étroit, les cartes (coefficients négatifs) recouvriraient le
      // texte voisin : seules les photos, rognées par leur cadre, bougent.
      // Même seuil que les cartes de l'accueil, masquées sous 1100 px.
      const compact = window.innerWidth < 1100;

      // Toutes les mesures d'abord, toutes les écritures ensuite.
      const offsets = layers.map((layer) => {
        const speed = Number(layer.dataset.parallax);
        if (still || (compact && speed < 0)) return 0;
        const box = layer.parentElement?.getBoundingClientRect();
        if (!box || box.bottom < -vh || box.top > 2 * vh) return null;
        return (box.top + box.height / 2 - vh / 2) * speed * (compact ? 0.5 : 1);
      });
      const progress = stages.map((stage) => {
        const box = stage.getBoundingClientRect();
        return Math.min(1, Math.max(0, -box.top / Math.max(1, box.height - vh)));
      });
      // Même équilibre que la maquette, qui mesurait le texte déjà décalé (÷ 1,3).
      const scrolled =
        heroCopy && !still ? Math.max(0, (window.scrollY - heroCopy.offsetTop) / 1.3) : 0;

      layers.forEach((layer, i) => {
        const offset = offsets[i];
        if (offset === null) return;
        layer.style.transform = offset ? `translate3d(0, ${offset.toFixed(1)}px, 0)` : "";
      });
      stages.forEach((stage, i) => stage.style.setProperty("--p", progress[i].toFixed(4)));
      if (heroCopy) {
        heroCopy.style.opacity = scrolled ? Math.max(0, 1 - scrolled / (vh * 0.6)).toFixed(3) : "";
        heroCopy.style.transform = scrolled ? `translate3d(0, ${(scrolled * 0.3).toFixed(1)}px, 0)` : "";
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduceMotion.addEventListener("change", schedule);

    return () => {
      cancelAnimationFrame(frame);
      revealObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduceMotion.removeEventListener("change", schedule);
    };
  }, []);

  return null;
}
