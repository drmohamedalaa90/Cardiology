-- ACL Expert Edition V2 — Phase 2.1
-- Database-driven modules, publishing, ordering, and access assignments
-- Safe to run more than once.

create extension if not exists pgcrypto;

-- Helper functions used by RLS. These do not expose privileged keys.
create or replace function public.acl_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;

create or replace function public.acl_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and account_status = 'active'
  );
$$;

grant execute on function public.acl_is_admin() to authenticated;
grant execute on function public.acl_is_active_user() to authenticated;

-- Preserve the existing text module id because quiz_attempts.module_id already uses it.
create table if not exists public.modules (
  id text primary key,
  title text not null,
  description text
);

alter table public.modules add column if not exists slug text;
alter table public.modules add column if not exists short_description text;
alter table public.modules add column if not exists full_description text;
alter table public.modules add column if not exists category text not null default 'General Cardiology';
alter table public.modules add column if not exists difficulty text not null default 'foundation';
alter table public.modules add column if not exists cover_image_url text;
alter table public.modules add column if not exists estimated_minutes integer not null default 10;
alter table public.modules add column if not exists question_count integer not null default 0;
alter table public.modules add column if not exists status text not null default 'draft';
alter table public.modules add column if not exists access_type text not null default 'open';
alter table public.modules add column if not exists minimum_score numeric not null default 0;
alter table public.modules add column if not exists passcode_hash text;
alter table public.modules add column if not exists learning_mode_enabled boolean not null default true;
alter table public.modules add column if not exists competition_mode_enabled boolean not null default false;
alter table public.modules add column if not exists opens_at timestamptz;
alter table public.modules add column if not exists closes_at timestamptz;
alter table public.modules add column if not exists display_order integer not null default 100;
alter table public.modules add column if not exists is_featured boolean not null default false;
alter table public.modules add column if not exists launch_path text;
alter table public.modules add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.modules add column if not exists created_at timestamptz not null default now();
alter table public.modules add column if not exists updated_at timestamptz not null default now();

update public.modules
set slug = coalesce(nullif(slug, ''), id),
    short_description = coalesce(nullif(short_description, ''), nullif(description, ''), 'ACL Expert Edition module'),
    full_description = coalesce(full_description, description),
    category = coalesce(nullif(category, ''), 'General Cardiology'),
    difficulty = case when difficulty in ('foundation','intermediate','advanced','expert') then difficulty else 'foundation' end,
    status = case when status in ('draft','published','coming_soon','archived') then status else 'draft' end,
    access_type = case when access_type in ('open','passcode','minimum_score','admin_assigned') then access_type else 'open' end,
    estimated_minutes = greatest(1, coalesce(estimated_minutes, 10)),
    question_count = greatest(0, coalesce(question_count, 0)),
    display_order = coalesce(display_order, 100),
    updated_at = now();

create unique index if not exists modules_slug_unique on public.modules(lower(slug));
create index if not exists modules_catalogue_idx on public.modules(status, display_order, title);

alter table public.modules drop constraint if exists modules_difficulty_check;
alter table public.modules add constraint modules_difficulty_check
  check (difficulty in ('foundation','intermediate','advanced','expert'));
alter table public.modules drop constraint if exists modules_status_check;
alter table public.modules add constraint modules_status_check
  check (status in ('draft','published','coming_soon','archived'));
alter table public.modules drop constraint if exists modules_access_type_check;
alter table public.modules add constraint modules_access_type_check
  check (access_type in ('open','passcode','minimum_score','admin_assigned'));
alter table public.modules drop constraint if exists modules_estimated_minutes_check;
alter table public.modules add constraint modules_estimated_minutes_check check (estimated_minutes > 0);
alter table public.modules drop constraint if exists modules_question_count_check;
alter table public.modules add constraint modules_question_count_check check (question_count >= 0);

create or replace function public.acl_touch_module()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.slug := lower(trim(new.slug));
  return new;
end;
$$;

drop trigger if exists acl_touch_module_trigger on public.modules;
create trigger acl_touch_module_trigger
before insert or update on public.modules
for each row execute function public.acl_touch_module();

create table if not exists public.module_assignments (
  id uuid primary key default gen_random_uuid(),
  module_id text not null references public.modules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  unique(module_id, user_id)
);

create index if not exists module_assignments_user_idx
  on public.module_assignments(user_id, module_id);

alter table public.modules enable row level security;
alter table public.module_assignments enable row level security;

drop policy if exists "ACL active users view catalogue modules" on public.modules;
drop policy if exists "ACL admins view all modules" on public.modules;
drop policy if exists "ACL admins create modules" on public.modules;
drop policy if exists "ACL admins update modules" on public.modules;
drop policy if exists "ACL admins delete modules" on public.modules;

create policy "ACL active users view catalogue modules"
on public.modules for select to authenticated
using (
  public.acl_is_active_user()
  and status in ('published','coming_soon')
);

create policy "ACL admins view all modules"
on public.modules for select to authenticated
using (public.acl_is_admin());

create policy "ACL admins create modules"
on public.modules for insert to authenticated
with check (public.acl_is_admin());

create policy "ACL admins update modules"
on public.modules for update to authenticated
using (public.acl_is_admin())
with check (public.acl_is_admin());

create policy "ACL admins delete modules"
on public.modules for delete to authenticated
using (public.acl_is_admin());

drop policy if exists "ACL users read own module assignments" on public.module_assignments;
drop policy if exists "ACL admins manage module assignments" on public.module_assignments;

create policy "ACL users read own module assignments"
on public.module_assignments for select to authenticated
using (
  user_id = auth.uid()
  and public.acl_is_active_user()
);

create policy "ACL admins manage module assignments"
on public.module_assignments for all to authenticated
using (public.acl_is_admin())
with check (public.acl_is_admin());

grant select on public.modules to authenticated;
grant insert, update, delete on public.modules to authenticated;
grant select, insert, update, delete on public.module_assignments to authenticated;

-- Starter catalogue. Existing PPCI attempts remain valid because its id is unchanged.
insert into public.modules (
  id, slug, title, description, short_description, full_description,
  category, difficulty, estimated_minutes, question_count, status,
  access_type, minimum_score, learning_mode_enabled,
  competition_mode_enabled, display_order, is_featured, launch_path
) values
('ppci-fundamentals','ppci-fundamentals','Primary PCI Fundamentals',
 'Primary PCI pilot module with cloud autosave and cross-device resume.',
 'Core decisions, workflow, and safety principles in primary PCI.',
 'A foundation module covering practical primary PCI decisions and procedural safety.',
 'Interventional Cardiology','foundation',10,2,'published','open',0,true,false,1,true,'modules/ppci/'),
('acute-coronary-syndromes','acute-coronary-syndromes','Acute Coronary Syndromes',
 'ESC-guideline-based assessment and management of acute coronary syndromes.',
 'Guideline-focused ACS learning and competition module.',
 'Clinical scenarios, antithrombotic strategy, invasive timing, and secondary prevention.',
 'Ischaemic Heart Disease','intermediate',25,0,'coming_soon','open',0,true,true,2,true,null),
('heart-failure','heart-failure','Heart Failure',
 'Evidence-based diagnosis and management of acute and chronic heart failure.',
 'Heart failure guidelines, phenotypes, and contemporary therapies.',
 'A structured module covering diagnosis, pharmacotherapy, devices, and acute care.',
 'Heart Failure','intermediate',25,0,'coming_soon','open',0,true,true,3,false,null),
('ecg-demystified','ecg-demystified','ECG Demystified',
 'Progressive ECG interpretation from fundamentals to clinical patterns.',
 'ECG interpretation with image-based clinical questions.',
 'A visual learning path for rhythm, conduction, ischaemia, and advanced ECG patterns.',
 'Electrocardiography','foundation',20,0,'coming_soon','open',0,true,true,4,true,null),
('mitral-valve-interventions','mitral-valve-interventions','Mitral Valve Interventions',
 'Advanced transcatheter and surgical decision-making for mitral valve disease.',
 'Advanced mitral intervention concepts and evidence.',
 'Patient selection, imaging, TEER, TMVR, procedural planning, and landmark evidence.',
 'Structural Heart Disease','expert',40,0,'draft','minimum_score',70,true,false,5,false,null),
('left-main-pci','left-main-pci','Left Main PCI',
 'Revascularization decisions and PCI strategy for left main coronary disease.',
 'Evidence, imaging, and techniques for left main PCI.',
 'PCI versus CABG, bifurcation strategy, intracoronary imaging, and outcomes.',
 'Interventional Cardiology','advanced',35,0,'draft','minimum_score',70,true,false,6,false,null),
('cto-interventions','cto-interventions','CTO Interventions',
 'Contemporary chronic total occlusion PCI strategy and techniques.',
 'CTO planning, crossing algorithms, and evidence.',
 'Antegrade and retrograde strategies, dissection re-entry, imaging, and complications.',
 'Interventional Cardiology','expert',45,0,'draft','admin_assigned',0,true,false,7,false,null),
('mechanical-circulatory-support','mechanical-circulatory-support','Mechanical Circulatory Support',
 'Device selection and deployment in cardiogenic shock and high-risk PCI.',
 'MCS indications, devices, evidence, and deployment.',
 'IABP, Impella, VA-ECMO, patient selection, complications, and practical deployment.',
 'Critical Care Cardiology','advanced',35,0,'draft','admin_assigned',0,true,false,8,false,null)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  short_description = coalesce(nullif(public.modules.short_description,''), excluded.short_description),
  full_description = coalesce(public.modules.full_description, excluded.full_description),
  category = coalesce(nullif(public.modules.category,''), excluded.category),
  launch_path = coalesce(public.modules.launch_path, excluded.launch_path),
  updated_at = now();
