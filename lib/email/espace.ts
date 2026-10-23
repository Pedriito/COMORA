import 'server-only'
import { Resend } from 'resend'
import { appUrl, siteConfig, siteUrl as getSiteUrl } from '@/lib/site'
import { daysFromNow, signToken, verifyToken } from '@/lib/tokens'
import { resolveTimeZone } from '@/lib/timezone'
import { emailButton, emailInfoCard, emailParagraph, esc, renderEmail } from '@/lib/email/layout'

/** Objet des jetons signés des liens de réponse à une affectation. */
export const ASSIGNMENT_RESPONSE_PURPOSE = 'assignment-response'

/** Jeton signé (30 jours) qui porte l'id de l'affectation dans les liens de réponse. */
export function assignmentResponseToken(assignmentId: string): string {
  return signToken(ASSIGNMENT_RESPONSE_PURPOSE, assignmentId, daysFromNow(30))
}

/** Id de l'affectation d'un jeton de réponse valide, sinon null. */
export function verifyAssignmentResponseToken(token: string): string | null {
  const id = verifyToken(ASSIGNMENT_RESPONSE_PURPOSE, token)
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null
}

/** Adresse absolue d'une page de l'espace (en local, appUrl() est relative). */
function appLink(path: string): string {
  const url = appUrl(path)
  return url.startsWith('http') ? url : `${getSiteUrl()}${path}`
}

/** Lien de réponse d'un bénévole (confirmer ou décliner). */
export function memberResponseUrl(assignmentId: string, status: 'confirmed' | 'declined'): string {
  return `${getSiteUrl()}/espace/repondre/${assignmentResponseToken(assignmentId)}?status=${status}`
}

/** Lien de réponse d'un invité externe. */
export function externalResponseUrl(assignmentId: string): string {
  return `${getSiteUrl()}/espace/repondre-ext/${assignmentResponseToken(assignmentId)}`
}

/** Date longue et heure d'un service, dans le fuseau de l'église. */
function serviceDateTime(serviceDate: string, timeZone: string) {
  const tz = resolveTimeZone(timeZone)
  const d = new Date(serviceDate)
  return {
    date: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }),
    time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz }),
  }
}

/** "25 mai", "3 décembre", etc. — format court pour les objets d'email */
function shortDate(serviceDate: string, timeZone: string): string {
  return new Date(serviceDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: resolveTimeZone(timeZone),
  })
}

/** Construit l'objet email : "Culte du dimanche · 25 mai — Présidence" */
function buildSubject(planTitle: string, serviceDate: string, positionName: string | null, timeZone: string): string {
  const date = shortDate(serviceDate, timeZone)
  const position = positionName ? ` — ${positionName}` : ''
  return `${planTitle} · ${date}${position}`
}

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) throw new Error('RESEND_API_KEY manquante ou vide')
  return new Resend(key)
}

/** Expéditeur des e-mails de l'espace (domaine vérifié dans Resend). */
function emailFrom(): string {
  return process.env.RESEND_FROM?.trim() || `${siteConfig.name} <bonjour@comora.fr>`
}

async function deliver(label: string, { to, subject, html }: { to: string; subject: string; html: string }) {
  const { error } = await getResend().emails.send({ from: emailFrom(), to, subject, html })
  if (error) throw new Error(`Resend ${label}: ${error.message}`)
}

/** Nom de l'église pour les objets : « … — Église de la Source ». */
function churchSuffix(churchName?: string | null) {
  const name = churchName?.trim()
  return name ? ` — ${name}` : ''
}

/** Encadré du service : titre, date, équipe, poste. */
function serviceCard(
  { planTitle, serviceDate, positionName, teamName, timeZone }: { planTitle: string; serviceDate: string; positionName: string | null; teamName: string | null; timeZone: string },
  roleLabel: 'Poste' | 'Rôle',
  tone: 'info' | 'warning' = 'info',
) {
  const { date, time } = serviceDateTime(serviceDate, timeZone)
  return emailInfoCard(
    [
      esc(planTitle),
      `<span style="text-transform:capitalize;">${date}</span> à ${time}`,
      teamName ? `Équipe : ${esc(teamName)}` : null,
      positionName ? `${roleLabel} : ${esc(positionName)}` : null,
    ],
    tone,
  )
}

const IGNORE_HINT = "Si ce message ne vous concerne pas, vous pouvez simplement l'ignorer."

export async function sendInviteEmail({
  to,
  firstName,
  inviteLink,
  churchName,
}: {
  to: string
  firstName: string
  inviteLink: string
  churchName?: string | null
}) {
  const church = churchName?.trim()
  await deliver('sendInviteEmail', {
    to,
    subject: church ? `Bienvenue dans l'espace de ${church}` : `Bienvenue sur ${siteConfig.name}`,
    html: renderEmail({
      preheader: 'Créez votre mot de passe pour accéder à votre espace.',
      heading: 'Bienvenue !',
      churchName: church,
      body:
        emailParagraph(`Bonjour ${esc(firstName)},`) +
        emailParagraph(
          church
            ? `<strong>${esc(church)}</strong> vous invite à rejoindre son espace sur ${siteConfig.name}, pour retrouver vos plannings, vos équipes et les informations de l'église.`
            : `Vous êtes invité(e) à rejoindre l'espace de votre église sur ${siteConfig.name}.`,
        ) +
        emailParagraph('Pour commencer, choisissez votre mot de passe :') +
        emailButton({ label: 'Créer mon mot de passe', url: inviteLink }) +
        emailParagraph('<span style="font-size:14px;">Ce lien est valable 72 heures et ne peut servir qu’une seule fois.</span>'),
      reason: `Vous recevez ce message parce que ${church ? `${church} a` : 'votre église a'} saisi votre adresse pour vous inviter. ${IGNORE_HINT}`,
    }),
  })
}

export async function sendPasswordResetEmail({
  to,
  firstName,
  resetLink,
}: {
  to: string
  firstName: string
  resetLink: string
}) {
  await deliver('sendPasswordResetEmail', {
    to,
    subject: `Réinitialisation de votre mot de passe — ${siteConfig.name}`,
    html: renderEmail({
      preheader: 'Choisissez un nouveau mot de passe.',
      heading: 'Nouveau mot de passe',
      body:
        emailParagraph(`Bonjour ${esc(firstName)},`) +
        emailParagraph(`Vous avez demandé à réinitialiser le mot de passe de votre espace ${siteConfig.name}. Cliquez sur le bouton pour en choisir un nouveau.`) +
        emailButton({ label: 'Choisir un nouveau mot de passe', url: resetLink }) +
        emailParagraph('<span style="font-size:14px;">Ce lien est valable 72 heures et ne peut servir qu’une seule fois.</span>'),
      reason: `Vous recevez ce message suite à une demande de réinitialisation. Si vous n'en êtes pas à l'origine, ignorez-le : votre mot de passe reste inchangé.`,
    }),
  })
}

export async function sendCancellationNotificationEmail({
  to,
  volunteerName,
  planTitle,
  serviceDate,
  positionName,
  teamName,
  timeZone,
  churchName,
}: {
  to: string
  volunteerName: string
  planTitle: string
  serviceDate: string
  positionName: string | null
  teamName: string | null
  /** Fuseau de l'église (churches.timezone) */
  timeZone: string
  churchName?: string | null
}) {
  await deliver('sendCancellationEmail', {
    to,
    subject: `Désistement : ${volunteerName} — ${planTitle}${churchSuffix(churchName)}`,
    html: renderEmail({
      preheader: `${volunteerName} ne pourra pas participer à ${planTitle}.`,
      heading: 'Un désistement à gérer',
      churchName,
      body:
        emailParagraph(`<strong>${esc(volunteerName)}</strong> s'est désisté(e) pour le service suivant :`) +
        serviceCard({ planTitle, serviceDate, positionName, teamName, timeZone }, 'Poste', 'warning') +
        emailParagraph('Il faudra prévoir un remplaçant pour ce poste.') +
        emailButton({ label: 'Ouvrir la planification', url: appLink('/espace/admin/plans') }),
      reason: `Vous recevez ce message car vous êtes responsable${churchName ? ` dans ${churchName}` : ''} sur ${siteConfig.name}.`,
    }),
  })
}

export async function sendReminderEmail({
  to,
  firstName,
  planTitle,
  serviceDate,
  positionName,
  teamName,
  assignmentId,
  daysLeft,
  isPending = false,
  isExternal = false,
  timeZone,
  churchName,
}: {
  to: string
  firstName: string
  planTitle: string
  serviceDate: string
  positionName: string | null
  teamName: string | null
  assignmentId: string
  daysLeft: number
  isPending?: boolean
  isExternal?: boolean
  /** Fuseau de l'église (churches.timezone) */
  timeZone: string
  churchName?: string | null
}) {
  const responseUrl = isExternal ? externalResponseUrl(assignmentId) : appLink('/espace/dashboard')
  const label = daysLeft === 1 ? 'demain' : `dans ${daysLeft} jours`
  const urgent = isPending || daysLeft <= 2

  const intro = isPending
    ? `Vous êtes prévu(e) <strong>${label}</strong> pour le service suivant, mais vous n'avez pas encore confirmé votre participation.`
    : `Un petit rappel : vous êtes prévu(e) <strong>${label}</strong> pour le service suivant.`

  const subjectPrefix = isPending ? `Confirmation attendue (${label})` : `Rappel (${label})`

  const cta = isPending && !isExternal
    ? emailButton({ label: 'Confirmer ma présence', url: responseUrl }) +
      emailParagraph(`<span style="font-size:14px;">Si vous ne pouvez pas venir, merci de le signaler depuis <a href="${responseUrl}" style="color:#3d4f48;">votre espace</a> pour que l'équipe puisse trouver un remplaçant.</span>`)
    : emailButton({ label: isExternal ? 'Voir les détails' : 'Ouvrir mon espace', url: responseUrl })

  await deliver('sendReminderEmail', {
    to,
    subject: `${subjectPrefix} · ${buildSubject(planTitle, serviceDate, positionName, timeZone)}${churchSuffix(churchName)}`,
    html: renderEmail({
      preheader: `${planTitle} — ${shortDate(serviceDate, timeZone)}`,
      heading: isPending ? 'Votre présence est attendue' : 'À bientôt !',
      churchName,
      body:
        emailParagraph(`Bonjour ${esc(firstName)},`) +
        emailParagraph(intro) +
        serviceCard({ planTitle, serviceDate, positionName, teamName, timeZone }, 'Poste', urgent ? 'warning' : 'info') +
        cta,
      reason: `Vous recevez ce rappel car vous êtes inscrit(e) à ce service${churchName ? ` de ${churchName}` : ''}. ${IGNORE_HINT}`,
    }),
  })
}

export async function sendExternalGuestInvitationEmail({
  to,
  guestName,
  planTitle,
  serviceDate,
  positionName,
  teamName,
  assignmentId,
  timeZone,
  churchName,
}: {
  to: string
  guestName: string
  planTitle: string
  serviceDate: string
  positionName: string | null
  teamName: string | null
  assignmentId: string
  /** Fuseau de l'église (churches.timezone) */
  timeZone: string
  churchName?: string | null
}) {
  const church = churchName?.trim()
  await deliver('sendExternalGuestInvitationEmail', {
    to,
    subject: `${buildSubject(planTitle, serviceDate, positionName, timeZone)}${churchSuffix(church)}`,
    html: renderEmail({
      preheader: `${church ?? 'Une église'} vous invite à participer à ${planTitle}.`,
      heading: 'Vous êtes invité(e)',
      churchName: church,
      body:
        emailParagraph(`Bonjour ${esc(guestName)},`) +
        emailParagraph(`${church ? `<strong>${esc(church)}</strong> vous invite` : 'Vous êtes invité(e)'} à participer au service suivant :`) +
        serviceCard({ planTitle, serviceDate, positionName, teamName, timeZone }, 'Rôle') +
        emailParagraph('Merci de nous indiquer si vous pouvez participer :') +
        emailButton({ label: "Répondre à l'invitation", url: externalResponseUrl(assignmentId) }),
      reason: `Vous recevez ce message car ${church ? `${church} a` : 'une église a'} saisi votre adresse pour vous inviter. ${IGNORE_HINT}`,
    }),
  })
}

export async function sendPlanAssignmentEmail({
  to,
  firstName,
  planTitle,
  serviceDate,
  positionName,
  teamName,
  assignmentId,
  timeZone,
  churchName,
}: {
  to: string
  firstName: string
  planTitle: string
  serviceDate: string
  positionName: string | null
  teamName: string | null
  assignmentId: string
  /** Fuseau de l'église (churches.timezone) */
  timeZone: string
  churchName?: string | null
}) {
  await deliver('sendPlanAssignmentEmail', {
    to,
    subject: `${buildSubject(planTitle, serviceDate, positionName, timeZone)}${churchSuffix(churchName)}`,
    html: renderEmail({
      preheader: `Vous êtes prévu(e) pour ${planTitle}. Confirmez en un clic.`,
      heading: 'Vous êtes prévu(e) pour un service',
      churchName,
      body:
        emailParagraph(`Bonjour ${esc(firstName)},`) +
        emailParagraph('Vous avez été planifié(e) pour le service suivant :') +
        serviceCard({ planTitle, serviceDate, positionName, teamName, timeZone }, 'Poste') +
        emailParagraph('Pouvez-vous nous confirmer votre disponibilité ?') +
        emailButton({ label: 'Je confirme', url: memberResponseUrl(assignmentId, 'confirmed'), tone: 'positive' }) +
        emailButton({ label: 'Je ne peux pas', url: memberResponseUrl(assignmentId, 'declined'), tone: 'negative' }) +
        emailParagraph(`<span style="font-size:14px;"><a href="${appLink('/espace/dashboard')}" style="color:#3d4f48;">Ouvrir mon espace</a></span>`),
      reason: `Vous recevez ce message car vous êtes membre de l'équipe${churchName ? ` de ${churchName}` : ''}. ${IGNORE_HINT}`,
    }),
  })
}

/** Alerte interne : une église vient de prendre l'offre Signature (accompagnement à lancer). */
export async function sendSignatureSubscribedEmail({
  churchName,
  interval,
}: {
  churchName: string
  interval: 'month' | 'year'
}) {
  const to = process.env.PLATFORM_NOTIFY_EMAIL?.trim()
  if (!to) {
    console.warn('[billing] PLATFORM_NOTIFY_EMAIL non défini : alerte Signature non envoyée')
    return
  }
  await deliver('sendSignatureSubscribedEmail', {
    to,
    subject: `Nouvelle église Signature : ${churchName}`,
    html: renderEmail({
      preheader: `${churchName} vient de s'abonner à l'offre Signature.`,
      heading: 'Nouvelle église Signature',
      body:
        emailParagraph(`<strong>${esc(churchName)}</strong> vient de s'abonner à l'offre <strong>Signature</strong> (${interval === 'year' ? 'annuel' : 'mensuel'}).`) +
        emailParagraph("Il faut prendre contact pour lancer l'accompagnement."),
      reason: 'Alerte interne Comora.',
    }),
  })
}
