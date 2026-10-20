import "server-only";
import { getAdminClientIfConfigured } from "@/lib/supabase/admin";
import type { WaitlistRow } from "@/lib/waitlist";

/*
 * Accès à la base pour l'administration et l'inscription, avec la clé
 * secrète. Les fonctions lèvent une erreur si Supabase n'est pas configuré
 * ou refuse la requête : les appelants traduisent en message lisible.
 */

export type RequestStatus = "en_attente" | "acceptee" | "refusee";

export type AccessRequest = WaitlistRow & {
  id: string;
  created_at: string;
  statut: RequestStatus;
  decided_at: string | null;
  email_sent_at: string | null;
};

export type Invitation = {
  id: string;
  waitlist_id: string;
  email: string;
  expires_at: string;
  used_at: string | null;
};

export class StoreError extends Error {}

function client() {
  const supabase = getAdminClientIfConfigured();
  if (!supabase) throw new StoreError("Supabase n’est pas configuré (SUPABASE_SECRET_KEY manquante).");
  return supabase;
}

function fail(context: string, error: { code?: string; message: string }): never {
  console.error(`[store] ${context} :`, error.code, error.message);
  throw new StoreError(`${context} : ${error.message}`);
}

export function isStoreConfigured() {
  return getAdminClientIfConfigured() !== null;
}

export async function listRequests(): Promise<AccessRequest[]> {
  const { data, error } = await client()
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) fail("Lecture des demandes", error);
  return data as AccessRequest[];
}

export async function getRequest(id: string): Promise<AccessRequest | null> {
  const { data, error } = await client().from("waitlist").select("*").eq("id", id).maybeSingle();
  if (error) fail("Lecture de la demande", error);
  return data as AccessRequest | null;
}

export async function setDecision(id: string, statut: Exclude<RequestStatus, "en_attente">) {
  const { error } = await client()
    .from("waitlist")
    .update({ statut, decided_at: new Date().toISOString(), email_sent_at: null })
    .eq("id", id);
  if (error) fail("Enregistrement de la décision", error);
}

export async function markEmailSent(id: string) {
  const { error } = await client()
    .from("waitlist")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail("Enregistrement de l’envoi", error);
}

/** Remplace les invitations encore ouvertes de la demande par une nouvelle. */
export async function replaceInvitation(input: {
  waitlistId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  const supabase = client();
  const { error: deleteError } = await supabase
    .from("invitations")
    .delete()
    .eq("waitlist_id", input.waitlistId)
    .is("used_at", null);
  if (deleteError) fail("Annulation des anciennes invitations", deleteError);

  const { error } = await supabase.from("invitations").insert({
    waitlist_id: input.waitlistId,
    email: input.email,
    token_hash: input.tokenHash,
    expires_at: input.expiresAt.toISOString(),
  });
  if (error) fail("Création de l’invitation", error);
}

export async function findInvitation(tokenHash: string): Promise<Invitation | null> {
  const { data, error } = await client()
    .from("invitations")
    .select("id, waitlist_id, email, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) fail("Lecture de l’invitation", error);
  return data as Invitation | null;
}

/** Marque l'invitation comme utilisée ; false si elle l'était déjà (double envoi). */
export async function consumeInvitation(id: string) {
  const { data, error } = await client()
    .from("invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("id", id)
    .is("used_at", null)
    .select("id");
  if (error) fail("Utilisation de l’invitation", error);
  return (data ?? []).length > 0;
}

export async function releaseInvitation(id: string) {
  const { error } = await client().from("invitations").update({ used_at: null }).eq("id", id);
  if (error) fail("Réouverture de l’invitation", error);
}

export type CreateUserResult = { ok: true; userId: string } | { ok: false; reason: "exists" | "failed" };

export async function createUser(input: {
  email: string;
  password: string;
  metadata: Record<string, string>;
}): Promise<CreateUserResult> {
  const { data, error } = await client().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: input.metadata,
  });
  if (error || !data.user) {
    console.error("[store] Création du compte :", error?.code, error?.message);
    const exists = error?.code === "email_exists" || error?.status === 422;
    return { ok: false, reason: exists ? "exists" : "failed" };
  }
  return { ok: true, userId: data.user.id };
}

export async function insertProfile(profile: {
  id: string;
  waitlist_id: string;
  nom: string;
  eglise: string;
  role: string | null;
}) {
  const { error } = await client().from("profiles").insert(profile);
  if (error) fail("Création du profil", error);
}
