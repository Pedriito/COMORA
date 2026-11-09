import { GRACE_DAYS, RETENTION_DAYS, TRIAL_DAYS } from '@/lib/billing/access'
import { appAbsoluteUrl, siteConfig } from '@/lib/site'
import { resolveTimeZone } from '@/lib/timezone'
import { emailButton, emailInfoCard, emailParagraph, esc, renderEmail } from '@/lib/email/layout'

/*
 * E-mails du cycle de vie d'une église, envoyés à ses administrateurs.
 *
 * Ce module est pur : il choisit QUELS messages sont dus (dueTimeKinds) et fabrique leur contenu
 * (renderLifecycleEmail). L'envoi, la réservation anti-doublon et la recherche des destinataires
 * sont dans lib/email/lifecycle-send.ts.
 */

export type LifecycleKind =
  | 'welcome'
  | 'no_import_d3'
  | 'trial_midway'
  | 'trial_ending_7'
  | 'trial_ending_1'
  | 'deletion_warning'
  | 'payment_failed'
  | 'subscription_confirmed'
  | 'cancellation_scheduled'
  | 'subscription_ended'

/** Clé d'unicité d'un message : son type, suivi d'un repère quand il peut légitimement se reproduire. */
export function emailKey(kind: LifecycleKind, discriminator?: string | Date | null): string {
  if (!discriminator) return kind
  const part = discriminator instanceof Date ? discriminator.toISOString().slice(0, 10) : discriminator
  return `${kind}:${part}`
}

const DAY = 864e5

/** Ce que le cron sait d'une église pour décider des messages dus. */
export type ChurchLifecycleRow = {
  id: string
  name: string
  timezone: string
  billing_status: string
  created_at: string
  trial_ends_at: string | null
  grace_ends_at: string | null
  deletion_scheduled_at: string | null
}

export type DueMessage = { kind: LifecycleKind; key: string }

/** Jours entiers écoulés depuis une date. */
const ageDays = (from: string, now: Date) => (now.getTime() - new Date(from).getTime()) / DAY

/**
 * Messages dus pour une église à un instant donné, selon sa date de création, de fin d'essai, etc.
 * Les fenêtres sont larges à dessein : si le cron saute une journée, le message part le lendemain
 * (la table email_sends empêche tout doublon). « no_import_d3 » demande en plus de savoir si l'église
 * a déjà des membres : c'est le cron qui le vérifie.
 */
export function dueTimeKinds(church: ChurchLifecycleRow, now: Date): DueMessage[] {
  const due: DueMessage[] = []
  const add = (kind: LifecycleKind, discriminator?: string | Date | null) => due.push({ kind, key: emailKey(kind, discriminator) })

  if (church.billing_status === 'trialing') {
    const age = ageDays(church.created_at, now)
    if (age >= 0 && age < 7) add('welcome')
    if (age >= 3 && age < 8) add('no_import_d3')

    if (church.trial_ends_at) {
      const msLeft = new Date(church.trial_ends_at).getTime() - now.getTime()
      if (msLeft > 0) {
        const daysLeft = Math.ceil(msLeft / DAY)
        if (daysLeft >= 8 && daysLeft <= 15) add('trial_midway')
        else if (daysLeft >= 2 && daysLeft <= 7) add('trial_ending_7')
        else if (daysLeft === 1) add('trial_ending_1')
      }
    }
  }

  if (church.billing_status === 'past_due' && church.grace_ends_at && new Date(church.grace_ends_at).getTime() > now.getTime()) {
    add('payment_failed', new Date(church.grace_ends_at))
  }

  if (church.deletion_scheduled_at && church.billing_status !== 'active' && church.billing_status !== 'trialing') {
    const msLeft = new Date(church.deletion_scheduled_at).getTime() - now.getTime()
    if (msLeft > 0 && msLeft <= 7 * DAY) add('deletion_warning', new Date(church.deletion_scheduled_at))
  }

  return due
}

/* ── Contenu des messages ───────────────────────────────────────────── */

export type LifecycleContext = {
  firstName: string
  churchName: string
  timeZone: string
  /** Jours d'essai restants (messages de fin d'essai). */
  daysLeft?: number
  trialEndsAt?: Date | string | null
  graceEndsAt?: Date | string | null
  deletionAt?: Date | string | null
  /** Fin de la période payée (résiliation programmée). */
  periodEnd?: Date | string | null
  offerName?: string
  interval?: 'month' | 'year'
}

export type RenderedEmail = { subject: string; html: string }

function longDate(value: Date | string | null | undefined, timeZone: string): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: resolveTimeZone(timeZone) })
}

function longDateTime(value: Date | string | null | undefined, timeZone: string): string {
  if (!value) return ''
  const d = new Date(value)
  const tz = resolveTimeZone(timeZone)
  const day = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: tz })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  return `${day} à ${time}`
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)

type Message = {
  subject: string
  preheader: string
  heading: string
  paragraphs: string[]
  card?: string
  button?: { label: string; url: string }
}

function build(ctx: LifecycleContext, m: Message): RenderedEmail {
  const hello = ctx.firstName.trim() ? `Bonjour ${esc(ctx.firstName.trim())},` : 'Bonjour,'
  const body =
    emailParagraph(hello) +
    (m.card ?? '') +
    m.paragraphs.map(emailParagraph).join('') +
    (m.button ? `<div style="margin:8px 0 22px;">${emailButton({ label: m.button.label, url: m.button.url })}</div>` : '') +
    emailParagraph(`À bientôt,<br>${esc(siteConfig.emailSignature)}`)
  return {
    subject: m.subject,
    html: renderEmail({
      preheader: m.preheader,
      heading: m.heading,
      body,
      churchName: ctx.churchName,
      reason: `Vous recevez ce message parce que vous administrez l'espace de ${ctx.churchName} sur ${siteConfig.name}.`,
    }),
  }
}

const SUBSCRIPTION_URL = () => appAbsoluteUrl('/espace/abonnement')

export function renderLifecycleEmail(kind: LifecycleKind, ctx: LifecycleContext): RenderedEmail {
  const church = esc(ctx.churchName)
  const tz = ctx.timeZone
  const daysLeft = ctx.daysLeft ?? 0

  switch (kind) {
    case 'welcome':
      return build(ctx, {
        subject: `Bienvenue sur Comora : l'espace de ${ctx.churchName} est prêt`,
        preheader: `Votre essai gratuit de ${TRIAL_DAYS} jours commence aujourd'hui.`,
        heading: 'Bienvenue sur Comora',
        paragraphs: [
          `L'espace de <strong>${church}</strong> est prêt. Votre essai gratuit de ${TRIAL_DAYS} jours commence aujourd'hui, sans carte bancaire et avec toutes les fonctions de l'offre Communauté.`,
          'Le plus simple pour démarrer : importer vos membres depuis un tableur, créer une première équipe, puis planifier un premier culte. Le guide de démarrage vous accompagne pas à pas.',
        ],
        button: { label: 'Continuer la mise en route', url: appAbsoluteUrl('/espace/demarrage') },
      })

    case 'no_import_d3':
      return build(ctx, {
        subject: 'Importez vos membres en quelques minutes',
        preheader: 'Votre espace est créé, mais il ne compte pas encore de membres.',
        heading: 'Importez vos membres',
        paragraphs: [
          `L'espace de <strong>${church}</strong> ne compte pas encore de membres. Vous pouvez importer votre liste depuis un tableur Excel ou un fichier CSV : un modèle est fourni dans le guide de démarrage.`,
          "Aucun e-mail n'est envoyé aux personnes importées : vous choisissez ensuite qui inviter, et quand.",
        ],
        button: { label: 'Importer mes membres', url: appAbsoluteUrl('/espace/demarrage') },
      })

    case 'trial_midway':
      return build(ctx, {
        subject: 'Votre essai de Comora est à mi-parcours',
        preheader: `Il vous reste ${daysLeft} jours d'essai gratuit.`,
        heading: 'Votre essai est à mi-parcours',
        paragraphs: [
          `Il vous reste <strong>${daysLeft} jours</strong> d'essai gratuit pour <strong>${church}</strong>. Aucune carte bancaire n'est demandée pendant l'essai.`,
          "Pour en profiter pleinement : planifiez plusieurs cultes à l'avance et invitez les responsables d'équipe, pour qu'ils gèrent eux-mêmes leurs bénévoles.",
          "Quand vous serez prêt, choisissez l'offre qui correspond à la taille de votre église.",
        ],
        button: { label: 'Voir les offres', url: SUBSCRIPTION_URL() },
      })

    case 'trial_ending_7':
      return build(ctx, {
        subject: `Plus que ${daysLeft} ${plural(daysLeft, 'jour', 'jours')} d'essai gratuit`,
        preheader: `Votre essai se termine le ${longDate(ctx.trialEndsAt, tz)}.`,
        heading: `Plus que ${daysLeft} ${plural(daysLeft, 'jour', 'jours')} d'essai`,
        paragraphs: [
          `Votre essai gratuit se termine le <strong>${longDate(ctx.trialEndsAt, tz)}</strong>. Pour continuer sans interruption, choisissez une offre.`,
          `Sans offre, l'espace de ${church} passera en lecture seule : vous pourrez toujours consulter vos données, mais plus les modifier. Elles sont conservées ${RETENTION_DAYS} jours.`,
        ],
        button: { label: 'Choisir une offre', url: SUBSCRIPTION_URL() },
      })

    case 'trial_ending_1':
      return build(ctx, {
        subject: "Dernier jour d'essai gratuit",
        preheader: `Votre essai se termine le ${longDateTime(ctx.trialEndsAt, tz)}.`,
        heading: "Dernier jour d'essai",
        card: emailInfoCard([`Fin de l'essai : ${longDateTime(ctx.trialEndsAt, tz)}`], 'warning'),
        paragraphs: [
          `Après cette date, l'espace de <strong>${church}</strong> passera en lecture seule : vos données restent consultables mais ne sont plus modifiables. Elles sont conservées ${RETENTION_DAYS} jours.`,
          'Choisir une offre prend une minute, et tout reprend là où vous en étiez.',
        ],
        button: { label: 'Choisir une offre', url: SUBSCRIPTION_URL() },
      })

    case 'payment_failed':
      return build(ctx, {
        subject: "Le paiement de votre abonnement n'a pas abouti",
        preheader: `Votre espace reste utilisable jusqu'au ${longDate(ctx.graceEndsAt, tz)}.`,
        heading: "Le paiement n'a pas abouti",
        card: emailInfoCard([`À régulariser avant le ${longDate(ctx.graceEndsAt, tz)}`, `Votre espace reste pleinement utilisable jusque-là (${GRACE_DAYS} jours).`], 'warning'),
        paragraphs: [
          `Nous n'avons pas pu prélever le paiement de l'abonnement de <strong>${church}</strong>. C'est souvent une carte expirée ou un plafond atteint.`,
          'Mettez à jour votre moyen de paiement avant cette date pour éviter le passage en lecture seule.',
        ],
        button: { label: 'Mettre à jour mon moyen de paiement', url: SUBSCRIPTION_URL() },
      })

    case 'subscription_confirmed':
      return build(ctx, {
        subject: `Votre abonnement ${ctx.offerName ?? ''} est actif`.replace('  ', ' '),
        preheader: `Merci de votre confiance : l'espace de ${ctx.churchName} est actif.`,
        heading: 'Merci, votre abonnement est actif',
        paragraphs: [
          `L'abonnement${ctx.offerName ? ` <strong>${esc(ctx.offerName)}</strong>` : ''}${ctx.interval ? ` (${ctx.interval === 'year' ? 'annuel' : 'mensuel'})` : ''} de <strong>${church}</strong> est actif. Merci de votre confiance.`,
          'Vous retrouvez vos factures, votre moyen de paiement et la gestion de votre abonnement dans la page Abonnement.',
        ],
        button: { label: 'Gérer mon abonnement', url: SUBSCRIPTION_URL() },
      })

    case 'cancellation_scheduled':
      return build(ctx, {
        subject: 'Votre résiliation est enregistrée',
        preheader: `Votre espace reste accessible jusqu'au ${longDate(ctx.periodEnd, tz)}.`,
        heading: 'Votre résiliation est enregistrée',
        paragraphs: [
          `L'abonnement de <strong>${church}</strong> ne sera pas renouvelé. Votre espace reste pleinement accessible jusqu'au <strong>${longDate(ctx.periodEnd, tz)}</strong>.`,
          `Ensuite, il passera en lecture seule et vos données seront conservées ${RETENTION_DAYS} jours. Si vous changez d'avis, vous pouvez reprendre votre abonnement depuis la page Abonnement avant cette date.`,
        ],
        button: { label: 'Ouvrir la page Abonnement', url: SUBSCRIPTION_URL() },
      })

    case 'subscription_ended':
      return build(ctx, {
        subject: 'Votre abonnement Comora est terminé',
        preheader: 'Votre espace est passé en lecture seule.',
        heading: 'Votre abonnement est terminé',
        paragraphs: [
          `L'espace de <strong>${church}</strong> est passé en lecture seule : vos données restent consultables, mais ne sont plus modifiables.`,
          `Elles sont conservées jusqu'au <strong>${longDate(ctx.deletionAt, tz)}</strong>. Vous pouvez reprendre un abonnement à tout moment avant cette date : tout sera retrouvé tel quel.`,
        ],
        button: { label: 'Reprendre un abonnement', url: SUBSCRIPTION_URL() },
      })

    case 'deletion_warning':
      return build(ctx, {
        subject: `L'espace de ${ctx.churchName} sera supprimé le ${longDate(ctx.deletionAt, tz)}`,
        preheader: 'Réactivez votre espace avant cette date pour conserver vos données.',
        heading: 'Votre espace va être supprimé',
        card: emailInfoCard([`Suppression définitive le ${longDate(ctx.deletionAt, tz)}`], 'warning'),
        paragraphs: [
          `L'espace de <strong>${church}</strong> est en lecture seule. Faute d'abonnement, ses données seront supprimées définitivement à cette date.`,
          'Choisissez une offre avant cette date : votre espace est réactivé immédiatement, avec toutes ses données.',
        ],
        button: { label: 'Réactiver mon espace', url: SUBSCRIPTION_URL() },
      })
  }
}
