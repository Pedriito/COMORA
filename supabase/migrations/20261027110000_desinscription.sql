-- ════════════════════════════════════════════════════════════════════════
-- Désinscription des e-mails de rappel (étape 8).
--
--   • email_unsubscribes : une ligne par personne et par catégorie de messages qu'elle ne veut
--     plus recevoir. Catégorie « rappels » : conseils de démarrage et rappels de fin d'essai.
--     Les messages de service (paiement, résiliation, suppression) ne sont jamais concernés.
--
-- Table réservée au serveur (clé secrète) : la personne se désinscrit par un lien signé envoyé
-- dans l'e-mail, sans avoir besoin d'être connectée. Aucune adresse n'y est stockée.
-- ════════════════════════════════════════════════════════════════════════

create table public.email_unsubscribes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  category   text not null check (category in ('rappels')),
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.email_unsubscribes enable row level security;
alter table public.email_unsubscribes force row level security;
revoke all on table public.email_unsubscribes from anon, authenticated;
grant select, insert, update, delete on table public.email_unsubscribes to service_role;

comment on table public.email_unsubscribes is 'Catégories d''e-mails que la personne ne veut plus recevoir (désinscription par lien signé).';
