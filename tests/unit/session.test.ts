import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { passwordMatches, readAdminConfig, signSession, verifySession, ADMIN_SESSION_SECONDS } = await import(
  "@/lib/admin/session"
);

const config = { password: "un-mot-de-passe-solide", secret: "s".repeat(40) };

describe("session administrateur", () => {
  it("exige un mot de passe et un secret assez longs", () => {
    expect(readAdminConfig({})).toBeNull();
    expect(readAdminConfig({ ADMIN_PASSWORD: "court", ADMIN_SESSION_SECRET: "s".repeat(40) })).toBeNull();
    expect(readAdminConfig({ ADMIN_PASSWORD: config.password, ADMIN_SESSION_SECRET: "trop-court" })).toBeNull();
    expect(readAdminConfig({ ADMIN_PASSWORD: config.password, ADMIN_SESSION_SECRET: config.secret })).toEqual(config);
  });

  it("compare le mot de passe exactement", () => {
    expect(passwordMatches(config.password, config.password)).toBe(true);
    expect(passwordMatches("un-mot-de-passe-solidE", config.password)).toBe(false);
    expect(passwordMatches("", config.password)).toBe(false);
  });

  it("le cookie ne contient pas le mot de passe", () => {
    const cookie = signSession(config);
    expect(cookie).not.toContain(config.password);
    expect(cookie).not.toContain(config.secret);
  });

  it("accepte une session valide et la refuse après expiration", () => {
    const now = Date.UTC(2026, 9, 8, 12);
    const cookie = signSession(config, now);
    expect(verifySession(cookie, config, now)).toBe(true);
    expect(verifySession(cookie, config, now + (ADMIN_SESSION_SECONDS - 1) * 1000)).toBe(true);
    expect(verifySession(cookie, config, now + ADMIN_SESSION_SECONDS * 1000)).toBe(false);
  });

  it("refuse un cookie falsifié ou mal formé", () => {
    const now = Date.now();
    const cookie = signSession(config, now);
    const [expiry, sig] = cookie.split(".");
    expect(verifySession(`${Number(expiry) + 3600}.${sig}`, config, now)).toBe(false);
    expect(verifySession(`${expiry}.${sig.slice(0, -2)}xx`, config, now)).toBe(false);
    expect(verifySession(`${expiry}.${sig}.extra`, config, now)).toBe(false);
    expect(verifySession("n'importe-quoi", config, now)).toBe(false);
    expect(verifySession(undefined, config, now)).toBe(false);
  });

  it("changer le mot de passe ou le secret invalide les sessions", () => {
    const cookie = signSession(config);
    expect(verifySession(cookie, { ...config, password: "un-autre-mot-de-passe" })).toBe(false);
    expect(verifySession(cookie, { ...config, secret: "t".repeat(40) })).toBe(false);
  });
});
