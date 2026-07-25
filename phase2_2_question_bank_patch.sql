-- ACL Expert Edition V2 — Phase 2.2
-- Secure database-driven question bank and answer options
-- Run after phase2_1_modules_patch.sql. Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  module_id text not null references public.modules(id) on delete cascade,
  external_id text,
  question_type text not null default 'single_best_answer',
  stem text not null,
  clinical_scenario text,
  image_url text,
  image_alt text,
  explanation text,
  reference_text text,
  reference_url text,
  topic text,
  subtopic text,
  difficulty text not null default 'intermediate',
  default_seconds integer not null default 60,
  points numeric not null default 1,
  negative_points numeric not null default 0,
  confidence_enabled boolean not null default false,
  randomize_options boolean not null default true,
  display_order integer not null default 100,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_key text not null,
  option_text text not null,
  image_url text,
  is_correct boolean not null default false,
  display_order integer not null default 1,
  feedback text,
  created_at timestamptz not null default now(),
  unique(question_id, option_key)
);

create unique index if not exists questions_external_id_unique
  on public.questions(module_id, external_id)
  where external_id is not null;
create index if not exists questions_module_order_idx
  on public.questions(module_id, status, display_order, created_at);
create index if not exists questions_topic_idx
  on public.questions(module_id, topic, subtopic);
create index if not exists question_options_question_idx
  on public.question_options(question_id, display_order);

alter table public.questions drop constraint if exists questions_type_check;
alter table public.questions add constraint questions_type_check check (
  question_type in ('single_best_answer','multiple_response','true_false','image_based','ordering','matching','short_answer')
);
alter table public.questions drop constraint if exists questions_difficulty_check;
alter table public.questions add constraint questions_difficulty_check check (
  difficulty in ('foundation','intermediate','advanced','expert')
);
alter table public.questions drop constraint if exists questions_status_check;
alter table public.questions add constraint questions_status_check check (
  status in ('draft','published','archived')
);
alter table public.questions drop constraint if exists questions_default_seconds_check;
alter table public.questions add constraint questions_default_seconds_check check (default_seconds between 5 and 3600);
alter table public.questions drop constraint if exists questions_points_check;
alter table public.questions add constraint questions_points_check check (points >= 0 and negative_points >= 0);

create or replace function public.acl_touch_question()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.external_id := nullif(trim(new.external_id), '');
  return new;
end;
$$;

drop trigger if exists acl_touch_question_trigger on public.questions;
create trigger acl_touch_question_trigger
before insert or update on public.questions
for each row execute function public.acl_touch_question();

create or replace function public.acl_sync_module_question_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_module text;
begin
  target_module := coalesce(new.module_id, old.module_id);
  update public.modules m
  set question_count = (
    select count(*) from public.questions q
    where q.module_id = target_module and q.status = 'published'
  ), updated_at = now()
  where m.id = target_module;

  if tg_op = 'UPDATE' and old.module_id is distinct from new.module_id then
    update public.modules m
    set question_count = (
      select count(*) from public.questions q
      where q.module_id = old.module_id and q.status = 'published'
    ), updated_at = now()
    where m.id = old.module_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists acl_sync_module_question_count_trigger on public.questions;
create trigger acl_sync_module_question_count_trigger
after insert or update or delete on public.questions
for each row execute function public.acl_sync_module_question_count();

alter table public.questions enable row level security;
alter table public.question_options enable row level security;

drop policy if exists "ACL admins manage questions" on public.questions;
drop policy if exists "ACL admins manage question options" on public.question_options;

create policy "ACL admins manage questions"
on public.questions for all to authenticated
using (public.acl_is_admin())
with check (public.acl_is_admin());

create policy "ACL admins manage question options"
on public.question_options for all to authenticated
using (public.acl_is_admin())
with check (public.acl_is_admin());

grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.question_options to authenticated;

-- Sanitized student-facing retrieval. Correct answers and feedback are deliberately omitted.
create or replace function public.acl_get_module_questions(p_module_id text)
returns table (
  id uuid,
  external_id text,
  question_type text,
  stem text,
  clinical_scenario text,
  image_url text,
  image_alt text,
  topic text,
  subtopic text,
  difficulty text,
  default_seconds integer,
  points numeric,
  confidence_enabled boolean,
  randomize_options boolean,
  display_order integer,
  options jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id, q.external_id, q.question_type, q.stem, q.clinical_scenario,
    q.image_url, q.image_alt, q.topic, q.subtopic, q.difficulty,
    q.default_seconds, q.points, q.confidence_enabled,
    q.randomize_options, q.display_order,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'key', o.option_key,
          'text', o.option_text,
          'image_url', o.image_url,
          'display_order', o.display_order
        ) order by o.display_order
      ) filter (where o.id is not null),
      '[]'::jsonb
    ) as options
  from public.questions q
  join public.modules m on m.id = q.module_id
  left join public.question_options o on o.question_id = q.id
  where q.module_id = p_module_id
    and q.status = 'published'
    and m.status = 'published'
    and public.acl_is_active_user()
  group by q.id
  order by q.display_order, q.created_at;
$$;

grant execute on function public.acl_get_module_questions(text) to authenticated;

-- Seed the two existing PPCI pilot questions.
insert into public.questions (
  module_id, external_id, question_type, stem, explanation, topic,
  difficulty, default_seconds, display_order, status
) values
('ppci-fundamentals','ppci-v2-001','single_best_answer',
 'A patient with anterior STEMI presents within 90 minutes of symptom onset. Which system-level priority most directly determines whether primary PCI remains the preferred reperfusion strategy?',
 'The key system-level determinant is whether timely primary PCI can be delivered within guideline-recommended delay targets.',
 'Reperfusion strategy','foundation',60,1,'published'),
('ppci-fundamentals','ppci-v2-002','single_best_answer',
 'During PPCI, angiography shows heavy thrombus but preserved distal flow. Which statement best reflects contemporary evidence regarding routine manual aspiration thrombectomy?',
 'Large randomized trials did not support routine aspiration thrombectomy; selective bailout use may still be reasonable in specific circumstances.',
 'Thrombus management','foundation',60,2,'published')
on conflict (module_id, external_id) where external_id is not null do update set
  stem = excluded.stem,
  explanation = excluded.explanation,
  topic = excluded.topic,
  difficulty = excluded.difficulty,
  default_seconds = excluded.default_seconds,
  display_order = excluded.display_order,
  status = excluded.status,
  updated_at = now();

-- Upsert options for the seeded questions.
with seed as (
  select id, external_id from public.questions
  where module_id = 'ppci-fundamentals' and external_id in ('ppci-v2-001','ppci-v2-002')
), rows(external_id, option_key, option_text, is_correct, display_order) as (values
('ppci-v2-001','A','The patient''s baseline LDL cholesterol',false,1),
('ppci-v2-001','B','The expected first-medical-contact-to-device delay',true,2),
('ppci-v2-001','C','The presence of mild mitral regurgitation',false,3),
('ppci-v2-001','D','Whether radial access is available',false,4),
('ppci-v2-001','E','The operator''s preferred guide catheter',false,5),
('ppci-v2-002','A','It should be performed in every STEMI case',false,1),
('ppci-v2-002','B','It is routinely preferred before wiring',false,2),
('ppci-v2-002','C','Routine use is not recommended, but selective bailout use may be considered',true,3),
('ppci-v2-002','D','It eliminates the risk of distal embolization',false,4),
('ppci-v2-002','E','It is mandatory before direct stenting',false,5)
)
insert into public.question_options(question_id, option_key, option_text, is_correct, display_order)
select s.id, r.option_key, r.option_text, r.is_correct, r.display_order
from rows r join seed s using (external_id)
on conflict (question_id, option_key) do update set
  option_text = excluded.option_text,
  is_correct = excluded.is_correct,
  display_order = excluded.display_order;

-- Recalculate all module counts once after migration.
update public.modules m
set question_count = (
  select count(*) from public.questions q
  where q.module_id = m.id and q.status = 'published'
), updated_at = now();
