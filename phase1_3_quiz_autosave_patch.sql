-- ACL Expert Edition V2 — Phase 1.3
-- Cloud quiz attempts, automatic saving, and cross-device resume

create extension if not exists pgcrypto;

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  module_title text not null,
  question_count integer not null check (question_count > 0),
  question_ids jsonb not null default '[]'::jsonb,
  current_question_index integer not null default 0 check (current_question_index >= 0),
  answers jsonb not null default '[]'::jsonb,
  lifelines jsonb not null default '{}'::jsonb,
  score numeric not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

alter table public.quiz_attempts add column if not exists module_title text;
alter table public.quiz_attempts add column if not exists answers jsonb not null default '[]'::jsonb;
alter table public.quiz_attempts add column if not exists completed_at timestamptz;
alter table public.quiz_attempts add column if not exists duration_seconds integer;
alter table public.quiz_attempts add column if not exists started_at timestamptz not null default now();
alter table public.quiz_attempts add column if not exists updated_at timestamptz not null default now();
alter table public.quiz_attempts add column if not exists created_at timestamptz not null default now();

update public.quiz_attempts
set module_title = coalesce(nullif(module_title,''), module_id)
where module_title is null or module_title = '';

alter table public.quiz_attempts alter column module_title set not null;

create unique index if not exists quiz_attempts_one_open_per_module
on public.quiz_attempts(user_id, module_id)
where status = 'in_progress';

create index if not exists quiz_attempts_user_updated_idx
on public.quiz_attempts(user_id, updated_at desc);

create or replace function public.acl_touch_quiz_attempt()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.duration_seconds := coalesce(
      new.duration_seconds,
      greatest(0, floor(extract(epoch from (now() - new.started_at)))::integer)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists acl_touch_quiz_attempt_trigger on public.quiz_attempts;
create trigger acl_touch_quiz_attempt_trigger
before update on public.quiz_attempts
for each row execute function public.acl_touch_quiz_attempt();

alter table public.quiz_attempts enable row level security;

drop policy if exists "ACL students read own attempts" on public.quiz_attempts;
drop policy if exists "ACL students create own attempts" on public.quiz_attempts;
drop policy if exists "ACL students update own attempts" on public.quiz_attempts;
drop policy if exists "ACL admins read all attempts" on public.quiz_attempts;

create policy "ACL students read own attempts"
on public.quiz_attempts for select to authenticated
using (user_id = auth.uid());

create policy "ACL students create own attempts"
on public.quiz_attempts for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_status = 'active'
  )
);

create policy "ACL students update own attempts"
on public.quiz_attempts for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "ACL admins read all attempts"
on public.quiz_attempts for select to authenticated
using (public.acl_is_admin());
