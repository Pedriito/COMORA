-- Libère le nom `profiles` pour l'espace de gestion (migration suivante) :
-- la table des comptes créés depuis une invitation d'accès anticipé devient
-- `early_access_accounts`. Sans effet si elle a déjà été renommée.
do $$
begin
  if to_regclass('public.profiles') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'waitlist_id'
     ) then
    alter table public.profiles rename to early_access_accounts;
    alter policy "lecture de son profil" on public.early_access_accounts rename to "lecture de son compte";
  end if;
end;
$$;
