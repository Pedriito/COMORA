-- ════════════════════════════════════════════════════════════════════════
-- Back-office des fondateurs (étape 9).
--
--   • platform_audit_log   : journal de chaque action de l'équipe Comora sur une église.
--   • platform_assert()    : réservé aux comptes de platform_admins ET à une session
--                            en deux étapes (aal2, application d'authentification).
--   • platform_*()         : les SEULES portes d'entrée du back-office. Elles ne renvoient que
--                            des compteurs et des métadonnées d'église (nom de l'église, offre,
--                            dates, nombre de membres) : jamais le nom, l'adresse ou le contenu
--                            d'un membre, jamais la pastorale. Les actions écrivent dans le
--                            journal dans la même transaction que la modification.
--
-- Un compte platform_admin ne lit toujours AUCUNE table d'église : il passe par ces fonctions.
-- ════════════════════════════════════════════════════════════════════════

create table public.platform_audit_log (
  id            uuid primary key default gen_random_uuid(),
  -- Qui : compte de l'équipe (conservé même si le compte disparaît)
  admin_user_id uuid references auth.users (id) on delete set null,
  action        text not null check (action in ('extend_trial', 'approve_solidarity', 'revoke_solidarity')),
  -- Sur quoi : l'église (le repère reste lisible si elle est supprimée)
  church_id     uuid references public.churches (id) on delete set null,
  church_slug   text not null,
  -- Paramètres et valeurs avant/après : des dates et des nombres, jamais de données de personnes
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index platform_audit_log_created_at_idx on public.platform_audit_log (created_at desc);
create index platform_audit_log_church_id_idx on public.platform_audit_log (church_id);

alter table public.platform_audit_log enable row level security;
alter table public.platform_audit_log force row level security;
revoke all on table public.platform_audit_log from anon, authenticated;
grant select, insert, update, delete on table public.platform_audit_log to service_role;
comment on table public.platform_audit_log is 'Actions de l''équipe Comora sur les églises. Aucune policy : lecture par platform_audit_recent().';

-- ── Garde commune ───────────────────────────────────────────────────────

create function public.platform_assert()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not exists (select 1 from public.platform_admins a where a.user_id = v_user) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'Vérification en deux étapes requise' using errcode = '42501', hint = 'mfa_required';
  end if;
  return v_user;
end;
$$;
revoke execute on function public.platform_assert() from public, anon, authenticated;

-- ── Lectures : compteurs et métadonnées ─────────────────────────────────

create function public.platform_list_churches(p_limit integer default 500)
returns table (
  id                      uuid,
  name                    text,
  slug                    text,
  created_at              timestamptz,
  offer                   text,
  billing_status          text,
  access                  text,
  is_founder              boolean,
  is_solidarity           boolean,
  solidarity_requested_at timestamptz,
  trial_ends_at           timestamptz,
  billing_interval        text,
  founder_price           boolean,
  subscription_status     text,
  member_count            integer,
  last_activity_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.platform_assert();
  return query
    select c.id, c.name, c.slug::text, c.created_at, c.offer, c.billing_status, public.church_access(c.id),
           c.is_founder, c.is_solidarity, c.solidarity_requested_at, c.trial_ends_at,
           s.billing_interval, s.founder_price, s.status,
           (select count(*)::integer from public.members m where m.church_id = c.id and m.status <> 'inactive'),
           -- Dernière activité : dernière connexion d'un compte de l'église ou dernier culte créé
           greatest(
             c.created_at,
             (select max(u.last_sign_in_at) from public.church_memberships cm join auth.users u on u.id = cm.user_id where cm.church_id = c.id),
             (select max(p.created_at) from public.plans p where p.church_id = c.id)
           )
      from public.churches c
      left join public.subscriptions s on s.church_id = c.id
     order by c.created_at desc
     limit greatest(1, least(coalesce(p_limit, 500), 1000));
end;
$$;

create function public.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.platform_assert();
  return jsonb_build_object(
    'churches', (select count(*) from public.churches),
    'by_status', (
      select coalesce(jsonb_object_agg(s.billing_status, s.n), '{}'::jsonb)
        from (select billing_status, count(*) as n from public.churches group by billing_status) s
    ),
    -- Abonnements payants en cours, par offre, périodicité et tarif : le revenu se calcule côté serveur avec le catalogue
    'subscriptions', (
      select coalesce(jsonb_agg(jsonb_build_object('offer', s.offer, 'interval', s.billing_interval, 'founder', s.founder_price, 'count', s.n)), '[]'::jsonb)
        from (
          select offer, billing_interval, founder_price, count(*) as n
            from public.subscriptions
           where status = 'active' and offer is not null and billing_interval is not null
           group by offer, billing_interval, founder_price
        ) s
    ),
    'solidarity', (select count(*) from public.churches where is_solidarity),
    'solidarity_requests', (select count(*) from public.churches where solidarity_requested_at is not null and not is_solidarity)
  );
end;
$$;

create function public.platform_audit_recent(p_limit integer default 50)
returns table (id uuid, created_at timestamptz, action text, church_slug text, details jsonb, admin_first_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.platform_assert();
  return query
    select l.id, l.created_at, l.action, l.church_slug, l.details, coalesce(p.first_name, '')
      from public.platform_audit_log l
      left join public.profiles p on p.id = l.admin_user_id
     order by l.created_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

-- ── Actions (journalisées dans la même transaction) ─────────────────────

-- Prolonge l'essai de p_days jours (1 à 90) à partir de la fin actuelle, ou d'aujourd'hui si elle est passée.
-- Une église en lecture seule revient en essai : suppression programmée et grâce effacées.
create function public.platform_extend_trial(p_church uuid, p_days integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.platform_assert();
  v_church public.churches%rowtype;
  v_end timestamptz;
begin
  if p_days is null or p_days < 1 or p_days > 90 then
    return jsonb_build_object('ok', false, 'error', 'invalid_days');
  end if;
  select * into v_church from public.churches where id = p_church for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_church.billing_status not in ('trialing', 'read_only') or v_church.is_solidarity then
    return jsonb_build_object('ok', false, 'error', 'not_extendable');
  end if;

  v_end := greatest(coalesce(v_church.trial_ends_at, now()), now()) + make_interval(days => p_days);
  update public.churches
     set billing_status = 'trialing', trial_ends_at = v_end, deletion_scheduled_at = null, grace_ends_at = null
   where id = p_church;

  insert into public.platform_audit_log (admin_user_id, action, church_id, church_slug, details)
  values (v_admin, 'extend_trial', p_church, v_church.slug::text, jsonb_build_object(
    'days', p_days,
    'previous_status', v_church.billing_status,
    'previous_trial_ends_at', v_church.trial_ends_at,
    'new_trial_ends_at', v_end
  ));
  return jsonb_build_object('ok', true, 'trial_ends_at', v_end);
end;
$$;

create function public.platform_approve_solidarity(p_church uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.platform_assert();
  v_slug  text;
  v_result jsonb;
begin
  select slug::text into v_slug from public.churches where id = p_church;
  if v_slug is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  v_result := public.approve_solidarity(p_church);
  if coalesce((v_result ->> 'ok')::boolean, false) then
    insert into public.platform_audit_log (admin_user_id, action, church_id, church_slug, details)
    values (v_admin, 'approve_solidarity', p_church, v_slug, '{}'::jsonb);
  end if;
  return v_result;
end;
$$;

create function public.platform_revoke_solidarity(p_church uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.platform_assert();
  v_slug  text;
  v_was   boolean;
begin
  select slug::text, is_solidarity into v_slug, v_was from public.churches where id = p_church;
  if v_slug is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not v_was then
    return jsonb_build_object('ok', false, 'error', 'not_solidarity');
  end if;
  perform public.revoke_solidarity(p_church);
  insert into public.platform_audit_log (admin_user_id, action, church_id, church_slug, details)
  values (v_admin, 'revoke_solidarity', p_church, v_slug, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function
  public.platform_list_churches(integer), public.platform_overview(), public.platform_audit_recent(integer),
  public.platform_extend_trial(uuid, integer), public.platform_approve_solidarity(uuid), public.platform_revoke_solidarity(uuid)
  from public, anon;
grant execute on function
  public.platform_list_churches(integer), public.platform_overview(), public.platform_audit_recent(integer),
  public.platform_extend_trial(uuid, integer), public.platform_approve_solidarity(uuid), public.platform_revoke_solidarity(uuid)
  to authenticated;
