-- ════════════════════════════════════════════════════════════════════════
-- Limites par offre et tarif solidaire (étape 7).
--
--   • offer_limits         : copie SQL des limites de lib/offers.ts (un test vérifie qu'elles
--                            restent identiques).
--   • church_limits()      : les limites qui s'appliquent à une église (offre effective).
--   • Déclencheurs         : dernier rempart sur members et church_memberships. Même un appel
--                            direct à l'API ne peut pas dépasser la limite. Une église déjà
--                            au-dessus (rétrogradation) garde ses données : seul l'ajout est refusé.
--   • public_church_site() : n'expose le site qu'aux offres qui l'incluent.
--   • Tarif solidaire      : demande par l'église, validation par l'équipe Comora (service),
--                            échéance de 30 jours si l'église atteint 30 membres.
-- ════════════════════════════════════════════════════════════════════════

create table public.offer_limits (
  offer           text primary key check (offer in ('essentiel', 'communaute', 'signature')),
  max_members     integer check (max_members > 0),   -- null = illimité
  max_admins      integer check (max_admins > 0),    -- null = illimité
  public_site     boolean not null,
  custom_branding boolean not null,
  custom_domain   boolean not null,
  multi_site      boolean not null,
  advanced_roles  boolean not null
);

insert into public.offer_limits (offer, max_members, max_admins, public_site, custom_branding, custom_domain, multi_site, advanced_roles) values
  ('essentiel',  100,  3,    false, false, false, false, false),
  ('communaute', 500,  null, true,  false, false, false, false),
  ('signature',  null, null, true,  true,  true,  true,  true);

alter table public.offer_limits enable row level security;
alter table public.offer_limits force row level security;
revoke all on table public.offer_limits from anon, authenticated;
grant select, insert, update, delete on table public.offer_limits to service_role;
grant select on table public.offer_limits to authenticated;
create policy "connectés : lecture" on public.offer_limits for select to authenticated using (true);

alter table public.churches
  add column solidarity_requested_at timestamptz,
  add column solidarity_exceeded_at  timestamptz;
comment on column public.churches.solidarity_requested_at is 'Demande du tarif solidaire (Essentiel gratuit sous 30 membres), à valider par l''équipe Comora.';
comment on column public.churches.solidarity_exceeded_at is 'Date à laquelle une église solidaire a atteint 30 membres : elle a 30 jours pour choisir une offre.';

-- Une église solidaire a l'offre Essentiel ; sinon, l'offre choisie (Communauté pendant l'essai)
create or replace function public.church_effective_offer(p_church uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.is_solidarity then 'essentiel'
    when public.church_access(c.id) = 'trial' then coalesce(c.offer, 'communaute')
    else c.offer
  end
  from public.churches c where c.id = p_church;
$$;

-- État d'accès : une église solidaire qui a dépassé 30 membres depuis plus de 30 jours passe en lecture seule
create or replace function public.church_access(p_church uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.is_solidarity and c.solidarity_exceeded_at is not null and c.solidarity_exceeded_at + interval '30 days' <= now() then 'read_only'
    else case c.billing_status
      when 'active' then 'active'
      when 'trialing' then case when c.trial_ends_at is null or c.trial_ends_at > now() then 'trial' else 'read_only' end
      when 'past_due' then case when c.grace_ends_at is not null and c.grace_ends_at > now() then 'grace' else 'read_only' end
      when 'pending_deletion' then 'pending_deletion'
      else 'read_only'
    end
  end
  from public.churches c where c.id = p_church;
$$;

create function public.church_limits(p_church uuid)
returns public.offer_limits
language sql
stable
security definer
set search_path = ''
as $$
  select l.*
  from public.offer_limits l
  where l.offer = coalesce(public.church_effective_offer(p_church), 'essentiel');
$$;
revoke execute on function public.church_limits(uuid) from public, anon;
grant execute on function public.church_limits(uuid) to authenticated, service_role;

-- ── Membres : une personne désactivée ne compte pas ───────────────────────
create function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max   integer;
  v_count integer;
begin
  if new.status = 'inactive' then return new; end if;
  -- Une personne déjà comptée (hors désactivée) ne change pas le total
  if tg_op = 'UPDATE' and old.status <> 'inactive' then return new; end if;

  select (public.church_limits(new.church_id)).max_members into v_max;
  if v_max is null then return new; end if;

  -- Deux ajouts simultanés ne doivent pas franchir la limite ensemble
  perform pg_advisory_xact_lock(hashtext('members:' || new.church_id::text));
  select count(*) into v_count from public.members m where m.church_id = new.church_id and m.status <> 'inactive';
  if v_count >= v_max then
    raise exception 'limite_membres' using errcode = 'P0001', detail = v_max::text;
  end if;
  return new;
end;
$$;
create trigger members_enforce_limit before insert or update of status on public.members
  for each row execute function public.enforce_member_limit();

-- ── Administrateurs : actifs et invités ───────────────────────────────────
create function public.enforce_admin_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max   integer;
  v_count integer;
begin
  if new.role <> 'admin' or new.status not in ('active', 'invited') then return new; end if;
  if tg_op = 'UPDATE' and old.role = 'admin' and old.status in ('active', 'invited') then return new; end if;

  select (public.church_limits(new.church_id)).max_admins into v_max;
  if v_max is null then return new; end if;

  perform pg_advisory_xact_lock(hashtext('admins:' || new.church_id::text));
  select count(*) into v_count from public.church_memberships m
   where m.church_id = new.church_id and m.role = 'admin' and m.status in ('active', 'invited') and m.id <> new.id;
  if v_count >= v_max then
    raise exception 'limite_administrateurs' using errcode = 'P0001', detail = v_max::text;
  end if;
  return new;
end;
$$;
create trigger church_memberships_enforce_admin_limit before insert or update of role, status on public.church_memberships
  for each row execute function public.enforce_admin_limit();

-- ── Tarif solidaire : 30 membres déclenchent l'échéance de 30 jours ───────
create function public.track_solidarity_threshold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_church uuid := coalesce(new.church_id, old.church_id);
  v_count  integer;
begin
  if not coalesce((select c.is_solidarity from public.churches c where c.id = v_church), false) then return null; end if;
  select count(*) into v_count from public.members m where m.church_id = v_church and m.status <> 'inactive';
  update public.churches
     set solidarity_exceeded_at = case when v_count >= 30 then coalesce(solidarity_exceeded_at, now()) else null end
   where id = v_church;
  return null;
end;
$$;
create trigger members_track_solidarity after insert or update of status or delete on public.members
  for each row execute function public.track_solidarity_threshold();

-- Validation et retrait : réservés au serveur (back-office de l'équipe Comora, étape 9)
create function public.approve_solidarity(p_church uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.members m where m.church_id = p_church and m.status <> 'inactive';
  if not exists (select 1 from public.churches where id = p_church and solidarity_requested_at is not null) then
    return jsonb_build_object('ok', false, 'error', 'not_requested');
  end if;
  if v_count >= 30 then
    return jsonb_build_object('ok', false, 'error', 'too_many_members');
  end if;
  update public.churches
     set is_solidarity = true, billing_status = 'active', offer = 'essentiel',
         solidarity_exceeded_at = null, deletion_scheduled_at = null, grace_ends_at = null
   where id = p_church;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.revoke_solidarity(p_church uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  -- L'église retrouve l'état que disent ses dates (essai, sinon lecture seule)
  update public.churches
     set is_solidarity = false, solidarity_requested_at = null, solidarity_exceeded_at = null,
         billing_status = 'trialing', offer = null
   where id = p_church and is_solidarity;
$$;
revoke execute on function public.approve_solidarity(uuid), public.revoke_solidarity(uuid) from public, anon, authenticated;
grant execute on function public.approve_solidarity(uuid), public.revoke_solidarity(uuid) to service_role;

-- ── Site public : seulement pour les offres qui l'incluent ────────────────
create or replace function public.public_church_site(target_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case
    when not coalesce((public.church_limits(c.id)).public_site, false) then
      -- Offre sans site public : on ne révèle que le nom
      jsonb_build_object('published', false, 'church', jsonb_build_object('name', c.name, 'slug', c.slug))
    else jsonb_build_object(
      'published', true,
      'church', jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug,
        -- Couleurs de l'église : offre Signature seulement
        'branding', case when (public.church_limits(c.id)).custom_branding then c.branding else '{}'::jsonb end
      ),
      'settings', (
        select to_jsonb(s) - 'church_id' - 'updated_at'
        from public.church_settings s where s.church_id = c.id
      ),
      'schedules', coalesce((
        select jsonb_agg(to_jsonb(h) - 'church_id' - 'created_at' order by h.sort_order)
        from public.church_schedules h where h.church_id = c.id and h.active
      ), '[]'::jsonb)
    )
  end
  from public.churches c
  where c.slug = target_slug::extensions.citext
    and c.billing_status not in ('pending_deletion');
$$;
