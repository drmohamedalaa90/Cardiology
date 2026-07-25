-- ACL Expert Edition V2 — Phase 1.2
-- Admin dashboard, account control and secure profile access

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text default 'student';
alter table public.profiles add column if not exists account_status text default 'active';
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.profiles add column if not exists last_seen_at timestamptz;

update public.profiles p set email = lower(u.email)
from auth.users u where p.id = u.id and u.email is not null;

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = case when lower(trim(coalesce(role,'')))='admin' then 'admin' else 'student' end;
alter table public.profiles alter column role set default 'student';
alter table public.profiles alter column role set not null;
alter table public.profiles add constraint profiles_role_check check (role in ('student','admin'));

alter table public.profiles drop constraint if exists profiles_account_status_check;
update public.profiles set account_status = case when lower(trim(coalesce(account_status,'')))='suspended' then 'suspended' else 'active' end;
alter table public.profiles alter column account_status set default 'active';
alter table public.profiles alter column account_status set not null;
alter table public.profiles add constraint profiles_account_status_check check (account_status in ('active','suspended'));

create or replace function public.acl_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and account_status = 'active'
  );
$$;
revoke all on function public.acl_is_admin() from public;
grant execute on function public.acl_is_admin() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "ACL users read own profile" on public.profiles;
drop policy if exists "ACL users update own profile" on public.profiles;
drop policy if exists "ACL admins read all profiles" on public.profiles;
drop policy if exists "ACL admins update all profiles" on public.profiles;

create policy "ACL users read own profile" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "ACL users update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.acl_protect_profile_control_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.acl_is_admin() then
    new.role := old.role;
    new.account_status := old.account_status;
    new.email := old.email;
    new.full_name := old.full_name;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists acl_protect_profile_control_fields_trigger on public.profiles;
create trigger acl_protect_profile_control_fields_trigger
before update on public.profiles
for each row execute function public.acl_protect_profile_control_fields();

create policy "ACL admins read all profiles" on public.profiles
for select to authenticated using (public.acl_is_admin());

create policy "ACL admins update all profiles" on public.profiles
for update to authenticated using (public.acl_is_admin())
with check (public.acl_is_admin());

-- Replace the email below with the exact owner account before running this line.
-- update public.profiles set role='admin', account_status='active' where lower(email)=lower('YOUR_ADMIN_EMAIL@example.com');
