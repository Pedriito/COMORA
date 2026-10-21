"use client";

import { useState } from "react";

/** Sections effectivement affichées sur la page : le menu ne propose que celles-là. */
export type NavSections = { horaires: boolean; cultes: boolean; contact: boolean };

export default function Navbar({ churchName, sections }: { churchName: string; sections: NavSections }) {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Accueil", href: "#accueil" },
    sections.horaires && { label: "Horaires", href: "#horaires" },
    sections.cultes && { label: "Cultes", href: "#cultes" },
    sections.contact && { label: "Contact", href: "#contact" },
  ].filter((link): link is { label: string; href: string } => Boolean(link));

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm"
      style={{ background: "linear-gradient(135deg, var(--color-teal-dark) 0%, var(--color-teal) 100%)" }}
    >
      <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
        <a href="#accueil" className="font-display text-2xl font-semibold text-white">
          {churchName}
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-sans text-sm tracking-wide text-white/80 hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
          <a
            href="/espace/dashboard"
            className="font-sans text-xs tracking-wide text-white/50 hover:text-white/80 transition-colors border border-white/20 rounded-full px-3 py-1"
          >
            Espace bénévoles
          </a>
        </nav>

        <button
          className="md:hidden p-2 text-white"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          <span className="block w-5 h-0.5 bg-current mb-1" />
          <span className="block w-5 h-0.5 bg-current mb-1" />
          <span className="block w-5 h-0.5 bg-current" />
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-white/20 px-6 py-4 flex flex-col gap-4 bg-teal-dark">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="font-sans text-sm tracking-wide text-white/80 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
