import { siteConfig } from '@/lib/site'

/**
 * Mise en page commune de tous les e-mails Comora : bandeau avec le logo,
 * contenu, bouton, puis pied de page (raison de l'envoi, aide, mentions).
 *
 * Mise en page en tableaux et styles en ligne : c'est ce que lisent les messageries
 * (Gmail, Outlook, Apple Mail). Aucune dépendance, utilisable côté serveur comme
 * dans le script qui génère les modèles de Supabase (scripts/build-auth-emails.ts).
 */

const COLORS = {
  ink: '#15261f',
  inkSoft: '#3d4f48',
  muted: '#6b7a74',
  sand: '#efece3',
  page: '#f4f2ec',
  card: '#ffffff',
  line: '#e3dfd3',
  accent: '#e2693c',
  button: '#1f362e',
  buttonText: '#f7f4ea',
} as const

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

/** Échappe une valeur saisie par un utilisateur avant de l'insérer dans le HTML. */
export function esc(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type EmailButton = { label: string; url: string; tone?: 'primary' | 'positive' | 'negative' }

const BUTTON_BG = { primary: COLORS.button, positive: '#2f7a4d', negative: '#a63d2f' } as const

/** Bouton « bulletproof » : un lien dans une cellule colorée, lisible sans images. */
export function emailButton({ label, url, tone = 'primary' }: EmailButton): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="display:inline-block;margin:0 8px 8px 0;"><tr><td style="border-radius:10px;background:${BUTTON_BG[tone]};"><a href="${url}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.2;color:${COLORS.buttonText};text-decoration:none;border-radius:10px;">${esc(label)}</a></td></tr></table>`
}

/** Encadré d'information (date, équipe, poste…). */
export function emailInfoCard(lines: Array<string | null | undefined>, tone: 'info' | 'warning' = 'info'): string {
  const border = tone === 'warning' ? COLORS.accent : COLORS.button
  const bg = tone === 'warning' ? '#fcf0e9' : '#f1f4ef'
  const rows = lines
    .filter((l): l is string => !!l)
    .map((l, i) => `<p style="margin:${i === 0 ? 0 : 6}px 0 0;font-size:${i === 0 ? 17 : 14}px;font-weight:${i === 0 ? 700 : 400};color:${i === 0 ? COLORS.ink : COLORS.inkSoft};">${l}</p>`)
    .join('')
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;"><tr><td style="background:${bg};border-left:4px solid ${border};border-radius:8px;padding:16px 18px;font-family:${FONT};">${rows}</td></tr></table>`
}

/** Paragraphe de texte courant. */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${COLORS.inkSoft};">${html}</p>`
}

export type EmailLayoutInput = {
  /** Texte d'aperçu affiché dans la liste de la boîte de réception. */
  preheader: string
  /** Titre en haut du message. */
  heading: string
  /** Corps du message (HTML déjà sûr : valeurs saisies passées par esc()). */
  body: string
  /** Nom de l'église concernée, rappelé sous le titre. */
  churchName?: string | null
  /** Pourquoi la personne reçoit ce message. */
  reason: string
  /** Adresse publique de Comora (logo et liens). Par défaut : celle du site. */
  baseUrl?: string
}

export function renderEmail({ preheader, heading, body, churchName, reason, baseUrl = siteConfig.url }: EmailLayoutInput): string {
  const root = baseUrl.replace(/\/$/, '')
  const church = churchName?.trim()
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.page};">
<tr><td align="center" style="padding:28px 14px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
    <tr><td style="background:${COLORS.ink};border-radius:14px 14px 0 0;padding:20px 28px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td style="vertical-align:middle;"><img src="${root}/email/logo.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:9px;"></td>
        <td style="vertical-align:middle;padding-left:12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;letter-spacing:0.01em;color:${COLORS.sand};">Comora</td>
      </tr></table>
    </td></tr>
    <tr><td style="height:4px;background:${COLORS.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="background:${COLORS.card};padding:34px 28px 22px;border-left:1px solid ${COLORS.line};border-right:1px solid ${COLORS.line};">
      ${church ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};">${esc(church)}</p>` : ''}
      <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;font-weight:700;color:${COLORS.ink};">${esc(heading)}</h1>
      ${body}
    </td></tr>
    <tr><td style="background:${COLORS.card};padding:0 28px 30px;border-left:1px solid ${COLORS.line};border-right:1px solid ${COLORS.line};border-bottom:1px solid ${COLORS.line};border-radius:0 0 14px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid ${COLORS.line};padding-top:18px;font-family:${FONT};font-size:13px;line-height:1.55;color:${COLORS.muted};">
        ${esc(reason)}<br>
        Une question ? Écrivez-nous à <a href="mailto:${siteConfig.supportEmail}" style="color:${COLORS.inkSoft};">${siteConfig.supportEmail}</a>.
      </td></tr></table>
    </td></tr>
    <tr><td align="center" style="padding:20px 10px 4px;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.muted};">
      <strong style="color:${COLORS.inkSoft};">Comora</strong> — ${esc(siteConfig.tagline)}<br>
      <a href="${root}" style="color:${COLORS.muted};">comora.fr</a> ·
      <a href="${root}/confidentialite" style="color:${COLORS.muted};">Confidentialité</a> ·
      <a href="${root}/cgv" style="color:${COLORS.muted};">Conditions générales</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}
