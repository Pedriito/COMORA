-- ════════════════════════════════════════════════════════════════════════
-- Abonnements (étape 6, Stripe Billing).
--
--   • subscriptions : un abonnement (et son client Stripe) par église. Écrit uniquement
--                     par le serveur à partir des événements Stripe ; les administrateurs
--                     de l'église ne peuvent que le lire.
--   • stripe_events : journal des événements reçus, pour ne jamais traiter deux fois
--                     le même et ignorer un événement plus ancien que l'état connu.
-- Vocabulaire : « offre » (offer), « périodicité » (billing_interval) ; jamais « plan ».
-- ════════════════════════════════════════════════════════════════════════

create table public.subscriptions (
  church_id              uuid primary key references public.churches (id) on delete cascade,
  stripe_customer_id     text not null unique,
  stripe_subscription_id text unique,
  offer                  text check (offer in ('essentiel', 'communaute', 'signature')),
  billing_interval       text check (billing_interval in ('month', 'year')),
  -- Tarif fondateur appliqué (lu sur le prix réellement facturé)
  founder_price          boolean not null default false,
  status                 text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  -- Horodatage du dernier événement Stripe appliqué : un événement plus ancien est ignoré
  last_event_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
revoke all on table public.subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.subscriptions to service_role;
grant select on table public.subscriptions to authenticated;

create policy "admins : lecture" on public.subscriptions
  for select to authenticated using (public.has_church_role(church_id, 'admin'));

create table public.stripe_events (
  id           text primary key,
  type         text not null,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.stripe_events enable row level security;
alter table public.stripe_events force row level security;
revoke all on table public.stripe_events from anon, authenticated;
grant select, insert, update, delete on table public.stripe_events to service_role;
