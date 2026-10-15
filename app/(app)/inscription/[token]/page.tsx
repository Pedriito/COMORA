import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SignupForm } from "@/components/account/signup-form";
import { buttonClasses } from "@/components/ui/button";
import { StoreError } from "@/lib/admin/store";
import { checkInvitation, signupMessages, type InvitationCheck } from "@/lib/signup";

export const metadata: Metadata = {
  title: "Créer mon compte",
  robots: { index: false, follow: false },
  // Le jeton est dans l'adresse : il ne doit pas partir vers d'autres sites.
  referrer: "no-referrer",
};

export default async function InscriptionPage({ params }: PageProps<"/inscription/[token]">) {
  const { token } = await params;

  let check: InvitationCheck | null = null;
  try {
    check = await checkInvitation(token);
  } catch (error) {
    if (!(error instanceof StoreError)) throw error;
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-ink px-5 py-16 text-sand">
      <div className="flex w-full max-w-[460px] flex-col items-center gap-7">
        <Link href="/" aria-label="Accueil Comora">
          <Logo size={52} word="none" color="#efece3" />
        </Link>
        {check?.ok ? (
          <>
            <div className="flex flex-col gap-3 text-center">
              <h1 className="font-display text-[clamp(38px,6vw,52px)] leading-none font-semibold">
                Créez votre compte
              </h1>
              <p className="text-[17px] leading-[1.6] text-mist">
                {check.request.eglise} fait partie des églises fondatrices. Choisissez votre mot de passe
                pour réserver votre accès.
              </p>
            </div>
            <div className="w-full rounded-[28px] border border-moss-light bg-ink-card p-6 sm:p-8">
              <SignupForm token={token} email={check.invitation.email} defaultName={check.request.nom} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-6 text-center">
            <h1 className="font-display text-[clamp(38px,6vw,52px)] leading-none font-semibold">
              Lien indisponible
            </h1>
            <p className="text-[17px] leading-[1.6] text-mist">
              {check ? signupMessages[check.reason] : signupMessages.failed}
            </p>
            <Link href="/" className={buttonClasses({ variant: "accent", size: "lg", shape: "pill" })}>
              Retour à l’accueil
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
