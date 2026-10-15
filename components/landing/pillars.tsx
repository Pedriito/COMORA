import Image from "next/image";
import type { ReactNode } from "react";
import communiquerImage from "@/assets/images/communiquer.jpg";
import organiserImage from "@/assets/images/organiser.jpg";
import repasPoster from "@/assets/images/repas-partage-poster.jpg";
import { Badge } from "@/components/ui/badge";
import { cx } from "@/components/ui/cx";
import { AmbientVideo } from "./ambient-video";
import { Eyebrow } from "./eyebrow";
import { FloatCard, Parallax } from "./motion";

const MEDIA_SIZES = "(min-width: 1024px) 660px, 100vw";

const TONES = {
  coral: { chip: "bg-coral-50 text-coral", dot: "bg-coral" },
  teal: { chip: "bg-teal-50 text-teal-dark", dot: "bg-teal-dark" },
  ink: { chip: "bg-sage-50 text-ink-light", dot: "bg-ink-light" },
} as const;

const TEAM = [
  { name: "Marc Dubois", role: "Chant", confirmed: true },
  { name: "Léa Moreau", role: "Guitare", confirmed: true },
  { name: "Claire Roux", role: "Piano", confirmed: true },
  { name: "Tom Girard", role: "Son", confirmed: false },
];

export function Pillars() {
  return (
    <section aria-labelledby="piliers-title" className="bg-white">
      <div className="px-5 pt-24 pb-10 sm:px-7 lg:pt-[140px] lg:pb-[60px]">
        <div data-reveal className="mx-auto flex max-w-[1240px] flex-col items-center gap-[18px] text-center">
          <Eyebrow>Trois verbes, une plateforme</Eyebrow>
          <h2
            id="piliers-title"
            className="max-w-[860px] font-display text-[clamp(40px,5vw,72px)] leading-none font-semibold"
          >
            Tout ce dont une église a besoin pour prendre soin des siens.
          </h2>
        </div>
      </div>

      {/* Communiquer */}
      <div className="px-5 pt-10 pb-20 sm:px-7">
        <PillarRow>
          <PillarText
            tone="coral"
            label="Communiquer"
            title="Chaque membre informé, au bon moment."
            items={[
              "Notifications push et e-mails",
              "Ciblage par équipe ou par groupe",
              "Annonces programmées du dimanche",
            ]}
          >
            Annonces et rappels arrivent directement sur le téléphone de chacun. Ciblez un groupe, une
            équipe ou toute l’église en deux clics.
          </PillarText>
          <MediaFrame>
            <PhotoLayer src={communiquerImage} alt="Communauté réunie" />
            <Parallax
              speed={-0.14}
              className="absolute bottom-6 left-3 w-[min(330px,calc(100%-24px))] sm:left-6 lg:bottom-12 lg:-left-10 lg:w-[330px]"
            >
              <FloatCard
                amplitude={8}
                phase={0.4}
                className="flex flex-col gap-2 rounded-[20px] bg-white p-4 shadow-[0_30px_70px_rgba(22,36,31,0.25)]"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-coral">
                  Pasteur Daniel · Toute l’église
                </span>
                <span className="text-[15px] leading-[1.45]">
                  Repas partagé après le culte dimanche. Inscrivez-vous pour les desserts&nbsp;!
                </span>
                <span className="flex gap-1.5">
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[12px] font-semibold text-teal-dark">
                    124 vues
                  </span>
                  <span className="rounded-full bg-coral-50 px-2.5 py-1 text-[12px] font-semibold text-coral-deep">
                    38 inscrits
                  </span>
                </span>
              </FloatCard>
            </Parallax>
            <Parallax speed={-0.26} className="absolute top-6 right-3 sm:right-6 lg:top-10 lg:-right-6">
              <FloatCard
                amplitude={10}
                phase={2.2}
                className="flex items-center gap-2.5 rounded-2xl bg-dark px-3.5 py-3 text-[14px] text-white shadow-[0_24px_50px_rgba(22,36,31,0.3)]"
              >
                <span className="flex size-[30px] flex-none items-center justify-center rounded-[9px] bg-coral text-[13px] font-bold">
                  L
                </span>
                Rappel envoyé · 5 bénévoles louange
              </FloatCard>
            </Parallax>
          </MediaFrame>
        </PillarRow>
      </div>

      {/* Organiser */}
      <div className="px-5 py-20 sm:px-7">
        <PillarRow reversed>
          <PillarText
            tone="teal"
            label="Organiser"
            title="Des plannings qui se remplissent presque seuls."
            items={[
              "Planning des services et des équipes",
              "Relances automatiques des non-réponses",
              "Bibliothèque de chants et accords transposables",
              "Projection des paroles, en salle et en streaming",
            ]}
          >
            Les bénévoles indiquent leurs indisponibilités, confirment en un geste et reçoivent les grilles
            d’accords dans la bonne tonalité. Vous voyez d’un coup d’œil ce qui reste à pourvoir.
          </PillarText>
          <MediaFrame className="lg:order-first">
            <PhotoLayer src={organiserImage} alt="Équipe sur scène" />
            <Parallax
              speed={-0.16}
              className="absolute right-3 bottom-6 w-[min(380px,calc(100%-24px))] sm:right-6 lg:-right-10 lg:bottom-10 lg:w-[380px]"
            >
              <FloatCard
                amplitude={8}
                phase={1.1}
                className="overflow-hidden rounded-[20px] bg-white shadow-[0_30px_70px_rgba(22,36,31,0.25)]"
              >
                <span className="flex items-center justify-between bg-sand px-4 py-3.5">
                  <span className="text-[14px] font-semibold">Dim. 4 octobre · Louange</span>
                  <Badge tone="amber" size="sm">
                    3/4 confirmés
                  </Badge>
                </span>
                {TEAM.map((member) => (
                  <span
                    key={member.name}
                    className="flex items-center gap-2.5 border-t border-line-soft px-4 py-2.5"
                  >
                    <span
                      className={cx(
                        "size-2 flex-none rounded-full",
                        member.confirmed ? "bg-[#2f9e62]" : "bg-[#e0a030]",
                      )}
                    />
                    <span className="flex-1 text-[14px] font-medium">{member.name}</span>
                    <span className="text-[12px] text-muted">{member.role}</span>
                  </span>
                ))}
              </FloatCard>
            </Parallax>
            <Parallax speed={-0.28} className="absolute top-6 left-3 sm:left-6 lg:top-12 lg:-left-7">
              <FloatCard
                amplitude={9}
                phase={2.8}
                className="flex flex-col gap-0.5 rounded-2xl bg-ink-light px-4 py-3 text-sand shadow-[0_24px_50px_rgba(22,36,31,0.3)]"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-teal-pale">
                  Tonalité
                </span>
                <span className="font-mono text-[22px] font-bold text-coral-light">G → A</span>
              </FloatCard>
            </Parallax>
          </MediaFrame>
        </PillarRow>
      </div>

      {/* Rassembler */}
      <div className="px-5 pt-20 pb-[120px] sm:px-7 lg:pb-[160px]">
        <PillarRow>
          <PillarText
            tone="ink"
            label="Rassembler"
            title="Des liens qui durent au-delà du dimanche."
            items={[
              "Événements et inscriptions en ligne",
              "Groupes de maison et suivi des nouveaux",
              "Dons en ligne et reçus fiscaux, bientôt disponibles",
            ]}
          >
            Événements, groupes de maison, accueil des nouveaux&nbsp;: Comora aide chaque personne à
            trouver sa place et à se sentir partie prenante de la vie de l’église.
          </PillarText>
          <MediaFrame>
            <div className="absolute inset-0 overflow-hidden rounded-[32px] bg-ink-light">
              <Parallax speed={0.1} className="absolute inset-x-0 -top-[10%] h-[120%]">
                <Image src={repasPoster} alt="" fill sizes={MEDIA_SIZES} className="object-cover" />
                <AmbientVideo
                  src="/videos/repas-partage.mp4"
                  className="absolute inset-0 size-full object-cover"
                />
              </Parallax>
            </div>
            <Parallax
              speed={-0.18}
              className="absolute top-6 left-3 w-[min(310px,calc(100%-24px))] sm:left-6 lg:top-14 lg:-left-10 lg:w-[310px]"
            >
              <FloatCard
                amplitude={9}
                phase={0.9}
                className="flex flex-col gap-3 rounded-[20px] bg-white p-[18px] shadow-[0_30px_70px_rgba(22,36,31,0.3)]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-[52px] w-12 flex-none flex-col items-center justify-center rounded-xl bg-teal-50">
                    <span className="text-[10px] font-semibold uppercase text-teal-dark">Oct</span>
                    <span className="text-[19px] font-bold">17</span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">Week-end d’église</span>
                    <span className="text-[13px] text-muted">Annecy · 2 jours</span>
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-sand">
                  <span className="block h-full w-[70%] bg-teal-dark" />
                </span>
                <span className="text-[13px] text-slate">42 inscrits sur 60 places</span>
              </FloatCard>
            </Parallax>
            <Parallax speed={-0.3} className="absolute right-3 bottom-6 sm:right-6 lg:-right-6 lg:bottom-14">
              <FloatCard
                amplitude={10}
                phase={1.8}
                className="flex flex-col gap-1 rounded-[18px] bg-coral px-[18px] py-3.5 text-white shadow-[0_24px_50px_rgba(0,0,0,0.35)]"
              >
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em]">Bientôt · Don mensuel</span>
                <span className="text-[24px] font-bold">30,00&nbsp;€</span>
                <span className="text-[12px]">Reçu fiscal envoyé</span>
              </FloatCard>
            </Parallax>
          </MediaFrame>
        </PillarRow>
      </div>
    </section>
  );
}

function PillarRow({ reversed = false, children }: { reversed?: boolean; children: ReactNode }) {
  return (
    <div
      className={cx(
        "mx-auto grid max-w-[1240px] items-center gap-12 lg:gap-[72px]",
        reversed
          ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
          : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]",
      )}
    >
      {children}
    </div>
  );
}

function PillarText({
  tone,
  label,
  title,
  items,
  children,
}: {
  tone: keyof typeof TONES;
  label: string;
  title: string;
  items: string[];
  children: ReactNode;
}) {
  const colors = TONES[tone];
  return (
    <div data-reveal className="flex flex-col gap-[22px]">
      <p
        className={cx(
          "flex items-center gap-2 self-start rounded-full px-3.5 py-2 text-[13px] font-bold uppercase tracking-[0.08em]",
          colors.chip,
        )}
      >
        <span aria-hidden="true" className={cx("size-2 rounded-full", colors.dot)} />
        {label}
      </p>
      <h3 className="font-display text-[clamp(36px,4vw,56px)] leading-[1.02] font-semibold">{title}</h3>
      <p className="text-[18px] leading-[1.6] text-pretty text-slate">{children}</p>
      <ul className="flex flex-col gap-3 text-base">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cx(
                "flex size-[22px] flex-none items-center justify-center rounded-full text-[12px] font-bold",
                colors.chip,
              )}
            >
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cadre des visuels : hauteur fixe, cartes d'interface positionnées par-dessus. */
function MediaFrame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div aria-hidden="true" className={cx("relative h-[440px] sm:h-[520px] lg:h-[560px]", className)}>
      {children}
    </div>
  );
}

/** Photo arrondie, légèrement plus haute que son cadre pour la parallaxe. */
function PhotoLayer({ src, alt }: { src: typeof communiquerImage; alt: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[32px]">
      <Parallax speed={0.12} className="absolute inset-x-0 -top-[10%] h-[120%]">
        <Image src={src} alt={alt} fill sizes={MEDIA_SIZES} className="object-cover" />
      </Parallax>
    </div>
  );
}
