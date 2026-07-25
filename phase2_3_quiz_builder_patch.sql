-- ACL Expert Edition V2 — Phase 2.3
-- Admin quiz builder and reusable quiz definitions
-- Run after phase2_2_question_bank_patch.sql. Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  module_id text not null references public.modules(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  mode text not null default 'learning',
  selection_mode text not null default 'fixed',
  question_count integer not null default 10,
  time_limit_seconds integer,
  randomize_questions boolean not null default false,
  randomize_options boolean not null default true,
  allow_review boolean not null default true,
  show_explanations boolean not null default true,
  attempts_allowed integer,
  passing_percentage numeric not null default 70,
  status text not null default 'draft',
  display_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(module_id, slug)
);

create table if not exists public.quiz_questions (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  display_order integer not null default 1,
  is_required boolean not null default true,
  points_override numeric,
  primary key (quiz_id, question_id)
);

alter table public.quizzes drop constraint if exists quizzes_mode_check;
alter table public.quizzes add constraint quizzes_mode_check check (mode in ('learning','competition','practice'));
alter table public.quizzes drop constraint if exists quizzes_selection_mode_check;
alter table public.quizzes add constraint quizzes_selection_mode_check check (selection_mode in ('fixed','random'));
alter table public.quizzes drop constraint if exists quizzes_status_check;
alter table public.quizzes add constraint quizzes_status_check check (status in ('draft','published','archived'));
alter table public.quizzes drop constraint if exists quizzes_question_count_check;
alter table public.quizzes add constraint quizzes_question_count_check check (question_count between 1 and 500);
alter table public.quizzes drop constraint if exists quizzes_passing_check;
alter table public.quizzes add constraint quizzes_passing_check check (passing_percentage between 0 and 100);

create index if not exists quizzes_module_idx on public.quizzes(module_id,status,display_order);
create index if not exists quiz_questions_order_idx on public.quiz_questions(quiz_id,display_order);

create or replace function public.acl_touch_quiz()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.slug := lower(regexp_replace(trim(new.slug), '[^a-zA-Z0-9]+', '-', 'g'));
  new.slug := trim(both '-' from new.slug);
  return new;
end; $$;

drop trigger if exists acl_touch_quiz_trigger on public.quizzes;
create trigger acl_touch_quiz_trigger before insert or update on public.quizzes
for each row execute function public.acl_touch_quiz();

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;

drop policy if exists "ACL admins manage quizzes" on public.quizzes;
drop policy if exists "ACL users read published quizzes" on public.quizzes;
drop policy if exists "ACL admins manage quiz questions" on public.quiz_questions;
drop policy if exists "ACL users read published quiz questions" on public.quiz_questions;

create policy "ACL admins manage quizzes" on public.quizzes for all to authenticated
using (public.acl_is_admin()) with check (public.acl_is_admin());
create policy "ACL users read published quizzes" on public.quizzes for select to authenticated
using (status='published' and public.acl_is_active_user());
create policy "ACL admins manage quiz questions" on public.quiz_questions for all to authenticated
using (public.acl_is_admin()) with check (public.acl_is_admin());
create policy "ACL users read published quiz questions" on public.quiz_questions for select to authenticated
using (public.acl_is_active_user() and exists(select 1 from public.quizzes z where z.id=quiz_id and z.status='published'));

grant select,insert,update,delete on public.quizzes to authenticated;
grant select,insert,update,delete on public.quiz_questions to authenticated;

-- Seed a draft quiz using the existing PPCI pilot questions.
insert into public.quizzes(module_id,slug,title,description,mode,selection_mode,question_count,randomize_questions,randomize_options,status,display_order)
values('ppci-fundamentals','ppci-pilot','Primary PCI Fundamentals — Pilot','Reusable pilot quiz assembled from the PPCI question bank.','learning','fixed',2,false,true,'draft',1)
on conflict(module_id,slug) do update set title=excluded.title, description=excluded.description, updated_at=now();

insert into public.quiz_questions(quiz_id,question_id,display_order)
select z.id,q.id,q.display_order from public.quizzes z join public.questions q on q.module_id=z.module_id
where z.module_id='ppci-fundamentals' and z.slug='ppci-pilot' and q.external_id in ('ppci-v2-001','ppci-v2-002')
on conflict(quiz_id,question_id) do update set display_order=excluded.display_order;
