export const siteConfig = {
  name: "Comora",
  tagline: "Votre église, rassemblée.",
  /** Signature de marque : pieds de page, e-mails, notifications. */
  signature: "Comora — Votre église, rassemblée.",
  description:
    "La plateforme tout-en-un pensée pour les églises francophones : plannings des bénévoles, communication, chants et événements. Sur le web, iPhone et Android.",
  /** URL publique du site (balises Open Graph, sitemap, liens des e-mails). */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://comora.fr").replace(/\/$/, ""),
  /**
   * Adresse affichée quand l'envoi du formulaire échoue
   * (« … ou écrivez-nous à … »). Laisser vide pour ne rien afficher.
   */
  contactEmail: "",
  /** Adresse d'aide affichée dans l'espace (« Aide & contact »). */
  supportEmail: "bonjour@comora.fr",
};

/** URL de base des liens envoyés par e-mail ou partagés (lien d'invitation, calendrier…). */
export function siteUrl(): string {
  return siteConfig.url;
}

/**
 * Adresse de l'espace de gestion (app.comora.fr). En développement, chemins relatifs :
 * la landing et l'espace tournent sur le même serveur local. Surchargeable par
 * NEXT_PUBLIC_APP_URL (par exemple pour une prévisualisation).
 */
export function appUrl(path = ""): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "comora.fr";
  const base = explicit ?? (process.env.NODE_ENV === "production" ? `https://app.${root}` : "");
  return `${base.replace(/\/$/, "")}${path}`;
}
