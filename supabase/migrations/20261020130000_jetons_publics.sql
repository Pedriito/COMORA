-- ════════════════════════════════════════════════════════════════════════
-- Liens publics, tous liés à une église et vérifiés côté serveur.
-- Seule l'empreinte SHA-256 des jetons est stockée.
-- Les réponses aux affectations utilisent des jetons signés (HMAC, sans table).
-- ════════════════════════════════════════════════════════════════════════

-- Abonnement calendrier (ICS) : un lien par compte et par église, révocable
create table public.calendar_feeds (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null default public.current_church_id()
             references public.churches (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index calendar_feeds_church_user_idx on public.calendar_feeds (church_id, user_id);

-- Partage d'une setlist en lecture seule, avec expiration
create table public.plan_share_links (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null default public.current_church_id(),
  plan_id    uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (plan_id, church_id) references public.plans (id, church_id) on delete cascade
);
create index plan_share_links_plan_id_idx on public.plan_share_links (plan_id);
create index plan_share_links_church_id_idx on public.plan_share_links (church_id);

-- Activation d'un compte invité (lien envoyé par e-mail, usage unique).
-- Le lien de connexion Supabase est généré au moment de l'activation et
-- n'est jamais stocké. Accès serveur uniquement (aucune policy).
create table public.account_activations (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index account_activations_user_id_idx on public.account_activations (user_id);
create index account_activations_church_id_idx on public.account_activations (church_id);

do $$
declare
  t text;
begin
  foreach t in array array['calendar_feeds', 'plan_share_links', 'account_activations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end;
$$;

grant select, insert, update, delete on public.calendar_feeds, public.plan_share_links to authenticated;

-- Calendrier : chacun gère ses propres liens, dans une église dont il est membre
create policy "soi : lecture" on public.calendar_feeds
  for select to authenticated using (user_id = (select auth.uid()) and public.is_church_member(church_id));
create policy "soi : ajout" on public.calendar_feeds
  for insert to authenticated with check (user_id = (select auth.uid()) and public.is_church_member(church_id));
create policy "soi : modification" on public.calendar_feeds
  for update to authenticated using (user_id = (select auth.uid()) and public.is_church_member(church_id))
  with check (user_id = (select auth.uid()) and public.is_church_member(church_id));
create policy "soi : suppression" on public.calendar_feeds
  for delete to authenticated using (user_id = (select auth.uid()) and public.is_church_member(church_id));

-- Partage : les responsables créent et révoquent les liens
create policy "membres : lecture" on public.plan_share_links
  for select to authenticated using (public.is_church_member(church_id));
create policy "responsables : ajout" on public.plan_share_links
  for insert to authenticated with check (public.has_church_role(church_id, 'responsable'));
create policy "responsables : modification" on public.plan_share_links
  for update to authenticated using (public.has_church_role(church_id, 'responsable'))
  with check (public.has_church_role(church_id, 'responsable'));
create policy "responsables : suppression" on public.plan_share_links
  for delete to authenticated using (public.has_church_role(church_id, 'responsable'));

-- Consommation atomique d'un lien d'inscription : vérifie l'expiration, la
-- révocation et le nombre d'utilisations, et incrémente en une seule requête.
-- Renvoie l'église du lien, ou null. Appelée par le serveur (clé secrète).
create function public.consume_invite_token(target_hash text)
returns uuid
language sql volatile security definer set search_path = ''
as $$
  update public.invite_tokens t
     set uses_count = t.uses_count + 1
   where t.token_hash = target_hash
     and t.revoked_at is null
     and (t.expires_at is null or t.expires_at > now())
     and (t.max_uses is null or t.uses_count < t.max_uses)
  returning t.church_id;
$$;
revoke execute on function public.consume_invite_token(text) from public, anon, authenticated;
grant execute on function public.consume_invite_token(text) to service_role;
