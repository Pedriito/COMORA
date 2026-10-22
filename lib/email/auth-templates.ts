import { emailButton, emailParagraph, renderEmail } from '@/lib/email/layout'

/**
 * Modèles des e-mails de connexion envoyés par Supabase Auth (confirmation,
 * lien magique, mot de passe oublié…). Les variables `{{ .… }}` sont remplies par
 * Supabase. Les fichiers de supabase/templates/ sont générés d'ici :
 * `npm run emails:build`. En production, les coller dans le tableau de bord
 * (Authentication → Emails) ou les envoyer par Resend (étape 8).
 */

const BASE_URL = 'https://comora.fr'
const IGNORE = "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : rien ne sera modifié."
const VALIDITY = '<span style="font-size:14px;">Ce lien est à usage unique et expire au bout d’une heure.</span>'

type AuthTemplate = { file: string; subject: string; html: string }

function template(file: string, subject: string, content: Parameters<typeof renderEmail>[0]): AuthTemplate {
  return { file, subject, html: renderEmail({ ...content, baseUrl: BASE_URL }) }
}

export const AUTH_TEMPLATES: Record<string, AuthTemplate> = {
  confirmation: template('confirmation.html', 'Confirmez votre adresse e-mail — Comora', {
    preheader: 'Une dernière étape pour créer l’espace de votre église.',
    heading: 'Confirmez votre adresse e-mail',
    body:
      emailParagraph('Bonjour et bienvenue sur Comora !') +
      emailParagraph('Il vous reste une étape avant de créer l’espace de votre église : confirmer que cette adresse est bien la vôtre.') +
      emailButton({ label: 'Confirmer mon adresse', url: '{{ .ConfirmationURL }}' }) +
      emailParagraph(VALIDITY),
    reason: 'Vous recevez ce message car cette adresse a été utilisée pour créer un compte Comora. Si ce n’est pas vous, ignorez-le : aucun compte ne sera activé.',
  }),
  magic_link: template('magic_link.html', 'Votre lien de connexion — Comora', {
    preheader: 'Connectez-vous en un clic, sans mot de passe.',
    heading: 'Votre lien de connexion',
    body:
      emailParagraph('Bonjour,') +
      emailParagraph('Cliquez sur le bouton ci-dessous pour vous connecter à Comora, sans mot de passe.') +
      emailButton({ label: 'Me connecter', url: '{{ .ConfirmationURL }}' }) +
      emailParagraph(VALIDITY),
    reason: `Vous recevez ce message suite à une demande de connexion. ${IGNORE}`,
  }),
  recovery: template('recovery.html', 'Réinitialisez votre mot de passe — Comora', {
    preheader: 'Choisissez un nouveau mot de passe.',
    heading: 'Nouveau mot de passe',
    body:
      emailParagraph('Bonjour,') +
      emailParagraph('Vous avez demandé à réinitialiser votre mot de passe Comora. Cliquez sur le bouton pour en choisir un nouveau.') +
      emailButton({ label: 'Choisir un nouveau mot de passe', url: '{{ .ConfirmationURL }}' }) +
      emailParagraph(VALIDITY),
    reason: `Vous recevez ce message suite à une demande de réinitialisation. ${IGNORE}`,
  }),
  invite: template('invite.html', 'Vous êtes invité(e) sur Comora', {
    preheader: 'Créez votre mot de passe pour accéder à votre espace.',
    heading: 'Bienvenue sur Comora',
    body:
      emailParagraph('Bonjour,') +
      emailParagraph('Vous êtes invité(e) à rejoindre l’espace de votre église sur Comora. Acceptez l’invitation pour créer votre accès.') +
      emailButton({ label: 'Accepter l’invitation', url: '{{ .ConfirmationURL }}' }),
    reason: 'Vous recevez ce message car une église a saisi votre adresse pour vous inviter. Si ce message ne vous concerne pas, ignorez-le.',
  }),
  email_change: template('email_change.html', 'Confirmez votre nouvelle adresse — Comora', {
    preheader: 'Confirmez le changement d’adresse e-mail de votre compte.',
    heading: 'Changement d’adresse e-mail',
    body:
      emailParagraph('Bonjour,') +
      emailParagraph('Vous avez demandé à utiliser {{ .NewEmail }} comme adresse de connexion à Comora. Confirmez ce changement :') +
      emailButton({ label: 'Confirmer le changement', url: '{{ .ConfirmationURL }}' }),
    reason: `Vous recevez ce message suite à une demande de changement d’adresse. ${IGNORE}`,
  }),
  reauthentication: template('reauthentication.html', 'Votre code de vérification — Comora', {
    preheader: 'Code à saisir pour confirmer votre identité.',
    heading: 'Code de vérification',
    body:
      emailParagraph('Bonjour,') +
      emailParagraph('Saisissez ce code dans Comora pour confirmer votre identité :') +
      '<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:32px;letter-spacing:0.3em;font-weight:700;color:#15261f;">{{ .Token }}</p>',
    reason: `Vous recevez ce message suite à une action sensible sur votre compte. ${IGNORE}`,
  }),
}
