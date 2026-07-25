-- ACL Expert Edition V2 — Phase 2.7
-- Analytics, reporting, seasons and safe admin RPCs.
-- Run after Phase 2.6. Safe to run more than once.

create extension if not exists pgcrypto;

-- Seasons keep future ACL rounds separated without changing historical attempts.
create table if not exists public.acl_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  points_rules jsonb not null default '{"1":10,"2":8,"3":6,"4":5,"5":4,"6-10":3,"participation":1,"perfect":1}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.acl_season_competitions (
  season_id uuid not null references public.acl_seasons(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  round_number integer,
  created_at timestamptz not null default now(),
  primary key (season_id, competition_id)
);

create table if not exists public.acl_season_points (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.acl_seasons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  competition_id uuid references public.competitions(id) on delete cascade,
  points numeric not null default 0,
  reason text,
  awarded_by uuid references auth.users(id) on delete set null,
  awarded_at timestamptz not null default now(),
  unique (season_id, user_id, competition_id, reason)
);

create index if not exists acl_season_points_rank_idx
  on public.acl_season_points(season_id, points desc, awarded_at asc);

create or replace function public.acl_touch_season()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.slug := trim(both '-' from lower(regexp_replace(trim(new.slug), '[^a-zA-Z0-9]+', '-', 'g')));
  return new;
end;
$$;

drop trigger if exists acl_touch_season_trigger on public.acl_seasons;
create trigger acl_touch_season_trigger
before insert or update on public.acl_seasons
for each row execute function public.acl_touch_season();

alter table public.acl_seasons enable row level security;
alter table public.acl_season_competitions enable row level security;
alter table public.acl_season_points enable row level security;

drop policy if exists "Admins manage ACL seasons" on public.acl_seasons;
drop policy if exists "Active users read visible ACL seasons" on public.acl_seasons;
create policy "Admins manage ACL seasons" on public.acl_seasons
for all to authenticated using (public.acl_is_admin()) with check (public.acl_is_admin());
create policy "Active users read visible ACL seasons" on public.acl_seasons
for select to authenticated using (public.acl_is_active_user() and status in ('active','completed'));

drop policy if exists "Admins manage season competitions" on public.acl_season_competitions;
drop policy if exists "Active users read season competitions" on public.acl_season_competitions;
create policy "Admins manage season competitions" on public.acl_season_competitions
for all to authenticated using (public.acl_is_admin()) with check (public.acl_is_admin());
create policy "Active users read season competitions" on public.acl_season_competitions
for select to authenticated using (public.acl_is_active_user());

drop policy if exists "Admins manage season points" on public.acl_season_points;
drop policy if exists "Users read own season points" on public.acl_season_points;
create policy "Admins manage season points" on public.acl_season_points
for all to authenticated using (public.acl_is_admin()) with check (public.acl_is_admin());
create policy "Users read own season points" on public.acl_season_points
for select to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.acl_seasons to authenticated;
grant select, insert, update, delete on public.acl_season_competitions to authenticated;
grant select, insert, update, delete on public.acl_season_points to authenticated;

-- Admin-only overview. JSON output avoids fragile return-column conflicts during upgrades.
create or replace function public.acl_admin_analytics_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.acl_is_admin() then
    raise exception 'Administrator access required';
  end if;

  select jsonb_build_object(
    'registered_users', (select count(*) from public.profiles),
    'active_users', (select count(*) from public.profiles where account_status = 'active'),
    'suspended_users', (select count(*) from public.profiles where account_status = 'suspended'),
    'published_modules', (select count(*) from public.modules where status = 'published'),
    'published_questions', (select count(*) from public.questions where status = 'published'),
    'published_quizzes', (select count(*) from public.quizzes where status = 'published'),
    'competitions', (select count(*) from public.competitions where status <> 'archived'),
    'learning_attempts', (select count(*) from public.quiz_attempts),
    'completed_learning_attempts', (select count(*) from public.quiz_attempts where status = 'completed'),
    'competition_attempts', (select count(*) from public.competition_attempts),
    'submitted_competition_attempts', (select count(*) from public.competition_attempts where status = 'submitted'),
    'average_competition_score', (select coalesce(round(avg(score), 2), 0) from public.competition_attempts where status = 'submitted'),
    'average_competition_accuracy', (select coalesce(round(avg(accuracy), 2), 0) from public.competition_attempts where status = 'submitted')
  ) into result;
  return result;
end;
$$;

grant execute on function public.acl_admin_analytics_overview() to authenticated;

create or replace function public.acl_admin_competition_report(p_competition_id uuid default null)
returns table (
  competition_id uuid,
  competition_title text,
  participant_count bigint,
  submitted_count bigint,
  terminated_count bigint,
  average_score numeric,
  average_accuracy numeric,
  average_duration_seconds numeric,
  warning_events bigint
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.title,
    count(distinct a.user_id),
    count(*) filter (where a.status = 'submitted'),
    count(*) filter (where a.status = 'terminated'),
    coalesce(round(avg(a.score) filter (where a.status = 'submitted'), 2), 0),
    coalesce(round(avg(a.accuracy) filter (where a.status = 'submitted'), 2), 0),
    coalesce(round(avg(a.duration_seconds) filter (where a.status = 'submitted'), 2), 0),
    count(e.id) filter (where e.event_type in ('visibility_hidden','window_blur','anti_cheat_warning'))
  from public.competitions c
  left join public.competition_attempts a on a.competition_id = c.id
  left join public.competition_events e on e.attempt_id = a.id
  where public.acl_is_admin()
    and (p_competition_id is null or c.id = p_competition_id)
  group by c.id, c.title, c.opens_at
  order by c.opens_at desc;
$$;

grant execute on function public.acl_admin_competition_report(uuid) to authenticated;

create or replace function public.acl_admin_question_report(p_module_id text default null)
returns table (
  question_id uuid,
  module_id text,
  stem text,
  topic text,
  difficulty text,
  response_count bigint,
  correct_count bigint,
  correct_percentage numeric,
  average_points numeric,
  high_confidence_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    q.id,
    q.module_id,
    q.stem,
    q.topic,
    q.difficulty,
    count(ca.id),
    count(ca.id) filter (where ca.is_correct is true),
    coalesce(round(100.0 * count(ca.id) filter (where ca.is_correct is true) / nullif(count(ca.id), 0), 1), 0),
    coalesce(round(avg(ca.points_awarded), 2), 0),
    count(ca.id) filter (where ca.confidence = 'high')
  from public.questions q
  left join public.competition_answers ca on ca.question_id = q.id
  where public.acl_is_admin()
    and (p_module_id is null or q.module_id = p_module_id)
  group by q.id, q.module_id, q.stem, q.topic, q.difficulty, q.display_order
  order by response_count desc, q.display_order asc;
$$;

grant execute on function public.acl_admin_question_report(text) to authenticated;

create or replace function public.acl_season_leaderboard(p_season_id uuid)
returns table (
  leaderboard_rank bigint,
  user_id uuid,
  display_name text,
  academic_position text,
  total_points numeric
)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over(order by sum(sp.points) desc, min(sp.awarded_at) asc),
    sp.user_id,
    coalesce(p.full_name, p.username, 'Participant')::text,
    p.academic_year::text,
    sum(sp.points)::numeric
  from public.acl_season_points sp
  left join public.profiles p on p.id = sp.user_id
  join public.acl_seasons s on s.id = sp.season_id
  where sp.season_id = p_season_id
    and (public.acl_is_admin() or (public.acl_is_active_user() and s.status in ('active','completed')))
  group by sp.user_id, p.full_name, p.username, p.academic_year
  order by total_points desc;
$$;

grant execute on function public.acl_season_leaderboard(uuid) to authenticated;

-- Corrected leaderboard function for installations where the profile field is academic_year.
drop function if exists public.acl_competition_leaderboard(uuid);
create or replace function public.acl_competition_leaderboard(p_competition uuid)
returns table (
  leaderboard_rank bigint,
  user_id uuid,
  display_name text,
  academic_position text,
  score numeric,
  accuracy numeric,
  duration_seconds integer,
  submitted_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over(order by a.score desc, a.accuracy desc, a.duration_seconds asc, a.submitted_at asc),
    a.user_id,
    coalesce(p.full_name, p.username, 'Participant')::text,
    p.academic_year::text,
    a.score,
    a.accuracy,
    a.duration_seconds,
    a.submitted_at
  from public.competition_attempts a
  left join public.profiles p on p.id = a.user_id
  join public.competitions c on c.id = a.competition_id
  where a.competition_id = p_competition
    and a.status = 'submitted'
    and c.leaderboard_visible = true
    and public.acl_is_active_user()
  order by a.score desc, a.accuracy desc, a.duration_seconds asc, a.submitted_at asc;
$$;

grant execute on function public.acl_competition_leaderboard(uuid) to authenticated;
