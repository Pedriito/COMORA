import { describe, expect, it } from "vitest";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationUrl,
  isWellFormedToken,
} from "@/lib/invitations";

describe("jetons d'invitation", () => {
  it("génère des jetons uniques, bien formés et hachés de façon stable", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).not.toBe(b);
    expect(isWellFormedToken(a)).toBe(true);
    expect(hashInvitationToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInvitationToken(a)).toBe(hashInvitationToken(a));
    expect(hashInvitationToken(a)).not.toBe(a);
  });

  it("refuse les jetons mal formés", () => {
    expect(isWellFormedToken("")).toBe(false);
    expect(isWellFormedToken("abc")).toBe(false);
    expect(isWellFormedToken(`${"a".repeat(42)}/`)).toBe(false);
  });

  it("expire après 14 jours et pointe vers /inscription", () => {
    const now = Date.UTC(2026, 9, 8);
    expect(invitationExpiry(now).toISOString()).toBe("2026-10-22T00:00:00.000Z");
    expect(invitationUrl("tok")).toMatch(/\/inscription\/tok$/);
  });
});
