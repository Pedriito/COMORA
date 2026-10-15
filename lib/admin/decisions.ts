import "server-only";
import { invitationEmail, refusalEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationUrl,
} from "@/lib/invitations";
import * as store from "./store";

/*
 * Décisions prises depuis /admin. L'autorisation est vérifiée par les Server
 * Actions (requireAdmin) avant d'arriver ici.
 */

export type DecisionResult =
  | { ok: true; message: string; link?: string; emailSent: boolean }
  | { ok: false; message: string };

const emailNote = (sent: boolean) =>
  sent ? "E-mail envoyé." : "L’e-mail n’a pas pu partir : utilisez « Renvoyer l’e-mail » ou copiez le lien.";

async function invite(request: store.AccessRequest): Promise<DecisionResult> {
  const token = generateInvitationToken();
  const expiresAt = invitationExpiry();
  await store.replaceInvitation({
    waitlistId: request.id,
    email: request.email,
    tokenHash: hashInvitationToken(token),
    expiresAt,
  });
  const link = invitationUrl(token);
  const sent = await sendEmail(
    request.email,
    invitationEmail({ nom: request.nom, eglise: request.eglise, link, expiresAt }),
  );
  if (sent.ok) await store.markEmailSent(request.id);
  return { ok: true, link, emailSent: sent.ok, message: `${request.eglise} acceptée. ${emailNote(sent.ok)}` };
}

async function refuse(request: store.AccessRequest): Promise<DecisionResult> {
  const sent = await sendEmail(request.email, refusalEmail({ nom: request.nom, eglise: request.eglise }));
  if (sent.ok) await store.markEmailSent(request.id);
  return { ok: true, emailSent: sent.ok, message: `${request.eglise} refusée. ${emailNote(sent.ok)}` };
}

async function load(id: string) {
  const request = await store.getRequest(id);
  if (!request) throw new store.StoreError("Demande introuvable.");
  return request;
}

async function guard(run: () => Promise<DecisionResult>): Promise<DecisionResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof store.StoreError) return { ok: false, message: error.message };
    throw error;
  }
}

export function acceptRequest(id: string) {
  return guard(async () => {
    const request = await load(id);
    if (request.statut !== "en_attente") return { ok: false, message: "Cette demande a déjà été traitée." };
    await store.setDecision(id, "acceptee");
    return invite(request);
  });
}

export function refuseRequest(id: string) {
  return guard(async () => {
    const request = await load(id);
    if (request.statut !== "en_attente") return { ok: false, message: "Cette demande a déjà été traitée." };
    await store.setDecision(id, "refusee");
    return refuse(request);
  });
}

/**
 * Renvoie l'e-mail de la décision. Pour une église acceptée, un nouveau lien
 * est créé (seule l'empreinte de l'ancien était connue) et l'ancien est annulé.
 */
export function resendDecision(id: string) {
  return guard(async () => {
    const request = await load(id);
    if (request.statut === "acceptee") return invite(request);
    if (request.statut === "refusee") return refuse(request);
    return { ok: false, message: "Aucune décision à renvoyer pour cette demande." };
  });
}
