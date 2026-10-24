-- Privacy-safe registration availability check.
-- The public wrapper exposes only one boolean and never returns profile data.

create schema if not exists private;

create or replace function private.acl_registration_available(
  p_username text,
  p_phone text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private, public
as $$
  select
    p_username is not null
    and p_phone is not null
    and not exists (
      select 1
      from public.profiles p
      where lower(p.username) = lower(trim(p_username))
         or p.phone_e164 = trim(p_phone)
    );
$$;

revoke all on function private.acl_registration_available(text, text) from public;
grant execute on function private.acl_registration_available(text, text) to anon, authenticated;

create or replace function public.acl_registration_available(
  p_username text,
  p_phone text
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, private, public
as $$
  select private.acl_registration_available(p_username, p_phone);
$$;

revoke all on function public.acl_registration_available(text, text) from public;
grant execute on function public.acl_registration_available(text, text) to anon, authenticated;
