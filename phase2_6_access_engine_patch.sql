-- ACL Expert Edition V2 — Phase 2.6
-- Adaptive access rules and learning pathways
-- Safe to run more than once after Phase 2.5.

create extension if not exists pgcrypto;

create table if not exists public.learning_tracks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  display_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.track_modules (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.learning_tracks(id) on delete cascade,
  module_id text not null references public.modules(id) on delete cascade,
  step_order integer not null default 1,
  is_required boolean not null default true,
  unique(track_id,module_id)
);

create table if not exists public.student_tracks (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.learning_tracks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique(track_id,user_id)
);

create table if not exists public.module_unlock_rules (
  id uuid primary key default gen_random_uuid(),
  module_id text not null references public.modules(id) on delete cascade,
  rule_type text not null check (rule_type in ('prerequisite_module','minimum_total_score','academic_position','manual_assignment')),
  prerequisite_module_id text references public.modules(id) on delete cascade,
  minimum_value numeric,
  allowed_positions text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists module_unlock_rules_module_idx on public.module_unlock_rules(module_id,is_active);
create index if not exists track_modules_track_idx on public.track_modules(track_id,step_order);
create index if not exists student_tracks_user_idx on public.student_tracks(user_id,track_id);

alter table public.learning_tracks enable row level security;
alter table public.track_modules enable row level security;
alter table public.student_tracks enable row level security;
alter table public.module_unlock_rules enable row level security;

drop policy if exists "ACL users view published tracks" on public.learning_tracks;
drop policy if exists "ACL admins manage tracks" on public.learning_tracks;
create policy "ACL users view published tracks" on public.learning_tracks for select to authenticated
using (status='published' and public.acl_is_active_user());
create policy "ACL admins manage tracks" on public.learning_tracks for all to authenticated
using (public.acl_is_admin()) with check (public.acl_is_admin());

drop policy if exists "ACL users view published track modules" on public.track_modules;
drop policy if exists "ACL admins manage track modules" on public.track_modules;
create policy "ACL users view published track modules" on public.track_modules for select to authenticated
using (public.acl_is_active_user() and exists (select 1 from public.learning_tracks t where t.id=track_id and t.status='published'));
create policy "ACL admins manage track modules" on public.track_modules for all to authenticated
using (public.acl_is_admin()) with check (public.acl_is_admin());

drop policy if exists "ACL users view own track assignments" on public.student_tracks;
drop policy if exists "ACL admins manage student tracks" on public.student_tracks;
create policy "ACL users view own track assignments" on public.student_tracks for select to authenticated
using (user_id=auth.uid() and public.acl_is_active_user());
create policy "ACL admins manage student tracks" on public.student_tracks for all to authenticated
using (public.acl_is_admin()) with check (public.acl_is_admin());

drop policy if exists "ACL users view unlock rules" on public.module_unlock_rules;
drop policy if exists "ACL admins manage unlock rules" on public.module_unlock_rules;
create policy "ACL users view unlock rules" on public.module_unlock_rules for select to authenticated
using (public.acl_is_active_user());
create policy "ACL admins manage unlock rules" on public.module_unlock_rules for all to authenticated
using (public.acl_is_admin()) with check (public.acl_is_admin());

grant select on public.learning_tracks, public.track_modules, public.student_tracks, public.module_unlock_rules to authenticated;
grant insert,update,delete on public.learning_tracks, public.track_modules, public.student_tracks, public.module_unlock_rules to authenticated;

-- Secure access evaluator used by the catalogue and learning pathway.
create or replace function public.acl_module_access(p_module_id text)
returns table(allowed boolean, reason text)
language plpgsql
security definer
set search_path=public
as $$
declare
  m public.modules%rowtype;
  total_score numeric := 0;
  r record;
  user_position text;
  assigned boolean := false;
begin
  if not public.acl_is_active_user() then return query select false,'Inactive account'::text; return; end if;
  select * into m from public.modules where id=p_module_id;
  if not found then return query select false,'Module not found'::text; return; end if;
  if m.status <> 'published' then return query select false,case when m.status='coming_soon' then 'Coming soon' else 'Not published' end; return; end if;
  if m.opens_at is not null and now() < m.opens_at then return query select false,('Opens '||to_char(m.opens_at,'YYYY-MM-DD HH24:MI'))::text; return; end if;
  if m.closes_at is not null and now() > m.closes_at then return query select false,'Access window closed'::text; return; end if;

  select exists(select 1 from public.module_assignments a where a.module_id=p_module_id and a.user_id=auth.uid() and (a.expires_at is null or a.expires_at>now())) into assigned;
  select coalesce(sum(score),0) into total_score from public.quiz_attempts where user_id=auth.uid() and status='completed';
  select academic_year into user_position from public.profiles where id=auth.uid();

  if m.access_type='admin_assigned' and not assigned then return query select false,'Admin assignment required'::text; return; end if;
  if m.access_type='minimum_score' and total_score < coalesce(m.minimum_score,0) then return query select false,('Requires '||m.minimum_score||' points')::text; return; end if;
  if m.access_type='passcode' and not assigned then return query select false,'Passcode or admin unlock required'::text; return; end if;

  for r in select * from public.module_unlock_rules where module_id=p_module_id and is_active loop
    if r.rule_type='prerequisite_module' and not exists (
      select 1 from public.quiz_attempts qa where qa.user_id=auth.uid() and qa.module_id=r.prerequisite_module_id and qa.status='completed'
    ) then
      return query select false,('Complete prerequisite: '||coalesce((select title from public.modules where id=r.prerequisite_module_id),r.prerequisite_module_id))::text; return;
    elsif r.rule_type='minimum_total_score' and total_score < coalesce(r.minimum_value,0) then
      return query select false,('Requires '||r.minimum_value||' total points')::text; return;
    elsif r.rule_type='academic_position' and coalesce(array_length(r.allowed_positions,1),0)>0 and not (user_position=any(r.allowed_positions)) then
      return query select false,'Not available for your academic position'::text; return;
    elsif r.rule_type='manual_assignment' and not assigned then
      return query select false,'Manual assignment required'::text; return;
    end if;
  end loop;

  return query select true,'Unlocked'::text;
end;
$$;

grant execute on function public.acl_module_access(text) to authenticated;

insert into public.learning_tracks(slug,title,description,status,display_order)
values ('interventional-cardiology','Interventional Cardiology Track','A structured pathway from primary PCI foundations to advanced coronary intervention.','published',1)
on conflict (slug) do update set title=excluded.title,description=excluded.description,status=excluded.status,updated_at=now();

insert into public.track_modules(track_id,module_id,step_order,is_required)
select t.id,x.module_id,x.step_order,true
from public.learning_tracks t
cross join (values
 ('ppci-fundamentals',1),
 ('acute-coronary-syndromes',2),
 ('left-main-pci',3),
 ('cto-interventions',4),
 ('mechanical-circulatory-support',5)
) as x(module_id,step_order)
where t.slug='interventional-cardiology'
on conflict (track_id,module_id) do update set step_order=excluded.step_order,is_required=excluded.is_required;
