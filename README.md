# COMORA

Votre église, rassemblée. La plateforme tout-en-un pensée pour les églises francophones : plannings des bénévoles, communication, chants et événements.

Ce dépôt contient le site public (page d'accueil et demande d'accès anticipé), l'administration des demandes (`/admin`) et la création des premiers comptes (`/inscription/…`). Il est structuré pour accueillir ensuite l'application elle-même.

## Pile technique

- [Next.js 16](https://nextjs.org) (App Router, TypeScript), pages statiques servies depuis le CDN
- [Tailwind CSS 4](https://tailwindcss.com), avec les jetons et composants du design system EgliseUI
- [Supabase](https://supabase.com) : demandes d'accès, invitations et comptes (Supabase Auth)
- [Resend](https://resend.com) : e-mails d'acceptation et de refus
- Tests : [Vitest](https://vitest.dev) (logique serveur) et [Playwright](https://playwright.dev) (parcours dans le navigateur)
- Déploiement prévu sur [Vercel](https://vercel.com), fonctions en région Paris (`cdg1`)

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs Supabase
npm run dev                  # http://localhost:3000
```

Autres commandes : `npm run lint`, `npm run build`, `npm run start`, `npm test` (tests unitaires), `npm run test:e2e` (tests navigateur ; la première fois : `npx playwright install chromium`).

Sans variables Supabase, le site fonctionne ; le formulaire répond simplement que les demandes ouvrent bientôt.

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (`sb_publishable_…`). L'ancienne clé `NEXT_PUBLIC_SUPABASE_ANON_KEY` est aussi acceptée |
| `NEXT_PUBLIC_SITE_URL` | URL publique du site : balises de partage, sitemap, liens des e-mails (par défaut `https://comora.fr`) |
| `SUPABASE_SECRET_KEY` | Clé secrète (`sb_secret_…`, ou ancienne `SUPABASE_SERVICE_ROLE_KEY`), **serveur uniquement** : lecture des demandes et création des comptes |
| `ADMIN_PASSWORD` | Mot de passe de `/admin` (12 caractères minimum) |
| `ADMIN_SESSION_SECRET` | Secret de signature des sessions admin (32 caractères minimum, `openssl rand -base64 48`) |
| `RESEND_API_KEY` | Clé API Resend |
| `RESEND_FROM` | Expéditeur, ex. `Comora <bonjour@comora.fr>` (domaine vérifié dans Resend ; en test `onboarding@resend.dev`) |
| `RESEND_REPLY_TO` | Adresse de réponse (facultatif) |

Les variables `NEXT_PUBLIC_*` sont figées au moment du build : après les avoir ajoutées ou modifiées sur Vercel, redéployez. Les autres (clé secrète, mot de passe admin, Resend) ne doivent **jamais** prendre le préfixe `NEXT_PUBLIC_`.

L'adresse de contact affichée quand l'envoi échoue se règle dans `lib/site.ts` (`contactEmail`).

## Base de données

La migration `supabase/migrations/20261005120000_create_waitlist.sql` crée la table `public.waitlist` :

- RLS activée ; le rôle `anon` peut seulement **ajouter** une demande (statut `en_attente`), jamais lire la liste ;
- droits explicites (`grant insert … to anon`), car Supabase n'accorde plus automatiquement les privilèges de l'API aux nouvelles tables.

Pour l'appliquer : avec la CLI (`supabase link` puis `supabase db push`), ou en collant le fichier dans l'éditeur SQL du tableau de bord. Pour tenir la promesse « Hébergé en France », créez le projet dans la région `eu-west-3` (Paris).

La migration `supabase/migrations/20261008120000_selection_invitations.sql` ajoute :

- le profil de l'église dans `waitlist` (pays, bénévoles, cultes, plusieurs sites, équipes actives, besoin n°1, visio) et la décision (`statut` : `en_attente`, `acceptee`, `refusee`) ;
- `invitations` : liens d'inscription, dont seule l'empreinte SHA-256 est stockée, valables 14 jours, utilisables une fois ;
- `profiles` : profil des comptes créés, relié à `auth.users` (chaque utilisateur lit seulement le sien).

Les demandes se traitent dans `/admin`.

## Formulaire « Demander mon accès »

- Server Action `app/(site)/actions.ts`, appelée côté serveur : la clé Supabase n'est pas utilisée dans le navigateur.
- Mêmes règles de validation dans le navigateur et sur le serveur (`lib/waitlist.ts`), alignées sur les contraintes de la table.
- Champ piège invisible contre les robots ; `utm_source` de l'URL est enregistré dans `source`.
- Fonctionne aussi sans JavaScript.
- Page dédiée `/demande-acces` ; `?offre=reseau` (bouton de l'offre Réseau) pré-coche « plusieurs sites ».

## Administration (`/admin`)

- Mot de passe unique (`ADMIN_PASSWORD`), vérifié par une Server Action : il ne figure ni dans le JavaScript envoyé, ni dans l'adresse, ni dans le cookie. Le cookie de session (`comora_admin`, 8 h) contient seulement une expiration signée (HMAC), en `HttpOnly`, `SameSite=Strict`, limité à `/admin`. Changer le mot de passe ou le secret ferme toutes les sessions.
- Chaque action (accepter, refuser, renvoyer) revérifie la session côté serveur.
- **Accepter** : crée un lien d'inscription (affiché une fois, à copier) et l'envoie par e-mail. **Refuser** : envoie l'e-mail « accès à la version publique ». Si l'e-mail ne part pas, la décision est gardée et « Renvoyer l'e-mail » apparaît (pour une église acceptée, un nouveau lien remplace l'ancien).
- Pages `/admin` et `/inscription/…` : `noindex`, `no-store`, `Referrer-Policy: no-referrer`.

## Création de compte (`/inscription/<jeton>`)

Le lien reçu par une église acceptée crée un compte Supabase Auth (e-mail déjà confirmé) et son profil dans `public.profiles`. L'application pourra s'y connecter avec `@supabase/ssr`.

## Organisation du code

```
app/
  layout.tsx            racine : polices, métadonnées, <html lang="fr">
  globals.css           thème Tailwind (couleurs EgliseUI) et animations
  (site)/               site public : page d'accueil et Server Action
  (app)/                application (/connexion, /inscription/[jeton])
  admin/                administration des demandes (mot de passe)
components/
  ui/                   design system EgliseUI (Button, Badge, Card, champs…)
  brand/logo.tsx        logo Comora (arche)
  landing/              sections de la page d'accueil et effets de défilement
lib/                    configuration du site, règles du formulaire, clients Supabase,
                        session admin, décisions, invitations, e-mails, inscription
tests/unit, tests/e2e   tests Vitest et Playwright
assets/images/          visuels optimisés par next/image
public/videos/          vidéo d'ambiance (chargée seulement à l'approche)
supabase/migrations/    schéma de la base
```

### Ajouter l'application

Les pages de l'application se placent dans `app/(app)/` : le groupe de routes partage la mise en page racine (polices, thème) sans hériter des sections du site. Le design system `components/ui` et le logo sont prêts à l'emploi. Pour l'authentification Supabase, ajoutez `@supabase/ssr` et un client lié aux cookies à côté de `lib/supabase/anon.ts`.

## Accessibilité et performances

- Respect de `prefers-reduced-motion` : pas de parallaxe, de flottement ni de vidéo automatique.
- Images converties en AVIF/WebP aux bonnes dimensions par `next/image` ; polices auto-hébergées (aucune requête vers Google côté visiteur).
- Mise en page adaptée du téléphone au grand écran.

## À compléter avant l'ouverture

- Page **Mentions légales** (obligatoire en France) et politique de confidentialité pour les données du formulaire ; le lien du pied de page est encore un simple texte.
- Adresse de contact dans `lib/site.ts`.
- Vérifier le domaine d'envoi dans Resend (DNS) et renseigner `RESEND_FROM`. Resend traite les e-mails hors de France : à mentionner dans la politique de confidentialité.
