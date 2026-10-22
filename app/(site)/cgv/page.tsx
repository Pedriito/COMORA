import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";
import { LEGAL_DOCUMENTS } from "@/lib/legal";

export const metadata: Metadata = {
  title: LEGAL_DOCUMENTS.cgv.title,
  alternates: { canonical: LEGAL_DOCUMENTS.cgv.path },
};

export default function CgvPage() {
  return (
    <LegalPage title={LEGAL_DOCUMENTS.cgv.title} version={LEGAL_DOCUMENTS.cgv.version}>
      <Section title="1. Objet">
        <p>
          Les présentes conditions encadrent l’utilisation de Comora, plateforme de gestion pour les églises
          (plannings des bénévoles, chants, communication, site de l’église), éditée par [raison sociale, forme
          juridique, capital, SIREN, adresse du siège].
        </p>
      </Section>
      <Section title="2. Création de l’espace et essai gratuit">
        <p>
          Toute personne majeure peut créer l’espace de son église. L’essai dure 30 jours, sans carte bancaire,
          avec les fonctions de l’offre Communauté. À la fin de l’essai sans abonnement, l’espace passe en
          lecture seule : aucune donnée n’est supprimée. [Durée de conservation avant suppression : 90 jours,
          avec avertissement préalable.]
        </p>
      </Section>
      <Section title="3. Offres et prix">
        <p>Prix en euros, TVA non applicable, article 293 B du CGI. Paiement mensuel ou annuel (−20&nbsp;%).</p>
        <ul>
          <li>Essentiel&nbsp;: 19&nbsp;€ par mois, jusqu’à 100 membres.</li>
          <li>Communauté&nbsp;: 49&nbsp;€ par mois, jusqu’à 500 membres, avec le site public de l’église.</li>
          <li>Signature&nbsp;: 119&nbsp;€ par mois, membres illimités, domaine et identité visuelle propres.</li>
        </ul>
        <p>
          Les églises fondatrices (inscrites avant le 20 janvier 2027) bénéficient d’un tarif réduit conservé tant
          que l’abonnement n’est pas résilié. [Conditions détaillées à compléter.]
        </p>
      </Section>
      <Section title="4. Paiement, résiliation, défaut de paiement">
        <p>
          Le paiement s’effectue en ligne par carte ou prélèvement SEPA. L’abonnement se résilie à tout moment
          depuis le portail de facturation&nbsp;; il reste actif jusqu’à la fin de la période payée. En cas de
          paiement refusé, un délai de grâce de 7 jours s’applique avant le passage en lecture seule.
          [Modalités à confirmer.]
        </p>
      </Section>
      <Section title="5. Données de l’église">
        <p>
          L’église reste propriétaire de ses données. Comora agit comme sous-traitant au sens du RGPD&nbsp;: un
          contrat de sous-traitance est mis à disposition. L’église peut exporter l’ensemble de ses données et
          supprimer définitivement son espace.
        </p>
      </Section>
      <Section title="6. Contenus et licences">
        <p>
          L’église est responsable des contenus qu’elle publie, notamment des paroles de chants et des textes
          bibliques qu’elle importe ou projette. Elle s’assure de détenir les licences nécessaires (par exemple
          LicenceChants ou CCLI pour la reproduction, la projection et la diffusion en ligne).
        </p>
      </Section>
      <Section title="7. Responsabilité, droit applicable">
        <p>[À compléter : limitation de responsabilité, disponibilité du service, droit français, tribunal compétent.]</p>
      </Section>
      <Section title="8. Contact">
        <p>[Adresse de contact et de réclamation.]</p>
      </Section>
    </LegalPage>
  );
}
