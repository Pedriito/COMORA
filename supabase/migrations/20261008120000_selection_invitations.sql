-- Sélection des églises fondatrices : profil détaillé des demandes,
-- décision (acceptée / refusée), invitations et profils des comptes créés.

-- 1. Profil de l'église dans les demandes d'accès
alter table public.waitlist
  add column if not exists pays text,
  add column if not exists benevoles text,
  add column if not exists cultes text,
  add column if not exists multi_sites boolean not null default false,
  add column if not exists ministeres text[] not null default '{}',
  add column if not exists priorite text,
  add column if not exists visio boolean not null default false,
  -- Décision prise depuis /admin et envoi de l'e-mail correspondant
  add column if not exists decided_at timestamptz,
  add column if not exists email_sent_at timestamptz;

alter table public.waitlist
  drop constraint if exists waitlist_statut_check,
  add constraint waitlist_statut_check check (statut in ('en_attente', 'acceptee', 'refusee'));

create index if not exists waitlist_statut_created_at_idx on public.waitlist (statut, created_at desc);

-- 2. Invitations envoyées aux églises acceptées.
-- Seule l'empreinte SHA-256 du jeton est stockée : une fuite de la table
-- ne permet pas de créer de compte.
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  waitlist_id uuid not null references public.waitlist (id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists invitations_waitlist_id_idx on public.invitations (waitlist_id);

alter table public.invitations enable row level security;
-- Aucune politique : seul le rôle service (serveur) y accède.
revoke all on table public.invitations from anon, authenticated;

-- 3. Profil des comptes créés depuis une invitation (lié à Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  waitlist_id uuid references public.waitlist (id) on delete set null,
  nom text not null check (char_length(nom) between 1 and 160),
  eglise text not null check (char_length(eglise) between 1 and 200),
  role text
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

-- Chaque utilisateur connecté lit uniquement son propre profil
create policy "lecture de son profil"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);
