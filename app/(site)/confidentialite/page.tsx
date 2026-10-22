import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";
import { LEGAL_DOCUMENTS } from "@/lib/legal";

export const metadata: Metadata = {
  title: LEGAL_DOCUMENTS.confidentialite.title,
  alternates: { canonical: LEGAL_DOCUMENTS.confidentialite.path },
};

export default function ConfidentialitePage() {
  return (
    <LegalPage title={LEGAL_DOCUMENTS.confidentialite.title} version={LEGAL_DOCUMENTS.confidentialite.version}>
      <Section title="1. Qui est responsable de vos données&nbsp;?">
        <p>
          Pour les données de votre compte et de la facturation, le responsable du traitement est [raison sociale,
          adresse, contact]. Pour les données des membres d’une église (bénévoles, personnes suivies), l’église est
          responsable du traitement et Comora agit comme sous-traitant.
        </p>
      </Section>
      <Section title="2. Données collectées">
        <ul>
          <li>Compte&nbsp;: prénom, nom, adresse e-mail, mot de passe (jamais lu, stocké sous forme chiffrée).</li>
          <li>Église&nbsp;: nom, ville, pays, taille, adresse du site.</li>
          <li>Espace de gestion&nbsp;: personnes, équipes, plannings, chants, annonces, selon l’usage de l’église.</li>
          <li>Facturation&nbsp;: gérée par notre prestataire de paiement&nbsp;; nous ne voyons pas votre carte.</li>
        </ul>
        <p>
          Les données d’une église peuvent révéler des convictions religieuses&nbsp;: nous collectons le strict
          nécessaire, ne les utilisons jamais à des fins publicitaires et ne les partageons avec personne d’autre
          que nos sous-traitants techniques.
        </p>
      </Section>
      <Section title="3. Pourquoi, et sur quelle base">
        <p>
          Fournir le service (exécution du contrat), sécuriser les comptes, facturer, et répondre à vos demandes.
          [Bases légales et durées de conservation à détailler.]
        </p>
      </Section>
      <Section title="4. Où sont-elles hébergées&nbsp;?">
        <p>
          Base de données et fichiers&nbsp;: Union européenne (Paris). Application&nbsp;: fonctions hébergées à Paris.
          [Liste des sous-traitants et garanties de transfert à confirmer&nbsp;: hébergeur, e-mails, paiement.]
        </p>
      </Section>
      <Section title="5. Vos droits">
        <p>
          Accès, rectification, effacement, limitation, opposition, portabilité&nbsp;: écrivez-nous à [adresse
          e-mail]. Une église peut exporter ses données et supprimer son espace depuis ses réglages. Vous pouvez
          saisir la CNIL.
        </p>
      </Section>
      <Section title="6. Cookies">
        <p>
          Comora n’utilise que les cookies nécessaires à la connexion. Aucun outil de suivi publicitaire n’est
          installé. [À confirmer avec l’outil de mesure d’audience retenu.]
        </p>
      </Section>
    </LegalPage>
  );
}
