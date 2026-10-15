-- Table des demandes d'accès Comora (formulaire « Demander mon accès »)
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  eglise text not null check (char_length(eglise) between 1 and 200),
  ville text not null check (char_length(ville) between 1 and 120),
  nom text not null check (char_length(nom) between 1 and 160),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text,
  taille text,
  outil text check (outil is null or char_length(outil) <= 300),
  source text,
  statut text not null default 'en_attente'
);

alter table public.waitlist enable row level security;

-- Droits explicites : Supabase n'accorde plus automatiquement les privilèges
-- de l'API aux nouvelles tables. Le rôle anon peut seulement insérer.
revoke all on table public.waitlist from anon, authenticated;
grant insert on table public.waitlist to anon;

-- Le site public peut seulement AJOUTER une demande, jamais lire la liste
create policy "inscription publique"
  on public.waitlist for insert
  to anon
  with check (statut = 'en_attente');
