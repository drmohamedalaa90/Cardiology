create schema if not exists private;
CREATE OR REPLACE FUNCTION private.acl_basic_access_for(p_module_id text, p_user uuid)
 RETURNS TABLE(allowed boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.modules%rowtype;
  total_score numeric := 0;
  r record;
  user_position text;
  assigned boolean := false;
  mastery numeric := 0;
  prerequisite_title text;
begin
  if not exists(select 1 from public.profiles where id=p_user and account_status='active') then
    return query select false,'Inactive account'::text; return;
  end if;
  select * into m from public.modules where id=p_module_id;
  if not found then return query select false,'Module not found'::text; return; end if;
  if m.status<>'published' then
    return query select false,(case when m.status='coming_soon' then 'Coming soon' else 'Not published' end)::text; return;
  end if;
  if m.opens_at is not null and now()<m.opens_at then return query select false,('Opens '||to_char(m.opens_at,'YYYY-MM-DD HH24:MI'))::text; return; end if;
  if m.closes_at is not null and now()>m.closes_at then return query select false,'Access window closed'::text; return; end if;

  select exists(select 1 from public.module_assignments a where a.module_id=p_module_id and a.user_id=p_user and (a.expires_at is null or a.expires_at>now())) into assigned;
  select coalesce(sum(score),0) into total_score from public.quiz_attempts where user_id=p_user and status='completed';
  select academic_year into user_position from public.profiles where id=p_user;

  if m.access_type='subscription' and not assigned then return query select false,'Subscription required'::text; return; end if;
  if m.access_type='admin_assigned' and not assigned then return query select false,'Admin assignment required'::text; return; end if;
  if m.access_type='minimum_score' and total_score<coalesce(m.minimum_score,0) then return query select false,('Requires '||m.minimum_score||' points')::text; return; end if;
  if m.access_type='passcode' and not assigned then return query select false,'Passcode or admin unlock required'::text; return; end if;

  for r in select * from public.module_unlock_rules where module_id=p_module_id and is_active loop
    if r.rule_type='prerequisite_module' and not exists (
      select 1 from public.quiz_attempts qa where qa.user_id=p_user and qa.module_id=r.prerequisite_module_id and qa.status='completed'
    ) then
      return query select false,('Complete prerequisite: '||coalesce((select title from public.modules where id=r.prerequisite_module_id),r.prerequisite_module_id))::text; return;
    elsif r.rule_type='prerequisite_accuracy' then
      select mm.percentage into mastery from public.acl_module_mastery(r.prerequisite_module_id,p_user) mm;
      select title into prerequisite_title from public.modules where id=r.prerequisite_module_id;
      if coalesce(mastery,0)<coalesce(r.minimum_value,0) then
        return query select false,('Requires '||trim(to_char(r.minimum_value,'FM999D0'))||'% mastery in '||coalesce(prerequisite_title,r.prerequisite_module_id)||' (current '||trim(to_char(coalesce(mastery,0),'FM999D0'))||'%)')::text; return;
      end if;
    elsif r.rule_type='minimum_total_score' and total_score<coalesce(r.minimum_value,0) then
      return query select false,('Requires '||r.minimum_value||' total points')::text; return;
    elsif r.rule_type='academic_position' and coalesce(array_length(r.allowed_positions,1),0)>0 and not (user_position=any(r.allowed_positions)) then
      return query select false,'Not available for your academic position'::text; return;
    elsif r.rule_type='manual_assignment' and not assigned then
      return query select false,'Manual assignment required'::text; return;
    end if;
  end loop;
  return query select true,'Available'::text;
end;
$function$;
CREATE OR REPLACE FUNCTION public.acl_apply_challenge_play_preferences()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  prefs jsonb := '{}'::jsonb;
  requested_count integer;
  selected_ids jsonb;
  confidence_on boolean := true;
  enabled_lines jsonb := '[]'::jsonb;
begin
  if exists(select 1 from public.modules where id=new.module_id and edition='basic') then return new; end if;
  select coalesce(settings, '{}'::jsonb)
    into prefs
  from public.user_settings
  where user_id = new.creator_id;

  requested_count := greatest(
    1,
    least(
      100,
      coalesce(
        nullif(prefs->>'preferredQuestionCount','')::integer,
        case when jsonb_typeof(new.question_ids) = 'array' then jsonb_array_length(new.question_ids) else null end,
        10
      )
    )
  );

  select coalesce(jsonb_agg(id), '[]'::jsonb)
    into selected_ids
  from (
    select id
    from public.questions
    where quiz_id = new.quiz_id
    order by random()
    limit requested_count
  ) q;

  if jsonb_typeof(selected_ids) = 'array' and jsonb_array_length(selected_ids) > 0 then
    new.question_ids := selected_ids;
    requested_count := jsonb_array_length(selected_ids);
  end if;

  confidence_on := case lower(coalesce(prefs->>'confidenceEnabled','true'))
    when 'false' then false
    else true
  end;

  if lower(coalesce(prefs#>>'{enabledLifelines,expert}','true')) <> 'false' then
    enabled_lines := enabled_lines || jsonb_build_array('expert');
  end if;
  if lower(coalesce(prefs#>>'{enabledLifelines,filter}','true')) <> 'false' then
    enabled_lines := enabled_lines || jsonb_build_array('filter');
  end if;
  if lower(coalesce(prefs#>>'{enabledLifelines,vault}','true')) <> 'false' then
    enabled_lines := enabled_lines || jsonb_build_array('vault');
  end if;

  new.play_config := jsonb_build_object(
    'question_count', requested_count,
    'confidence_enabled', confidence_on,
    'lifelines', enabled_lines,
    'question_seconds', 45
  );

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.acl_set_challenge_play_config()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  user_settings jsonb := '{}'::jsonb;
  enabled jsonb := '{}'::jsonb;
  chosen jsonb := '[]'::jsonb;
  confidence_on boolean := true;
  lifelines_on boolean := true;
begin
  if exists(select 1 from public.modules where id=new.module_id and edition='basic') then return new; end if;
  select coalesce(us.settings, '{}'::jsonb)
  into user_settings
  from public.user_settings us
  where us.user_id = new.creator_id;

  enabled := coalesce(user_settings->'enabledLifelines', '{}'::jsonb);
  confidence_on := coalesce((user_settings->>'confidenceEnabled')::boolean, true);
  lifelines_on := coalesce((user_settings->>'lifelinesEnabled')::boolean, true);

  if lifelines_on then
    if coalesce((enabled->>'expert')::boolean, true) then chosen := chosen || '"expert"'::jsonb; end if;
    if coalesce((enabled->>'filter')::boolean, true) then chosen := chosen || '"filter"'::jsonb; end if;
    if coalesce((enabled->>'vault')::boolean, true) then chosen := chosen || '"vault"'::jsonb; end if;
  end if;

  new.play_config := jsonb_build_object(
    'question_count', greatest(1, coalesce(jsonb_array_length(new.question_ids), 1)),
    'confidence_enabled', confidence_on,
    'lifelines', chosen
  );
  return new;
end;
$function$;
create schema if not exists private;

create or replace function private.acl_basic_user_open(p_user uuid,p_module text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
select exists(select 1 from public.modules m join public.profiles p on p.id=p_user join auth.users u on u.id=p.id where m.id=p_module and m.edition='basic' and m.status='published' and p.account_status='active' and (m.display_order=1 or lower(u.email)='drmohamedalaa90@gmail.com')) and coalesce((select allowed from private.acl_basic_access_for(p_module,p_user)),false)
$$;

create or replace function private.acl_basic_fair_questions(p_module text,p_quiz uuid,p_one uuid,p_two uuid,p_pool text) returns table(id uuid,topic text) language sql stable security definer set search_path=public,pg_temp as $$
with seen as (
 select qa.user_id,coalesce(a->>'questionId',a->>'question_id') qid from public.quiz_attempts qa cross join lateral jsonb_array_elements(coalesce(qa.answers,'[]'::jsonb)) a where qa.module_id=p_module and qa.user_id in(p_one,p_two)
)
select distinct q.id,coalesce(nullif(btrim(q.topic),''),'General') from public.quiz_questions qq join public.questions q on q.id=qq.question_id where qq.quiz_id=p_quiz and q.module_id=p_module and q.status='published' and case p_pool
 when 'unattempted' then not exists(select 1 from seen s where s.qid=q.id::text)
 when 'attempted' then exists(select 1 from seen s where s.qid=q.id::text and s.user_id=p_one) and exists(select 1 from seen s where s.qid=q.id::text and s.user_id=p_two)
 else false end
$$;

create or replace function private.acl_basic_challenge_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare opponent uuid; n int; pool text;
begin
 if not exists(select 1 from modules where id=new.module_id and edition='basic') then return new; end if;
 opponent=(new.play_config->>'opponent_id')::uuid; n=(new.play_config->>'question_count')::int; pool=new.play_config->>'pool';
 if auth.uid() is null or new.creator_id<>auth.uid() or opponent is null or opponent=new.creator_id or n is null or n not in(5,10,15) or pool is null or pool not in('unattempted','attempted') then raise exception 'Choose a friend, 5, 10 or 15 questions, and a shared question pool'; end if;
 if not exists(select 1 from acl_friendships where status='accepted' and ((requester_id=new.creator_id and addressee_id=opponent) or (requester_id=opponent and addressee_id=new.creator_id))) then raise exception 'Choose a connected friend'; end if;
 if not private.acl_basic_user_open(new.creator_id,new.module_id) or not private.acl_basic_user_open(opponent,new.module_id) then raise exception 'This module must be open for both players'; end if;
 if not exists(select 1 from quizzes where id=new.quiz_id and module_id=new.module_id and status='published' and edition='basic' and mode in('learning','practice')) then raise exception 'Quiz is not available'; end if;
 if new.maximum_participants is distinct from 2 or jsonb_array_length(new.question_ids)<>n or (select count(distinct value) from jsonb_array_elements_text(new.question_ids))<>n then raise exception 'Invalid challenge question count'; end if;
 if exists(select 1 from jsonb_array_elements_text(new.question_ids) selected where not exists(select 1 from private.acl_basic_fair_questions(new.module_id,new.quiz_id,new.creator_id,opponent,pool) q where q.id::text=selected.value)) then raise exception 'Each question must have the same attempt history for both players'; end if;
 new.play_config=new.play_config||jsonb_build_object('confidence_enabled',false,'lifelines','[]'::jsonb,'question_seconds',120,'basic_fair','v1');
 return new;
end $$;
drop trigger if exists zz_acl_basic_fair_challenge on public.module_challenges;
create trigger zz_acl_basic_fair_challenge before insert or update of module_id,quiz_id,creator_id,question_ids,play_config,maximum_participants on public.module_challenges for each row execute function private.acl_basic_challenge_guard();

create or replace function private.acl_basic_challenge_api(p_action text,p_args jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare me uuid:=auth.uid(); friend uuid; mod text; quiz_record record; challenge public.module_challenges%rowtype; n int; pool text; ids jsonb; result jsonb;
begin
 if me is null or not public.acl_is_active_user() then raise exception 'Sign in with an active account'; end if;
 if p_action in('options','create') then
  friend=(p_args->>'friend_id')::uuid;
  if friend is null or not exists(select 1 from acl_friendships where status='accepted' and ((requester_id=me and addressee_id=friend) or(requester_id=friend and addressee_id=me))) then raise exception 'Choose a connected friend'; end if;
 end if;
 if p_action='options' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select m.id,m.title,z.id quiz_id,z.slug quiz_slug,
    (select count(*) from private.acl_basic_fair_questions(m.id,z.id,me,friend,'unattempted')) unattempted,
    (select count(*) from private.acl_basic_fair_questions(m.id,z.id,me,friend,'attempted')) attempted
   from modules m cross join lateral(select q.id,q.slug from quizzes q where q.module_id=m.id and q.edition='basic' and q.status='published' and q.mode in('learning','practice') and q.slug not like '%-review-%' order by q.display_order,q.created_at limit 1)z
   where m.edition='basic' and private.acl_basic_user_open(me,m.id) and private.acl_basic_user_open(friend,m.id) order by m.display_order
  )x;return result;
 elsif p_action='create' then
  mod=p_args->>'module_id';n=(p_args->>'count')::int;pool=p_args->>'pool';
  if n is null or n not in(5,10,15) or pool is null or pool not in('unattempted','attempted') then raise exception 'Choose 5, 10 or 15 questions and a shared pool'; end if;
  if not private.acl_basic_user_open(me,mod) or not private.acl_basic_user_open(friend,mod) then raise exception 'This module must be open for both players'; end if;
  select id,slug into quiz_record from quizzes where module_id=mod and edition='basic' and status='published' and mode in('learning','practice') and slug not like '%-review-%' order by display_order,created_at limit 1;
  if not found then raise exception 'This module has no quiz yet'; end if;
  select jsonb_agg(id order by turn,random_sort) into ids from (
   select id,row_number() over(partition by topic order by random()) turn,random() random_sort from private.acl_basic_fair_questions(mod,quiz_record.id,me,friend,pool) order by turn,random_sort limit n
  )chosen;
  if coalesce(jsonb_array_length(ids),0)<n then raise exception 'Not enough questions with matching history for both players. Choose a smaller quiz or another pool.'; end if;
  insert into module_challenges(module_id,quiz_id,creator_id,challenge_code,title,question_ids,maximum_participants,ends_at,play_config) values(mod,quiz_record.id,me,gen_random_uuid()::text,'Friend challenge',ids,2,now()+interval '7 days',jsonb_build_object('question_count',n,'pool',pool,'opponent_id',friend)) returning * into challenge;
  insert into module_challenge_participants(challenge_id,user_id,invitation_status) values(challenge.id,me,'joined'),(challenge.id,friend,'invited');
  return jsonb_build_object('id',challenge.id);
 elsif p_action='accept' then
  select * into challenge from module_challenges where id=(p_args->>'id')::uuid for update;
  if not found or challenge.play_config->>'basic_fair' is distinct from 'v1' then raise exception 'Challenge not found'; end if;
  if not exists(select 1 from module_challenge_participants where challenge_id=challenge.id and user_id=me and invitation_status in('invited','joined')) then raise exception 'This invitation is not available'; end if;
  if challenge.status<>'open' or challenge.ends_at<=now() then raise exception 'Challenge has closed'; end if;
  if not private.acl_basic_user_open(me,challenge.module_id) or not private.acl_basic_user_open((challenge.play_config->>'opponent_id')::uuid,challenge.module_id) or not private.acl_basic_user_open(challenge.creator_id,challenge.module_id) then raise exception 'The module must still be open for both players'; end if;
  update module_challenge_participants set invitation_status='joined',joined_at=case when attempt_id is null then now() else joined_at end where challenge_id=challenge.id and user_id=me;
  return jsonb_build_object('id',challenge.id);
 elsif p_action='history' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into result from (
   select c.id,c.module_id,c.creator_id,c.created_at,c.ends_at,c.status,c.play_config,m.title module_title,z.slug quiz_slug,mine.invitation_status,mine.completed_at,mine.score,mine.duration_seconds,
    other.completed_at opponent_completed,other.score opponent_score,other.duration_seconds opponent_seconds,coalesce(p.display_name,p.full_name,p.username,'ACL Friend') opponent_name
   from module_challenges c join modules m on m.id=c.module_id and m.edition='basic' join quizzes z on z.id=c.quiz_id join module_challenge_participants mine on mine.challenge_id=c.id and mine.user_id=me
   left join module_challenge_participants other on other.challenge_id=c.id and other.user_id<>me left join profiles p on p.id=other.user_id
  )x;return result;
 else raise exception 'Unknown action'; end if;
end $$;

create or replace function public.acl_basic_challenge_api(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path=public,pg_temp as $$select private.acl_basic_challenge_api(p_action,p_args)$$;
revoke all on function private.acl_basic_access_for(text,uuid),private.acl_basic_user_open(uuid,text),private.acl_basic_fair_questions(text,uuid,uuid,uuid,text),private.acl_basic_challenge_guard(),private.acl_basic_challenge_api(text,jsonb) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.acl_basic_challenge_api(text,jsonb) to authenticated;
revoke all on function public.acl_basic_challenge_api(text,jsonb) from public,anon;
grant execute on function public.acl_basic_challenge_api(text,jsonb) to authenticated;

 alter table public.quiz_attempts add column if not exists challenge_id uuid references public.module_challenges(id) on delete set null;
drop index if exists public.one_active_attempt_per_module;
CREATE UNIQUE INDEX one_active_attempt_per_module ON public.quiz_attempts USING btree (user_id, module_id) WHERE ((status = 'in_progress'::text) AND (challenge_id IS NULL));
drop index if exists public.quiz_attempts_one_open_per_quiz;
CREATE UNIQUE INDEX quiz_attempts_one_open_per_quiz ON public.quiz_attempts USING btree (user_id, quiz_id) WHERE ((status = 'in_progress'::text) AND (quiz_id IS NOT NULL) AND (challenge_id IS NULL));
drop index if exists public.one_active_attempt_per_quiz;
CREATE UNIQUE INDEX one_active_attempt_per_quiz ON public.quiz_attempts USING btree (quiz_id, participant_id) WHERE ((status = 'in_progress'::text) AND (participant_id IS NOT NULL) AND (challenge_id IS NULL));
drop index if exists public.basic_one_open_attempt_per_challenge;
CREATE UNIQUE INDEX basic_one_open_attempt_per_challenge ON public.quiz_attempts USING btree (user_id, challenge_id) WHERE ((status = 'in_progress'::text) AND (challenge_id IS NOT NULL));
CREATE OR REPLACE FUNCTION private.acl_validate_basic_challenge_attempt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare c public.module_challenges%rowtype; begin if new.challenge_id is null then return new; end if; select * into c from public.module_challenges where id=new.challenge_id; if not exists(select 1 from modules where id=c.module_id and edition='basic') then return new; end if; if auth.uid() is null or new.user_id<>auth.uid() or c.status<>'open' or c.ends_at<=now() or new.module_id<>c.module_id or new.quiz_id<>c.quiz_id or new.question_ids<>c.question_ids or not private.acl_basic_user_open(new.user_id,c.module_id) or not exists(select 1 from module_challenge_participants where challenge_id=c.id and user_id=new.user_id and invitation_status='joined') then raise exception 'Challenge attempt does not match your accepted invitation'; end if; return new; end $function$;
revoke all on function private.acl_validate_basic_challenge_attempt() from public,anon,authenticated;
drop trigger if exists acl_validate_basic_challenge_attempt on public.quiz_attempts;
create trigger acl_validate_basic_challenge_attempt before insert or update of challenge_id,question_ids on public.quiz_attempts for each row execute function private.acl_validate_basic_challenge_attempt();
