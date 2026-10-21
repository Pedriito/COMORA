import 'server-only'
import { PRIVATE_BUCKET, isChurchPath } from '@/lib/storage'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Durée de validité des URL signées des PDF de prédication (1 h) */
const SIGNED_URL_SECONDS = 3600

/** URL signée d'un PDF privé de l'église, ou null si le chemin n'est pas celui de cette église. */
export async function signedSermonUrl(
  supabase: SupabaseServerClient,
  churchId: string,
  storagePath: string | null,
): Promise<string | null> {
  if (!storagePath || !isChurchPath(churchId, storagePath)) return null
  const { data } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS)
  return data?.signedUrl ?? null
}
