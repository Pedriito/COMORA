/**
 * Variables Supabase partagées par tous les clients.
 * Les références à process.env restent littérales : Next les remplace
 * au build pour le navigateur.
 */
export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Clé publique (`sb_publishable_…`), ou ancienne clé « anon ». */
export function supabasePublicKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/** Clé secrète (`sb_secret_…`), ou ancienne clé « service_role ». Serveur uniquement. */
export function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}
