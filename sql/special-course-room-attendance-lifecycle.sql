alter table public.special_course_sessions add column if not exists is_locked boolean not null default false;
alter table public.special_course_sessions add column if not exists lecture_started_at timestamptz;
alter table public.special_course_sessions add column if not exists lecture_ended_at timestamptz;
alter table public.special_course_attendance add column if not exists checked_out_at timestamptz;

create or replace function private.acl_special_course_hall(p_module_id text)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','auth'
as $function$
declare v_uid uuid:=auth.uid();v_module public.modules%rowtype;v_admin boolean;v_access boolean;v_result jsonb;
begin
 if v_uid is null then raise exception 'Sign in required';end if;
 v_admin:=public.acl_is_basic_question_admin();
 select * into v_module from public.modules where id=p_module_id and edition='basic' and is_special_course;
 if not found then raise exception 'Special course not found';end if;
 v_access:=v_admin or not v_module.passcode_required or exists(select 1 from public.course_access ca where ca.user_id=v_uid and ca.module_id=p_module_id and ca.status='granted' and ca.access_version=v_module.passcode_version);
 if not v_access then raise exception 'Course passcode required';end if;
 select jsonb_build_object(
  'capacity',200,'occupied',count(*),'admin',v_admin,
  'your_seat',(select seat_number from public.special_course_seats where module_id=p_module_id and user_id=v_uid),
  'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'is_locked',r.is_locked,'started_at',r.lecture_started_at,'ended_at',r.lecture_ended_at) order by r.session_number) from public.special_course_sessions r where r.module_id=p_module_id),'[]'::jsonb),
  'members',coalesce(jsonb_agg(jsonb_build_object(
   'seat_number',s.seat_number,'name',coalesce(nullif(trim(p.display_name),''),nullif(trim(p.full_name),''),'ACL Member'),
   'gender',s.gender,'stars',s.stars,'asked',(s.asked_at is not null),'is_you',(s.user_id=v_uid),
   'attendance',coalesce((select jsonb_agg(jsonb_build_object(
      'slot',a.attendance_slot,'checked_in_at',a.checked_at,'checked_out_at',a.checked_out_at,
      'status',case when r.lecture_started_at is not null and a.checked_at>r.lecture_started_at then 'warning'
                    when a.checked_out_at is not null and (r.lecture_ended_at is null or a.checked_out_at<r.lecture_ended_at) then 'warning'
                    when r.lecture_ended_at is not null and a.checked_out_at is null then 'warning' else 'good' end
    ) order by a.attendance_slot) from public.special_course_attendance a join public.special_course_sessions r on r.id=a.session_id where a.module_id=s.module_id and a.user_id=s.user_id),'[]'::jsonb)
  ) order by s.seat_number),'[]'::jsonb)
 ) into v_result
 from public.special_course_seats s join public.course_access ca on ca.module_id=s.module_id and ca.user_id=s.user_id left join public.profiles p on p.id=s.user_id
 where s.module_id=p_module_id and ca.status='granted' and ca.access_version=v_module.passcode_version;
 return v_result;
end $function$;

create or replace function private.acl_special_course_hall_action(p_action text,p_module_id text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','auth'
as $function$
declare v_uid uuid:=auth.uid();v_admin boolean;v_module public.modules%rowtype;v_access boolean;v_seat integer:=nullif(p_args->>'seat_number','')::integer;v_slot integer:=nullif(p_args->>'attendance_slot','')::integer;v_session uuid:=nullif(p_args->>'session_id','')::uuid;v_question text:=nullif(trim(p_args->>'question'),'');v_room public.special_course_sessions%rowtype;
begin
 if v_uid is null then raise exception 'Sign in required';end if;v_admin:=public.acl_is_basic_question_admin();
 select * into v_module from public.modules where id=p_module_id and edition='basic' and is_special_course;if not found then raise exception 'Special course not found';end if;
 v_access:=v_admin or not v_module.passcode_required or exists(select 1 from public.course_access ca where ca.user_id=v_uid and ca.module_id=p_module_id and ca.status='granted' and ca.access_version=v_module.passcode_version);if not v_access then raise exception 'Course passcode required';end if;
 if v_session is not null then select * into v_room from public.special_course_sessions where id=v_session and module_id=p_module_id;end if;
 if p_action='check_in' then
  if v_room.id is null or not v_room.is_active or v_room.is_locked then raise exception 'This room is locked';end if;
  if v_slot is null or v_slot not between 1 and 4 or v_room.session_number<>v_slot then raise exception 'Attendance is available for course rooms 1 to 4';end if;
  insert into public.special_course_attendance(module_id,user_id,session_id,attendance_slot,checked_at,checked_out_at) values(p_module_id,v_uid,v_session,v_slot,now(),null)
   on conflict(module_id,user_id,attendance_slot) do update set session_id=excluded.session_id,checked_at=excluded.checked_at,checked_out_at=null;
  return jsonb_build_object('ok',true);
 elsif p_action='check_out' then
  update public.special_course_attendance set checked_out_at=now() where module_id=p_module_id and user_id=v_uid and session_id=v_session and checked_out_at is null;
  if not found then raise exception 'Check in first';end if;return jsonb_build_object('ok',true);
 elsif p_action in ('request_repeat','submit_question') then
  if v_admin then raise exception 'Candidate action only';end if;if v_room.id is null or v_room.is_locked then raise exception 'This course room is locked';end if;
  if p_action='submit_question' and v_question is null then raise exception 'Write your question first';end if;if length(coalesce(v_question,''))>1000 then raise exception 'Question is too long';end if;
  insert into public.special_course_help_requests(module_id,session_id,user_id,request_type,question) values(p_module_id,v_session,v_uid,case when p_action='request_repeat' then 'repeat' else 'question' end,v_question);return jsonb_build_object('ok',true);
 end if;
 if not v_admin then raise exception 'Admin access required';end if;
 if p_action='set_room_lock' then update public.special_course_sessions set is_locked=coalesce((p_args->>'locked')::boolean,false),updated_at=now() where id=v_session and module_id=p_module_id;
 elsif p_action='start_lecture' then update public.special_course_sessions set lecture_started_at=now(),lecture_ended_at=null,is_locked=false,updated_at=now() where id=v_session and module_id=p_module_id;
 elsif p_action='end_lecture' then update public.special_course_sessions set lecture_ended_at=now(),updated_at=now() where id=v_session and module_id=p_module_id and lecture_started_at is not null;
 elsif p_action='call_member' then update public.special_course_seats set asked_at=now() where module_id=p_module_id and seat_number=v_seat;
 elsif p_action='award_star' then update public.special_course_seats set stars=least(stars+1,999) where module_id=p_module_id and seat_number=v_seat;
 elsif p_action='remove_star' then update public.special_course_seats set stars=greatest(stars-1,0) where module_id=p_module_id and seat_number=v_seat;
 elsif p_action='reset_asked' then update public.special_course_seats set asked_at=null where module_id=p_module_id;
 else raise exception 'Unknown hall action';end if;return jsonb_build_object('ok',true);
end $function$;
