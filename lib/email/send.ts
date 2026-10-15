import "server-only";
import { Resend } from "resend";
import type { EmailContent } from "./templates";

export type SendResult = { ok: true } | { ok: false; reason: "not_configured" | "failed" };

/**
 * Envoie un e-mail via Resend. Sans RESEND_API_KEY / RESEND_FROM (en local),
 * rien n'est envoyé : la décision est enregistrée et l'admin le signale.
 */
export async function sendEmail(to: string, content: EmailContent): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.warn("[email] Resend n'est pas configuré : e-mail non envoyé.");
    return { ok: false, reason: "not_configured" };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: process.env.RESEND_REPLY_TO || undefined,
    });
    if (error) {
      console.error("[email] Envoi refusé :", error.name, error.message);
      return { ok: false, reason: "failed" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email] Envoi impossible :", error);
    return { ok: false, reason: "failed" };
  }
}
