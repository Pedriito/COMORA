import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "./env";

/**
 * Client Supabase avec la clé secrète (rôle service) : contourne la RLS.
 * Réservé au serveur ; la clé n'a pas de préfixe NEXT_PUBLIC_ et n'atteint
 * donc jamais le navigateur.
 * Renvoie null tant que les variables d'environnement ne sont pas définies.
 */
export function getAdminClientIfConfigured() {
  const url = supabaseUrl();
  const key = supabaseSecretKey();
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Comme getAdminClientIfConfigured, mais échoue si Supabase n'est pas configuré. */
export function createAdminClient() {
  const client = getAdminClientIfConfigured();
  if (!client) {
    throw new Error("Supabase n'est pas configuré (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY).");
  }
  return client;
}
