import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicKey, supabaseUrl } from "./env";

/**
 * Client Supabase côté serveur, sans session utilisateur (rôle « anon »).
 * Ce rôle n'a aucun droit sur les tables : il ne sert qu'à appeler les fonctions
 * publiques, comme public_church_site() pour le site d'une église.
 * Renvoie null tant que les variables d'environnement ne sont pas définies.
 */
export function createAnonClient() {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
