# Back-office des fondateurs

Page : `app.comora.fr/plateforme` (en interne `/espace/plateforme`).

## Ce qu'il montre et fait
- **Indicateurs** : revenu mensuel récurrent (abonnements actifs, annuel ÷ 12, prix lus dans `lib/offers.ts`), nombre d'églises par statut et par offre, demandes de tarif solidaire.
- **Liste des églises** : offre, statut, fin d'essai, nombre de membres, dernière activité.
- **Actions** : prolonger un essai (7, 14 ou 30 jours, 90 au plus), valider ou retirer le tarif solidaire. Chacune est écrite dans `platform_audit_log` dans la même transaction.
- **Aucune donnée de personne** : ni nom, ni adresse, ni pastorale. Tout passe par les fonctions SQL `platform_*`, qui ne renvoient que des compteurs et des métadonnées d'église.

## Qui y entre
Un compte listé dans `platform_admins` **et** connecté en deux étapes (application d'authentification, TOTP). La base vérifie les deux conditions à chaque appel (`platform_assert()`), pas seulement la page. Un compte hors équipe reçoit une 404.

Ajouter un fondateur (dans l'éditeur SQL de Supabase, avec le compte déjà créé) :

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'prenom@exemple.fr';
```

À la première visite, la page affiche un QR code à scanner ; ensuite, elle demande seulement le code à 6 chiffres.

## Avant la mise en production
- Activer le **TOTP** dans le projet Supabase hébergé : *Authentication → Sign In / Providers → Multi-Factor → TOTP* (inscription et vérification). En local, c'est déjà fait dans `supabase/config.toml`.
- Sans cela, personne ne peut passer la deuxième étape.
- Aucune variable d'environnement supplémentaire.

## Tests
- `tests/rls/back-office.test.ts` : accès (anonyme, administrateur d'église, équipe sans deuxième étape, équipe en deux étapes), absence de données de personne, actions et journal. Les sessions en deux étapes sont de vraies sessions `aal2`.
- `npx tsx tests/rls/smoke-plateforme.ts` : parcours dans un vrai navigateur, sur Supabase local et un serveur Next lancé sur cette base.
