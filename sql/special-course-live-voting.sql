create table if not exists public.special_course_votes(
 id uuid primary key default gen_random_uuid(),
 module_id text not null references public.modules(id) on delete cascade,
 session_id uuid not null references public.special_course_sessions(id) on delete cascade,
 question text not null check(length(trim(question)) between 1 and 500),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 10),
 allow_multiple boolean not null default false,
 correct_options jsonb not null default '[]'::jsonb check(jsonb_typeof(correct_options)='array'),
 status text not null default 'open' check(status in('open','closed','archived')),
 results_visible boolean not null default false,
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 closed_at timestamptz,
 push_sent_at timestamptz
);
create index if not exists special_course_votes_room_idx on public.special_course_votes(module_id,session_id,created_at desc);
alter table public.special_course_votes enable row level security;
revoke all on public.special_course_votes from public,anon,authenticated;

create table if not exists public.special_course_vote_responses(
 vote_id uuid not null references public.special_course_votes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 selected_options jsonb not null check(jsonb_typeof(selected_options)='array'),
 responded_at timestamptz not null default now(),
 primary key(vote_id,user_id)
);
create index if not exists special_course_vote_responses_time_idx on public.special_course_vote_responses(vote_id,responded_at);
alter table public.special_course_vote_responses enable row level security;
revoke all on public.special_course_vote_responses from public,anon,authenticated;

create or replace function private.acl_course_vote_access(p_module_id text)
returns boolean language sql stable security definer set search_path='pg_catalog','public','auth'
as $function$
 select auth.uid() is not null and (
  public.acl_is_basic_question_admin() or exists(
   select 1 from public.modules m left join public.course_access ca on ca.module_id=m.id and ca.user_id=auth.uid()
   where m.id=p_module_id and m.edition='basic' and m.is_special_course
   and (not m.passcode_required or (ca.status='granted' and ca.access_version=m.passcode_version))
  )
 ) and (public.acl_is_basic_question_admin() or not exists(select 1 from public.special_course_suspensions s where s.module_id=p_module_id and s.user_id=auth.uid() and s.is_active))
$function$;

create or replace function public.acl_course_vote_state(p_module_id text,p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private','auth'
as $function$
declare v_uid uuid:=auth.uid();v_admin boolean:=public.acl_is_basic_question_admin();v_vote public.special_course_votes%rowtype;v_total integer;v_result jsonb;v_counts jsonb;v_first jsonb;v_history jsonb;
begin
 if not private.acl_course_vote_access(p_module_id) then raise exception 'Course access required';end if;
 if not exists(select 1 from public.special_course_sessions where id=p_session_id and module_id=p_module_id) then raise exception 'Room not found';end if;
 select * into v_vote from public.special_course_votes where module_id=p_module_id and session_id=p_session_id and (status='open' or results_visible) order by case when status='open' then 0 else 1 end,created_at desc limit 1;
 if v_vote.id is not null then
  select count(*) into v_total from public.special_course_vote_responses where vote_id=v_vote.id;
  if v_admin or v_vote.results_visible then
   select coalesce(jsonb_agg(jsonb_build_object('index',o.idx-1,'label',o.label,'count',coalesce(c.n,0),'percent',case when v_total>0 then round(100.0*coalesce(c.n,0)/v_total,1) else 0 end) order by o.idx),'[]'::jsonb) into v_counts
   from jsonb_array_elements_text(v_vote.options) with ordinality o(label,idx)
   left join lateral(select count(*) n from public.special_course_vote_responses r where r.vote_id=v_vote.id and exists(select 1 from jsonb_array_elements_text(r.selected_options) sx(value) where sx.value=((o.idx-1)::text)))c on true;
  else v_counts:='[]'::jsonb;end if;
  if v_admin then
   select coalesce(jsonb_agg(x.obj order by x.responded_at),'[]'::jsonb) into v_first from(
    select r.responded_at,jsonb_build_object('name',coalesce(nullif(trim(p.display_name),''),nullif(trim(p.full_name),''),'ACL Member'),'seat_number',s.seat_number,'selected',r.selected_options,'responded_at',r.responded_at) obj
    from public.special_course_vote_responses r left join public.profiles p on p.id=r.user_id left join public.special_course_seats s on s.module_id=p_module_id and s.user_id=r.user_id where r.vote_id=v_vote.id order by r.responded_at limit 10
   )x;
  else v_first:='[]'::jsonb;end if;
  v_result:=jsonb_build_object('id',v_vote.id,'question',v_vote.question,'options',v_vote.options,'allow_multiple',v_vote.allow_multiple,'correct_options',case when v_admin or v_vote.results_visible then v_vote.correct_options else '[]'::jsonb end,'status',v_vote.status,'results_visible',v_vote.results_visible,'total_responses',v_total,'counts',v_counts,'first_ten',v_first,'has_voted',exists(select 1 from public.special_course_vote_responses where vote_id=v_vote.id and user_id=v_uid),'my_selected',coalesce((select selected_options from public.special_course_vote_responses where vote_id=v_vote.id and user_id=v_uid),'[]'::jsonb),'created_at',v_vote.created_at);
 end if;
 if v_admin then
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'question',v.question,'status',v.status,'results_visible',v.results_visible,'responses',(select count(*) from public.special_course_vote_responses r where r.vote_id=v.id),'created_at',v.created_at) order by v.created_at desc),'[]'::jsonb) into v_history from (select * from public.special_course_votes where module_id=p_module_id and session_id=p_session_id order by created_at desc limit 30)v;
 else v_history:='[]'::jsonb;end if;
 return jsonb_build_object('admin',v_admin,'vote',v_result,'history',v_history,'server_time',now());
end $function$;

create or replace function public.acl_course_vote_action(p_action text,p_module_id text,p_session_id uuid,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','auth'
as $function$
declare v_uid uuid:=auth.uid();v_admin boolean:=public.acl_is_basic_question_admin();v_vote uuid:=nullif(p_args->>'vote_id','')::uuid;v_question text:=nullif(trim(p_args->>'question'),'');v_options jsonb:=coalesce(p_args->'options','[]'::jsonb);v_selected jsonb:=coalesce(p_args->'selected','[]'::jsonb);v_correct jsonb:=coalesce(p_args->'correct_options','[]'::jsonb);v_multiple boolean:=coalesce((p_args->>'allow_multiple')::boolean,false);v_row public.special_course_votes%rowtype;
begin
 if not private.acl_course_vote_access(p_module_id) then raise exception 'Course access required';end if;
 if not exists(select 1 from public.special_course_sessions where id=p_session_id and module_id=p_module_id) then raise exception 'Room not found';end if;
 if p_action='submit' then
  select * into v_row from public.special_course_votes where id=v_vote and module_id=p_module_id and session_id=p_session_id;
  if v_row.id is null or v_row.status<>'open' then raise exception 'Voting is closed';end if;
  if jsonb_array_length(v_selected)<1 or (not v_row.allow_multiple and jsonb_array_length(v_selected)<>1) then raise exception 'Choose the required answer';end if;
  if exists(select 1 from jsonb_array_elements_text(v_selected)x where x::integer<0 or x::integer>=jsonb_array_length(v_row.options)) then raise exception 'Invalid choice';end if;
  insert into public.special_course_vote_responses(vote_id,user_id,selected_options,responded_at) values(v_vote,v_uid,v_selected,now()) on conflict(vote_id,user_id) do update set selected_options=excluded.selected_options,responded_at=now();
  return jsonb_build_object('ok',true);
 end if;
 if not v_admin then raise exception 'Admin access required';end if;
 if p_action='create' then
  if v_question is null then raise exception 'Write the voting question';end if;
  if jsonb_typeof(v_options)<>'array' or jsonb_array_length(v_options) not between 2 and 10 then raise exception 'Add between 2 and 10 choices';end if;
  if exists(select 1 from jsonb_array_elements_text(v_options)x where length(trim(x))<1) then raise exception 'Choices cannot be empty';end if;
  update public.special_course_votes set status='closed',closed_at=now() where module_id=p_module_id and session_id=p_session_id and status='open';
  insert into public.special_course_votes(module_id,session_id,question,options,allow_multiple,correct_options,created_by) values(p_module_id,p_session_id,v_question,v_options,v_multiple,v_correct,v_uid) returning id into v_vote;
  return jsonb_build_object('ok',true,'vote_id',v_vote);
 elsif p_action='show_results' then update public.special_course_votes set results_visible=true where id=v_vote and module_id=p_module_id and session_id=p_session_id;
 elsif p_action='hide_results' then update public.special_course_votes set results_visible=false where id=v_vote and module_id=p_module_id and session_id=p_session_id;
 elsif p_action='stop_show' then update public.special_course_votes set status='closed',results_visible=true,closed_at=now() where id=v_vote and module_id=p_module_id and session_id=p_session_id;
 elsif p_action='stop_save' then update public.special_course_votes set status='archived',results_visible=false,closed_at=now() where id=v_vote and module_id=p_module_id and session_id=p_session_id;
 elsif p_action='reopen' then update public.special_course_votes set status='closed',results_visible=true where id=v_vote and module_id=p_module_id and session_id=p_session_id;
 else raise exception 'Unknown voting action';end if;
 return jsonb_build_object('ok',true);
end $function$;

revoke all on function public.acl_course_vote_state(text,uuid) from public,anon;
grant execute on function public.acl_course_vote_state(text,uuid) to authenticated,service_role;
revoke all on function public.acl_course_vote_action(text,text,uuid,jsonb) from public,anon;
grant execute on function public.acl_course_vote_action(text,text,uuid,jsonb) to authenticated,service_role;
