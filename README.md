# Comora

**Comora — Votre église, rassemblée.**

La plateforme tout-en-un pensée pour les églises francophones : plannings des bénévoles, chants et projection, communication, site public de l'église.

Ce dépôt contient, dans une seule application Next.js :

| Partie | Adresse (aujourd'hui) | Rôle |
| --- | --- | --- |
| Landing | `/` | présentation de Comora, tarifs, demande d'accès |
| Espace de gestion | `/espace/…` | plannings, équipes, chants, projection, pastorale, réglages (ancien `/benevoles`, redirigé) |
| Site public d'église | `/sites/<slug>` | site vitrine généré à partir des réglages de l'église |
| Partage de setlist | `/partage/<jeton>` | lecture seule, sans compte |
| Administration Comora | `/admin` | demandes d'accès (sera remplacée à l'étape 9) |

L'espace de gestion vient de l'application construite pour une première église, rendue générique. Le passage en SaaS multi-églises suit le plan de [`docs/PLAN.md`](docs/PLAN.md) ; l'audit du code de départ est un document interne, gardé hors du dépôt. Les domaines définitifs (`app.comora.fr`, `<slug>.comora.fr`) arrivent à l'étape 2.

## Pile technique

- [Next.js 16](https://nextjs.org) (App Router, `proxy.ts`), React 19, TypeScript
- [Tailwind CSS 4](https://tailwindcss.com) ; jetons de design dans le paquet interne `@comora/ui`
- [Supabase](https://supabase.com) (`@supabase/ssr`) : authentification, base Postgres avec RLS, stockage, temps réel
- [Resend](https://resend.com) pour les e-mails, `web-push` (VAPID) pour les notifications
- FullCalendar (planification), pdf.js (prédications en PDF)
- Tests : [Vitest](https://vitest.dev) (logique serveur et composants) et [Playwright](https://playwright.dev) (parcours)
- Déploiement sur [Vercel](https://vercel.com), fonctions en région Paris (`cdg1`)

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs (voir ci-dessous)
npm run dev                  # http://localhost:3000
```

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `build` / `start` | développement, build, serveur de production |
| `npm run lint` | ESLint |
| `npm test` | tests Vitest (deux projets : `serveur` en Node, `app` en jsdom) |
| `npm run test:e2e` | tests Playwright (la première fois : `npx playwright install chromium`) |
| `npm run icons` | régénère les icônes PWA de `public/icons/` à partir du logo |

Sans variables Supabase, la landing fonctionne ; l'espace de gestion, lui, a besoin d'un projet Supabase.

## Variables d'environnement

Toutes sont décrites dans [`.env.example`](.env.example). **Ce dépôt est public : aucune valeur réelle ne doit y être commitée** (`.env*` est ignoré par Git, sauf `.env.example`).

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | projet Supabase et clé publique (l'ancienne `NEXT_PUBLIC_SUPABASE_ANON_KEY` est acceptée) |
| `SUPABASE_SECRET_KEY` | clé secrète, **serveur uniquement** (l'ancienne `SUPABASE_SERVICE_ROLE_KEY` est acceptée) |
| `NEXT_PUBLIC_SITE_URL` | URL publique (par défaut `https://comora.fr`), utilisée dans les liens envoyés |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | accès à `/admin` |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` | e-mails (domaine `comora.fr` vérifié dans Resend) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | notifications push (clés propres à Comora) |
| `CRON_SECRET` | protège les tâches planifiées |
| `FOUNDER_DEADLINE` | date limite de l'offre fondateurs (20 janvier 2027) |
| `UNSPLASH_ACCESS_KEY` | recherche de photos dans la médiathèque (facultatif) |

Les variables `NEXT_PUBLIC_*` sont figées au build : après une modification sur Vercel, redéployez. Les autres ne doivent **jamais** prendre ce préfixe.

## Identité visuelle

- **Jetons** (couleurs, polices, rayons, ombres) : `packages/ui/src/styles/tokens.css`, seule source de vérité, importée par `app/globals.css`. Une couleur absente de ce fichier retombe sur la palette Tailwind par défaut, donc hors charte.
- **Logo** : `components/brand/logo.tsx` (l'arche et sa porte). Icônes PWA générées par `npm run icons`.
- **Nom, signature, URL** : `lib/site.ts`.
- **Offre Signature** : `lib/brand/theme.ts` remplace les couleurs Comora par celles de l'église (`churches.branding`), avec repli sur le thème Comora.
- Les e-mails, qui ne lisent pas les variables CSS, reprennent les mêmes valeurs en dur.

## Organisation du code

```
app/
  (site)/, (app)/, admin/   landing, demande d'accès, administration des demandes
  espace/                   espace de gestion de l'église (pages, Server Actions, tests)
  sites/[slug]/             site public d'une église
  partage/[token]/          setlist partagée
  api/                      calendrier ICS, rappels (cron), Bible, import de chants
  manifest.ts               application installable (PWA)
components/
  brand/, landing/, ui/     logo, sections de la landing, composants
  church-site/              sections du site public d'église
lib/                        site, thème, clients Supabase, e-mails, réglages d'église,
                            parsing des chants et diapositives, notifications push
packages/ui/                design system @comora/ui (composants et jetons)
public/                     service worker, page hors ligne, icônes, e-mails
scripts/                    import de chants (CSV Planning Center), icônes
supabase/migrations/        schéma de la base (le schéma complet arrive à l'étape 2)
tests/                      tests unitaires et e2e, aides de test
docs/                       audit et plan du chantier
```

## Base de données

Schéma dans `supabase/migrations/` :

- `20261005…` et `20261008…` : demandes d'accès de la landing (`waitlist`, `invitations`, `early_access_accounts`), remplacées à l'étape 3 ;
- `20261020…_espace_multi_eglises.sql` : l'espace de gestion, **cloisonné par église**.

Règles du cloisonnement :

- chaque table métier porte `church_id`, et une clé étrangère composite empêche de relier deux lignes d'églises différentes ;
- RLS activée et forcée sur toutes les tables, en lecture et en écriture, via `is_church_member()`, `has_church_role()` et `current_church_id()` ;
- rôles d'église dans `church_memberships` (`admin`, `responsable`, `membre`, plus la capacité `pastoral`) ; un compte peut appartenir à plusieurs églises ;
- `members` : les personnes de l'église, avec ou sans compte ; leurs coordonnées (`member_contacts`) ne sont visibles que d'elles-mêmes et des responsables ;
- la pastorale n'est lisible que par le rôle `pastoral` ; l'équipe Comora (`platform_admins`) n'a accès à aucune donnée d'église ;
- le site public passe par la fonction `public_church_site(slug)`, seule ouverte sans compte.

### Tests d'isolation

```bash
supabase start        # base locale (Docker)
supabase db reset     # applique les migrations
npm run test:rls      # deux églises de test, chaque table attaquée avec la clé publique
```

Une table ajoutée sans test d'isolation fait échouer la suite.

Parcours à jeton et espace connecté, sur un vrai serveur branché sur la base locale :

```bash
# serveur de test : copie du projet avec .env.local pointant sur Supabase local
FLOWS_BASE_URL=http://localhost:3200 APP_TOKEN_SECRET=… CRON_SECRET=… npm run test:rls   # liens publics, cron, domaines
FLOWS_BASE_URL=http://localhost:3200 npx tsx tests/rls/smoke-espace.ts                   # chaque page, admin et membre
``` Projet Supabase hébergé : région `eu-west-3` (Paris).

## Contenus et licences

Les imports de chants (`/api/ltcasaph`, `/api/shir`) et les traductions bibliques (`/api/bible`) donnent accès à des textes dont certains sont protégés par le droit d'auteur. Chaque église reste responsable de ses licences (par exemple LicenceChants ou CCLI pour la projection et la diffusion).
