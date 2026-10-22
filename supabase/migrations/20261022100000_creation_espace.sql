-- ════════════════════════════════════════════════════════════════════════
-- Création d'un espace en libre-service (étape 3).
--
--   • legal_acceptances : version et date de chaque document accepté.
--   • create_church()   : crée l'église, son administrateur et ses acceptations
--                         légales en une seule transaction. Appelable par le serveur
--                         uniquement (clé secrète) : c'est lui qui décide du statut
--                         fondateur et de la fin d'essai, jamais le navigateur.
--   • Fin du parcours « accès sur sélection » : ses trois tables sont retirées.
-- ════════════════════════════════════════════════════════════════════════

create table public.legal_acceptances (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  document    text not null check (document in ('cgv', 'confidentialite')),
  version     text not null check (char_length(version) between 1 and 60),
  accepted_at timestamptz not null default now()
);
create index legal_acceptances_church_id_idx on public.legal_acceptances (church_id);

alter table public.legal_acceptances enable row level security;
alter table public.legal_acceptances force row level security;
revoke all on table public.legal_acceptances from anon, authenticated;
grant select, insert, update, delete on table public.legal_acceptances to service_role;
grant select on table public.legal_acceptances to authenticated;

-- Les administrateurs de l'église consultent ce qui a été accepté ; l'écriture
-- passe uniquement par create_church().
create policy "admins : lecture" on public.legal_acceptances
  for select to authenticated using (public.has_church_role(church_id, 'admin'));

create function public.create_church(
  p_user_id        uuid,
  p_name           text,
  p_slug           text,
  p_city           text,
  p_country        text,
  p_size_bracket   text,
  p_is_founder     boolean,
  p_trial_ends_at  timestamptz,
  p_cgv_version    text,
  p_privacy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email       text;
  v_confirmed   timestamptz;
  v_first       text;
  v_last        text;
  v_church_id   uuid;
  v_member_id   uuid;
  v_admin_count integer;
begin
  select u.email, u.email_confirmed_at into v_email, v_confirmed
    from auth.users u where u.id = p_user_id;
  if v_email is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_user');
  end if;
  -- La vérification de l'e-mail est obligatoire avant de créer un espace
  if v_confirmed is null then
    return jsonb_build_object('ok', false, 'error', 'email_not_confirmed');
  end if;

  if p_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_slug');
  end if;
  if char_length(trim(p_name)) not between 1 and 160 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;

  -- Frein contre la création en série d'espaces par un même compte
  select count(*) into v_admin_count
    from public.church_memberships m
   where m.user_id = p_user_id and m.role = 'admin' and m.status = 'active';
  if v_admin_count >= 3 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;

  begin
    insert into public.churches (name, slug, city, country, size_bracket, billing_status, trial_ends_at, is_founder)
    values (trim(p_name), p_slug, nullif(trim(p_city), ''), p_country, p_size_bracket, 'trialing', p_trial_ends_at, coalesce(p_is_founder, false))
    returning id into v_church_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'slug_taken');
  end;

  insert into public.church_settings (church_id, address_city) values (v_church_id, coalesce(nullif(trim(p_city), ''), ''));

  -- Le créateur devient administrateur, avec sa fiche de personne
  select p.first_name, p.last_name into v_first, v_last from public.profiles p where p.id = p_user_id;
  insert into public.members (church_id, user_id, first_name, last_name)
  values (
    v_church_id, p_user_id,
    coalesce(nullif(trim(v_first), ''), nullif(split_part(v_email, '@', 1), ''), 'Responsable'),
    coalesce(trim(v_last), '')
  )
  returning id into v_member_id;
  insert into public.member_contacts (member_id, church_id, email, city)
  values (v_member_id, v_church_id, v_email, nullif(trim(p_city), ''));

  insert into public.church_memberships (church_id, user_id, role, status)
  values (v_church_id, p_user_id, 'admin', 'active');
  update public.profiles set active_church_id = v_church_id where id = p_user_id;

  insert into public.legal_acceptances (church_id, user_id, document, version)
  values (v_church_id, p_user_id, 'cgv', p_cgv_version),
         (v_church_id, p_user_id, 'confidentialite', p_privacy_version);

  return jsonb_build_object('ok', true, 'church_id', v_church_id, 'slug', p_slug);
end;
$$;

revoke execute on function public.create_church(uuid, text, text, text, text, text, boolean, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.create_church(uuid, text, text, text, text, text, boolean, timestamptz, text, text)
  to service_role;

-- Fin du parcours « accès sur sélection » : aucune demande n'a été reçue.
drop table if exists public.early_access_accounts;
drop table if exists public.invitations;
drop table if exists public.waitlist;
