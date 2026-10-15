"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";

const LINKS = [
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#application", label: "Application" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "Questions" },
];

export function SiteHeader() {
  // Transparente sur la photo d'accueil, opaque dès qu'on l'a dépassée.
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    const update = () => setSolid(!hero || hero.getBoundingClientRect().bottom < 80);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const close = () => setMenuOpen(false);
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", close);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", close);
    };
  }, [menuOpen]);

  const filled = solid || menuOpen;
  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,color] duration-350",
        filled
          ? "bg-white/92 text-dark shadow-[0_1px_0_#e4e0d4] backdrop-blur-[14px]"
          : "text-sand",
      )}
    >
      <div className="mx-auto flex max-w-[1240px] items-center gap-8 px-5 py-4 sm:px-7">
        <a href="#top" onClick={closeMenu} className="flex">
          <Logo size={34} word="serif" color="currentColor" />
        </a>

        <nav aria-label="Navigation principale" className="hidden gap-7 text-[15px] font-medium lg:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-opacity hover:opacity-70">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-[18px]">
          <Link
            href="/connexion"
            className="hidden text-[15px] font-medium transition-opacity hover:opacity-70 lg:block"
          >
            Se connecter
          </Link>
          <Link
            href="/demande-acces"
            className={buttonClasses({
              variant: "accent",
              size: "md",
              shape: "pill",
              className: "max-sm:hidden",
            })}
          >
            Demander mon accès
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            className="-mr-2 flex size-10 items-center justify-center rounded-full transition-colors hover:bg-current/10 lg:hidden"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      <div
        id="menu-mobile"
        hidden={!menuOpen}
        className="border-t border-line px-5 pt-1 pb-6 sm:px-7 lg:hidden"
      >
        <nav aria-label="Navigation mobile" className="flex flex-col text-[18px] font-medium">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu} className="border-b border-line-soft py-3.5">
              {link.label}
            </a>
          ))}
          <Link href="/connexion" onClick={closeMenu} className="py-3.5">
            Se connecter
          </Link>
        </nav>
        <Link
          href="/demande-acces"
          onClick={closeMenu}
          className={buttonClasses({ variant: "accent", size: "lg", shape: "pill", fullWidth: true, className: "mt-3" })}
        >
          Demander mon accès
        </Link>
      </div>
    </header>
  );
}
