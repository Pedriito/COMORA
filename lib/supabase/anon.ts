import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur, sans session utilisateur (rôle « anon »).
 * Les politiques RLS limitent ce rôle à l'ajout d'une demande dans
 * public.waitlist : il ne peut pas lire la liste.
 * Renvoie null tant que les variables d'environnement ne sont pas définies.
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
