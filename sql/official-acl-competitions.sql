create table private.acl_official_competitions (
 id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 180),
 question_count int not null check(question_count between 1 and 100), question_seconds int not null check(question_seconds between 5 and 600),
 opens_at timestamptz not null, closes_at timestamptz not null, status text not null default 'draft' check(status in('draft','published','closed')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(closes_at>opens_at)
);
create table private.acl_official_questions (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null references private.acl_official_competitions(id) on delete cascade,
 position int not null check(position>0), stem text not null check(length(btrim(stem))>0), choices jsonb not null check(jsonb_typeof(choices)='array' and jsonb_array_length(choices)=4),
 correct_index int not null check(correct_index between 0 and 3), explanation text not null default '', topic text not null default '', image_path text,
 unique(competition_id,position)
);
create table private.acl_official_attempts (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null references private.acl_official_competitions(id), user_id uuid not null references auth.users(id),
 question_ids uuid[] not null, current_index int not null default 0, deadline timestamptz not null,
 answers jsonb not null default '[]', warning_count int not null default 0, penalty int not null default 0,
 status text not null default 'active' check(status in('active','completed','omitted')), started_at timestamptz not null default now(), finished_at timestamptz,
 unique(competition_id,user_id)
);
create table private.acl_official_events (
 attempt_id uuid not null references private.acl_official_attempts(id), event_id uuid not null, created_at timestamptz not null default now(), primary key(attempt_id,event_id)
);
alter table private.acl_official_competitions enable row level security;
alter table private.acl_official_questions enable row level security;
alter table private.acl_official_attempts enable row level security;
alter table private.acl_official_events enable row level security;
revoke all on private.acl_official_competitions,private.acl_official_questions,private.acl_official_attempts,private.acl_official_events from public,anon,authenticated;

create function private.acl_official_state(p_attempt uuid) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare a private.acl_official_attempts%rowtype; c private.acl_official_competitions%rowtype; q private.acl_official_questions%rowtype; current_q jsonb:=null; review jsonb:=null; correct_count int;
begin
 select * into a from private.acl_official_attempts where id=p_attempt and user_id=auth.uid() for update;
 if not found then raise exception 'Attempt not found'; end if;
 select * into c from private.acl_official_competitions where id=a.competition_id;
 while a.status='active' and (clock_timestamp()>=a.deadline or c.status='closed') loop
  a.answers=a.answers||jsonb_build_array(jsonb_build_object('question_id',a.question_ids[a.current_index+1],'selected',null,'correct',false,'timed_out',true));
  a.current_index=a.current_index+1;
  if a.current_index>=cardinality(a.question_ids) then a.status='completed';a.finished_at=least(a.deadline,clock_timestamp(),c.closes_at);exit;end if;
  a.deadline=least(a.deadline+make_interval(secs=>c.question_seconds),c.closes_at);
 end loop;
 update private.acl_official_attempts set current_index=a.current_index,deadline=a.deadline,answers=a.answers,status=a.status,finished_at=a.finished_at where id=a.id;
 if a.status='active' then
  select * into q from private.acl_official_questions where id=a.question_ids[a.current_index+1];
  current_q=jsonb_build_object('id',q.id,'stem',q.stem,'choices',q.choices,'topic',q.topic,'image_path',q.image_path,'number',a.current_index+1);
 elsif clock_timestamp()>=c.closes_at then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'stem',x.stem,'choices',x.choices,'correct_index',x.correct_index,'explanation',x.explanation,'image_path',x.image_path,'selected',a.answers->(ids.ord::int-1)->'selected') order by ids.ord),'[]') into review
  from unnest(a.question_ids) with ordinality ids(id,ord) join private.acl_official_questions x on x.id=ids.id;
 end if;
 select count(*) into correct_count from jsonb_array_elements(a.answers) x where (x->>'correct')::boolean;
 return jsonb_build_object('id',a.id,'competition_id',c.id,'title',c.title,'status',a.status,'question_count',cardinality(a.question_ids),'answered_count',a.current_index,'warning_count',a.warning_count,'penalty',a.penalty,'score',case when a.status<>'active' then correct_count-a.penalty else null end,'correct_count',case when a.status<>'active' then correct_count else null end,'deadline',a.deadline,'server_now',clock_timestamp(),'question',current_q,'review',review,'closes_at',c.closes_at,'duration_seconds',case when a.finished_at is not null then greatest(0,extract(epoch from a.finished_at-a.started_at)::int) else null end);
end $$;
revoke all on function private.acl_official_state(uuid) from public,anon,authenticated;

create function private.acl_official_api(p_action text,p_args jsonb) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare me uuid:=auth.uid(); is_admin boolean; c private.acl_official_competitions%rowtype; a private.acl_official_attempts%rowtype; q private.acl_official_questions%rowtype; cid uuid; qid uuid; selected int; ids uuid[]; result jsonb; inserted int; pos int; new_opens timestamptz; new_closes timestamptz;
begin
 if me is null or not public.acl_is_active_user() then raise exception 'Sign in with an active account'; end if;
 is_admin=public.acl_is_basic_question_admin();
 if p_action like 'admin_%' and not is_admin then raise exception 'Admin access required'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'question_count',x.question_count,'question_seconds',x.question_seconds,'opens_at',x.opens_at,'closes_at',x.closes_at,'status',x.status,'attempt_id',x.attempt_id,'attempt_status',x.attempt_status) order by x.opens_at),'[]') into result from (
   select comp.*,att.id attempt_id,att.status attempt_status from private.acl_official_competitions comp left join private.acl_official_attempts att on att.competition_id=comp.id and att.user_id=me where is_admin or comp.status in('published','closed')
  )x;
  return jsonb_build_object('admin',is_admin,'competitions',result,'server_now',clock_timestamp());
 end if;
 if p_action='admin_save' then
  new_opens=(p_args->>'opens_local')::timestamp at time zone 'Africa/Cairo';new_closes=(p_args->>'closes_local')::timestamp at time zone 'Africa/Cairo';
  if new_opens is null or new_closes is null or new_closes<=new_opens then raise exception 'Choose a valid opening and closing time';end if;
  if nullif(p_args->>'competition_id','') is null then
   insert into private.acl_official_competitions(title,question_count,question_seconds,opens_at,closes_at,created_by) values(btrim(p_args->>'title'),(p_args->>'question_count')::int,(p_args->>'question_seconds')::int,new_opens,new_closes,me) returning * into c;
  else
   cid=(p_args->>'competition_id')::uuid;
   select * into c from private.acl_official_competitions where id=cid for update;
   if not found then raise exception 'Competition not found';end if;
   if exists(select 1 from private.acl_official_attempts where competition_id=cid) then raise exception 'Settings are locked once a participant starts';end if;
   update private.acl_official_competitions set title=btrim(p_args->>'title'),question_count=(p_args->>'question_count')::int,question_seconds=(p_args->>'question_seconds')::int,opens_at=new_opens,closes_at=new_closes,updated_at=now() where id=cid returning * into c;
  end if;
  return to_jsonb(c);
 end if;
 cid=(p_args->>'competition_id')::uuid;
 if p_action like 'admin_%' or p_action='start' then
  select * into c from private.acl_official_competitions where id=cid for update;
 else
  select * into c from private.acl_official_competitions where id=cid;
 end if;
 if not found or (c.status='draft' and not is_admin) then raise exception 'Competition not found';end if;
 if p_action='admin_get' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.position),'[]') into result from private.acl_official_questions x where competition_id=cid;
  return jsonb_build_object('competition',to_jsonb(c),'questions',result,'locked',exists(select 1 from private.acl_official_attempts where competition_id=cid));
 elsif p_action in('admin_question','admin_delete_question') then
  if exists(select 1 from private.acl_official_attempts where competition_id=cid) or (c.status='published' and clock_timestamp()>=c.opens_at) then raise exception 'Questions are locked once the competition opens';end if;
  qid=nullif(p_args->>'question_id','')::uuid;
  if p_action='admin_delete_question' then delete from private.acl_official_questions where id=qid and competition_id=cid;return '{}'::jsonb;end if;
  if jsonb_typeof(p_args->'choices') is distinct from 'array' or jsonb_array_length(p_args->'choices')<>4 or exists(select 1 from jsonb_array_elements_text(p_args->'choices') x where nullif(btrim(x),'') is null) then raise exception 'Enter four answer choices';end if;
  if nullif(p_args->>'image_path','') is not null and split_part(p_args->>'image_path','/',1)<>cid::text then raise exception 'Invalid image path';end if;
  if qid is null then
   select coalesce(max(position),0)+1 into pos from private.acl_official_questions where competition_id=cid;
   insert into private.acl_official_questions(competition_id,position,stem,choices,correct_index,explanation,topic,image_path) values(cid,pos,btrim(p_args->>'stem'),p_args->'choices',(p_args->>'correct_index')::int,coalesce(p_args->>'explanation',''),coalesce(p_args->>'topic',''),nullif(p_args->>'image_path','')) returning id into qid;
  else
   update private.acl_official_questions set stem=btrim(p_args->>'stem'),choices=p_args->'choices',correct_index=(p_args->>'correct_index')::int,explanation=coalesce(p_args->>'explanation',''),topic=coalesce(p_args->>'topic',''),image_path=nullif(p_args->>'image_path','') where id=qid and competition_id=cid;
   if not found then raise exception 'Question not found';end if;
  end if;
  return jsonb_build_object('id',qid);
 elsif p_action='admin_publish' then
  if exists(select 1 from private.acl_official_attempts where competition_id=cid) then raise exception 'Competition has already started';end if;
  if (select count(*) from private.acl_official_questions where competition_id=cid)<c.question_count then raise exception 'Add enough questions before publishing';end if;
  if c.closes_at<=clock_timestamp() then raise exception 'Closing time must be in the future';end if;
  update private.acl_official_competitions set status='published',updated_at=now() where id=cid;return '{}'::jsonb;
 elsif p_action='admin_close' then
  update private.acl_official_competitions set status='closed',closes_at=greatest(opens_at+interval '1 second',least(closes_at,clock_timestamp())),updated_at=now() where id=cid;return '{}'::jsonb;
 elsif p_action='admin_results' then
  update private.acl_official_attempts set status='completed',current_index=cardinality(question_ids),finished_at=least(c.closes_at,deadline+make_interval(secs=>((cardinality(question_ids)-current_index-1)*c.question_seconds)))
  where competition_id=cid and status='active' and (c.status='closed' or clock_timestamp()>=least(c.closes_at,deadline+make_interval(secs=>((cardinality(question_ids)-current_index-1)*c.question_seconds))));
  select coalesce(jsonb_agg(to_jsonb(x) order by x.score desc,x.duration_seconds),'[]') into result from (
   select coalesce(p.display_name,p.full_name,p.username,'Member') name,att.status,att.warning_count,att.penalty,att.current_index answered_count,(select count(*) from jsonb_array_elements(att.answers) x where (x->>'correct')::boolean)-att.penalty score,extract(epoch from coalesce(att.finished_at,now())-att.started_at)::int duration_seconds
   from private.acl_official_attempts att left join public.profiles p on p.id=att.user_id where att.competition_id=cid
  )x;return result;
 end if;
 select * into a from private.acl_official_attempts where competition_id=cid and user_id=me for update;
 if p_action='view' then
  return jsonb_build_object('competition',jsonb_build_object('id',c.id,'title',c.title,'question_count',c.question_count,'question_seconds',c.question_seconds,'opens_at',c.opens_at,'closes_at',c.closes_at,'status',c.status),'attempt',case when a.id is not null then private.acl_official_state(a.id) else null end,'server_now',clock_timestamp());
 elsif p_action='start' then
  if a.id is not null then return private.acl_official_state(a.id);end if;
  if c.status<>'published' or clock_timestamp()<c.opens_at or clock_timestamp()>=c.closes_at then raise exception 'This competition is not open';end if;
  select array_agg(id order by position) into ids from (select id,position from private.acl_official_questions where competition_id=cid order by position limit c.question_count)x;
  if cardinality(ids) is distinct from c.question_count then raise exception 'Competition questions are not ready';end if;
  insert into private.acl_official_attempts(competition_id,user_id,question_ids,deadline) values(cid,me,ids,least(clock_timestamp()+make_interval(secs=>c.question_seconds),c.closes_at)) returning * into a;
  return private.acl_official_state(a.id);
 end if;
 if a.id is null then raise exception 'Start the competition first';end if;
 if p_action='event' then
  perform private.acl_official_state(a.id);
  select * into a from private.acl_official_attempts where id=a.id;
  if a.status<>'active' then return private.acl_official_state(a.id);end if;
  insert into private.acl_official_events(attempt_id,event_id) values(a.id,(p_args->>'event_id')::uuid) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then
   a.warning_count=a.warning_count+1;
   a.penalty=a.penalty+case when a.warning_count=2 then 1 when a.warning_count>=3 then 3 else 0 end;
   if a.warning_count>=3 then a.status='omitted';a.finished_at=clock_timestamp();end if;
   update private.acl_official_attempts set warning_count=a.warning_count,penalty=a.penalty,status=a.status,finished_at=a.finished_at where id=a.id;
  end if;
  return private.acl_official_state(a.id);
 end if;
 perform private.acl_official_state(a.id);
 select * into a from private.acl_official_attempts where id=a.id;
 if p_action='state' then return private.acl_official_state(a.id);
 elsif p_action='answer' then
  if a.status<>'active' then return private.acl_official_state(a.id);end if;
  if a.question_ids[a.current_index+1] is distinct from (p_args->>'question_id')::uuid then return private.acl_official_state(a.id);end if;
  selected=(p_args->>'selected')::int;if selected is null or selected not between 0 and 3 then raise exception 'Choose an answer';end if;
  select * into q from private.acl_official_questions where id=a.question_ids[a.current_index+1];
  a.answers=a.answers||jsonb_build_array(jsonb_build_object('question_id',q.id,'selected',selected,'correct',selected=q.correct_index,'answered_at',clock_timestamp()));
  a.current_index=a.current_index+1;
  if a.current_index>=cardinality(a.question_ids) then a.status='completed';a.finished_at=clock_timestamp();end if;
  update private.acl_official_attempts set answers=a.answers,current_index=a.current_index,status=a.status,finished_at=a.finished_at,deadline=least(clock_timestamp()+make_interval(secs=>c.question_seconds),c.closes_at) where id=a.id;
  return private.acl_official_state(a.id);
 end if;
 raise exception 'Unknown action';
end $$;
revoke all on function private.acl_official_api(text,jsonb) from public,anon;
grant execute on function private.acl_official_api(text,jsonb) to authenticated;
create function public.acl_official_api(p_action text,p_args jsonb default '{}') returns jsonb language sql security invoker set search_path=public,pg_temp as $$select private.acl_official_api(p_action,p_args)$$;
revoke all on function public.acl_official_api(text,jsonb) from public,anon;
grant execute on function public.acl_official_api(text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('acl-official','acl-official',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create function private.acl_official_image_allowed(p_name text) returns boolean language sql stable security definer set search_path=public,private,pg_temp as $$
select auth.uid() is not null and (public.acl_is_basic_question_admin() or exists(select 1 from private.acl_official_attempts a join private.acl_official_questions q on q.competition_id=a.competition_id where a.user_id=auth.uid() and q.image_path=p_name))$$;
revoke all on function private.acl_official_image_allowed(text) from public,anon;
grant execute on function private.acl_official_image_allowed(text) to authenticated;
create policy official_image_read on storage.objects for select to authenticated using(bucket_id='acl-official' and private.acl_official_image_allowed(name));
create policy official_image_upload on storage.objects for insert to authenticated with check(bucket_id='acl-official' and public.acl_is_basic_question_admin());
create policy official_image_delete on storage.objects for delete to authenticated using(bucket_id='acl-official' and public.acl_is_basic_question_admin());
