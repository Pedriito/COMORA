-- ════════════════════════════════════════════════════════════════════════
-- Essai de 30 jours et lecture seule (étape 5).
--
--   • church_access()          : état réel d'une église, calculé depuis les dates
--                                (aucune tâche planifiée n'est nécessaire pour bloquer).
--   • church_is_writable()     : vrai en essai, abonnement actif ou période de grâce.
--   • church_effective_offer() : l'offre qui s'applique (Communauté pendant l'essai).
--   • Policies RESTRICTIVES    : une par type d'écriture et par table d'église ; elles
--                                s'ajoutent à toutes les policies existantes, présentes
--                                et futures. La lecture n'est jamais touchée.
--   • church_lifecycle_step()  : passe en lecture seule les essais et grâces expirés et
--                                programme la suppression (conservation 90 jours).
-- Ne sont jamais bloqués : la lecture, les exports, le paiement, le compte personnel.
-- ════════════════════════════════════════════════════════════════════════

alter table public.churches
  add column grace_ends_at         timestamptz,
  add column deletion_scheduled_at timestamptz;

comment on column public.churches.grace_ends_at is 'Fin de la période de grâce après un impayé (7 jours).';
comment on column public.churches.deletion_scheduled_at is 'Date de suppression programmée : fin d''accès + 90 jours. Effacée si l''église paie.';

create function public.church_access(p_church uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case c.billing_status
    when 'active' then 'active'
    when 'trialing' then case when c.trial_ends_at is null or c.trial_ends_at > now() then 'trial' else 'read_only' end
    when 'past_due' then case when c.grace_ends_at is not null and c.grace_ends_at > now() then 'grace' else 'read_only' end
    when 'pending_deletion' then 'pending_deletion'
    else 'read_only'
  end
  from public.churches c where c.id = p_church;
$$;

create function public.church_is_writable(p_church uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.church_access(p_church) in ('trial', 'active', 'grace'), false);
$$;

create function public.church_effective_offer(p_church uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.church_access(p_church) = 'trial' then coalesce(c.offer, 'communaute') else c.offer end
  from public.churches c where c.id = p_church;
$$;

revoke execute on function public.church_access(uuid), public.church_is_writable(uuid), public.church_effective_offer(uuid) from public, anon;
grant execute on function public.church_access(uuid), public.church_is_writable(uuid), public.church_effective_offer(uuid) to authenticated, service_role;

-- Écriture refusée en lecture seule, sur chaque table qui porte un church_id.
-- Exceptions : traces légales, progression du guide, abonnements au calendrier et
-- liens d'activation de compte (gérés par le serveur ou propres à la personne).
do $$
declare
  t text;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'church_id' and tb.table_type = 'BASE TABLE'
       and c.table_name not in ('legal_acceptances', 'onboarding_progress', 'calendar_feeds', 'account_activations')
  loop
    execute format('create policy "lecture seule : ajout refusé" on public.%I as restrictive for insert to authenticated with check (public.church_is_writable(church_id))', t);
    execute format('create policy "lecture seule : modification refusée" on public.%I as restrictive for update to authenticated using (public.church_is_writable(church_id)) with check (public.church_is_writable(church_id))', t);
    execute format('create policy "lecture seule : suppression refusée" on public.%I as restrictive for delete to authenticated using (public.church_is_writable(church_id))', t);
  end loop;
end;
$$;

-- Fichiers : mêmes règles pour les dépôts de l'église
create policy "lecture seule : ajout refusé" on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id not in ('church-public', 'church-private') or public.church_is_writable(public.storage_church_id(name)));
create policy "lecture seule : modification refusée" on storage.objects
  as restrictive for update to authenticated
  using (bucket_id not in ('church-public', 'church-private') or public.church_is_writable(public.storage_church_id(name)))
  with check (bucket_id not in ('church-public', 'church-private') or public.church_is_writable(public.storage_church_id(name)));
create policy "lecture seule : suppression refusée" on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id not in ('church-public', 'church-private') or public.church_is_writable(public.storage_church_id(name)));

-- Un lien d'inscription ne fonctionne plus dans une église en lecture seule
create or replace function public.consume_invite_token(target_hash text)
returns uuid
language sql volatile security definer set search_path = ''
as $$
  update public.invite_tokens t
     set uses_count = t.uses_count + 1
   where t.token_hash = target_hash
     and t.revoked_at is null
     and (t.expires_at is null or t.expires_at > now())
     and (t.max_uses is null or t.uses_count < t.max_uses)
     and public.church_is_writable(t.church_id)
  returning t.church_id;
$$;

-- Une église qui paie n'est plus programmée pour suppression
create function public.churches_clear_deletion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.billing_status = 'active' then
    new.deletion_scheduled_at := null;
    new.grace_ends_at := null;
  end if;
  return new;
end;
$$;
create trigger churches_clear_deletion before update on public.churches
  for each row execute function public.churches_clear_deletion();

-- Passage automatique en lecture seule, appelé chaque jour par le serveur.
-- Ne supprime rien : la suppression est une étape distincte, validée à part.
create function public.church_lifecycle_step()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trials integer;
  v_graces integer;
begin
  with moved as (
    update public.churches
       set billing_status = 'read_only',
           deletion_scheduled_at = coalesce(deletion_scheduled_at, trial_ends_at + interval '90 days')
     where billing_status = 'trialing' and trial_ends_at is not null and trial_ends_at <= now()
    returning 1
  )
  select count(*) into v_trials from moved;

  with moved as (
    update public.churches
       set billing_status = 'read_only',
           deletion_scheduled_at = coalesce(deletion_scheduled_at, grace_ends_at + interval '90 days')
     where billing_status = 'past_due' and grace_ends_at is not null and grace_ends_at <= now()
    returning 1
  )
  select count(*) into v_graces from moved;

  return jsonb_build_object('trials_ended', v_trials, 'graces_ended', v_graces);
end;
$$;
revoke execute on function public.church_lifecycle_step() from public, anon, authenticated;
grant execute on function public.church_lifecycle_step() to service_role;
