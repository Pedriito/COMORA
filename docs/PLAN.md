# Plan du chantier : Comora en SaaS

> **Étape 0.** Plan proposé le 20 octobre 2026, à partir de l'audit du code de départ (document interne, non publié dans ce dépôt). Rien n'est codé avant ta validation.
>
> **Déroulé de chaque étape** :
> 1. plan détaillé ;
> 2. ta validation ;
> 3. code ;
> 4. tests (`npm test`, `npm run lint`, `npm run build`, Playwright si l'interface change) ;
> 5. commit en français.
>
> **Complexité** :
>
> | Taille | Durée de travail |
> | --- | --- |
> | S | moins d'une journée |
> | M | 1 à 3 jours |
> | L | 3 à 6 jours |
> | XL | plus d'une semaine |

---

## Décisions prises le 20 octobre 2026

| Sujet | Décision |
| --- | --- |
| Visibilité du dépôt | `Pedriito/COMORA` **reste public pour le moment**. Il faut donc une vigilance renforcée : aucun secret, aucune donnée réelle, aucun identifiant de ressource externe (tableur, projet…) dans le code ou l'historique. |
| Annuaire des entrepreneurs | **Non repris** : `app/annuaire`, la table `entrepreneurs`, le bucket `entrepreneurs` et les emails associés sont retirés. |
| Page de dons | **Non reprise** : `app/don`, la section `Don` du site public et le widget HelloAsso sont retirés. |
| Chants et Bible | **Gardés tels quels** : imports `api/ltcasaph` et `api/shir`, et toutes les versions de `api/bible` (y compris BDS et NBS). Les routes seront réservées aux comptes connectés, avec des paramètres validés. |
| Table `members` | **Validée** : personnes de l'église, avec ou sans compte. |
| Liste d'attente | Aucune demande reçue. Le parcours « sur sélection » et son `/admin` à mot de passe sont retirés sans reprise de données. |
| Charte | Logo de la landing (`components/brand/logo.tsx`, l'arche et sa porte) et palette actuelle (`ink`, `sand`, `teal`, `coral`, polices Inter et Cormorant). Pas de dossier `brand/` à attendre. |
| `FOUNDER_DEADLINE` | 20 janvier 2027 (`2027-01-20T23:59:59+01:00`), à confirmer. |
| Valeurs entre crochets | Considérées comme validées : conservation 90 jours, grâce 7 jours, 3 admins pour Essentiel, 30 jours pour le tarif solidaire. |

---

## Choix d'architecture proposés

### A. Une seule application Next.js dans le dépôt Comora

Le dépôt `Pedriito/COMORA` contient déjà la landing. J'y importe **un instantané** du code de l'Église la Rencontre, sans son historique, à condition que le dépôt soit d'abord **passé en privé**. Je propose de ne pas créer de deuxième dépôt.

| Domaine | Contenu | Groupe de routes interne |
| --- | --- | --- |
| `comora.fr` | landing, tarifs, inscription, pages légales | `app/(site)` (existant) |
| `app.comora.fr` | espace de gestion (l'ancien `/benevoles`) et back-office `/admin` | `app/espace/…` |
| `<slug>.comora.fr` | site public de l'église (Communauté, Signature) | `app/sites/[slug]/…` |
| domaine propre (Signature) | site public de l'église | `app/sites/[slug]/…`, résolu par une table `church_domains` |

**Rôle de `proxy.ts`** : il lit l'hôte et **réécrit** la requête vers le bon groupe de routes. Il redirige aussi l'ancien `/benevoles/*` vers `app.comora.fr/*` (308).

**Hors production** :
- **En local** : `app.localhost:3000` et `<slug>.localhost:3000`. Les navigateurs résolvent `*.localhost` sans configuration.
- **URL de prévisualisation Vercel** : préfixes de chemin `/espace/…` et `/sites/<slug>/…`, accessibles directement.

**Cookies de session** : limités à `app.comora.fr`. Les sites publics d'église sont anonymes et n'en ont pas besoin, ce qui évite tout partage de cookies entre églises.

Je relirai `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` et le guide `multi-tenant.md` avant de coder. Le proxy tourne désormais par défaut en Node.js.

### B. Isolation des données

**Règle** : la RLS est le seul vrai garde-fou. Le code n'utilise le client service role que là où c'est indispensable :
- webhook Stripe ;
- crons ;
- création d'espace ;
- invitations Auth ;
- back-office (compteurs seulement).

Ces usages sont regroupés dans un module `lib/server/privileged.ts`, relu à part. Toutes les autres requêtes passent par le client de session, soumis à la RLS.

**Contrôles serveur centralisés** : `requireChurchRole(role)` et `requirePlatformAdmin()`, dans `lib/auth/`. Ils remplacent les 7 variantes recopiées.

**Cache** : les clés `unstable_cache` et les tags incluent toujours `church_id`.

### C. Vocabulaire

- `plans` reste la table des plans de culte.
- L'abonnement utilise `offers` (catalogue dans `lib/offers.ts`), `subscriptions`, `billing_*` et `stripe_events`. Les colonnes portent les noms `offer` et `billing_interval`, jamais `plan`.
- Dans le tableau `subscriptions` demandé à l'étape 6, la colonne `plan` s'appellera `offer`.

---

## Étape 1 : Import du code et branding Comora (L)

### 1a. Import et nettoyage

Prérequis : dépôt privé.

**Copie dans le dépôt Comora** :
- `app/benevoles` → `app/espace` ;
- `lib/`, `packages/ui`, `test/`, les migrations SQL (dans un dossier d'archive, voir l'étape 2).

On ne copie ni `.git`, ni `.env*`, ni `node_modules`.

**Retraits**, après validation du tableau du §10 de l'audit :
- régie ATEM, `app/obs`, webhook WhatsApp, `conference-prophetique` ;
- `api/ltcasaph`, `api/shir` ;
- `scripts/create-admin.ts`, `scripts/reset-password.ts` ;
- `.design-sync/`, workflow upstream, `.plist`, `start-atem.sh` ;
- le PNG au nom de chemin Windows ;
- `public/` : photos, mp3, visuels, SVG du modèle ;
- dépendances `@tensorflow/tfjs-node`, `@vladmandic/face-api`, `canvas`, `atem-connection`.

**Fusion des dépendances** :
- versions de la landing : Next 16.3.8, React 19.2.8, Vitest 5 ;
- ajouts : `@supabase/ssr`, FullCalendar, `pdfjs-dist`, `react-image-crop`, `web-push`, Testing Library, jsdom ;
- deux environnements de test Vitest : `node` pour la landing, `jsdom` pour l'appli.

**Fusion des deux `profiles`** (landing et appli) : on garde celui de l'appli, et l'étape 3 remplace la liste d'attente.

**Critère de fin** : les 210 tests de l'appli et les tests de la landing passent, et le build est vert.

### 1b. Branding

- **Charte** : jetons uniques dans `packages/ui/src/styles/tokens.css`, renommé en `@comora/ui`.
  - Contenu : couleurs sémantiques (`--color-brand`, `--color-brand-strong`, `--color-accent`, `--color-surface`, `--color-ink`…), typographies, **rayons et ombres** (absents aujourd'hui).
  - La landing et l'appli importent le même fichier.
  - Les 42 couleurs codées en dur passent sur ces jetons.
- **Thème par église (Signature)** : `getChurchTheme(church)` lit `churches.branding` (logo, couleurs) et injecte des variables CSS dans le layout. Repli sur le thème Comora. On prépare le mécanisme ici, on ne l'active qu'avec l'offre Signature.
- **Remplacement de « Église la Rencontre » par Comora**, ou par le nom de l'église quand c'est le contexte (site public, emails d'invitation) :
  - métadonnées, `manifest.json`, `sw.js`, `offline.html`, `icon.tsx`, `opengraph-image.tsx`, favicon ;
  - ICS (`PRODID -//Comora//Planning//FR`) ;
  - écrans d'authentification, notifications push.
- **Signature de marque** : « Comora — Votre église, rassemblée. » (pied de page, emails, OG).
- **Emails** : expéditeur `RESEND_FROM` (ex. `Comora <bonjour@comora.fr>`), sujet VAPID `VAPID_SUBJECT=mailto:contact@comora.fr`. Aucune adresse en dur.
- **Divers** : `package.json` renommé `comora` ; `README.md` réécrit ; `.env.example` complété.
- **Nouvelles clés VAPID** : générées avec `npx web-push generate-vapid-keys`. Je te les donne pour Vercel, elles ne sont **jamais commitées**.

**Tests** :
- aucune occurrence de « Rencontre », « Lieusaint » ou « egliselarencontre » hors `docs/` (test automatisé par grep) ;
- repli du thème.

---

## Étape 2 : Multi-églises (XL, priorité absolue)

### Prérequis

- **Ton export `supabase db dump --schema-only`**, à déposer dans `supabase/reference/elr-schema.sql`, ignoré par Git si tu préfères.
- Le **nouveau projet Supabase** Comora (région Paris) et la CLI Supabase en local (`supabase start`), pour des tests RLS sur une vraie base Postgres.

### 2.1 Socle SQL

Comora part d'une base vide. Je propose donc **une migration initiale propre**, `supabase/migrations/2026…_comora_init.sql`, reconstruite à partir de l'export et des colonnes déduites du code. Les 005 à 021 ne sont pas reprises une à une : elles sont archivées pour mémoire. Aucune donnée n'est copiée.

**Table `churches`**

| Colonne | Type et contraintes |
| --- | --- |
| `id` | |
| `name` | |
| `slug` | unique, `citext`, vérifié par regex |
| `city`, `country` | |
| `timezone` | défaut `Europe/Paris` |
| `size_bracket` | `lt30`, `30_100`, `100_500`, `gt500` |
| `offer` | `essentiel`, `communaute`, `signature`, nullable pendant l'essai |
| `billing_status` | `trialing`, `active`, `past_due`, `read_only`, `canceled`, `pending_deletion` |
| `trial_ends_at`, `grace_ends_at` | |
| `is_founder`, `is_solidarity` | booléens |
| `branding` | jsonb |
| `modules` | jsonb : `pastorale`, `annuaire`… |
| `created_at`, `deleted_at` | |

La table `church_settings` est fusionnée dans `churches`, ou gardée en 1-1 : c'est un détail d'implémentation.

**Personnes et comptes.** Tes étapes 4 (import CSV) et 7 (limite de membres) supposent des **membres sans compte**. Aujourd'hui, chaque bénévole doit être un compte Auth. Les invités externes passent par un faux profil partagé (`INVITE_EXT_ID`). Je propose donc deux tables :
- `members` : une personne de l'église, avec ou sans compte (`church_id`, nom, email, téléphone, `user_id` nullable). C'est elle que comptent les limites d'offre.
- `church_memberships` : le lien entre un compte et une église, avec son rôle (`user_id`, `church_id`, `role`, `is_pastoral`).

`team_members`, `plan_assignments` et `blockout_dates` pointent ensuite vers `members.id`, ce qui fait disparaître `INVITE_EXT_ID`. **C'est le plus gros morceau de l'étape**, voir la question 3.

**Rôles d'église**

| Rôle | Ancien rôle | Droits |
| --- | --- | --- |
| `admin` | admin | tout l'espace de l'église |
| `responsable` | editor | contenus, plans, équipes |
| `membre` | viewer | son espace personnel |

**Capacité séparée `pastoral`.** Ni `admin` ni le back-office n'y ont accès.

**Fin de `super_admin`.** La valeur disparaît des rôles d'église et est remplacée par `platform_admins`. Les comptes de cette table n'ont **aucune policy** sur les données des églises.

**`church_id NOT NULL`, avec clé étrangère et index, sur toutes les tables métier** :
- `songs`, `arrangements`, `plan_songs`, `plan_videos` ;
- `recurring_announcements`, `plan_announcements`, `plan_sermons` ;
- `media_files`, `projection_settings` (une ligne par église, plus de singleton) ;
- `tasks`, `decisions`, `pastoral_notes`, `prayer_requests` ;
- `invite_tokens`, `pending_invites`, `push_subscriptions` ;
- `entrepreneurs`, `church_schedules` ;
- `positions`, `team_members`, `member_positions`, `plan_assignments`, `blockout_dates` (dénormalisé, pour des policies simples et rapides).

**Cohérence entre tables** : des triggers vérifient que `church_id` est le même entre parent et enfant, par exemple qu'un `plan_songs` et son `plan` appartiennent à la même église.

**Contraintes uniques par église** :
- `UNIQUE(church_id, name)` sur `teams` ;
- `songs.id` passe en uuid.

**Fonctions SQL** (`security definer`, `stable`, `set search_path = ''`, propriétaire non `postgres` si possible) :
- `is_church_member(church_id)` ;
- `has_church_role(church_id, role)`, avec la hiérarchie `admin` > `responsable` > `membre` ; `'pastoral'` teste `is_pastoral` ;
- `current_church_id()` : l'église active de l'utilisateur, utilisée comme valeur par défaut à l'insertion. Avec plusieurs églises, la RLS se fonde sur l'appartenance. L'église active est choisie côté serveur et revérifiée (voir la question 2) ;
- `is_platform_admin()` : uniquement pour les vues de compteurs du back-office ;
- `church_is_writable(church_id)` : renvoie faux en lecture seule (fin d'essai, impayé), pour les étapes 5 et 6.

**Policies RLS** :
- RLS **activée et forcée sur toutes les tables**. Un test vérifie dans `pg_class` qu'aucune table de `public` n'y échappe ;
- policies distinctes pour SELECT, INSERT, UPDATE et DELETE, avec `WITH CHECK` ;
- `revoke` par défaut, `grant` explicites.

**`profiles`** :
- l'utilisateur ne peut modifier que ses champs personnels ;
- lecture limitée aux membres des mêmes églises, avec les seules colonnes utiles.

**Pastorale** :
- policies uniquement `has_church_role(church_id, 'pastoral')` ;
- aucune exception service role dans le code applicatif ;
- l'export RGPD de l'étape 10 passe par une fonction dédiée.

**Stockage** :
- bucket `church-media`, **privé**, avec des chemins `{church_id}/…` ;
- policies `storage.objects` sur `(storage.foldername(name))[1]::uuid` ;
- URL signées pour les PDF de prédication ;
- bucket public `church-public` pour les visuels du site public, préfixé de la même façon.

**Realtime** :
- canaux `church:{church_id}:projection`, `private: true` ;
- autorisation par la RLS sur `realtime.messages`.

### 2.2 Application

- **Réglages par défaut** : suppression de `DEFAULT_CHURCH_ID`, `DEFAULT_CHURCH_SETTINGS` et `CHURCH_ID`. Les réglages par défaut deviennent neutres : nom de l'église, sans adresse ni pasteurs.
- **Église courante** : `getCurrentChurch()` résout l'église depuis la session (espace) ou depuis le sous-domaine ou le domaine (site public). Une église inconnue renvoie un 404.
- **Server Actions** : relecture des 95 actions, une par une. Pour chacune : `requireChurchRole`, client de session, validation des entrées, et plus d'identifiants venus du client sans vérification.
- **Jetons publics**, sur le modèle déjà en place dans Comora : `crypto.randomBytes(32)`, empreinte SHA-256 stockée, expiration, `church_id`.

| Jeton | Changement |
| --- | --- |
| ICS | un jeton par église et par utilisateur, révocable |
| Partage de setlist | expiration de 30 jours par défaut, lecture par une route serveur et non plus par la clé publique |
| Invitation (`invite_tokens`) | lié à l'église |
| Activation (`pending_invites`) | expiration de 72 h, plus de lien de récupération stocké |
| Réponses `repondre` et `repondre-ext` | jeton signé dédié, à la place de l'UUID |
| Annuaire | jeton haché, retiré du SELECT public |

- **Cron des rappels** : boucle par église, fenêtres J-n calculées dans **le fuseau de l'église**, dates des emails et notifications formatées avec `timeZone`. Le cron répond 401 si `CRON_SECRET` est vide.
- **Redirections** : `/benevoles/*` → `app.comora.fr/*`.

### 2.3 Tests obligatoires

Sur Supabase local, avec `supabase start` et Vitest :
- deux églises A et B, un utilisateur par église et par rôle ;
- **pour chaque table**, un utilisateur de A tente SELECT, INSERT, UPDATE et DELETE sur les lignes de B, **avec la clé publique et son JWT** ;
- les tests sont générés à partir de la liste des tables, donc une nouvelle table sans test fait échouer la suite.

Autres tests :
- pastorale : un admin non `pastoral` ne lit rien ;
- un `platform_admin` ne lit rien ;
- stockage et Realtime : pas d'accès d'une église à l'autre ;
- jetons expirés, révoqués ou d'une autre église refusés ;
- `profiles` : impossible de changer de rôle ou d'église ;
- proxy : résolution des hôtes (production, `localhost`, prévisualisation).

---

## Étape 3 : Inscription et création de l'espace (M)

- **Landing** : le bouton devient « Créer l'espace de mon église ». Le parcours de liste d'attente et d'« inscription sur sélection » est retiré. Je propose de garder la table `waitlist` en lecture pour l'historique (voir la question 4).
- **Comptes** : inscription Supabase Auth par email et mot de passe ou par lien magique, email confirmé obligatoire.
- **Assistant en une page** : nom, ville, pays, tranche de taille et slug.
  - Le slug est proposé automatiquement : translittération, minuscules, tirets.
  - Il est vérifié en direct par une action serveur (unicité, format, liste réservée dans `lib/reserved-slugs.ts`).
- **Case CGV et confidentialité** obligatoire. La table `legal_acceptances` enregistre utilisateur, église, document, version, date, et l'empreinte de l'IP plutôt que l'IP en clair.
- **Création atomique** par une fonction SQL `create_church(...)` : église, appartenance `admin`, réglages neutres, `trial_ends_at` et `is_founder` si la date est avant `FOUNDER_DEADLINE`.
- **Tests** : slug (unicité, mots réservés, accents) ; acceptation obligatoire ; date limite fondateurs ; l'utilisateur ne peut pas créer une église pour un autre.

## Étape 4 : Démarrage guidé (M)

- **Progression** : table `onboarding_progress` (une ligne par église), recalculée à partir des données réelles. Par exemple, l'étape « importer » est faite dès qu'il existe au moins 2 membres, ce qui évite les cases cochées à la main.
- **Import CSV et Excel** :
  - lecture côté navigateur avec SheetJS : dernière version publiée sur `cdn.sheetjs.com`, la version npm étant obsolète ;
  - correspondance des colonnes, aperçu, doublons (email, puis nom et téléphone) ;
  - validation serveur ;
  - **respect de la limite de membres de l'offre**.
- **Autres premières actions** : créer une équipe, planifier le prochain culte, inviter un responsable.
- **Carte « Bien démarrer »** dans le tableau de bord, masquable une fois terminée.
- **Tests** : parseur, doublons, limite, isolation de l'import.

## Étape 5 : Essai gratuit de 30 jours (M)

- **Démarrage** : `trial_ends_at = now() + 30 jours` à la création, sans carte. L'offre effective pendant l'essai est Communauté.
- **Bandeau** : discret, il affiche les jours restants et mène à « Choisir une offre ».
- **Lecture seule** : `church_is_writable()` est utilisé dans **toutes** les policies d'écriture, et un garde-fou côté serveur affiche un écran clair. On ne bloque jamais les exports ni l'accès au paiement.
- **Conservation** : `deletion_scheduled_at = fin + 90 jours`, puis avertissement J-7, puis suppression par le cron.
  - **Action irréversible** : je te soumettrai le code de suppression avant de l'activer.
  - Un mode « simulation » journalise ce qui serait supprimé, sans rien supprimer.
- **Tests** : passage en lecture seule, écritures refusées au niveau de la RLS, horloge simulée.

## Étape 6 : Paiement avec Stripe Billing (L)

- **Script `scripts/stripe-setup.ts`** : idempotent grâce aux `lookup_key`, il crée 3 produits et 12 prix.
  - Convention de nommage : `essentiel_month`, `essentiel_year`, `essentiel_founder_month`…
  - Mode test par défaut, `--live` explicite pour la production.
  - Il affiche les identifiants à mettre dans l'environnement. L'app retrouve les prix par `lookup_key`, ce qui évite de copier 12 variables.
  - **Montants annuels en centimes** :

    | Offre | Annuel | Annuel fondateur |
    | --- | --- | --- |
    | Essentiel | 18 240 | 11 520 |
    | Communauté | 47 040 | 27 840 |
    | Signature | 114 240 | 66 240 |

- **Checkout** :
  - mode abonnement, carte et `sepa_debit` ;
  - client Stripe créé côté serveur ;
  - `client_reference_id = church_id` ;
  - prix fondateur proposé **seulement** si `is_founder` est vrai côté serveur.
- **Portail client** : configuré par le script (changement d'offre et de périodicité parmi les prix autorisés, moyen de paiement, factures, résiliation).
  - **Point délicat** : un fondateur qui change d'offre doit rester sur un prix fondateur. Je propose de le gérer par deux configurations du portail : fondateurs et standard.
- **Webhook `/api/stripe/webhook`** :
  - signature vérifiée sur le corps brut ;
  - table `stripe_events` (id unique) pour l'idempotence ;
  - événements traités : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` ;
  - mise à jour de `subscriptions` (`church_id`, `stripe_customer_id`, `stripe_subscription_id`, `offer`, `billing_interval`, `status`, `current_period_end`, `cancel_at_period_end`) et de `churches.billing_status`.
- **Source de vérité** : la fonction `get_church_access(church_id)`, calculée côté serveur à partir de `subscriptions`, de l'essai et de la période de grâce.
- **Impayé** : `grace_ends_at = +7 jours`, bandeau et emails, puis lecture seule.
- **Factures** :
  - pied de facture « TVA non applicable, art. 293 B du CGI » ;
  - raison sociale et adresse de la SAS Comora, réglées par le script dans les paramètres de facturation du compte, depuis les variables `COMORA_LEGAL_*` ;
  - Stripe Tax désactivé.
- **Signature** : à l'abonnement, une notification part vers l'équipe Comora (email à `PLATFORM_NOTIFY_EMAIL`) pour lancer l'accompagnement.
- **Tests** : webhook avec événements signés de test et rejeu (idempotence) ; calcul de l'accès ; refus d'un prix fondateur pour une église non fondatrice ; Stripe CLI à l'étape 11.

## Étape 7 : Limites par offre (M)

- **`lib/offers.ts`** : seule source de vérité.
  - Contenu : limites de membres et d'admins, site public, domaine et branding, multi-sites et rôles avancés, prix et `lookup_key`.
  - Une copie SQL (`offer_limits`) est générée depuis ce fichier, et un test vérifie qu'elles restent identiques.
- **Contrôles serveur** : dans les actions (message clair et proposition de l'offre supérieure), plus des **triggers SQL** sur `members` et `church_memberships` en dernier rempart.
- **Site public** : servi seulement pour Communauté et Signature. Sinon, page « Ce site n'est pas encore publié ».
- **Tarif solidaire** :
  - demande depuis l'espace pour une église de moins de 30 membres ;
  - validation ou retrait dans le back-office ;
  - si l'église dépasse 30 membres, échéance à J+30 avec bandeau et emails.
- **Tests** : chaque limite, à la frontière exacte ; tarif solidaire.

## Étape 8 : Emails automatiques (M)

- **Modèles** : `react-email` et `@react-email/components` dans `emails/`, aux couleurs Comora, signés « [Prénom] et Pierre-Elie, de Comora ».
- **Emails de cycle de vie** : bienvenue, J+3 sans import, milieu d'essai, J-7, J-1, paiement échoué.
- **Emails transactionnels** : vérification de l'email (modèle Supabase Auth personnalisé, envoyé par le SMTP Resend), invitation d'un responsable, confirmation d'abonnement, résiliation. On y ajoute la migration des 8 emails actuels de l'appli : rappels, affectations, réinitialisation…
- **Envoi** :
  - route `/api/cron/lifecycle` protégée par `CRON_SECRET` ;
  - table `email_sends` avec `UNIQUE(church_id, user_id, kind)`, pour ne jamais envoyer deux fois ;
  - clé d'idempotence Resend.
- **Tests** : rendu de chaque modèle ; choix des destinataires par jour et par église ; aucun doublon en cas de double exécution.

## Étape 9 : Back-office des fondateurs (M)

- **Accès** :
  - table `platform_admins` (2 comptes), vérifiée côté serveur ;
  - l'actuel `/admin`, protégé par `ADMIN_PASSWORD`, est remplacé ;
  - deuxième facteur d'authentification (TOTP Supabase) recommandé.
- **Page `app.comora.fr/admin`** :
  - liste des églises : offre, statut, fin d'essai, nombre de membres, dernière activité ;
  - indicateurs : revenu mensuel récurrent (annuel ÷ 12) et nombre d'églises par offre ;
  - actions : prolonger un essai, valider ou retirer le statut solidaire, toutes journalisées dans `platform_audit_log`.
- **Données** : passent par des **fonctions SQL qui ne renvoient que des compteurs et des métadonnées**. Jamais de nom ni d'email de membre, et aucune lecture de la pastorale.
- **Tests** :
  - un non-admin reçoit un 404 ;
  - aucune donnée personnelle dans les réponses (test sur la forme des objets renvoyés) ;
  - les actions sont journalisées.

## Étape 10 : Légal et RGPD (M)

- **Pages** : mentions légales, CGV, confidentialité, sous-traitance (art. 28). Contenu provisoire marqué « À remplacer ». Versions déclarées dans `lib/legal.ts` et reliées à `legal_acceptances`.
- **Minimisation** :
  - la date de naissance devient facultative ou disparaît (à décider) ;
  - logs sans données de membres (logger centralisé qui masque les champs) ;
  - QR codes générés localement, plutôt que chez api.qrserver.com.
- **Export complet** par un admin : ZIP de CSV et JSON par table, plus les fichiers.
  - La pastorale n'est incluse que si l'admin a aussi le rôle `pastoral`.
- **Suppression définitive de l'espace** : confirmation par saisie du slug et email de confirmation, annulation de l'abonnement Stripe, puis suppression.
  - **Destructif** : je te montre le code avant de l'activer.
- **Cookies** : pas de bandeau si on choisit un outil de mesure sans cookie (Plausible, ou Vercel Web Analytics sans cookie). Sinon, bandeau.

## Étape 11 : Fiabilité (M)

- **Suivi des erreurs** : Sentry, avec `sendDefaultPii: false`, un filtre `beforeSend` et les données de la requête masquées. Ou un équivalent hébergé dans l'UE.
- **Sauvegardes** : offre Pro Supabase, PITR recommandé. Procédure de restauration testée sur un projet jetable.
- **Tests Playwright de bout en bout**, en mode test Stripe : inscription → espace → import → fin d'essai simulée → paiement (carte de test) → accès débloqué → résiliation.
- **Webhook** : `stripe listen` et `stripe trigger` dans un script `npm run test:stripe`.
- **`docs/DEPLOIEMENT.md`** : domaines et DNS (joker `*.comora.fr` sur Vercel), variables, Stripe en production, cron, rotation des clés (Supabase, Stripe, Resend, VAPID, `CRON_SECRET`).

---

## Ordre et estimation

| Étape | Complexité | Dépend de |
| --- | --- | --- |
| 1. Import et branding | L | dépôt privé, `brand/` (sinon valeurs provisoires) |
| 2. Multi-églises | **XL** | export du schéma, projet Supabase Comora |
| 3. Inscription | M | 2 |
| 4. Démarrage guidé | M | 2, 3 |
| 5. Essai | M | 3 |
| 6. Stripe | L | 5, compte Stripe en mode test |
| 7. Limites | M | 6 |
| 8. Emails | M | 3, 5, 6, domaine vérifié dans Resend |
| 9. Back-office | M | 2, 6 |
| 10. Légal et RGPD | M | 2, textes juridiques |
| 11. Fiabilité | M | tout |

## Variables d'environnement prévues (`.env.example`)

| Domaine | Variables |
| --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| Domaines | `NEXT_PUBLIC_ROOT_DOMAIN` (`comora.fr`), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` |
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_CONFIG_STANDARD`, `STRIPE_PORTAL_CONFIG_FOUNDER` ; les prix sont retrouvés par `lookup_key`, ou via `STRIPE_PRICE_*` si tu préfères des identifiants explicites |
| Resend | `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` |
| Push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Calendrier et tâches | `FOUNDER_DEADLINE`, `CRON_SECRET` |
| Notifications | `PLATFORM_NOTIFY_EMAIL` |
| Mentions légales | `COMORA_LEGAL_NAME`, `COMORA_LEGAL_ADDRESS`, `COMORA_LEGAL_SIREN` |
| Services | `UNSPLASH_ACCESS_KEY`, `SENTRY_DSN` |

---

## Questions qui me bloquent

1. **Dépôt.**
   - Peux-tu passer `Pedriito/COMORA` en privé ? Ton fork public `Pedriito/eglise-la-rencontre` aussi, si tu ne t'en sers plus.
   - Es-tu d'accord pour importer le code de l'appli dans ce dépôt plutôt que d'en créer un nouveau ?
2. **Un utilisateur dans plusieurs églises ?** Je recommande **oui** avec `church_memberships` : pasteur sur deux lieux, bénévole qui sert dans deux églises, et vos propres comptes de test. Cela ajoute un sélecteur d'église dans l'espace. Sinon, on garde `profiles.church_id` et on documente la limite.
3. **Membres sans compte.** Valides-tu la table `members` (personnes de l'église, avec ou sans compte), sur laquelle portent les limites 100 et 500 et l'import CSV ? C'est le plus gros changement du modèle actuel, mais l'import, les limites et les invités externes en dépendent.
4. **Liste d'attente actuelle.** On retire le parcours « sur sélection » et son `/admin` à mot de passe. Les demandes déjà reçues doivent-elles recevoir un lien pour créer leur espace, avec le statut fondateur ?
5. **Charte.** Le dossier `brand/` n'existe pas. La landing Comora utilise aujourd'hui **la palette et les polices de l'Église la Rencontre** (teal `#5A9EA6`, Inter et Cormorant). Les garde-t-on pour Comora, ou attends-tu un logo et des couleurs propres ? Il me faudrait, au minimum :
   - le logo en SVG, clair et sombre ;
   - une icône carrée de 512 px ;
   - les couleurs principale, d'accent et neutres ;
   - les polices.
6. **« Annuaire ».** Le module existant est un **annuaire des entrepreneurs** chrétiens (fiches publiques modérées), pas un annuaire des membres. C'est bien celui-là que tu veux garder ?
7. **Chants et Bible.** Es-tu d'accord pour :
   - retirer les imports `ltcasaph` et `shir` ;
   - ne garder par défaut que les Bibles du domaine public ?
8. **Valeurs entre crochets.** Je les prends telles quelles sauf avis contraire : conservation de **90** jours, grâce de **7** jours, **3** admins pour Essentiel, **30** jours pour le tarif solidaire. Quelle date pour `FOUNDER_DEADLINE` ?
9. **Export du schéma.** Peux-tu me fournir le fichier `supabase db dump --schema-only` ? Il me faut aussi, si possible, les policies de `storage` (`--schema storage`). Sans lui, l'étape 2 repose sur des colonnes déduites du code.
