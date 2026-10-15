"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acceptRequest, refuseRequest, resendDecision, type DecisionResult } from "@/lib/admin/decisions";
import {
  endAdminSession,
  isAdmin,
  passwordMatches,
  readAdminConfig,
  startAdminSession,
} from "@/lib/admin/session";

export type LoginState = { error: string | null };

/** Délai après un mauvais mot de passe : ralentit les essais en série. */
const FAILURE_DELAY_MS = 800;

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const config = readAdminConfig();
  if (!config) {
    return { error: "L’administration n’est pas configurée (ADMIN_PASSWORD, ADMIN_SESSION_SECRET)." };
  }
  const password = formData.get("password");
  if (typeof password !== "string" || !passwordMatches(password, config.password)) {
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
    return { error: "Mot de passe incorrect." };
  }
  await startAdminSession();
  redirect("/admin");
}

export async function logout() {
  await endAdminSession();
  redirect("/admin");
}

export type DecisionState = DecisionResult | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DECISIONS = {
  accepter: acceptRequest,
  refuser: refuseRequest,
  renvoyer: resendDecision,
} as const;

export async function decide(_previous: DecisionState, formData: FormData): Promise<DecisionState> {
  // Chaque action vérifie la session : l'affichage de la page ne suffit pas.
  if (!(await isAdmin())) {
    return { ok: false, message: "Session expirée : reconnectez-vous." };
  }
  const id = formData.get("id");
  const intent = formData.get("intent");
  if (typeof id !== "string" || !UUID.test(id) || typeof intent !== "string" || !Object.hasOwn(DECISIONS, intent)) {
    return { ok: false, message: "Requête invalide." };
  }

  const result = await DECISIONS[intent as keyof typeof DECISIONS](id);
  revalidatePath("/admin");
  return result;
}
