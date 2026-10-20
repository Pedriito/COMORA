import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Accès à la base Supabase locale (`supabase start`) pour les tests RLS.
 * Les clés viennent de `supabase status` : ce sont les clés de démonstration
 * de l'instance locale, jamais celles d'un projet hébergé.
 */
type LocalEnv = { url: string; publicKey: string; secretKey: string };

let cached: LocalEnv | null = null;

export function localEnv(): LocalEnv {
  if (cached) return cached;
  let raw: string;
  try {
    raw = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error("Base locale introuvable : lancez Docker puis `supabase start`.");
  }
  const vars = Object.fromEntries(
    raw
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  const url = vars.API_URL;
  if (!url?.startsWith("http://127.0.0.1") && !url?.startsWith("http://localhost")) {
    throw new Error("Les tests RLS ne tournent que sur une base locale.");
  }
  cached = { url, publicKey: vars.PUBLISHABLE_KEY ?? vars.ANON_KEY, secretKey: vars.SECRET_KEY ?? vars.SERVICE_ROLE_KEY };
  return cached;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function serviceClient(): SupabaseClient {
  const { url, secretKey } = localEnv();
  return createClient(url, secretKey, noSession);
}

export function anonClient(): SupabaseClient {
  const { url, publicKey } = localEnv();
  return createClient(url, publicKey, noSession);
}

/** Crée un compte confirmé et renvoie un client connecté avec la clé publique. */
export async function signedInClient(email: string): Promise<{ client: SupabaseClient; userId: string }> {
  const password = `Mot-de-passe-${Math.random().toString(36).slice(2)}-Aa1!`;
  const service = serviceClient();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Création du compte ${email} : ${error?.message}`);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Connexion ${email} : ${signInError.message}`);
  return { client, userId: data.user.id };
}
