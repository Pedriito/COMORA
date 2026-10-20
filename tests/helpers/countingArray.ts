/**
 * Enveloppe un tableau dans un Proxy qui compte les accès à chacune de ses méthodes
 * (et à l'itérateur, utilisé par le spread `[...arr]`). Sert à prouver, sans toucher au
 * code de production, qu'un `useMemo` a bien empêché un recalcul : si la dépendance ne
 * change pas, le compteur de la méthode utilisée par le calcul (`.map`, `.filter`, l'itérateur…)
 * ne doit plus augmenter après le premier rendu.
 */
export function makeCountingArray<T>(arr: T[]) {
  const counts: Record<string, number> = {}
  function bump(key: string) {
    counts[key] = (counts[key] ?? 0) + 1
  }
  const proxy = new Proxy(arr, {
    get(target, prop, receiver) {
      if (typeof prop === 'string') bump(prop)
      else if (prop === Symbol.iterator) bump('Symbol.iterator')
      return Reflect.get(target, prop, receiver)
    },
  })
  return { proxy, counts }
}
