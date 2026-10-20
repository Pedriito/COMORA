import { describe, expect, it } from "vitest";
import { readWaitlistValues, validateWaitlist } from "@/lib/waitlist";

function form(entries: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  }
  return data;
}

const complete = {
  eglise: "  Église de l’Espérance ",
  ville: "Lyon",
  pays: "France",
  nom: "Marie Dupont",
  email: "marie@exemple.fr",
  taille: "30 à 100",
  role: "Pasteur",
  benevoles: "10 à 30",
  cultes: "2",
  priorite: "Communication",
  outil: "WhatsApp",
  multi_sites: "on",
  visio: "on",
  ministeres: ["Louange", "Jeunesse"],
};

describe("formulaire de demande d'accès", () => {
  it("accepte une demande complète et nettoie les valeurs", () => {
    const result = validateWaitlist(readWaitlistValues(form(complete)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row).toEqual({
      eglise: "Église de l’Espérance",
      ville: "Lyon",
      pays: "France",
      nom: "Marie Dupont",
      email: "marie@exemple.fr",
      role: "Pasteur",
      taille: "30 à 100",
      benevoles: "10 à 30",
      cultes: "2",
      multi_sites: true,
      ministeres: ["Louange", "Jeunesse"],
      priorite: "Communication",
      visio: true,
      outil: "WhatsApp",
    });
  });

  it("signale chaque champ obligatoire manquant", () => {
    const result = validateWaitlist(readWaitlistValues(form({ email: "pas-un-email" })));
    expect(result).toEqual({ ok: false, invalid: ["eglise", "ville", "nom", "pays", "email", "taille"] });
  });

  it("refuse un pays ou une taille hors liste (champs obligatoires)", () => {
    const result = validateWaitlist(readWaitlistValues(form({ ...complete, pays: "Atlantide", taille: "Immense" })));
    expect(result).toEqual({ ok: false, invalid: ["pays", "taille"] });
  });

  it("ignore les valeurs facultatives trafiquées", () => {
    const result = validateWaitlist(
      readWaitlistValues(
        form({
          ...complete,
          role: "Pape",
          benevoles: "1000",
          cultes: "<script>",
          priorite: "Tout",
          ministeres: ["Louange", "Piratage"],
          multi_sites: [],
          visio: [],
        }),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row).toMatchObject({
      role: null,
      benevoles: null,
      cultes: null,
      priorite: null,
      ministeres: ["Louange"],
      multi_sites: false,
      visio: false,
    });
  });

  it("tronque la réponse libre à la limite de la base", () => {
    const result = validateWaitlist(readWaitlistValues(form({ ...complete, outil: "x".repeat(500) })));
    expect(result.ok && result.row.outil?.length).toBe(300);
  });
});
