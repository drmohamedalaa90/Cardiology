alter table public.special_course_attendance_review_requests add column if not exists checker_invited boolean not null default false;

create table if not exists public.special_course_attendance_publications(
 module_id text not null references public.modules(id) on delete cascade,
 session_id uuid not null references public.special_course_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 attendance_slot integer not null check(attendance_slot between 1 and 4),
 checkin_status text not null check(checkin_status in('on_time','not_on_time','not_checked_in')),
 checkout_status text not null check(checkout_status in('on_time','not_on_time','not_checked_out')),
 overall_status text not null check(overall_status in('green','orange','red')),
 published_at timestamptz not null default now(),
 published_by uuid references auth.users(id) on delete set null,
 primary key(session_id,user_id)
);
alter table public.special_course_attendance_publications enable row level security;
revoke all on public.special_course_attendance_publications from public,anon,authenticated;

create table if not exists public.special_course_attendance_review_requests(
 id uuid primary key default gen_random_uuid(),module_id text not null references public.modules(id) on delete cascade,
 session_id uuid not null references public.special_course_sessions(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 request_text text not null check(length(trim(request_text)) between 1 and 1500),requested_at timestamptz not null default now(),
 status text not null default 'pending' check(status in('pending','replied','closed')),admin_reply text,replied_by uuid references auth.users(id) on delete set null,replied_at timestamptz,
 unique(session_id,user_id)
);
alter table public.special_course_attendance_review_requests enable row level security;
revoke all on public.special_course_attendance_review_requests from public,anon,authenticated;

create table if not exists public.special_course_attendance_quizzes(
 session_id uuid primary key references public.special_course_sessions(id) on delete cascade,module_id text not null references public.modules(id) on delete cascade,
 questions jsonb not null default '[]'::jsonb check(jsonb_typeof(questions)='array'),is_open boolean not null default false,
 updated_by uuid references auth.users(id) on delete set null,updated_at timestamptz not null default now()
);
alter table public.special_course_attendance_quizzes enable row level security;
revoke all on public.special_course_attendance_quizzes from public,anon,authenticated;

create table if not exists public.special_course_attendance_quiz_attempts(
 session_id uuid not null references public.special_course_sessions(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'started' check(status in('started','passed','failed')),answers jsonb not null default '[]'::jsonb,score integer,
 started_at timestamptz not null default now(),submitted_at timestamptz,fail_reason text,
 primary key(session_id,user_id)
);
alter table public.special_course_attendance_quiz_attempts enable row level security;
revoke all on public.special_course_attendance_quiz_attempts from public,anon,authenticated;

create or replace function private.acl_attendance_room_rows(p_module_id text,p_session_id uuid)
returns table(user_id uuid,seat_number integer,member_name text,attendance_slot integer,checkin_status text,checkout_status text,overall_status text)
language sql stable security definer set search_path='pg_catalog','public','auth'
as $function$
 select s.user_id,s.seat_number,coalesce(nullif(trim(p.display_name),''),nullif(trim(p.full_name),''),'ACL Member'),r.session_number,
 case when a.checked_at is null then 'not_checked_in' when r.lecture_started_at is null or a.checked_at<=r.lecture_started_at then 'on_time' else 'not_on_time' end,
 case when a.checked_out_at is null then 'not_checked_out' when r.lecture_ended_at is not null and a.checked_out_at>=r.lecture_ended_at and a.checked_out_at<=r.lecture_ended_at+interval '15 minutes' then 'on_time' else 'not_on_time' end,
 case when a.checked_at is null then 'red' when (r.lecture_started_at is null or a.checked_at<=r.lecture_started_at) and r.lecture_ended_at is not null and a.checked_out_at>=r.lecture_ended_at and a.checked_out_at<=r.lecture_ended_at+interval '15 minutes' then 'green' else 'orange' end
 from public.special_course_sessions r join public.special_course_seats s on s.module_id=r.module_id
 join public.course_access ca on ca.module_id=s.module_id and ca.user_id=s.user_id and ca.status='granted'
 left join public.profiles p on p.id=s.user_id
 left join public.special_course_attendance a on a.module_id=s.module_id and a.user_id=s.user_id and a.session_id=r.id
 where r.id=p_session_id and r.module_id=p_module_id
 order by s.seat_number
$function$;

create or replace function public.acl_attendance_review_state(p_module_id text,p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private','auth'
as $function$
declare uid uuid:=auth.uid();adm boolean:=public.acl_is_basic_question_admin();pub jsonb;req jsonb;quiz jsonb;attempt jsonb;attempts jsonb;report jsonb;slot integer;
begin
 if not private.acl_course_vote_access(p_module_id) then raise exception 'Course access required';end if;
 select session_number into slot from public.special_course_sessions where id=p_session_id and module_id=p_module_id;if slot is null then raise exception 'Room not found';end if;
 if adm then
  select coalesce(jsonb_agg(jsonb_build_object('user_id',x.user_id,'seat_number',x.seat_number,'name',x.member_name,'checkin_status',coalesce(ap.checkin_status,x.checkin_status),'checkout_status',coalesce(ap.checkout_status,x.checkout_status),'overall_status',coalesce(ap.overall_status,x.overall_status),'published',ap.user_id is not null) order by x.seat_number),'[]'::jsonb) into report from private.acl_attendance_room_rows(p_module_id,p_session_id)x left join public.special_course_attendance_publications ap on ap.session_id=p_session_id and ap.user_id=x.user_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'user_id',q.user_id,'name',coalesce(nullif(trim(p.display_name),''),nullif(trim(p.full_name),''),'ACL Member'),'seat_number',s.seat_number,'text',q.request_text,'status',q.status,'reply',q.admin_reply,'requested_at',q.requested_at,'checker_invited',q.checker_invited) order by q.requested_at),'[]'::jsonb) into req from public.special_course_attendance_review_requests q left join public.profiles p on p.id=q.user_id left join public.special_course_seats s on s.module_id=q.module_id and s.user_id=q.user_id where q.session_id=p_session_id;
  select to_jsonb(q) into quiz from public.special_course_attendance_quizzes q where q.session_id=p_session_id;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'name',coalesce(nullif(trim(p.display_name),''),nullif(trim(p.full_name),''),'ACL Member'),'seat_number',s.seat_number,'status',a.status,'score',a.score,'started_at',a.started_at,'submitted_at',a.submitted_at,'fail_reason',a.fail_reason,'attendance_status',ap.overall_status,'suspended',exists(select 1 from public.special_course_suspensions sx where sx.module_id=p_module_id and sx.user_id=a.user_id and sx.is_active)) order by a.submitted_at desc nulls last,a.started_at desc),'[]'::jsonb) into attempts from public.special_course_attendance_quiz_attempts a left join public.profiles p on p.id=a.user_id left join public.special_course_seats s on s.module_id=p_module_id and s.user_id=a.user_id left join public.special_course_attendance_publications ap on ap.session_id=p_session_id and ap.user_id=a.user_id where a.session_id=p_session_id;
  return jsonb_build_object('admin',true,'report',report,'requests',req,'quiz',quiz,'attempts',attempts);
 end if;
 select to_jsonb(x) into pub from (select p.checkin_status,p.checkout_status,p.overall_status,p.published_at,r.session_number,r.title from public.special_course_attendance_publications p join public.special_course_sessions r on r.id=p.session_id where p.session_id=p_session_id and p.user_id=uid)x;
 select to_jsonb(x) into req from (select id,request_text,status,admin_reply,replied_at,checker_invited from public.special_course_attendance_review_requests where session_id=p_session_id and user_id=uid)x;
 select jsonb_build_object('is_open',q.is_open,'questions',case when q.is_open and exists(select 1 from public.special_course_attendance_review_requests rr where rr.session_id=p_session_id and rr.user_id=uid) then (select jsonb_agg(value-'correct_index') from jsonb_array_elements(q.questions)) else '[]'::jsonb end) into quiz from public.special_course_attendance_quizzes q where q.session_id=p_session_id;
 select to_jsonb(a) into attempt from public.special_course_attendance_quiz_attempts a where a.session_id=p_session_id and a.user_id=uid;
 return jsonb_build_object('admin',false,'publication',pub,'request',req,'quiz',quiz,'attempt',attempt);
end $function$;

create or replace function public.acl_attendance_review_action(p_action text,p_module_id text,p_session_id uuid,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','auth'
as $function$
declare uid uuid:=auth.uid();adm boolean:=public.acl_is_basic_question_admin();slot integer;txt text:=nullif(trim(p_args->>'text'),'');rid uuid:=nullif(p_args->>'request_id','')::uuid;qs jsonb:=coalesce(p_args->'questions','[]'::jsonb);ans jsonb:=coalesce(p_args->'answers','[]'::jsonb);sc integer:=0;q jsonb;idx integer:=0;
begin
 if not private.acl_course_vote_access(p_module_id) then raise exception 'Course access required';end if;
 select session_number into slot from public.special_course_sessions where id=p_session_id and module_id=p_module_id;if slot is null then raise exception 'Room not found';end if;
 if p_action='request_review' then
  if txt is null then raise exception 'Write your review request';end if;
  if not exists(select 1 from public.special_course_attendance_publications where session_id=p_session_id and user_id=uid) then raise exception 'Attendance report has not been published';end if;
  insert into public.special_course_attendance_review_requests(module_id,session_id,user_id,request_text,status,requested_at,admin_reply,replied_at) values(p_module_id,p_session_id,uid,txt,'pending',now(),null,null) on conflict(session_id,user_id) do update set request_text=excluded.request_text,status='pending',requested_at=now(),admin_reply=null,replied_at=null,checker_invited=false;
  return jsonb_build_object('ok',true);
 elsif p_action='start_quiz' then
  if not exists(select 1 from public.special_course_attendance_review_requests where session_id=p_session_id and user_id=uid and checker_invited) then raise exception 'The Academic Director has not invited you to the checker yet';end if;
  if not exists(select 1 from public.special_course_attendance_quizzes where session_id=p_session_id and is_open and jsonb_array_length(questions)=5) then raise exception 'Attendance checker is not open';end if;
  if exists(select 1 from public.special_course_attendance_quiz_attempts where session_id=p_session_id and user_id=uid) then raise exception 'This attendance checker attempt has already been used';end if;
  insert into public.special_course_attendance_quiz_attempts(session_id,user_id,status,answers,score,started_at,submitted_at,fail_reason) values(p_session_id,uid,'started','[]',null,now(),null,null);
  return jsonb_build_object('ok',true);
 elsif p_action='fail_quiz' then
  update public.special_course_attendance_quiz_attempts set status='failed',submitted_at=now(),fail_reason=coalesce(txt,'Screen changed during attendance checker') where session_id=p_session_id and user_id=uid and status='started';return jsonb_build_object('ok',true);
 elsif p_action='submit_quiz' then
  if jsonb_array_length(ans)<>5 then raise exception 'Answer all five questions';end if;
  select questions into qs from public.special_course_attendance_quizzes where session_id=p_session_id and is_open;
  if qs is null or jsonb_array_length(qs)<>5 then raise exception 'Attendance checker is closed';end if;
  if not exists(select 1 from public.special_course_attendance_quiz_attempts where session_id=p_session_id and user_id=uid and status='started') then raise exception 'Start the checker first';end if;
  for q in select value from jsonb_array_elements(qs) loop if (ans->>idx)::integer=(q->>'correct_index')::integer then sc:=sc+1;end if;idx:=idx+1;end loop;
  update public.special_course_attendance_quiz_attempts set status=case when sc>=4 then 'passed' else 'failed' end,answers=ans,score=sc,submitted_at=now(),fail_reason=case when sc>=4 then null else 'Score below 4/5' end where session_id=p_session_id and user_id=uid;
  if sc>=4 then
   update public.special_course_attendance_publications set overall_status='green' where session_id=p_session_id and user_id=uid;
   insert into public.special_course_attendance_reviews(module_id,user_id,attendance_slot,status,reviewed_by,reviewed_at) values(p_module_id,uid,slot,'green',null,now()) on conflict(module_id,user_id,attendance_slot) do update set status='green',reviewed_by=null,reviewed_at=now();
  end if;
  return jsonb_build_object('ok',true,'score',sc,'passed',sc>=4);
 end if;
 if not adm then raise exception 'Admin access required';end if;
 if p_action='publish_report' then
  insert into public.special_course_attendance_publications(module_id,session_id,user_id,attendance_slot,checkin_status,checkout_status,overall_status,published_by,published_at)
  select p_module_id,p_session_id,x.user_id,x.attendance_slot,x.checkin_status,x.checkout_status,x.overall_status,uid,now() from private.acl_attendance_room_rows(p_module_id,p_session_id)x
  on conflict(session_id,user_id) do update set checkin_status=excluded.checkin_status,checkout_status=excluded.checkout_status,overall_status=excluded.overall_status,published_by=uid,published_at=now();
  insert into public.special_course_attendance_reviews(module_id,user_id,attendance_slot,status,reviewed_by,reviewed_at)
  select p_module_id,x.user_id,x.attendance_slot,x.overall_status,uid,now() from private.acl_attendance_room_rows(p_module_id,p_session_id)x
  on conflict(module_id,user_id,attendance_slot) do update set status=excluded.status,reviewed_by=uid,reviewed_at=now();
 elsif p_action='reply' then if txt is null or rid is null then raise exception 'Write a reply';end if;update public.special_course_attendance_review_requests set admin_reply=txt,status='replied',replied_by=uid,replied_at=now() where id=rid and session_id=p_session_id;
 elsif p_action='invite_checker' then if txt is null or rid is null then raise exception 'Write a reply';end if;if not exists(select 1 from public.special_course_attendance_quizzes where session_id=p_session_id and jsonb_array_length(questions)=5) then raise exception 'Create the five checker questions first';end if;update public.special_course_attendance_quizzes set is_open=true,updated_by=uid,updated_at=now() where session_id=p_session_id;update public.special_course_attendance_review_requests set admin_reply=txt,status='replied',checker_invited=true,replied_by=uid,replied_at=now() where id=rid and session_id=p_session_id;
 elsif p_action='group_reply' then if txt is null then raise exception 'Write a group message';end if;update public.special_course_attendance_review_requests set admin_reply=txt,status='replied',replied_by=uid,replied_at=now() where session_id=p_session_id and status='pending';
 elsif p_action='save_quiz' then
  if jsonb_array_length(qs)<>5 then raise exception 'Exactly five questions are required';end if;
  if exists(select 1 from jsonb_array_elements(qs)x where length(trim(x->>'stem'))<1 or x->>'type' not in('mcq','tf') or jsonb_array_length(x->'choices')<2 or (x->>'correct_index')::integer not between 0 and jsonb_array_length(x->'choices')-1) then raise exception 'Complete all five questions and correct answers';end if;
  insert into public.special_course_attendance_quizzes(session_id,module_id,questions,is_open,updated_by,updated_at) values(p_session_id,p_module_id,qs,coalesce((p_args->>'is_open')::boolean,false),uid,now()) on conflict(session_id) do update set questions=excluded.questions,is_open=excluded.is_open,updated_by=uid,updated_at=now();
 elsif p_action='set_quiz_open' then update public.special_course_attendance_quizzes set is_open=coalesce((p_args->>'is_open')::boolean,false),updated_by=uid,updated_at=now() where session_id=p_session_id;
 elsif p_action='reset_attempt' then delete from public.special_course_attendance_quiz_attempts where session_id=p_session_id and user_id=(p_args->>'user_id')::uuid;
 else raise exception 'Unknown attendance action';end if;
 return jsonb_build_object('ok',true);
end $function$;

revoke all on function public.acl_attendance_review_state(text,uuid) from public,anon;
grant execute on function public.acl_attendance_review_state(text,uuid) to authenticated,service_role;
revoke all on function public.acl_attendance_review_action(text,text,uuid,jsonb) from public,anon;
grant execute on function public.acl_attendance_review_action(text,text,uuid,jsonb) to authenticated,service_role;
