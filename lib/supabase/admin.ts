import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé secrète (rôle service) : contourne la RLS.
 * Réservé au serveur (page /admin, création de compte) ; la clé n'a pas de
 * préfixe NEXT_PUBLIC_ et n'atteint donc jamais le navigateur.
 * Renvoie null tant que les variables d'environnement ne sont pas définies.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
