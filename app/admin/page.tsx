import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/admin/login-form";
import { RequestBoard } from "@/components/admin/request-board";
import { isAdmin } from "@/lib/admin/session";
import { isStoreConfigured, listRequests, StoreError, type AccessRequest } from "@/lib/admin/store";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-ink px-5 py-16 text-sand">
        <div className="flex w-full max-w-[380px] flex-col items-center gap-7 text-center">
          <Logo size={52} word="none" color="#efece3" />
          <h1 className="font-display text-[44px] leading-none font-semibold">Administration</h1>
          <LoginForm />
        </div>
      </main>
    );
  }

  let requests: AccessRequest[] = [];
  let problem: string | null = null;
  if (!isStoreConfigured()) {
    problem = "Supabase n’est pas configuré : ajoutez SUPABASE_SECRET_KEY pour lire les demandes.";
  } else {
    try {
      requests = await listRequests();
    } catch (error) {
      if (!(error instanceof StoreError)) throw error;
      problem = error.message;
    }
  }

  return (
    <div className="min-h-svh bg-sand-light text-dark">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-7">
          <span className="flex items-center gap-3">
            <Logo size={30} word="serif" />
            <span className="rounded-full bg-sage-50 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-light">
              Admin
            </span>
          </span>
          <form action={logout}>
            <button type="submit" className="cursor-pointer text-[15px] font-medium whitespace-nowrap text-slate hover:text-dark">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 py-10 sm:px-7">
        <h1 className="font-display text-[clamp(34px,4vw,52px)] leading-none font-semibold">
          Demandes d’accès anticipé
        </h1>
        {problem ? (
          <p role="alert" className="rounded-2xl border border-coral/30 bg-coral-50 p-5 font-semibold text-coral-deep">
            {problem}
          </p>
        ) : (
          <RequestBoard requests={requests} />
        )}
      </main>
    </div>
  );
}
