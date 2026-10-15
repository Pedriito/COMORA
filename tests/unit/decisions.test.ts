import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeStore } from "../support/fake-store";

const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeStore> | null }));
const sendEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin/store", () => fake.current!.store);
vi.mock("@/lib/email/send", () => ({ sendEmail }));

fake.current = createFakeStore();
const { acceptRequest, refuseRequest, resendDecision } = await import("@/lib/admin/decisions");
const { hashInvitationToken } = await import("@/lib/invitations");

const db = fake.current;

beforeEach(() => {
  db.requests.clear();
  db.invitations.length = 0;
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true });
});

describe("accepter une église", () => {
  it("crée une invitation hachée, change le statut et envoie le lien par e-mail", async () => {
    const request = db.addRequest();
    const result = await acceptRequest(request.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const token = result.link!.split("/inscription/")[1];
    expect(db.invitations).toHaveLength(1);
    expect(db.invitations[0].token_hash).toBe(hashInvitationToken(token));
    expect(db.invitations[0].token_hash).not.toContain(token);
    expect(db.requests.get(request.id)).toMatchObject({ statut: "acceptee" });
    expect(db.requests.get(request.id)!.email_sent_at).not.toBeNull();

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, content] = sendEmail.mock.calls[0];
    expect(to).toBe("marie@exemple.fr");
    expect(content.html).toContain(result.link);
    expect(result.emailSent).toBe(true);
  });

  it("garde la décision et le lien si l'e-mail ne part pas", async () => {
    sendEmail.mockResolvedValue({ ok: false, reason: "failed" });
    const request = db.addRequest();
    const result = await acceptRequest(request.id);

    expect(result).toMatchObject({ ok: true, emailSent: false });
    expect(result.ok && result.link).toBeTruthy();
    expect(db.requests.get(request.id)).toMatchObject({ statut: "acceptee", email_sent_at: null });
  });

  it("ne traite pas deux fois la même demande", async () => {
    const request = db.addRequest({ statut: "refusee" });
    expect(await acceptRequest(request.id)).toEqual({ ok: false, message: "Cette demande a déjà été traitée." });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("signale une demande introuvable", async () => {
    expect(await acceptRequest("00000000-0000-4000-8000-000000000000")).toEqual({
      ok: false,
      message: "Demande introuvable.",
    });
  });
});

describe("refuser une église", () => {
  it("change le statut et envoie l'e-mail de refus, sans invitation", async () => {
    const request = db.addRequest();
    const result = await refuseRequest(request.id);

    expect(result).toMatchObject({ ok: true, emailSent: true });
    expect(db.requests.get(request.id)).toMatchObject({ statut: "refusee" });
    expect(db.invitations).toHaveLength(0);
    const [, content] = sendEmail.mock.calls[0];
    expect(content.subject).toBe("Votre demande d’accès à Comora");
    expect(content.text).toContain("version publique");
  });
});

describe("renvoyer l'e-mail", () => {
  it("pour une église acceptée, remplace l'ancien lien par un nouveau", async () => {
    const request = db.addRequest();
    const first = await acceptRequest(request.id);
    const second = await resendDecision(request.id);

    expect(first.ok && second.ok && first.link !== second.link).toBe(true);
    expect(db.invitations).toHaveLength(1);
    const token = second.ok ? second.link!.split("/inscription/")[1] : "";
    expect(db.invitations[0].token_hash).toBe(hashInvitationToken(token));
  });

  it("pour une église refusée, renvoie le refus", async () => {
    const request = db.addRequest();
    await refuseRequest(request.id);
    await resendDecision(request.id);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[1][1].subject).toBe("Votre demande d’accès à Comora");
  });

  it("rien à renvoyer pour une demande en attente", async () => {
    const request = db.addRequest();
    expect((await resendDecision(request.id)).ok).toBe(false);
  });
});
