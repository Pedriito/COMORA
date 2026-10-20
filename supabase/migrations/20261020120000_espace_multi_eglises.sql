-- ════════════════════════════════════════════════════════════════════════
-- Comora : schéma de l'espace de gestion, cloisonné par église.
--
-- Principes
--   • Chaque table métier porte `church_id` (non nul, indexé). Les tables
--     enfants le reprennent et une clé étrangère composite (parent_id,
--     church_id) garantit qu'un enfant appartient à la même église que son
--     parent : impossible de rattacher un chant de l'église B à un plan de A.
--   • RLS activée et forcée sur toutes les tables ; policies distinctes en
--     lecture et en écriture, fondées sur les fonctions d'accès ci-dessous.
--   • Le rôle `anon` n'a aucun droit sur ces tables : le site public passe par
--     la fonction `public_church_site(slug)` qui ne renvoie que des champs
--     publics.
--   • La pastorale n'est lisible que par le rôle `pastoral`, jamais par les
--     autres admins ni par l'équipe Comora.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists citext with schema extensions;

-- ── Églises ─────────────────────────────────────────────────────────────

create table public.churches (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 160),
  slug            extensions.citext not null unique
                  check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$'),
  city            text,
  country         text not null default 'FR',
  timezone        text not null default 'Europe/Paris',
  size_bracket    text check (size_bracket in ('lt30', '30_100', '100_500', 'gt500')),
  -- Abonnement (offres Essentiel, Communauté, Signature — étapes 5 à 7)
  offer           text check (offer in ('essentiel', 'communaute', 'signature')),
  billing_status  text not null default 'trialing'
                  check (billing_status in ('trialing', 'active', 'past_due', 'read_only', 'canceled', 'pending_deletion')),
  trial_ends_at   timestamptz,
  is_founder      boolean not null default false,
  is_solidarity   boolean not null default false,
  -- Identité visuelle propre (offre Signature) : { primary, accent, logo_url }
  branding        jsonb not null default '{}'::jsonb,
  -- Modules optionnels activés (ex. { "pastorale": true })
  modules         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.churches is 'Une église cliente de Comora (un « espace »).';

-- Contenu du site public et coordonnées affichées
create table public.church_settings (
  church_id          uuid primary key references public.churches (id) on delete cascade,
  tagline            text not null default '',
  address_street     text not null default '',
  address_city       text not null default '',
  address_zip        text not null default '',
  address_dept       text not null default '',
  email              text not null default '',
  youtube_url        text not null default '',
  youtube_channel_id text,
  maps_url           text not null default '',
  pastors_names      text not null default '',
  pastors_photo_url  text not null default '',
  updated_at         timestamptz not null default now()
);

create table public.church_schedules (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  sort_order  integer not null default 0,
  day_of_week text not null,
  event_name  text not null,
  start_time  text not null,
  end_time    text,
  subtitle    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index church_schedules_church_id_idx on public.church_schedules (church_id, sort_order);

-- ── Comptes, appartenances et équipe Comora ─────────────────────────────

-- Identité du compte (une personne peut appartenir à plusieurs églises)
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  first_name       text not null default '',
  last_name        text not null default '',
  avatar_url       text,
  -- Église ouverte dans l'espace ; vérifiée par trigger (appartenance requise)
  active_church_id uuid references public.churches (id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Accès d'un compte à une église, avec son rôle
create table public.church_memberships (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'membre' check (role in ('admin', 'responsable', 'membre')),
  -- Rôle dédié à la pastorale, indépendant du rôle d'administration
  is_pastoral boolean not null default false,
  status      text not null default 'active' check (status in ('invited', 'active', 'inactive')),
  created_at  timestamptz not null default now(),
  unique (church_id, user_id)
);
create index church_memberships_user_id_idx on public.church_memberships (user_id);

-- Équipe Comora (back-office). Aucune policy : lecture par fonctions dédiées.
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── Fonctions d'accès ───────────────────────────────────────────────────
-- SECURITY DEFINER pour lire les appartenances sans repasser par la RLS
-- (évite toute récursion), search_path vide, STABLE pour être évaluées une
-- seule fois par requête.

create function public.is_church_member(target_church uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.church_memberships m
    where m.church_id = target_church
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- Rôles hiérarchiques : admin ⊃ responsable ⊃ membre.
-- 'pastoral' est une capacité à part, jamais accordée par le rôle admin.
create function public.has_church_role(target_church uuid, required_role text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.church_memberships m
    where m.church_id = target_church
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and case required_role
            when 'pastoral'    then m.is_pastoral
            when 'admin'       then m.role = 'admin'
            when 'responsable' then m.role in ('admin', 'responsable')
            when 'membre'      then true
            else false
          end
  );
$$;

-- Église courante : celle choisie dans l'espace si l'appartenance est
-- toujours active, sinon la plus ancienne appartenance active.
create function public.current_church_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.active_church_id
       from public.profiles p
       join public.church_memberships m
         on m.church_id = p.active_church_id and m.user_id = p.id and m.status = 'active'
      where p.id = (select auth.uid())),
    (select m.church_id
       from public.church_memberships m
      where m.user_id = (select auth.uid()) and m.status = 'active'
      order by m.created_at
      limit 1)
  );
$$;

create function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()));
$$;

revoke execute on function public.is_church_member(uuid), public.has_church_role(uuid, text),
  public.current_church_id(), public.is_platform_admin() from public, anon;
grant execute on function public.is_church_member(uuid), public.has_church_role(uuid, text),
  public.current_church_id(), public.is_platform_admin() to authenticated, service_role;

-- ── Personnes de l'église ───────────────────────────────────────────────

-- Personne de l'église, avec ou sans compte (import, ajout manuel, invité).
-- C'est elle que comptent les limites de l'offre.
create table public.members (
  id                uuid primary key default gen_random_uuid(),
  church_id         uuid not null default public.current_church_id()
                    references public.churches (id) on delete cascade,
  user_id           uuid references auth.users (id) on delete set null,
  first_name        text not null check (char_length(first_name) between 1 and 80),
  last_name         text not null default '' check (char_length(last_name) <= 80),
  status            text not null default 'active' check (status in ('active', 'invited', 'inactive')),
  desired_frequency text check (desired_frequency in ('as_needed', 'twice_month', 'every_6_weeks', 'monthly', 'weekly')),
  created_at        timestamptz not null default now(),
  unique (id, church_id),
  unique (church_id, user_id)
);
create index members_church_id_idx on public.members (church_id, last_name, first_name);
create index members_user_id_idx on public.members (user_id) where user_id is not null;

-- Coordonnées : séparées pour n'être lues que par la personne et les responsables
create table public.member_contacts (
  member_id  uuid primary key,
  church_id  uuid not null default public.current_church_id(),
  email      extensions.citext,
  phone      text,
  city       text,
  birthdate  date,
  updated_at timestamptz not null default now(),
  foreign key (member_id, church_id) references public.members (id, church_id) on delete cascade
);
create index member_contacts_church_id_idx on public.member_contacts (church_id);

-- La personne liée au compte connecté, dans une église donnée
create function public.my_member_id(target_church uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id from public.members m
  where m.church_id = target_church and m.user_id = (select auth.uid());
$$;
revoke execute on function public.my_member_id(uuid) from public, anon;
grant execute on function public.my_member_id(uuid) to authenticated, service_role;

-- ── Équipes ─────────────────────────────────────────────────────────────

create table public.teams (
  id                uuid primary key default gen_random_uuid(),
  church_id         uuid not null default public.current_church_id()
                    references public.churches (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 80),
  description       text,
  allows_guests     boolean not null default false,
  is_coordination   boolean not null default false,
  hide_positions    boolean not null default false,
  is_prayer_meeting boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (id, church_id),
  unique (church_id, name)
);

create table public.positions (
  id             uuid primary key default gen_random_uuid(),
  church_id      uuid not null default public.current_church_id(),
  team_id        uuid not null,
  name           text not null check (char_length(name) between 1 and 80),
  allow_multiple boolean not null default false,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (id, church_id),
  unique (team_id, name),
  foreign key (team_id, church_id) references public.teams (id, church_id) on delete cascade
);
create index positions_church_id_idx on public.positions (church_id);

create table public.team_members (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null default public.current_church_id(),
  member_id  uuid not null,
  team_id    uuid not null,
  role       text not null default 'member' check (role in ('leader', 'member')),
  frequency  text check (frequency in ('as_needed', 'twice_month', 'every_6_weeks', 'monthly', 'weekly')),
  created_at timestamptz not null default now(),
  unique (member_id, team_id),
  foreign key (member_id, church_id) references public.members (id, church_id) on delete cascade,
  foreign key (team_id, church_id) references public.teams (id, church_id) on delete cascade
);
create index team_members_church_id_idx on public.team_members (church_id);
create index team_members_team_id_idx on public.team_members (team_id);

create table public.member_positions (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null default public.current_church_id(),
  member_id   uuid not null,
  position_id uuid not null,
  created_at  timestamptz not null default now(),
  unique (member_id, position_id),
  foreign key (member_id, church_id) references public.members (id, church_id) on delete cascade,
  foreign key (position_id, church_id) references public.positions (id, church_id) on delete cascade
);
create index member_positions_church_id_idx on public.member_positions (church_id);

-- Le compte connecté fait-il partie de cette équipe ?
create function public.is_team_member(target_team uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    join public.members m on m.id = tm.member_id
    where tm.team_id = target_team and m.user_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_team_member(uuid) to authenticated, service_role;

-- ── Plans de culte ──────────────────────────────────────────────────────
-- (« plans » désigne ici les plans de culte, jamais l'abonnement)

create table public.plans (
  id                    uuid primary key default gen_random_uuid(),
  church_id             uuid not null default public.current_church_id()
                        references public.churches (id) on delete cascade,
  title                 text not null check (char_length(title) between 1 and 160),
  service_date          timestamptz not null,
  plan_type             text not null default 'sunday_service',
  team_id               uuid,
  team_ids              uuid[],
  excluded_position_ids uuid[],
  notes                 text,
  created_at            timestamptz not null default now(),
  unique (id, church_id),
  foreign key (team_id, church_id) references public.teams (id, church_id) on delete set null (team_id)
);
create index plans_church_id_date_idx on public.plans (church_id, service_date);

create table public.plan_assignments (
  id                 uuid primary key default gen_random_uuid(),
  church_id          uuid not null default public.current_church_id(),
  plan_id            uuid not null,
  -- Personne de l'église ; nulle pour un invité externe (nom et e-mail ci-dessous)
  member_id          uuid,
  team_id            uuid,
  position_id        uuid,
  status             text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  external_name      text,
  external_email     extensions.citext,
  invitation_sent_at timestamptz,
  reminder_sent_days integer[] not null default '{}',
  created_at         timestamptz not null default now(),
  check (member_id is not null or external_name is not null),
  foreign key (plan_id, church_id) references public.plans (id, church_id) on delete cascade,
  foreign key (member_id, church_id) references public.members (id, church_id) on delete cascade,
  foreign key (team_id, church_id) references public.teams (id, church_id) on delete set null (team_id),
  foreign key (position_id, church_id) references public.positions (id, church_id) on delete set null (position_id)
);
create index plan_assignments_church_id_idx on public.plan_assignments (church_id);
create index plan_assignments_plan_id_idx on public.plan_assignments (plan_id);
create index plan_assignments_member_id_idx on public.plan_assignments (member_id) where member_id is not null;
create unique index plan_assignments_unique_position
  on public.plan_assignments (plan_id, member_id, position_id)
  where member_id is not null and position_id is not null;
create unique index plan_assignments_unique_team_no_position
  on public.plan_assignments (plan_id, member_id, team_id)
  where member_id is not null and position_id is null;

create table public.blockout_dates (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null default public.current_church_id(),
  member_id  uuid not null,
  start_date date not null,
  end_date   date not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  foreign key (member_id, church_id) references public.members (id, church_id) on delete cascade
);
create index blockout_dates_church_id_idx on public.blockout_dates (church_id, start_date);
create index blockout_dates_member_id_idx on public.blockout_dates (member_id);

-- ── Chants ──────────────────────────────────────────────────────────────

create table public.songs (
  id                  uuid primary key default gen_random_uuid(),
  church_id           uuid not null default public.current_church_id()
                      references public.churches (id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 200),
  ccli                text,
  themes              text,
  notes               text,
  last_scheduled_date date,
  created_at          timestamptz not null default now(),
  unique (id, church_id)
);
create index songs_church_id_title_idx on public.songs (church_id, title);

create table public.arrangements (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null default public.current_church_id(),
  song_id         uuid not null,
  name            text not null default 'Original',
  bpm             integer,
  length_seconds  integer,
  notes           text,
  chord_chart     text,
  chord_chart_key text,
  keys_available  text[],
  tags            text[],
  youtube_url     text,
  audio_url       text,
  slide_style     jsonb,
  created_at      timestamptz not null default now(),
  unique (id, church_id),
  foreign key (song_id, church_id) references public.songs (id, church_id) on delete cascade
);
create index arrangements_church_id_idx on public.arrangements (church_id);
create index arrangements_song_id_idx on public.arrangements (song_id);

create table public.plan_songs (
  id             uuid primary key default gen_random_uuid(),
  church_id      uuid not null default public.current_church_id(),
  plan_id        uuid not null,
  song_id        uuid not null,
  arrangement_id uuid,
  key_selected   text,
  order_index    integer not null default 0,
  created_at     timestamptz not null default now(),
  foreign key (plan_id, church_id) references public.plans (id, church_id) on delete cascade,
  foreign key (song_id, church_id) references public.songs (id, church_id) on delete cascade,
  foreign key (arrangement_id, church_id) references public.arrangements (id, church_id) on delete set null (arrangement_id)
);
create index plan_songs_church_id_idx on public.plan_songs (church_id);
create index plan_songs_plan_id_idx on public.plan_songs (plan_id, order_index);

-- ── Contenus des plans ──────────────────────────────────────────────────

create table public.plan_videos (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null default public.current_church_id(),
  plan_id     uuid not null,
  title       text,
  url         text not null,
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  foreign key (plan_id, church_id) references public.plans (id, church_id) on delete cascade
);
create index plan_videos_plan_id_idx on public.plan_videos (plan_id);
create index plan_videos_church_id_idx on public.plan_videos (church_id);

create table public.plan_announcements (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null default public.current_church_id(),
  plan_id     uuid not null,
  title       text,
  body        text not null,
  order_index integer not null default 0,
  image_url   text,
  video_url   text,
  created_at  timestamptz not null default now(),
  foreign key (plan_id, church_id) references public.plans (id, church_id) on delete cascade
);
create index plan_announcements_plan_id_idx on public.plan_announcements (plan_id);
create index plan_announcements_church_id_idx on public.plan_announcements (church_id);

create table public.plan_sermons (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null default public.current_church_id(),
  plan_id      uuid not null,
  title        text not null,
  url          text not null,
  storage_path text,
  created_at   timestamptz not null default now(),
  foreign key (plan_id, church_id) references public.plans (id, church_id) on delete cascade
);
create index plan_sermons_plan_id_idx on public.plan_sermons (plan_id);
create index plan_sermons_church_id_idx on public.plan_sermons (church_id);

create table public.recurring_announcements (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null default public.current_church_id()
              references public.churches (id) on delete cascade,
  title       text,
  body        text not null,
  order_index integer not null default 0,
  image_url   text,
  video_url   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index recurring_announcements_church_id_idx on public.recurring_announcements (church_id, order_index);

create table public.media_files (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null default public.current_church_id()
               references public.churches (id) on delete cascade,
  name         text not null,
  type         text not null default 'image',
  storage_path text,
  url          text not null,
  created_at   timestamptz not null default now()
);
create index media_files_church_id_idx on public.media_files (church_id, created_at desc);

-- Une ligne par église (plus de réglage unique pour toute la base)
create table public.projection_settings (
  church_id                 uuid primary key default public.current_church_id()
                            references public.churches (id) on delete cascade,
  bg_type                   text    not null default 'color' check (bg_type in ('color', 'gradient', 'image')),
  bg_color                  text    not null default '#000000',
  bg_gradient               text,
  bg_image_url              text,
  bg_blur                   numeric not null default 0,
  overlay_opacity           numeric not null default 0,
  font_family               text    not null default 'Inter',
  text_color                text    not null default '#ffffff',
  text_shadow               boolean not null default false,
  text_transform            text    not null default 'uppercase',
  font_size_scale           numeric not null default 1.0,
  text_max_width            numeric not null default 94,
  ann_bg_type               text    not null default 'color' check (ann_bg_type in ('color', 'gradient', 'image')),
  ann_bg_color              text    not null default '#1e293b',
  ann_bg_gradient           text,
  ann_bg_image_url          text,
  ann_bg_blur               numeric not null default 0,
  ann_bg_overlay_opacity    numeric not null default 0,
  ann_font_family           text    not null default 'Inter',
  ann_text_color            text    not null default '#ffffff',
  ann_text_shadow           boolean not null default false,
  ann_text_transform        text    not null default 'none',
  ann_title_font_size_scale numeric not null default 1.1,
  ann_font_size_scale       numeric not null default 0.7,
  ann_text_max_width        numeric not null default 94,
  updated_at                timestamptz not null default now()
);

-- ── Tâches et décisions par équipe ──────────────────────────────────────

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null default public.current_church_id(),
  team_id     uuid not null,
  title       text not null check (char_length(title) between 1 and 300),
  assigned_to uuid,
  due_date    date,
  status      text not null default 'todo' check (status in ('todo', 'done')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (team_id, church_id) references public.teams (id, church_id) on delete cascade,
  foreign key (assigned_to, church_id) references public.members (id, church_id) on delete set null (assigned_to)
);
create index tasks_team_id_idx on public.tasks (team_id, status);
create index tasks_church_id_idx on public.tasks (church_id);

create table public.decisions (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null default public.current_church_id()
                references public.churches (id) on delete cascade,
  -- Nulle : décision à classer (sans équipe)
  team_id       uuid,
  title         text not null check (char_length(title) between 1 and 300),
  context       text,
  source        text,
  status        text not null default 'pending' check (status in ('pending', 'decided', 'rejected')),
  decision_note text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references auth.users (id) on delete set null,
  foreign key (team_id, church_id) references public.teams (id, church_id) on delete set null (team_id)
);
create index decisions_church_id_idx on public.decisions (church_id, status);
create index decisions_team_id_idx on public.decisions (team_id);

-- ── Pastorale (données sensibles) ───────────────────────────────────────

create table public.prayer_requests (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null default public.current_church_id()
              references public.churches (id) on delete cascade,
  member_id   uuid,
  person_name text,
  subject     text not null,
  notes       text,
  status      text not null default 'active' check (status in ('active', 'resolved')),
  resolved_at timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (member_id is not null or person_name is not null),
  foreign key (member_id, church_id) references public.members (id, church_id) on delete cascade
);
create index prayer_requests_church_id_idx on public.prayer_requests (church_id, status);
create index prayer_requests_member_id_idx on public.prayer_requests (member_id);

create table public.pastoral_notes (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null default public.current_church_id(),
  member_id  uuid not null,
  note_date  date not null default current_date,
  type       text not null default 'visit',
  notes      text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (member_id, church_id) references public.members (id, church_id) on delete cascade
);
create index pastoral_notes_church_id_idx on public.pastoral_notes (church_id);
create index pastoral_notes_member_id_idx on public.pastoral_notes (member_id, note_date desc);

-- ── Liens d'inscription ─────────────────────────────────────────────────
-- Seule l'empreinte SHA-256 du jeton est stockée.

create table public.invite_tokens (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null default public.current_church_id()
              references public.churches (id) on delete cascade,
  token_hash  text not null unique,
  label       text,
  expires_at  timestamptz,
  max_uses    integer check (max_uses is null or max_uses > 0),
  uses_count  integer not null default 0,
  revoked_at  timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index invite_tokens_church_id_idx on public.invite_tokens (church_id);

-- ── Notifications push (appareils d'un compte, toutes églises confondues) ─

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- ════════════════════════════════════════════════════════════════════════
-- Garde-fous (triggers)
-- ════════════════════════════════════════════════════════════════════════

-- Profil créé avec le compte
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- L'église active doit être une église dont le compte est membre
create function public.check_active_church()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.active_church_id is not null and not exists (
    select 1 from public.church_memberships m
    where m.church_id = new.active_church_id and m.user_id = new.id and m.status = 'active'
  ) then
    raise exception 'Église active non autorisée' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_check_active_church
  before insert or update of active_church_id on public.profiles
  for each row execute function public.check_active_church();

-- Une église garde toujours au moins un admin actif
create function public.keep_one_admin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'admin' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.status <> 'active')
     and exists (select 1 from public.churches c where c.id = old.church_id)
     and not exists (
       select 1 from public.church_memberships m
       where m.church_id = old.church_id and m.id <> old.id
         and m.role = 'admin' and m.status = 'active'
     ) then
    raise exception 'Une église doit garder au moins un administrateur' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger church_memberships_keep_one_admin
  before update or delete on public.church_memberships
  for each row execute function public.keep_one_admin();

-- Une appartenance ne change jamais d'église ni de compte
create function public.freeze_columns()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    if to_jsonb(new) -> col is distinct from to_jsonb(old) -> col then
      raise exception 'La colonne % ne peut pas être modifiée', col using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

create trigger church_memberships_freeze before update on public.church_memberships
  for each row execute function public.freeze_columns('church_id', 'user_id');
create trigger members_freeze before update on public.members
  for each row execute function public.freeze_columns('church_id');

-- Un membre sans rôle de responsable ne peut changer que le statut de sa
-- propre affectation (confirmer ou décliner)
create function public.guard_assignment_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.role()) = 'service_role' or public.has_church_role(old.church_id, 'responsable') then
    return new;
  end if;
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Seul le statut de votre affectation peut être modifié' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger plan_assignments_guard_update before update on public.plan_assignments
  for each row execute function public.guard_assignment_update();

-- Un compte modifie son propre profil de membre, sauf son statut
create function public.guard_member_self_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.role()) = 'service_role' or public.has_church_role(old.church_id, 'responsable') then
    return new;
  end if;
  if new.status is distinct from old.status or new.user_id is distinct from old.user_id then
    raise exception 'Modification non autorisée' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger members_guard_self_update before update on public.members
  for each row execute function public.guard_member_self_update();

-- ════════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array[
    'churches', 'church_settings', 'church_schedules', 'profiles', 'church_memberships',
    'platform_admins', 'members', 'member_contacts', 'teams', 'positions', 'team_members',
    'member_positions', 'plans', 'plan_assignments', 'blockout_dates', 'songs', 'arrangements',
    'plan_songs', 'plan_videos', 'plan_announcements', 'plan_sermons', 'recurring_announcements',
    'media_files', 'projection_settings', 'tasks', 'decisions', 'prayer_requests',
    'pastoral_notes', 'invite_tokens', 'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    -- Le serveur (clé secrète) garde tous les droits : crons, webhooks, création d'espace
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end;
$$;

-- Droits de l'API : seuls les comptes connectés, et la RLS filtre chaque ligne
grant select, insert, update, delete on
  public.church_schedules, public.church_memberships, public.members, public.member_contacts,
  public.teams, public.positions, public.team_members, public.member_positions, public.plans,
  public.plan_assignments, public.blockout_dates, public.songs, public.arrangements,
  public.plan_songs, public.plan_videos, public.plan_announcements, public.plan_sermons,
  public.recurring_announcements, public.media_files, public.tasks, public.decisions,
  public.prayer_requests, public.pastoral_notes, public.invite_tokens, public.push_subscriptions
  to authenticated;
grant select, insert, update on public.church_settings, public.projection_settings to authenticated;
grant select on public.churches to authenticated;
-- Un admin modifie le nom et la localisation de son église, jamais l'abonnement ni le slug
grant update (name, city, country, timezone, size_bracket) on public.churches to authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, avatar_url, active_church_id) on public.profiles to authenticated;

-- Églises ────────────────────────────────────────────────────────────────
create policy "membres : lecture" on public.churches
  for select to authenticated using (public.is_church_member(id));
create policy "admins : modification" on public.churches
  for update to authenticated using (public.has_church_role(id, 'admin'))
  with check (public.has_church_role(id, 'admin'));

-- Tables d'une église : lecture par les membres, écriture par les responsables
do $$
declare
  t text;
begin
  foreach t in array array[
    'church_schedules', 'teams', 'positions', 'team_members', 'member_positions', 'plans',
    'songs', 'arrangements', 'plan_songs', 'plan_videos', 'plan_announcements', 'plan_sermons',
    'recurring_announcements', 'media_files'
  ] loop
    execute format($f$
      create policy "membres : lecture" on public.%1$I
        for select to authenticated using (public.is_church_member(church_id));
      create policy "responsables : ajout" on public.%1$I
        for insert to authenticated with check (public.has_church_role(church_id, 'responsable'));
      create policy "responsables : modification" on public.%1$I
        for update to authenticated using (public.has_church_role(church_id, 'responsable'))
        with check (public.has_church_role(church_id, 'responsable'));
      create policy "responsables : suppression" on public.%1$I
        for delete to authenticated using (public.has_church_role(church_id, 'responsable'));
    $f$, t);
  end loop;
end;
$$;

-- Réglages : lecture par les membres ; site public modifié par les admins,
-- projection par les responsables
create policy "membres : lecture" on public.church_settings
  for select to authenticated using (public.is_church_member(church_id));
create policy "admins : ajout" on public.church_settings
  for insert to authenticated with check (public.has_church_role(church_id, 'admin'));
create policy "admins : modification" on public.church_settings
  for update to authenticated using (public.has_church_role(church_id, 'admin'))
  with check (public.has_church_role(church_id, 'admin'));

create policy "membres : lecture" on public.projection_settings
  for select to authenticated using (public.is_church_member(church_id));
create policy "responsables : ajout" on public.projection_settings
  for insert to authenticated with check (public.has_church_role(church_id, 'responsable'));
create policy "responsables : modification" on public.projection_settings
  for update to authenticated using (public.has_church_role(church_id, 'responsable'))
  with check (public.has_church_role(church_id, 'responsable'));

-- Profils ────────────────────────────────────────────────────────────────
create policy "soi : lecture" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "soi : modification" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Appartenances ──────────────────────────────────────────────────────────
create policy "soi et admins : lecture" on public.church_memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or public.has_church_role(church_id, 'admin'));
create policy "admins : ajout" on public.church_memberships
  for insert to authenticated with check (public.has_church_role(church_id, 'admin'));
create policy "admins : modification" on public.church_memberships
  for update to authenticated using (public.has_church_role(church_id, 'admin'))
  with check (public.has_church_role(church_id, 'admin'));
create policy "admins : suppression" on public.church_memberships
  for delete to authenticated using (public.has_church_role(church_id, 'admin'));

-- Personnes ──────────────────────────────────────────────────────────────
create policy "membres : lecture" on public.members
  for select to authenticated using (public.is_church_member(church_id));
create policy "responsables : ajout" on public.members
  for insert to authenticated with check (public.has_church_role(church_id, 'responsable'));
create policy "responsables ou soi : modification" on public.members
  for update to authenticated
  using (public.has_church_role(church_id, 'responsable') or (user_id = (select auth.uid()) and public.is_church_member(church_id)))
  with check (public.has_church_role(church_id, 'responsable') or (user_id = (select auth.uid()) and public.is_church_member(church_id)));
create policy "responsables : suppression" on public.members
  for delete to authenticated using (public.has_church_role(church_id, 'responsable'));

-- Coordonnées : la personne elle-même et les responsables seulement
create policy "responsables ou soi : lecture" on public.member_contacts
  for select to authenticated
  using (public.has_church_role(church_id, 'responsable') or member_id = public.my_member_id(church_id));
create policy "responsables ou soi : ajout" on public.member_contacts
  for insert to authenticated
  with check (public.has_church_role(church_id, 'responsable') or member_id = public.my_member_id(church_id));
create policy "responsables ou soi : modification" on public.member_contacts
  for update to authenticated
  using (public.has_church_role(church_id, 'responsable') or member_id = public.my_member_id(church_id))
  with check (public.has_church_role(church_id, 'responsable') or member_id = public.my_member_id(church_id));
create policy "responsables : suppression" on public.member_contacts
  for delete to authenticated using (public.has_church_role(church_id, 'responsable'));

-- Affectations : lecture par les membres ; un membre confirme ou décline la
-- sienne (le trigger limite la modification au statut)
create policy "membres : lecture" on public.plan_assignments
  for select to authenticated using (public.is_church_member(church_id));
create policy "responsables : ajout" on public.plan_assignments
  for insert to authenticated with check (public.has_church_role(church_id, 'responsable'));
create policy "responsables ou soi : modification" on public.plan_assignments
  for update to authenticated
  using (public.has_church_role(church_id, 'responsable') or member_id = public.my_member_id(church_id))
  with check (public.has_church_role(church_id, 'responsable') or member_id = public.my_member_id(church_id));
create policy "responsables ou soi : suppression" on public.plan_assignments
  for delete to authenticated
  using (public.has_church_role(church_id, 'responsable') or member_id = public.my_member_id(church_id));

-- Indisponibilités : les siennes ; les responsables voient celles de l'église
create policy "responsables ou soi : lecture" on public.blockout_dates
  for select to authenticated
  using (public.has_church_role(church_id, 'responsable') or member_id = public.my_member_id(church_id));
create policy "soi : ajout" on public.blockout_dates
  for insert to authenticated with check (member_id = public.my_member_id(church_id));
create policy "soi : modification" on public.blockout_dates
  for update to authenticated using (member_id = public.my_member_id(church_id))
  with check (member_id = public.my_member_id(church_id));
create policy "responsables ou soi : suppression" on public.blockout_dates
  for delete to authenticated
  using (public.has_church_role(church_id, 'responsable') or member_id = public.my_member_id(church_id));

-- Tâches et décisions : membres de l'équipe et responsables
create policy "équipe : lecture" on public.tasks
  for select to authenticated
  using (public.has_church_role(church_id, 'responsable') or (public.is_church_member(church_id) and public.is_team_member(team_id)));
create policy "équipe : ajout" on public.tasks
  for insert to authenticated
  with check (public.has_church_role(church_id, 'responsable') or (public.is_church_member(church_id) and public.is_team_member(team_id)));
create policy "équipe : modification" on public.tasks
  for update to authenticated
  using (public.has_church_role(church_id, 'responsable') or (public.is_church_member(church_id) and public.is_team_member(team_id)))
  with check (public.has_church_role(church_id, 'responsable') or (public.is_church_member(church_id) and public.is_team_member(team_id)));
create policy "équipe : suppression" on public.tasks
  for delete to authenticated
  using (public.has_church_role(church_id, 'responsable') or (public.is_church_member(church_id) and public.is_team_member(team_id)));

create policy "équipe : lecture" on public.decisions
  for select to authenticated
  using (public.has_church_role(church_id, 'responsable') or (team_id is not null and public.is_church_member(church_id) and public.is_team_member(team_id)));
create policy "équipe : ajout" on public.decisions
  for insert to authenticated
  with check (public.has_church_role(church_id, 'responsable') or (team_id is not null and public.is_church_member(church_id) and public.is_team_member(team_id)));
create policy "équipe : modification" on public.decisions
  for update to authenticated
  using (public.has_church_role(church_id, 'responsable') or (team_id is not null and public.is_church_member(church_id) and public.is_team_member(team_id)))
  with check (public.has_church_role(church_id, 'responsable') or (team_id is not null and public.is_church_member(church_id) and public.is_team_member(team_id)));
create policy "équipe : suppression" on public.decisions
  for delete to authenticated
  using (public.has_church_role(church_id, 'responsable') or (team_id is not null and public.is_church_member(church_id) and public.is_team_member(team_id)));

-- Pastorale : rôle `pastoral` uniquement, pour toutes les opérations
do $$
declare
  t text;
begin
  foreach t in array array['prayer_requests', 'pastoral_notes'] loop
    execute format($f$
      create policy "pastorale : lecture" on public.%1$I
        for select to authenticated using (public.has_church_role(church_id, 'pastoral'));
      create policy "pastorale : ajout" on public.%1$I
        for insert to authenticated with check (public.has_church_role(church_id, 'pastoral'));
      create policy "pastorale : modification" on public.%1$I
        for update to authenticated using (public.has_church_role(church_id, 'pastoral'))
        with check (public.has_church_role(church_id, 'pastoral'));
      create policy "pastorale : suppression" on public.%1$I
        for delete to authenticated using (public.has_church_role(church_id, 'pastoral'));
    $f$, t);
  end loop;
end;
$$;

-- Liens d'inscription : admins de l'église
create policy "admins : lecture" on public.invite_tokens
  for select to authenticated using (public.has_church_role(church_id, 'admin'));
create policy "admins : ajout" on public.invite_tokens
  for insert to authenticated with check (public.has_church_role(church_id, 'admin'));
create policy "admins : modification" on public.invite_tokens
  for update to authenticated using (public.has_church_role(church_id, 'admin'))
  with check (public.has_church_role(church_id, 'admin'));
create policy "admins : suppression" on public.invite_tokens
  for delete to authenticated using (public.has_church_role(church_id, 'admin'));

-- Notifications push : ses propres appareils
create policy "soi : lecture" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "soi : ajout" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "soi : modification" on public.push_subscriptions
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "soi : suppression" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- platform_admins : aucune policy (accès serveur uniquement).

-- ════════════════════════════════════════════════════════════════════════
-- Site public et contrôle
-- ════════════════════════════════════════════════════════════════════════

-- Données publiques d'une église pour son site (aucune donnée de membre,
-- aucune donnée d'abonnement). Seule porte d'entrée du rôle anon.
create function public.public_church_site(target_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'church', jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'branding', c.branding),
    'settings', (
      select to_jsonb(s) - 'church_id' - 'updated_at'
      from public.church_settings s where s.church_id = c.id
    ),
    'schedules', coalesce((
      select jsonb_agg(to_jsonb(h) - 'church_id' - 'created_at' order by h.sort_order)
      from public.church_schedules h where h.church_id = c.id and h.active
    ), '[]'::jsonb)
  )
  from public.churches c
  where c.slug = target_slug::extensions.citext
    and c.billing_status not in ('pending_deletion');
$$;
revoke execute on function public.public_church_site(text) from public;
grant execute on function public.public_church_site(text) to anon, authenticated, service_role;

-- Liste des tables de `public` et état de leur RLS (tests d'isolation)
create function public.rls_audit()
returns table (table_name text, rls_enabled boolean, rls_forced boolean)
language sql stable security definer set search_path = ''
as $$
  select c.relname::text, c.relrowsecurity, c.relforcerowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
$$;
revoke execute on function public.rls_audit() from public, anon, authenticated;
grant execute on function public.rls_audit() to service_role;
