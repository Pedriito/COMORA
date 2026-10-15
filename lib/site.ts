export const siteConfig = {
  name: "Comora",
  tagline: "Votre église, rassemblée.",
  description:
    "La plateforme tout-en-un pensée pour les églises francophones : plannings des bénévoles, communication, chants et événements. Sur le web, iPhone et Android.",
  /** URL publique du site (balises Open Graph, sitemap). */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://comora.fr",
  /**
   * Adresse affichée quand l'envoi du formulaire échoue
   * (« … ou écrivez-nous à … »). Laisser vide pour ne rien afficher.
   */
  contactEmail: "",
};
