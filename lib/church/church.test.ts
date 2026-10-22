import { describe, expect, it } from "vitest";
import { readCreateChurchForm, validateCreateChurch, type CreateChurchInput } from "./create";
import { founderDeadline, isFounderAt, trialEndsAt, TRIAL_DAYS } from "./founder";
import { slugify, validateSlug } from "./slug";

describe("slugify", () => {
  it.each([
    ["Église de la Source", "eglise-de-la-source"],
    ["  Église  Évangélique   Béthel  ", "eglise-evangelique-bethel"],
    ["Foi & Vie", "foi-et-vie"],
    ["Assemblée de Dieu — Lyon 3e", "assemblee-de-dieu-lyon-3e"],
    ["Église « L'Arche » ", "eglise-l-arche"],
    ["!!!", ""],
  ])("%s → %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("coupe à 40 caractères sans laisser de tiret final", () => {
    const slug = slugify("Église évangélique protestante de la grande ville de demain et d'aujourd'hui");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("validateSlug", () => {
  it("accepte une adresse correcte", () => {
    expect(validateSlug("la-source")).toBeNull();
    expect(validateSlug("eglise-77")).toBeNull();
  });

  it.each([
    ["ab", "too_short"],
    ["a".repeat(41), "too_long"],
    ["La-Source", "invalid"],
    ["église", "invalid"],
    ["-source", "invalid"],
    ["source-", "invalid"],
    ["la--source", "invalid"],
    ["la source", "invalid"],
    ["la_source", "invalid"],
    ["la.source", "invalid"],
  ])("refuse %s (%s)", (slug, error) => {
    expect(validateSlug(slug)).toBe(error);
  });

  it.each(["app", "www", "admin", "api", "aide", "blog", "status", "demo", "espace", "cgv", "mail"])(
    "réserve %s",
    (slug) => {
      expect(validateSlug(slug)).toBe("reserved");
    },
  );
});

describe("validateCreateChurch", () => {
  const valid: CreateChurchInput = {
    name: "Église de la Source",
    city: "Lyon",
    country: "FR",
    size: "30_100",
    slug: "la-source",
    accept: true,
  };

  it("accepte une saisie complète", () => {
    expect(validateCreateChurch(valid)).toEqual({
      ok: true,
      values: { name: "Église de la Source", city: "Lyon", country: "FR", size: "30_100", slug: "la-source" },
    });
  });

  it("exige l'acceptation des CGV et de la politique de confidentialité", () => {
    const result = validateCreateChurch({ ...valid, accept: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.accept).toMatch(/conditions générales de vente/);
  });

  it("signale chaque champ invalide", () => {
    const result = validateCreateChurch({ name: "", city: "", country: "ZZ", size: "gros", slug: "app", accept: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["city", "country", "name", "size", "slug"]);
  });

  it("refuse un pays ou une taille hors liste (formulaire trafiqué)", () => {
    expect(validateCreateChurch({ ...valid, country: "<script>" }).ok).toBe(false);
    expect(validateCreateChurch({ ...valid, size: "lt30; drop table" }).ok).toBe(false);
  });

  it("lit le formulaire en nettoyant les espaces et la casse de l'adresse", () => {
    const form = new FormData();
    form.set("name", "  Église   de la Source ");
    form.set("city", " Lyon ");
    form.set("country", "FR");
    form.set("size", "lt30");
    form.set("slug", " LA-SOURCE ");
    form.set("accept", "on");
    expect(readCreateChurchForm(form)).toEqual({
      name: "Église de la Source", city: "Lyon", country: "FR", size: "lt30", slug: "la-source", accept: true,
    });
    form.delete("accept");
    expect(readCreateChurchForm(form).accept).toBe(false);
  });
});

describe("offre fondateurs et essai", () => {
  const deadline = founderDeadline("2027-01-20T23:59:59+01:00");

  it("est fondatrice avant la date limite, y compris le dernier jour", () => {
    expect(isFounderAt(new Date("2026-11-05T10:00:00Z"), deadline)).toBe(true);
    expect(isFounderAt(new Date("2027-01-20T22:59:00Z"), deadline)).toBe(true);
  });

  it("n'est plus fondatrice après la date limite", () => {
    expect(isFounderAt(new Date("2027-01-20T23:00:01Z"), deadline)).toBe(false);
    expect(isFounderAt(new Date("2027-02-01T00:00:00Z"), deadline)).toBe(false);
  });

  it("personne n'est fondateur si la date limite manque ou est illisible", () => {
    expect(founderDeadline(undefined)).toBeNull();
    expect(founderDeadline("bientôt")).toBeNull();
    expect(isFounderAt(new Date("2026-11-05"), null)).toBe(false);
  });

  it("l'essai dure 30 jours", () => {
    expect(TRIAL_DAYS).toBe(30);
    const start = new Date("2026-11-05T10:00:00Z");
    expect(trialEndsAt(start).toISOString()).toBe("2026-12-05T10:00:00.000Z");
  });
});

import { passwordProblem, readSignupForm, validateSignup } from "./signup";

describe("inscription", () => {
  const valid = { firstName: "Camille", lastName: "Martin", email: "camille@exemple.fr", password: "Motdepasse2027", confirm: "Motdepasse2027" };

  it("accepte une saisie complète", () => {
    expect(validateSignup(valid, true)).toEqual({});
  });

  it.each([
    ["court", "Ab1"],
    ["sans majuscule", "motdepasse2027"],
    ["sans minuscule", "MOTDEPASSE2027"],
    ["sans chiffre", "MotDePasseLong"],
    ["trop long", "Aa1" + "x".repeat(80)],
  ])("refuse un mot de passe %s", (_label, password) => {
    expect(passwordProblem(password)).not.toBeNull();
  });

  it("vérifie la confirmation du mot de passe", () => {
    expect(validateSignup({ ...valid, confirm: "autre" }, true).confirm).toBeDefined();
  });

  it("le lien magique n'exige pas de mot de passe", () => {
    expect(validateSignup({ ...valid, password: "", confirm: "" }, false)).toEqual({});
    expect(validateSignup({ ...valid, password: "", confirm: "" }, true).password).toBeDefined();
  });

  it("signale prénom, nom et e-mail manquants ou invalides", () => {
    const errors = validateSignup({ ...valid, firstName: " ", lastName: "", email: "pas-un-email" }, false);
    expect(Object.keys(errors).sort()).toEqual(["email", "firstName", "lastName"]);
  });

  it("lit le formulaire en normalisant l'e-mail", () => {
    const form = new FormData();
    form.set("first_name", "  Camille ");
    form.set("last_name", "Martin");
    form.set("email", "  Camille@Exemple.FR ");
    form.set("password", "x");
    expect(readSignupForm(form)).toMatchObject({ firstName: "Camille", email: "camille@exemple.fr" });
  });
});
