-- ACL Expert Edition Phase 1.1: username registration support.
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;

create or replace function public.acl_sync_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, phone_e164, academic_year, institution)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(lower(trim(new.raw_user_meta_data->>'username')), ''),
    nullif(new.raw_user_meta_data->>'whatsapp', ''),
    nullif(new.raw_user_meta_data->>'academic_year', ''),
    nullif(new.raw_user_meta_data->>'institution', '')
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    username = coalesce(excluded.username, public.profiles.username),
    phone_e164 = coalesce(excluded.phone_e164, public.profiles.phone_e164),
    academic_year = coalesce(excluded.academic_year, public.profiles.academic_year),
    institution = coalesce(excluded.institution, public.profiles.institution);
  return new;
end;
$$;

drop trigger if exists acl_sync_new_user_profile_trigger on auth.users;
create trigger acl_sync_new_user_profile_trigger
after insert on auth.users
for each row execute function public.acl_sync_new_user_profile();
