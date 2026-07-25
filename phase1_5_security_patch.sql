-- ACL Expert Edition V2 — Phase 1.5
-- Final security hardening for profiles and quiz attempts.

create or replace function public.acl_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and account_status = 'active'
  );
$$;
revoke all on function public.acl_is_active_user() from public;
grant execute on function public.acl_is_active_user() to authenticated;

drop policy if exists "ACL users read own profile" on public.profiles;
drop policy if exists "ACL users update own profile" on public.profiles;
drop policy if exists "ACL admins read all profiles" on public.profiles;
drop policy if exists "ACL admins update all profiles" on public.profiles;

create policy "ACL users read own profile" on public.profiles
for select to authenticated
using (id = auth.uid() and public.acl_is_active_user());

create policy "ACL users update own profile" on public.profiles
for update to authenticated
using (id = auth.uid() and public.acl_is_active_user())
with check (id = auth.uid() and public.acl_is_active_user());

create policy "ACL admins read all profiles" on public.profiles
for select to authenticated using (public.acl_is_admin());

create policy "ACL admins update all profiles" on public.profiles
for update to authenticated using (public.acl_is_admin())
with check (public.acl_is_admin());

drop policy if exists "ACL students read own attempts" on public.quiz_attempts;
drop policy if exists "ACL students create own attempts" on public.quiz_attempts;
drop policy if exists "ACL students update own attempts" on public.quiz_attempts;
drop policy if exists "ACL admins read all attempts" on public.quiz_attempts;

create policy "ACL students read own attempts" on public.quiz_attempts
for select to authenticated
using (user_id = auth.uid() and public.acl_is_active_user());

create policy "ACL students create own attempts" on public.quiz_attempts
for insert to authenticated
with check (user_id = auth.uid() and public.acl_is_active_user());

create policy "ACL students update own attempts" on public.quiz_attempts
for update to authenticated
using (user_id = auth.uid() and public.acl_is_active_user())
with check (user_id = auth.uid() and public.acl_is_active_user());

create policy "ACL admins read all attempts" on public.quiz_attempts
for select to authenticated using (public.acl_is_admin());
