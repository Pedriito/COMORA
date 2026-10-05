# COMORA

Votre église, rassemblée. La plateforme tout-en-un pensée pour les églises francophones : plannings des bénévoles, communication, chants et événements.

Ce dépôt contient le site public (page d'accueil et demande d'accès anticipé). Il est structuré pour accueillir ensuite l'application elle-même.

## Pile technique

- [Next.js 16](https://nextjs.org) (App Router, TypeScript), pages statiques servies depuis le CDN
- [Tailwind CSS 4](https://tailwindcss.com), avec les jetons et composants du design system EgliseUI
- [Supabase](https://supabase.com) pour enregistrer les demandes d'accès (table `public.waitlist`)
- Déploiement prévu sur [Vercel](https://vercel.com), fonctions en région Paris (`cdg1`)

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs Supabase
npm run dev                  # http://localhost:3000
```

Autres commandes : `npm run lint`, `npm run build`, `npm run start`.

Sans variables Supabase, le site fonctionne ; le formulaire répond simplement que les demandes ouvrent bientôt.

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (`sb_publishable_…`). L'ancienne clé `NEXT_PUBLIC_SUPABASE_ANON_KEY` est aussi acceptée |
| `NEXT_PUBLIC_SITE_URL` | URL publique du site, utilisée pour les balises de partage et le sitemap (par défaut `https://comora.fr`) |

Les variables `NEXT_PUBLIC_*` sont figées au moment du build : après les avoir ajoutées ou modifiées sur Vercel, redéployez.

L'adresse de contact affichée quand l'envoi échoue se règle dans `lib/site.ts` (`contactEmail`).

## Base de données

La migration `supabase/migrations/20261005120000_create_waitlist.sql` crée la table `public.waitlist` :

- RLS activée ; le rôle `anon` peut seulement **ajouter** une demande (statut `en_attente`), jamais lire la liste ;
- droits explicites (`grant insert … to anon`), car Supabase n'accorde plus automatiquement les privilèges de l'API aux nouvelles tables.

Pour l'appliquer : avec la CLI (`supabase link` puis `supabase db push`), ou en collant le fichier dans l'éditeur SQL du tableau de bord. Pour tenir la promesse « Hébergé en France », créez le projet dans la région `eu-west-3` (Paris).

Les demandes se consultent dans le tableau de bord Supabase (Table Editor › `waitlist`).

## Formulaire « Demander mon accès »

- Server Action `app/(site)/actions.ts`, appelée côté serveur : la clé Supabase n'est pas utilisée dans le navigateur.
- Mêmes règles de validation dans le navigateur et sur le serveur (`lib/waitlist.ts`), alignées sur les contraintes de la table.
- Champ piège invisible contre les robots ; `utm_source` de l'URL est enregistré dans `source`.
- Fonctionne aussi sans JavaScript.

## Organisation du code

```
app/
  layout.tsx            racine : polices, métadonnées, <html lang="fr">
  globals.css           thème Tailwind (couleurs EgliseUI) et animations
  (site)/               site public : page d'accueil et Server Action
  (app)/                application (pour l'instant : /connexion, page d'attente)
components/
  ui/                   design system EgliseUI (Button, Badge, Card, champs…)
  brand/logo.tsx        logo Comora (arche)
  landing/              sections de la page d'accueil et effets de défilement
lib/                    configuration du site, règles du formulaire, client Supabase
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
