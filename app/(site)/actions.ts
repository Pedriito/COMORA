"use server";

import { createAnonClient } from "@/lib/supabase/anon";
import {
  normalizeSource,
  readWaitlistValues,
  validateWaitlist,
  waitlistMessages,
  type WaitlistState,
} from "@/lib/waitlist";

/** Enregistre une demande d'accès dans public.waitlist. */
export async function requestAccess(
  _previous: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  // Champ piège invisible : seul un robot le remplit. On le laisse croire que c'est passé.
  if (formData.get("site_web")) {
    return { status: "success", message: waitlistMessages.success };
  }

  const values = readWaitlistValues(formData);
  const result = validateWaitlist(values);
  if (!result.ok) {
    return { status: "error", message: waitlistMessages.invalid, values, invalid: result.invalid };
  }

  const supabase = createAnonClient();
  if (!supabase) {
    console.warn("[waitlist] Supabase n'est pas configuré : demande non enregistrée.");
    return { status: "error", message: waitlistMessages.unavailable, values };
  }

  const { error } = await supabase
    .from("waitlist")
    .insert({ ...result.row, source: normalizeSource(formData.get("source")) });

  if (error) {
    console.error("[waitlist] Insertion refusée :", error.code, error.message);
    return { status: "error", message: waitlistMessages.failed, values };
  }

  return { status: "success", message: waitlistMessages.success };
}
