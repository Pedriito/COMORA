-- ════════════════════════════════════════════════════════════════════════
-- Démarrage guidé (étape 4).
--
--   • onboarding_progress : étapes passées et fermeture du guide, par église.
--   • import_members()    : importe une liste de personnes en une seule transaction,
--                           avec les droits de l'appelant (la RLS reste en vigueur) ;
--                           réservé aux administrateurs. Les adresses déjà connues de
--                           l'église sont ignorées. Aucun e-mail n'est envoyé.
-- ════════════════════════════════════════════════════════════════════════

create table public.onboarding_progress (
  church_id    uuid primary key references public.churches (id) on delete cascade,
  skipped      text[] not null default '{}'
               check (skipped <@ array['import', 'team', 'service', 'invite']),
  dismissed_at timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.onboarding_progress enable row level security;
alter table public.onboarding_progress force row level security;
revoke all on table public.onboarding_progress from anon, authenticated;
grant select, insert, update, delete on table public.onboarding_progress to service_role;
grant select, insert, update on table public.onboarding_progress to authenticated;

create policy "admins : lecture" on public.onboarding_progress
  for select to authenticated using (public.has_church_role(church_id, 'admin'));
create policy "admins : ajout" on public.onboarding_progress
  for insert to authenticated with check (public.has_church_role(church_id, 'admin'));
create policy "admins : modification" on public.onboarding_progress
  for update to authenticated using (public.has_church_role(church_id, 'admin'))
  with check (public.has_church_role(church_id, 'admin'));

-- p_rows : [{ first_name, last_name, email, phone, city, birthdate }, …] (au plus 2000 lignes)
create function public.import_members(p_church_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r          jsonb;
  v_email    text;
  v_id       uuid;
  v_imported integer := 0;
  v_skipped  integer := 0;
begin
  if not public.has_church_role(p_church_id, 'admin') then
    raise exception 'Réservé aux administrateurs de l''église' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'Liste de personnes invalide (2000 lignes au maximum)' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_email := nullif(lower(trim(r ->> 'email')), '');

    -- Adresse déjà connue de l'église (ou déjà vue plus haut dans le fichier)
    if v_email is not null and exists (
      select 1 from public.member_contacts c
      where c.church_id = p_church_id and c.email = v_email::extensions.citext
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.members (church_id, first_name, last_name, status)
    values (p_church_id, trim(r ->> 'first_name'), coalesce(trim(r ->> 'last_name'), ''), 'active')
    returning id into v_id;

    insert into public.member_contacts (member_id, church_id, email, phone, city, birthdate)
    values (
      v_id, p_church_id, v_email::extensions.citext,
      nullif(trim(r ->> 'phone'), ''), nullif(trim(r ->> 'city'), ''),
      nullif(r ->> 'birthdate', '')::date
    );
    v_imported := v_imported + 1;
  end loop;

  return jsonb_build_object('imported', v_imported, 'skipped', v_skipped);
end;
$$;

revoke execute on function public.import_members(uuid, jsonb) from public, anon;
grant execute on function public.import_members(uuid, jsonb) to authenticated, service_role;
