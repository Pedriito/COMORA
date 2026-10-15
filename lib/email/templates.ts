import { siteConfig } from "@/lib/site";

/*
 * E-mails transactionnels aux couleurs de Comora. HTML en tableaux et styles
 * en ligne : c'est ce que les clients mail (Gmail, Outlook, Apple Mail)
 * affichent de façon fiable. Chaque e-mail a aussi une version texte.
 */

export type EmailContent = { subject: string; html: string; text: string };

const BRAND = {
  ink: "#16241f",
  inkLight: "#1f362e",
  sand: "#efece3",
  sandLight: "#f6f4ee",
  line: "#e4e0d4",
  coral: "#e2693c",
  dark: "#1c2b2d",
  slate: "#46555a",
  mist: "#c9d3cf",
  serif: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  sans: "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Prénom pour la salutation (« Bonjour Marie, »), à défaut le nom complet. */
function firstName(nom: string) {
  return nom.trim().split(/\s+/)[0] || nom;
}

const paragraph = (html: string) =>
  `<p style="margin:0 0 18px;font-family:${BRAND.sans};font-size:16px;line-height:1.6;color:${BRAND.slate};">${html}</p>`;

function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 26px;">
  <tr><td style="border-radius:999px;background:${BRAND.coral};">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 30px;font-family:${BRAND.sans};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

function layout({ preheader, title, body }: { preheader: string; title: string; body: string }) {
  // Fichier stable dans public/ (l’icône d’app de Next peut changer d’adresse).
  const logo = `${siteConfig.url}/email/logo.png`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.sand};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.sand};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td style="background:${BRAND.ink};border-radius:24px 24px 0 0;padding:28px 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;padding-right:12px;"><img src="${logo}" width="40" height="40" alt="" style="display:block;border-radius:10px;"></td>
          <td style="vertical-align:middle;font-family:${BRAND.serif};font-size:30px;font-weight:600;color:${BRAND.sand};">Comora</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;padding:40px 36px 18px;border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};">
        <h1 style="margin:0 0 22px;font-family:${BRAND.serif};font-size:34px;line-height:1.1;font-weight:600;color:${BRAND.dark};">${escapeHtml(title)}</h1>
        ${body}
      </td></tr>
      <tr><td style="background:${BRAND.inkLight};border-radius:0 0 24px 24px;padding:22px 36px;font-family:${BRAND.sans};font-size:13px;line-height:1.6;color:${BRAND.mist};">
        <strong style="color:${BRAND.sand};">${escapeHtml(siteConfig.tagline)}</strong><br>
        Communiquer · Organiser · Rassembler — <a href="${siteConfig.url}" style="color:${BRAND.mist};">${escapeHtml(siteConfig.url.replace(/^https?:\/\//, ""))}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const signature = "L’équipe Comora";

export function invitationEmail({
  nom,
  eglise,
  link,
  expiresAt,
}: {
  nom: string;
  eglise: string;
  link: string;
  expiresAt: Date;
}): EmailContent {
  const until = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(
    expiresAt,
  );
  const subject = `${eglise} rejoint les églises fondatrices de Comora`;
  const title = "Bienvenue parmi les églises fondatrices";
  const html = layout({
    preheader: "Créez votre compte Comora : votre lien personnel vous attend.",
    title,
    body: [
      paragraph(`Bonjour ${escapeHtml(firstName(nom))},`),
      paragraph(
        `Bonne nouvelle&nbsp;: <strong style="color:${BRAND.dark};">${escapeHtml(eglise)}</strong> fait partie des 20 églises fondatrices de Comora. Merci de votre confiance&nbsp;!`,
      ),
      paragraph(
        "Première étape&nbsp;: créez votre compte. C’est lui qui vous permettra d’entrer dans Comora et d’y inviter ensuite votre équipe.",
      ),
      button("Créer mon compte", link),
      paragraph(
        `Ce lien est personnel et valable jusqu’au ${escapeHtml(until)}. Ensuite, nous vous proposerons une visio d’une demi-heure pour installer Comora avec vous&nbsp;: équipes, services et invitations des bénévoles.`,
      ),
      paragraph(`À très vite,<br>${signature}`),
    ].join("\n"),
  });
  const text = `Bonjour ${firstName(nom)},

Bonne nouvelle : ${eglise} fait partie des 20 églises fondatrices de Comora. Merci de votre confiance !

Première étape : créez votre compte. C’est lui qui vous permettra d’entrer dans Comora et d’y inviter ensuite votre équipe.

Créer mon compte : ${link}

Ce lien est personnel et valable jusqu’au ${until}. Ensuite, nous vous proposerons une visio d’une demi-heure pour installer Comora avec vous : équipes, services et invitations des bénévoles.

À très vite,
${signature}`;
  return { subject, html, text };
}

export function refusalEmail({ nom, eglise }: { nom: string; eglise: string }): EmailContent {
  const subject = "Votre demande d’accès à Comora";
  const title = "Merci pour votre intérêt";
  const html = layout({
    preheader: "Nous vous ouvrirons l’accès dès la version publique de Comora.",
    title,
    body: [
      paragraph(`Bonjour ${escapeHtml(firstName(nom))},`),
      paragraph(
        `Merci d’avoir pris le temps de nous présenter <strong style="color:${BRAND.dark};">${escapeHtml(eglise)}</strong>. Vos réponses nous ont beaucoup appris.`,
      ),
      paragraph(
        "Pour l’accès anticipé, nous accompagnons volontairement un petit nombre d’églises dont l’organisation est très proche de la nôtre, afin de bien les suivre. Nous préférons donc vous donner accès lorsque la version publique sera en ligne, le 1er décembre&nbsp;: vous profiterez alors d’un Comora plus complet, avec un accompagnement à la hauteur.",
      ),
      paragraph("Nous vous écrirons dès l’ouverture. Vous n’avez rien à refaire d’ici là."),
      button("Découvrir Comora", siteConfig.url),
      paragraph(`Avec toute notre reconnaissance,<br>${signature}`),
    ].join("\n"),
  });
  const text = `Bonjour ${firstName(nom)},

Merci d’avoir pris le temps de nous présenter ${eglise}. Vos réponses nous ont beaucoup appris.

Pour l’accès anticipé, nous accompagnons volontairement un petit nombre d’églises dont l’organisation est très proche de la nôtre, afin de bien les suivre. Nous préférons donc vous donner accès lorsque la version publique sera en ligne, le 1er décembre : vous profiterez alors d’un Comora plus complet, avec un accompagnement à la hauteur.

Nous vous écrirons dès l’ouverture. Vous n’avez rien à refaire d’ici là.

Découvrir Comora : ${siteConfig.url}

Avec toute notre reconnaissance,
${signature}`;
  return { subject, html, text };
}
