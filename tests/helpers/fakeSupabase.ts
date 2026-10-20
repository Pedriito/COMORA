/**
 * Faux client Supabase minimal pour les tests unitaires : reproduit l'API chaînable
 * (.select/.eq/.neq/.gte/.lt/.in/.order/.single/...) sans toucher à un vrai réseau/DB.
 *
 * Chaque table a une file (FIFO) de réponses : la Nème requête sur cette table renvoie
 * la Nème réponse enregistrée. Ça suffit pour reproduire fidèlement l'ordre des appels
 * `.from(table)` dans le code testé (déterministe, car les appels sont émis
 * synchroniquement avant d'être attendus dans un `Promise.all`).
 */
export type FakeResponse<T = unknown> =
  | { data: T; error: null }
  | { data: null; error: { message: string } }

export function ok<T>(data: T): FakeResponse<T> {
  return { data, error: null }
}

export function makeFakeSupabase(queues: Record<string, FakeResponse[]>) {
  const remaining: Record<string, FakeResponse[]> = {}
  for (const [table, responses] of Object.entries(queues)) remaining[table] = [...responses]

  const calls: string[] = []

  function from(table: string) {
    calls.push(table)
    const resp = remaining[table]?.shift() ?? { data: null, error: { message: `no fixture queued for "${table}"` } }

    const builder: any = {
      select: () => builder,
      eq: () => builder,
      neq: () => builder,
      gte: () => builder,
      lt: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      upsert: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      single: () => Promise.resolve(resp),
      maybeSingle: () => Promise.resolve(resp),
      then: (resolve: (v: FakeResponse) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(resp).then(resolve, reject),
    }
    return builder
  }

  return { from, calls }
}
