-- Admin-only removal of experimental ACL accounts.
create schema if not exists private;
create or replace function private.acl_admin_delete_experimental_member(p_user_id uuid)
returns boolean language plpgsql security definer
set search_path = pg_catalog, private, public, auth
as $$
declare v_target_email text; v_target_role text;
begin
  if auth.uid() is null or not exists (select 1 from auth.users u where u.id=auth.uid() and lower(coalesce(u.email,''))='drmohamedalaa90@gmail.com') then raise exception 'Admin access required'; end if;
  if p_user_id is null or p_user_id=auth.uid() then raise exception 'The current admin account cannot be removed'; end if;
  select lower(coalesce(u.email,'')),coalesce(p.role,'student') into v_target_email,v_target_role from auth.users u left join public.profiles p on p.id=u.id where u.id=p_user_id;
  if not found then raise exception 'Member not found'; end if;
  if v_target_email='drmohamedalaa90@gmail.com' or v_target_role='admin' then raise exception 'Admin accounts cannot be removed'; end if;
  delete from private.acl_official_events e using private.acl_official_attempts a where e.attempt_id=a.id and a.user_id=p_user_id;
  delete from private.acl_official_attempts where user_id=p_user_id;
  delete from private.acl_notification_controls where owner_key=p_user_id::text;
  delete from auth.users where id=p_user_id;
  if not found then raise exception 'Member could not be removed'; end if;
  return true;
end;$$;
revoke all on function private.acl_admin_delete_experimental_member(uuid) from public;
grant execute on function private.acl_admin_delete_experimental_member(uuid) to authenticated;
create or replace function public.acl_admin_delete_experimental_member(p_user_id uuid)
returns boolean language sql security invoker set search_path = pg_catalog, private
as $$select private.acl_admin_delete_experimental_member(p_user_id);$$;
revoke all on function public.acl_admin_delete_experimental_member(uuid) from public;
grant execute on function public.acl_admin_delete_experimental_member(uuid) to authenticated;
