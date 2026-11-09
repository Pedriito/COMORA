-- ════════════════════════════════════════════════════════════════════════
-- E-mails du cycle de vie (étape 8).
--
--   • email_sends       : un envoi par (église, compte, type de message). La contrainte
--                         d'unicité garantit qu'un même message n'est jamais envoyé deux fois,
--                         même si le cron tourne deux fois ou si deux traitements se chevauchent.
--   • claim_email_send(): réserve l'envoi de façon atomique ; renvoie vrai si l'appelant doit
--                         envoyer. Une réservation abandonnée (plantage entre la réservation et
--                         l'envoi) peut être reprise après une heure ; la clé d'idempotence de
--                         Resend évite alors un doublon.
--
-- Table réservée au serveur (clé secrète) : aucune policy, aucun droit pour les comptes.
-- Elle ne contient ni adresse ni nom : seulement des identifiants et le type de message.
-- ════════════════════════════════════════════════════════════════════════

create table public.email_sends (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Type de message, éventuellement suivi d'un repère (« payment_failed:2026-12-03 »)
  kind       text not null check (char_length(kind) between 1 and 120),
  claimed_at timestamptz not null default now(),
  sent_at    timestamptz,
  unique (church_id, user_id, kind)
);

create index email_sends_church_id_idx on public.email_sends (church_id);
create index email_sends_user_id_idx on public.email_sends (user_id);

alter table public.email_sends enable row level security;
alter table public.email_sends force row level security;
revoke all on table public.email_sends from anon, authenticated;
grant select, insert, update, delete on table public.email_sends to service_role;

comment on table public.email_sends is 'Journal des e-mails de cycle de vie envoyés, pour ne jamais envoyer deux fois le même message.';

create function public.claim_email_send(p_church_id uuid, p_user_id uuid, p_kind text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claimed uuid;
begin
  insert into public.email_sends as s (church_id, user_id, kind)
  values (p_church_id, p_user_id, p_kind)
  on conflict (church_id, user_id, kind) do update
     set claimed_at = now()
   where s.sent_at is null
     and s.claimed_at < now() - interval '1 hour'
  returning s.id into v_claimed;
  return v_claimed is not null;
end;
$$;

revoke execute on function public.claim_email_send(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_email_send(uuid, uuid, text) to service_role;
