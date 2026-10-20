-- ════════════════════════════════════════════════════════════════════════
-- Stockage cloisonné par église : chaque fichier vit sous `<church_id>/…`.
--
--   church-public  : images (annonces, médiathèque, fonds de projection,
--                    photo des pasteurs) — lisibles par lien, noms aléatoires
--   church-private : documents (PDF de prédication) — lisibles par les seuls
--                    membres de l'église, via des URL signées
-- L'écriture est réservée aux responsables de l'église du dossier.
-- ════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('church-public', 'church-public', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']),
  ('church-private', 'church-private', false, 20971520,
   array['application/pdf'])
on conflict (id) do nothing;

-- Église propriétaire d'un fichier : premier dossier du chemin, s'il s'agit d'un UUID
create function public.storage_church_id(object_name text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;
grant execute on function public.storage_church_id(text) to authenticated, anon, service_role;

create policy "church-public : ajout par les responsables" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'church-public' and public.has_church_role(public.storage_church_id(name), 'responsable'));
create policy "church-public : modification par les responsables" on storage.objects
  for update to authenticated
  using (bucket_id = 'church-public' and public.has_church_role(public.storage_church_id(name), 'responsable'))
  with check (bucket_id = 'church-public' and public.has_church_role(public.storage_church_id(name), 'responsable'));
create policy "church-public : suppression par les responsables" on storage.objects
  for delete to authenticated
  using (bucket_id = 'church-public' and public.has_church_role(public.storage_church_id(name), 'responsable'));
-- Liste des fichiers (lecture par l'API) : membres de l'église ; le
-- téléchargement par lien public ne passe pas par cette policy.
create policy "church-public : liste par les membres" on storage.objects
  for select to authenticated
  using (bucket_id = 'church-public' and public.is_church_member(public.storage_church_id(name)));

create policy "church-private : lecture par les membres" on storage.objects
  for select to authenticated
  using (bucket_id = 'church-private' and public.is_church_member(public.storage_church_id(name)));
create policy "church-private : ajout par les responsables" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'church-private' and public.has_church_role(public.storage_church_id(name), 'responsable'));
create policy "church-private : modification par les responsables" on storage.objects
  for update to authenticated
  using (bucket_id = 'church-private' and public.has_church_role(public.storage_church_id(name), 'responsable'))
  with check (bucket_id = 'church-private' and public.has_church_role(public.storage_church_id(name), 'responsable'));
create policy "church-private : suppression par les responsables" on storage.objects
  for delete to authenticated
  using (bucket_id = 'church-private' and public.has_church_role(public.storage_church_id(name), 'responsable'));

-- ════════════════════════════════════════════════════════════════════════
-- Temps réel : canaux privés par église, `church:<church_id>:<sujet>`.
-- Seuls les membres de l'église peuvent s'y abonner ; seuls les responsables
-- peuvent y diffuser (projection).
-- ════════════════════════════════════════════════════════════════════════

create function public.realtime_church_id(topic text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when topic ~ '^church:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:'
    then split_part(topic, ':', 2)::uuid
  end;
$$;
grant execute on function public.realtime_church_id(text) to authenticated, service_role;

create policy "membres : écoute des canaux de l'église" on realtime.messages
  for select to authenticated
  using (public.is_church_member(public.realtime_church_id((select realtime.topic()))));

create policy "responsables : diffusion sur les canaux de l'église" on realtime.messages
  for insert to authenticated
  with check (public.has_church_role(public.realtime_church_id((select realtime.topic())), 'responsable'));
