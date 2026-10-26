create table if not exists public.special_course_help_requests (
  id uuid primary key default gen_random_uuid(),
  module_id text not null references public.modules(id) on delete cascade,
  session_id uuid not null references public.special_course_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('repeat','question')),
  question text check (question is null or length(question) between 1 and 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists special_course_help_requests_admin_feed_idx on public.special_course_help_requests(created_at desc) where resolved_at is null;
alter table public.special_course_help_requests enable row level security;
revoke all on public.special_course_help_requests from anon,authenticated;

create or replace function private.acl_special_course_hall_action(p_action text,p_module_id text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','auth'
as $function$
declare
  v_uid uuid:=auth.uid(); v_admin boolean; v_module public.modules%rowtype; v_access boolean;
  v_seat integer:=nullif(p_args->>'seat_number','')::integer;
  v_slot integer:=nullif(p_args->>'attendance_slot','')::integer;
  v_session uuid:=nullif(p_args->>'session_id','')::uuid;
  v_question text:=nullif(trim(p_args->>'question'),'');
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  v_admin:=public.acl_is_basic_question_admin();
  select * into v_module from public.modules where id=p_module_id and edition='basic' and is_special_course;
  if not found then raise exception 'Special course not found'; end if;
  v_access:=v_admin or not v_module.passcode_required or exists(select 1 from public.course_access ca where ca.user_id=v_uid and ca.module_id=p_module_id and ca.status='granted' and ca.access_version=v_module.passcode_version);
  if not v_access then raise exception 'Course passcode required'; end if;

  if p_action='check_in' then
    if v_slot is null or v_slot not between 1 and 4 then raise exception 'Attendance is available for course rooms 1 to 4'; end if;
    if v_session is null or not exists(select 1 from public.special_course_sessions s where s.id=v_session and s.module_id=p_module_id and s.session_number=v_slot and s.is_active) then raise exception 'This attendance room is not available'; end if;
    insert into public.special_course_attendance(module_id,user_id,session_id,attendance_slot) values(p_module_id,v_uid,v_session,v_slot)
      on conflict(module_id,user_id,attendance_slot) do update set session_id=excluded.session_id;
    return jsonb_build_object('ok',true,'attendance_slot',v_slot);
  elsif p_action in ('request_repeat','submit_question') then
    if v_admin then raise exception 'Candidate action only'; end if;
    if v_session is null or not exists(select 1 from public.special_course_sessions s where s.id=v_session and s.module_id=p_module_id and s.is_active) then raise exception 'This course room is not available'; end if;
    if p_action='submit_question' and v_question is null then raise exception 'Write your question first'; end if;
    if length(coalesce(v_question,''))>1000 then raise exception 'Question is too long'; end if;
    insert into public.special_course_help_requests(module_id,session_id,user_id,request_type,question)
      values(p_module_id,v_session,v_uid,case when p_action='request_repeat' then 'repeat' else 'question' end,v_question);
    return jsonb_build_object('ok',true);
  end if;

  if not v_admin then raise exception 'Admin access required'; end if;
  if p_action='call_member' then update public.special_course_seats set asked_at=now() where module_id=p_module_id and seat_number=v_seat;
  elsif p_action='award_star' then update public.special_course_seats set stars=least(stars+1,999) where module_id=p_module_id and seat_number=v_seat;
  elsif p_action='remove_star' then update public.special_course_seats set stars=greatest(stars-1,0) where module_id=p_module_id and seat_number=v_seat;
  elsif p_action='reset_asked' then update public.special_course_seats set asked_at=null where module_id=p_module_id;
  else raise exception 'Unknown hall action'; end if;
  return jsonb_build_object('ok',true);
end $function$;

create or replace function private.acl_basic_notifications_filtered() returns jsonb
language sql stable security definer set search_path='pg_catalog','public','private','auth'
as $function$
 with base_feed as(select value as item from jsonb_array_elements(private.acl_basic_notifications_raw()->'items')),
 help_feed as(
   select jsonb_build_object(
     'key','course_help:'||h.id::text,
     'kind','admin_message',
     'title',case when h.request_type='repeat' then 'Please repeat — Room '||s.session_number else 'Course question — Room '||s.session_number end,
     'body',coalesce(nullif(trim(p.display_name),''),nullif(trim(p.full_name),''),'ACL member')||' · Seat '||lpad(cs.seat_number::text,3,'0')||case when h.request_type='repeat' then ' asks you to repeat the explanation.' else ': '||h.question end,
     'link_url','basic-special-course.html?edition=basic&course='||h.module_id,
     'event_at',h.created_at,'avatar_url',p.avatar_url,
     'is_unread',not exists(select 1 from public.acl_notification_reads r where r.user_id=auth.uid() and r.notification_key='course_help:'||h.id::text)
   ) item
   from public.special_course_help_requests h
   join public.special_course_sessions s on s.id=h.session_id
   join public.special_course_seats cs on cs.module_id=h.module_id and cs.user_id=h.user_id
   left join public.profiles p on p.id=h.user_id
   where public.acl_is_basic_question_admin() and h.resolved_at is null
 ),
 feed as(select item from base_feed union all select item from help_feed),
 visible as(select f.item from feed f where auth.uid() is not null and not exists(select 1 from private.acl_notification_controls c where c.owner_key in ('*',auth.uid()::text) and ((c.notification_key=f.item->>'key' and c.hidden) or (c.notification_key='__cutoff' and (f.item->>'event_at')::timestamptz<=c.cutoff))))
 select jsonb_build_object('unread_count',count(*) filter(where (item->>'is_unread')::boolean),'items',coalesce(jsonb_agg(item order by coalesce((select c.position from private.acl_notification_controls c where c.owner_key='*' and c.notification_key=item->>'key'),2147483647),(item->>'event_at')::timestamptz desc),'[]'::jsonb)) from visible
$function$;

create or replace function public.acl_special_course_api(p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','auth'
as $function$
declare v_result jsonb;v_gender text;v_courses jsonb;
begin
  v_result:=private.acl_special_course_api(p_action,p_args);
  if p_action='unlock' then
    v_gender:=lower(coalesce(p_args->>'gender',''));
    if v_gender not in ('male','female') then raise exception 'Choose male or female'; end if;
    update public.special_course_seats set gender=v_gender where module_id=p_args->>'module_id' and user_id=auth.uid();
    v_result:=v_result||jsonb_build_object('seat_number',(select seat_number from public.special_course_seats where module_id=p_args->>'module_id' and user_id=auth.uid()),'gender',v_gender);
  elsif p_action='list' then
    select coalesce(jsonb_agg(c.value||jsonb_build_object('seat_number',(select s.seat_number from public.special_course_seats s where s.module_id=c.value->>'id' and s.user_id=auth.uid()))),'[]'::jsonb)
      into v_courses from jsonb_array_elements(coalesce(v_result->'courses','[]'::jsonb)) c(value);
    v_result:=jsonb_set(v_result,'{courses}',v_courses,true);
  end if;
  return v_result;
end $function$;
revoke execute on function public.acl_special_course_api(text,jsonb) from public,anon;
grant execute on function public.acl_special_course_api(text,jsonb) to authenticated,service_role;
