create extension if not exists pgcrypto;

alter table public.quizzes
  add column if not exists timer_mode text default 'whole_quiz',
  add column if not exists quiz_duration_seconds integer,
  add column if not exists default_question_time_seconds integer default 60;

alter table public.questions add column if not exists time_limit_seconds integer;

alter table public.quiz_attempts
  add column if not exists participant_name text,
  add column if not exists participant_email text,
  add column if not exists participant_phone text,
  add column if not exists academic_level text,
  add column if not exists violation_count integer default 0,
  add column if not exists anti_cheat_penalty integer default 0,
  add column if not exists total_score numeric default 0,
  add column if not exists correct_count integer default 0,
  add column if not exists incorrect_count integer default 0,
  add column if not exists unanswered_count integer default 0,
  add column if not exists high_confidence_errors integer default 0,
  add column if not exists accuracy_percent numeric default 0,
  add column if not exists total_time_seconds integer default 0;

alter table public.attempt_answers
  add column if not exists confidence text,
  add column if not exists is_correct boolean,
  add column if not exists awarded_points numeric default 0;

create table if not exists public.attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  participant_id uuid references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  event_type text not null,
  violation_number integer not null default 0,
  penalty integer not null default 0,
  browser_details text,
  event_time timestamptz not null default now()
);

alter table public.attempt_events enable row level security;

drop policy if exists "Users read own attempt events" on public.attempt_events;
create policy "Users read own attempt events" on public.attempt_events for select
using (participant_id=auth.uid() or public.is_admin());

drop policy if exists "Users insert own attempt events" on public.attempt_events;
create policy "Users insert own attempt events" on public.attempt_events for insert
with check (participant_id=auth.uid());

create or replace function public.acl_start_or_resume_attempt(
  p_quiz_id uuid,p_full_name text,p_email text,p_phone text,p_academic_level text,p_passcode text default null
) returns public.quiz_attempts language plpgsql security definer set search_path=public as $$
declare q public.quizzes%rowtype; a public.quiz_attempts%rowtype; exp_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into q from public.quizzes where id=p_quiz_id and status='published';
  if not found then raise exception 'Quiz not found'; end if;
  if now()<q.opens_at then raise exception 'Quiz has not opened yet'; end if;
  if now()>=q.closes_at then raise exception 'Quiz is closed'; end if;
  if q.access_type='passcode' and (q.passcode_hash is null or crypt(coalesce(p_passcode,''),q.passcode_hash)<>q.passcode_hash) then raise exception 'Incorrect passcode'; end if;
  select * into a from public.quiz_attempts where quiz_id=p_quiz_id and participant_id=auth.uid() and status='in_progress' order by started_at desc limit 1;
  if found then
    if a.expires_at is not null and a.expires_at<=now() then update public.quiz_attempts set status='expired',submitted_at=now() where id=a.id; raise exception 'Previous attempt expired'; end if;
    if not q.allow_resume then raise exception 'Resume is not allowed'; end if;
    return a;
  end if;
  if q.timer_mode='whole_quiz' then exp_at:=least(now()+make_interval(secs=>coalesce(q.quiz_duration_seconds,greatest(coalesce(q.duration_minutes,15),1)*60)),q.closes_at); else exp_at:=q.closes_at; end if;
  insert into public.quiz_attempts(quiz_id,participant_id,status,started_at,expires_at,participant_name,participant_email,participant_phone,academic_level)
  values(p_quiz_id,auth.uid(),'in_progress',now(),exp_at,p_full_name,p_email,p_phone,p_academic_level) returning * into a;
  return a;
end $$;

create or replace function public.acl_save_answer_with_confidence(
  p_attempt_id uuid,p_question_id uuid,p_selected_option_id uuid default null,p_confidence text default null,p_response_time_seconds integer default null,p_current_question_index integer default null
) returns public.attempt_answers language plpgsql security definer set search_path=public as $$
declare a public.quiz_attempts%rowtype; ans public.attempt_answers%rowtype;
begin
  select * into a from public.quiz_attempts where id=p_attempt_id and participant_id=auth.uid() and status='in_progress';
  if not found then raise exception 'Active attempt not found'; end if;
  if a.expires_at is not null and a.expires_at<=now() then raise exception 'Attempt expired'; end if;
  if p_confidence not in ('high','low') and p_confidence is not null then raise exception 'Invalid confidence'; end if;
  insert into public.attempt_answers(attempt_id,question_id,selected_option_ids,confidence,answered_at,response_time_seconds)
  values(p_attempt_id,p_question_id,case when p_selected_option_id is null then '{}'::uuid[] else array[p_selected_option_id] end,p_confidence,now(),p_response_time_seconds)
  on conflict(attempt_id,question_id) do update set selected_option_ids=excluded.selected_option_ids,confidence=excluded.confidence,answered_at=now(),response_time_seconds=excluded.response_time_seconds,updated_at=now()
  returning * into ans;
  update public.quiz_attempts set current_question_index=coalesce(p_current_question_index,current_question_index),last_saved_at=now() where id=p_attempt_id;
  return ans;
end $$;

create or replace function public.acl_record_attempt_event(
  p_attempt_id uuid,p_event_type text,p_question_id uuid default null,p_browser_details text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c integer; pen integer:=0; msg text;
begin
  if not exists(select 1 from public.quiz_attempts where id=p_attempt_id and participant_id=auth.uid() and status='in_progress') then raise exception 'Active attempt not found'; end if;
  if p_event_type in ('tab_hidden','window_blur','fullscreen_exit') then
    update public.quiz_attempts set violation_count=coalesce(violation_count,0)+1 where id=p_attempt_id returning violation_count into c;
    pen:=case when c=1 then 0 when c=2 then -1 else -3 end;
    update public.quiz_attempts set anti_cheat_penalty=coalesce(anti_cheat_penalty,0)+pen where id=p_attempt_id;
    msg:=case when c=1 then 'Warning: leaving the quiz was recorded.' when c=2 then 'Second violation: -1 point.' else 'Third or later violation: -3 points.' end;
  else select coalesce(violation_count,0) into c from public.quiz_attempts where id=p_attempt_id; end if;
  insert into public.attempt_events(attempt_id,participant_id,question_id,event_type,violation_number,penalty,browser_details) values(p_attempt_id,auth.uid(),p_question_id,p_event_type,coalesce(c,0),pen,p_browser_details);
  return jsonb_build_object('violation_count',coalesce(c,0),'penalty',pen,'message',msg);
end $$;

create or replace function public.acl_submit_and_score_attempt(p_attempt_id uuid,p_force_expired boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.quiz_attempts%rowtype; tq integer; cor integer; inc integer; un integer; he integer; ans_score numeric; pen integer; total numeric; acc numeric; secs integer; st text;
begin
  select * into a from public.quiz_attempts where id=p_attempt_id and participant_id=auth.uid() and status='in_progress';
  if not found then raise exception 'Active attempt not found'; end if;
  update public.attempt_answers aa set is_correct=qo.is_correct,awarded_points=case when cardinality(aa.selected_option_ids)=0 then -1 when qo.is_correct and aa.confidence='high' then 2 when qo.is_correct and aa.confidence='low' then 1 when not qo.is_correct and aa.confidence='low' then 0 when not qo.is_correct and aa.confidence='high' then -1 else -1 end from public.question_options qo where aa.attempt_id=p_attempt_id and qo.id=aa.selected_option_ids[1];
  select count(*) into tq from public.questions where quiz_id=a.quiz_id;
  select count(*) filter(where is_correct),count(*) filter(where is_correct=false),count(*) filter(where confidence='high' and is_correct=false),coalesce(sum(awarded_points),0) into cor,inc,he,ans_score from public.attempt_answers where attempt_id=p_attempt_id;
  un:=greatest(tq-coalesce(cor,0)-coalesce(inc,0),0); ans_score:=coalesce(ans_score,0)-un; pen:=coalesce(a.anti_cheat_penalty,0); total:=ans_score+pen; acc:=case when tq=0 then 0 else round(coalesce(cor,0)::numeric/tq*100,2) end; secs:=greatest(0,extract(epoch from(now()-a.started_at))::integer); st:=case when p_force_expired or (a.expires_at is not null and a.expires_at<=now()) then 'expired' else 'submitted' end;
  update public.quiz_attempts set status=st,submitted_at=now(),total_score=total,correct_count=coalesce(cor,0),incorrect_count=coalesce(inc,0),unanswered_count=un,high_confidence_errors=coalesce(he,0),accuracy_percent=acc,total_time_seconds=secs,last_saved_at=now() where id=p_attempt_id;
  return jsonb_build_object('status',st,'total_score',total,'correct_count',coalesce(cor,0),'incorrect_count',coalesce(inc,0),'unanswered_count',un,'high_confidence_errors',coalesce(he,0),'accuracy_percent',acc,'anti_cheat_penalty',pen,'total_time_seconds',secs);
end $$;

grant execute on function public.acl_start_or_resume_attempt(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.acl_save_answer_with_confidence(uuid,uuid,uuid,text,integer,integer) to authenticated;
grant execute on function public.acl_record_attempt_event(uuid,text,uuid,text) to authenticated;
grant execute on function public.acl_submit_and_score_attempt(uuid,boolean) to authenticated;

-- Timer examples:
-- whole quiz: update public.quizzes set timer_mode='whole_quiz',quiz_duration_seconds=900 where slug='acl-expert-edition-demo-step-3';
-- per question: update public.quizzes set timer_mode='per_question',default_question_time_seconds=60 where slug='acl-expert-edition-demo-step-3';
-- custom question: update public.questions set time_limit_seconds=90 where id='QUESTION_UUID';
-- no timer: update public.quizzes set timer_mode='none' where slug='acl-expert-edition-demo-step-3';
