import "server-only";
import * as store from "@/lib/admin/store";
import { hashInvitationToken, isWellFormedToken } from "@/lib/invitations";

/*
 * Création d'un compte depuis le lien d'invitation d'une église acceptée.
 * Le compte est créé dans Supabase Auth (e-mail déjà confirmé : il vient de
 * notre invitation) et relié à la demande par public.profiles.
 */

export const PASSWORD_MIN_LENGTH = 10;

export type InvitationCheck =
  | { ok: true; invitation: store.Invitation; request: store.AccessRequest }
  | { ok: false; reason: "invalid" | "expired" | "used" };

export async function checkInvitation(token: string, now = Date.now()): Promise<InvitationCheck> {
  if (!isWellFormedToken(token)) return { ok: false, reason: "invalid" };
  const invitation = await store.findInvitation(hashInvitationToken(token));
  if (!invitation) return { ok: false, reason: "invalid" };
  if (invitation.used_at) return { ok: false, reason: "used" };
  if (new Date(invitation.expires_at).getTime() <= now) return { ok: false, reason: "expired" };

  const request = await store.getRequest(invitation.waitlist_id);
  if (!request || request.statut !== "acceptee") return { ok: false, reason: "invalid" };
  return { ok: true, invitation, request };
}

export type SignupState =
  | { status: "idle" }
  | { status: "success"; email: string }
  | { status: "error"; message: string; field?: "nom" | "password" | "confirm" };

export const signupMessages = {
  invalid: "Ce lien n’est pas valide. Vérifiez qu’il est complet, ou demandez-nous un nouveau lien.",
  expired: "Ce lien a expiré. Écrivez-nous pour en recevoir un nouveau.",
  used: "Ce lien a déjà servi à créer un compte.",
  nom: "Indiquez votre prénom et votre nom.",
  password: `Choisissez un mot de passe de ${PASSWORD_MIN_LENGTH} à 72 caractères.`,
  confirm: "Les deux mots de passe ne correspondent pas.",
  exists: "Un compte existe déjà avec cet e-mail. Vous pourrez vous connecter à l’ouverture.",
  failed: "La création du compte n’a pas abouti. Réessayez dans un instant.",
} as const;

export async function createAccount(
  token: string,
  input: { nom: string; password: string; confirm: string },
): Promise<SignupState> {
  const nom = input.nom.trim();
  if (!nom || nom.length > 160) return { status: "error", message: signupMessages.nom, field: "nom" };
  if (input.password.length < PASSWORD_MIN_LENGTH || input.password.length > 72) {
    return { status: "error", message: signupMessages.password, field: "password" };
  }
  if (input.password !== input.confirm) {
    return { status: "error", message: signupMessages.confirm, field: "confirm" };
  }

  try {
    const check = await checkInvitation(token);
    if (!check.ok) return { status: "error", message: signupMessages[check.reason] };
    const { invitation, request } = check;

    // On réserve le lien d'abord : deux envois simultanés ne créent pas deux comptes.
    if (!(await store.consumeInvitation(invitation.id))) {
      return { status: "error", message: signupMessages.used };
    }

    const user = await store.createUser({
      email: invitation.email,
      password: input.password,
      metadata: { nom, eglise: request.eglise },
    });
    if (!user.ok) {
      if (user.reason === "failed") await store.releaseInvitation(invitation.id);
      return { status: "error", message: signupMessages[user.reason] };
    }

    await store.insertProfile({
      id: user.userId,
      waitlist_id: request.id,
      nom,
      eglise: request.eglise,
      role: request.role,
    });
    return { status: "success", email: invitation.email };
  } catch (error) {
    if (error instanceof store.StoreError) return { status: "error", message: signupMessages.failed };
    throw error;
  }
}
