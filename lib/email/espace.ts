import { Resend } from 'resend'
import { siteConfig, siteUrl as getSiteUrl } from '@/lib/site'

/** "25 mai", "3 décembre", etc. — format court pour les objets d'email */
function shortDate(serviceDate: string): string {
  return new Date(serviceDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  })
}

/** Construit l'objet email : "Culte du dimanche · 25 mai — Présidence" */
function buildSubject(planTitle: string, serviceDate: string, positionName: string | null): string {
  const date = shortDate(serviceDate)
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

const FOOTER = siteConfig.signature

export async function sendInviteEmail({
  to,
  firstName,
  inviteLink,
}: {
  to: string
  firstName: string
  inviteLink: string
}) {
  const resend = getResend()
  const { error } = await resend.emails.send({
    from: emailFrom(),
    to,
    subject: `Tu es invité(e) — ${siteConfig.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a2e2e;">
        <p style="margin-bottom:8px;">Bonjour ${firstName},</p>
        <p style="margin-bottom:24px;">
          Tu as été invité(e) à rejoindre l'espace bénévoles de ton église sur <strong>${siteConfig.name}</strong>.
          Clique sur le bouton ci-dessous pour créer ton mot de passe et accéder à ton espace.
        </p>
        <a href="${inviteLink}"
           style="display:inline-block;background:#3D7D85;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          Créer mon mot de passe →
        </a>
        <p style="margin-top:32px;font-size:12px;color:#999;">
          ${FOOTER}<br>
          Si tu n'es pas concerné(e) par ce message, ignore-le.
        </p>
      </div>
    `,
  })
  if (error) throw new Error(`Resend sendInviteEmail: ${error.message} (to: ${to})`)
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
  const resend = getResend()
  const { error } = await resend.emails.send({
    from: emailFrom(),
    to,
    subject: `Réinitialisation de ton mot de passe — ${siteConfig.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a2e2e;">
        <p style="margin-bottom:8px;">Bonjour ${firstName},</p>
        <p style="margin-bottom:24px;">
          Tu as demandé à réinitialiser ton mot de passe pour ton espace <strong>${siteConfig.name}</strong>.
          Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe.
        </p>
        <a href="${resetLink}"
           style="display:inline-block;background:#3D7D85;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          Réinitialiser mon mot de passe →
        </a>
        <p style="margin-top:32px;font-size:12px;color:#999;">
          ${FOOTER}<br>
          Si tu n'es pas à l'origine de cette demande, ignore ce message.
        </p>
      </div>
    `,
  })
  if (error) throw new Error(`Resend sendPasswordResetEmail: ${error.message} (to: ${to})`)
}

export async function sendCancellationNotificationEmail({
  to,
  volunteerName,
  planTitle,
  serviceDate,
  positionName,
  teamName,
}: {
  to: string
  volunteerName: string
  planTitle: string
  serviceDate: string
  positionName: string | null
  teamName: string | null
}) {
  const date = new Date(serviceDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const time = new Date(serviceDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  })
  const siteUrl = getSiteUrl()
  const resend = getResend()

  const { error: errCancel } = await resend.emails.send({
    from: emailFrom(),
    to,
    subject: `Désistement : ${volunteerName} — ${planTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a2e2e;">
        <p style="margin-bottom:8px;">Bonjour,</p>
        <p style="margin-bottom:16px;">
          <strong>${volunteerName}</strong> s'est désisté(e) pour le service suivant :
        </p>

        <div style="background:#fff7ed;border-radius:10px;padding:18px 20px;margin-bottom:20px;border-left:4px solid #f97316;">
          <p style="margin:0;font-size:16px;font-weight:600;">${planTitle}</p>
          <p style="margin:6px 0 0;color:#555;font-size:14px;text-transform:capitalize;">${date} à ${time}</p>
          ${teamName ? `<p style="margin:6px 0 0;color:#0d9488;font-size:14px;">Équipe : ${teamName}</p>` : ''}
          ${positionName ? `<p style="margin:6px 0 0;color:#0d9488;font-size:14px;">Poste : ${positionName}</p>` : ''}
        </div>

        <p style="margin-bottom:20px;color:#555;font-size:14px;">
          Il faudra prévoir un remplaçant pour ce poste.
        </p>

        <a href="${siteUrl}/espace/admin/plans"
           style="display:inline-block;background:#3D7D85;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Gérer la planification →
        </a>

        <p style="margin-top:32px;font-size:12px;color:#999;">
          ${FOOTER}
        </p>
      </div>
    `,
  })
  if (errCancel) throw new Error(`Resend sendCancellationEmail: ${errCancel.message} (to: ${to})`)
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
}) {
  const date = new Date(serviceDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const time = new Date(serviceDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  })
  const siteUrl = getSiteUrl()
  const resend = getResend()

  const responseUrl = isExternal
    ? `${siteUrl}/espace/repondre-ext/${assignmentId}`
    : `${siteUrl}/espace/dashboard`

  const label = daysLeft === 1 ? 'demain' : `dans ${daysLeft} jours`

  // Pour les pending : style orange urgent + message d'action
  // Pour les confirmed : style teal informatif
  const cardStyle = isPending
    ? 'background:#fff7ed;border-left:4px solid #f97316;'
    : daysLeft <= 2
      ? 'background:#fff7ed;border-left:4px solid #f97316;'
      : 'background:#f0faf9;border-left:4px solid #0d9488;'

  const intro = isPending
    ? `Tu es planifié(e) <strong>${label}</strong> pour le service suivant, mais tu n'as pas encore confirmé ta participation.`
    : `Rappel : tu es programmé(e) <strong>${label}</strong> pour le service suivant.`

  const subjectPrefix = isPending ? `⚠ Confirmation attendue (${label})` : `Rappel (${label})`

  const ctaHtml = isPending && !isExternal ? `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;">
      <a href="${responseUrl}"
         style="display:inline-block;background:#3D7D85;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Confirmer ma présence →
      </a>
    </div>
    <p style="font-size:13px;color:#555;margin-bottom:24px;">
      Si tu ne peux pas venir, merci de le signaler depuis ton
      <a href="${responseUrl}" style="color:#3D7D85;">espace bénévole</a> pour que le coordinateur puisse trouver un remplaçant.
    </p>
  ` : `
    <a href="${responseUrl}"
       style="display:inline-block;background:#3D7D85;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:24px;">
      ${isExternal ? 'Voir les détails →' : 'Mon espace bénévole →'}
    </a>
  `

  const { error } = await resend.emails.send({
    from: emailFrom(),
    to,
    subject: `${subjectPrefix} · ${buildSubject(planTitle, serviceDate, positionName)}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a2e2e;">
        <p style="margin-bottom:8px;">Bonjour ${firstName},</p>
        <p style="margin-bottom:16px;">${intro}</p>

        <div style="${cardStyle}border-radius:10px;padding:18px 20px;margin-bottom:20px;">
          <p style="margin:0;font-size:16px;font-weight:600;">${planTitle}</p>
          <p style="margin:6px 0 0;color:#555;font-size:14px;text-transform:capitalize;">${date} à ${time}</p>
          ${teamName ? `<p style="margin:6px 0 0;color:#0d9488;font-size:14px;">Équipe : ${teamName}</p>` : ''}
          ${positionName ? `<p style="margin:6px 0 0;color:#0d9488;font-size:14px;">Poste : ${positionName}</p>` : ''}
        </div>

        ${ctaHtml}

        <p style="margin-top:32px;font-size:12px;color:#999;">
          ${FOOTER}<br>
          Si tu n'es pas concerné(e) par ce message, ignore-le.
        </p>
      </div>
    `,
  })
  if (error) throw new Error(`Resend sendReminderEmail: ${error.message} (to: ${to})`)
}

export async function sendExternalGuestInvitationEmail({
  to,
  guestName,
  planTitle,
  serviceDate,
  positionName,
  teamName,
  assignmentId,
}: {
  to: string
  guestName: string
  planTitle: string
  serviceDate: string
  positionName: string | null
  teamName: string | null
  assignmentId: string
}) {
  const date = new Date(serviceDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const time = new Date(serviceDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  })
  const siteUrl = getSiteUrl()
  const resend = getResend()

  const { error } = await resend.emails.send({
    from: emailFrom(),
    to,
    subject: buildSubject(planTitle, serviceDate, positionName),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a2e2e;">
        <p style="margin-bottom:8px;">Bonjour ${guestName},</p>
        <p style="margin-bottom:16px;">
          Vous êtes invité(e) à participer au service suivant :
        </p>

        <div style="background:#f0faf9;border-radius:10px;padding:18px 20px;margin-bottom:20px;border-left:4px solid #0d9488;">
          <p style="margin:0;font-size:16px;font-weight:600;">${planTitle}</p>
          <p style="margin:6px 0 0;color:#555;font-size:14px;text-transform:capitalize;">${date} à ${time}</p>
          ${teamName ? `<p style="margin:6px 0 0;color:#0d9488;font-size:14px;">Équipe : ${teamName}</p>` : ''}
          ${positionName ? `<p style="margin:6px 0 0;color:#0d9488;font-size:14px;">Rôle : ${positionName}</p>` : ''}
        </div>

        <p style="margin-bottom:20px;">
          Merci de nous indiquer si vous pouvez participer :
        </p>

        <a href="${siteUrl}/espace/repondre-ext/${assignmentId}"
           style="display:inline-block;background:#3D7D85;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Répondre à l'invitation →
        </a>

        <p style="margin-top:32px;font-size:12px;color:#999;">
          ${FOOTER}<br>
          Si vous n'êtes pas concerné(e) par ce message, ignorez-le.
        </p>
      </div>
    `,
  })
  if (error) throw new Error(`Resend sendExternalGuestInvitationEmail: ${error.message} (to: ${to})`)
}

export async function sendPlanAssignmentEmail({
  to,
  firstName,
  planTitle,
  serviceDate,
  positionName,
  teamName,
  assignmentId,
}: {
  to: string
  firstName: string
  planTitle: string
  serviceDate: string
  positionName: string | null
  teamName: string | null
  assignmentId: string
}) {
  const date = new Date(serviceDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const time = new Date(serviceDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  })
  const siteUrl = getSiteUrl()
  const resend = getResend()

  const { error: errPlan } = await resend.emails.send({
    from: emailFrom(),
    to,
    subject: buildSubject(planTitle, serviceDate, positionName),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a2e2e;">
        <p style="margin-bottom:8px;">Bonjour ${firstName},</p>
        <p style="margin-bottom:16px;">Tu as été planifié(e) pour le service suivant :</p>

        <div style="background:#f0faf9;border-radius:10px;padding:18px 20px;margin-bottom:20px;border-left:4px solid #0d9488;">
          <p style="margin:0;font-size:16px;font-weight:600;">${planTitle}</p>
          <p style="margin:6px 0 0;color:#555;font-size:14px;text-transform:capitalize;">${date} à ${time}</p>
          ${teamName ? `<p style="margin:6px 0 0;color:#0d9488;font-size:14px;">Équipe : ${teamName}</p>` : ''}
          ${positionName ? `<p style="margin:6px 0 0;color:#0d9488;font-size:14px;">Poste : ${positionName}</p>` : ''}
        </div>

        <p style="margin-bottom:20px;">
          Merci de confirmer ou décliner ta disponibilité :
        </p>

        <div style="display:flex;gap:12px;margin-bottom:24px;">
          <a href="${siteUrl}/espace/repondre/${assignmentId}?status=confirmed"
             style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            ✓ Je confirme
          </a>
          <a href="${siteUrl}/espace/repondre/${assignmentId}?status=declined"
             style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            ✕ Je décline
          </a>
        </div>

        <a href="${siteUrl}/espace/dashboard"
           style="display:inline-block;color:#0d9488;font-size:13px;text-decoration:underline;">
          Accéder à mon espace bénévole
        </a>

        <p style="margin-top:32px;font-size:12px;color:#999;">
          ${FOOTER}<br>
          Si tu n'es pas concerné(e) par ce message, ignore-le.
        </p>
      </div>
    `,
  })
  if (errPlan) throw new Error(`Resend sendPlanAssignmentEmail: ${errPlan.message} (to: ${to})`)
}
