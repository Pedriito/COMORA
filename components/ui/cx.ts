/** Concatène des classes en ignorant les valeurs vides. */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
