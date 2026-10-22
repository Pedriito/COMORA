/*
 * Documents légaux acceptés à la création d'un espace. La version est enregistrée
 * avec chaque acceptation (table legal_acceptances) : changer le texte d'un
 * document impose d'incrémenter sa version.
 *
 * Les textes actuels sont provisoires (étape 10 : textes définitifs fournis par Comora).
 */
export const LEGAL_DOCUMENTS = {
  cgv: {
    label: "conditions générales de vente",
    title: "Conditions générales de vente",
    path: "/cgv",
    version: "2026-10-provisoire",
  },
  confidentialite: {
    label: "politique de confidentialité",
    title: "Politique de confidentialité",
    path: "/confidentialite",
    version: "2026-10-provisoire",
  },
} as const;

export type LegalDocument = keyof typeof LEGAL_DOCUMENTS;
