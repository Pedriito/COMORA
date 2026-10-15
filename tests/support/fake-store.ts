import { vi } from "vitest";
import type { AccessRequest, Invitation } from "@/lib/admin/store";

/** Base en mémoire qui remplace lib/admin/store dans les tests. */
export function createFakeStore() {
  const requests = new Map<string, AccessRequest>();
  const invitations: (Invitation & { token_hash: string })[] = [];
  const profiles: Record<string, unknown>[] = [];
  const users: { id: string; email: string; password: string }[] = [];

  class StoreError extends Error {}

  const store = {
    StoreError,
    isStoreConfigured: () => true,
    listRequests: vi.fn(async () => [...requests.values()]),
    getRequest: vi.fn(async (id: string) => requests.get(id) ?? null),
    setDecision: vi.fn(async (id: string, statut: "acceptee" | "refusee") => {
      const request = requests.get(id)!;
      requests.set(id, { ...request, statut, decided_at: new Date().toISOString(), email_sent_at: null });
    }),
    markEmailSent: vi.fn(async (id: string) => {
      const request = requests.get(id)!;
      requests.set(id, { ...request, email_sent_at: new Date().toISOString() });
    }),
    replaceInvitation: vi.fn(
      async (input: { waitlistId: string; email: string; tokenHash: string; expiresAt: Date }) => {
        for (let i = invitations.length - 1; i >= 0; i--) {
          if (invitations[i].waitlist_id === input.waitlistId && !invitations[i].used_at) invitations.splice(i, 1);
        }
        invitations.push({
          id: `inv-${invitations.length + 1}-${input.tokenHash.slice(0, 6)}`,
          waitlist_id: input.waitlistId,
          email: input.email,
          token_hash: input.tokenHash,
          expires_at: input.expiresAt.toISOString(),
          used_at: null,
        });
      },
    ),
    findInvitation: vi.fn(async (hash: string) => invitations.find((item) => item.token_hash === hash) ?? null),
    consumeInvitation: vi.fn(async (id: string) => {
      const invitation = invitations.find((item) => item.id === id);
      if (!invitation || invitation.used_at) return false;
      invitation.used_at = new Date().toISOString();
      return true;
    }),
    releaseInvitation: vi.fn(async (id: string) => {
      const invitation = invitations.find((item) => item.id === id);
      if (invitation) invitation.used_at = null;
    }),
    createUser: vi.fn(async (input: { email: string; password: string }) => {
      if (users.some((user) => user.email === input.email)) return { ok: false as const, reason: "exists" as const };
      const user = { id: `user-${users.length + 1}`, email: input.email, password: input.password };
      users.push(user);
      return { ok: true as const, userId: user.id };
    }),
    insertProfile: vi.fn(async (profile: Record<string, unknown>) => {
      profiles.push(profile);
    }),
  };

  function addRequest(overrides: Partial<AccessRequest> = {}) {
    const request: AccessRequest = {
      id: "6f1c2b9e-1d2a-4b3c-8d4e-5f6a7b8c9d0e",
      created_at: "2026-10-08T10:00:00Z",
      statut: "en_attente",
      decided_at: null,
      email_sent_at: null,
      eglise: "Église du Centre",
      ville: "Lyon",
      pays: "France",
      nom: "Marie Dupont",
      email: "marie@exemple.fr",
      role: "Pasteur",
      taille: "30 à 100",
      benevoles: "10 à 30",
      cultes: "1",
      multi_sites: false,
      ministeres: ["Louange"],
      priorite: "Communication",
      visio: true,
      outil: null,
      source: null,
      ...overrides,
    };
    requests.set(request.id, request);
    return request;
  }

  return { store, requests, invitations, profiles, users, addRequest };
}
