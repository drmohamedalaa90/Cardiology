alter table public.special_course_seats add column if not exists gender text not null default 'male';
alter table public.special_course_seats add column if not exists stars integer not null default 0;
alter table public.special_course_seats add column if not exists asked_at timestamptz;

alter table public.special_course_seats drop constraint if exists special_course_seats_gender_check;
alter table public.special_course_seats add constraint special_course_seats_gender_check check (gender in ('male','female'));
alter table public.special_course_seats drop constraint if exists special_course_seats_stars_check;
alter table public.special_course_seats add constraint special_course_seats_stars_check check (stars between 0 and 999);

create table if not exists public.special_course_attendance (
  module_id text not null references public.modules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.special_course_sessions(id) on delete cascade,
  attendance_slot integer not null check (attendance_slot between 1 and 4),
  checked_at timestamptz not null default now(),
  primary key(module_id,user_id,attendance_slot)
);

alter table public.special_course_attendance enable row level security;
revoke all on public.special_course_attendance from anon,authenticated;

create or replace function private.acl_special_course_hall(p_module_id text)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_module public.modules%rowtype;
  v_admin boolean;
  v_access boolean;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  v_admin:=public.acl_is_basic_question_admin();
  select * into v_module from public.modules where id=p_module_id and edition='basic' and is_special_course;
  if not found then raise exception 'Special course not found'; end if;
  v_access:=v_admin or not v_module.passcode_required or exists(
    select 1 from public.course_access ca where ca.user_id=v_uid and ca.module_id=p_module_id
      and ca.status='granted' and ca.access_version=v_module.passcode_version
  );
  if not v_access then raise exception 'Course passcode required'; end if;

  select jsonb_build_object(
    'capacity',200,
    'occupied',count(*),
    'admin',v_admin,
    'your_seat',(select seat_number from public.special_course_seats where module_id=p_module_id and user_id=v_uid),
    'members',coalesce(jsonb_agg(jsonb_build_object(
      'seat_number',s.seat_number,
      'name',coalesce(nullif(trim(p.display_name),''),nullif(trim(p.full_name),''),'ACL Member'),
      'gender',s.gender,
      'stars',s.stars,
      'asked',(s.asked_at is not null),
      'is_you',(s.user_id=v_uid),
      'attendance',coalesce((select jsonb_agg(a.attendance_slot order by a.attendance_slot) from public.special_course_attendance a where a.module_id=s.module_id and a.user_id=s.user_id),'[]'::jsonb)
    ) order by s.seat_number),'[]'::jsonb)
  ) into v_result
  from public.special_course_seats s
  join public.course_access ca on ca.module_id=s.module_id and ca.user_id=s.user_id
  left join public.profiles p on p.id=s.user_id
  where s.module_id=p_module_id and ca.status='granted' and ca.access_version=v_module.passcode_version;
  return v_result;
end
$function$;

create or replace function private.acl_special_course_hall_action(p_action text,p_module_id text,p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_admin boolean;
  v_module public.modules%rowtype;
  v_access boolean;
  v_seat integer:=nullif(p_args->>'seat_number','')::integer;
  v_slot integer:=nullif(p_args->>'attendance_slot','')::integer;
  v_session uuid:=nullif(p_args->>'session_id','')::uuid;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  v_admin:=public.acl_is_basic_question_admin();
  select * into v_module from public.modules where id=p_module_id and edition='basic' and is_special_course;
  if not found then raise exception 'Special course not found'; end if;
  v_access:=v_admin or not v_module.passcode_required or exists(
    select 1 from public.course_access ca where ca.user_id=v_uid and ca.module_id=p_module_id and ca.status='granted' and ca.access_version=v_module.passcode_version
  );
  if not v_access then raise exception 'Course passcode required'; end if;

  if p_action='check_in' then
    if v_slot is null or v_slot not between 1 and 4 then raise exception 'Attendance is available for course rooms 1 to 4'; end if;
    if v_session is null or not exists(select 1 from public.special_course_sessions s where s.id=v_session and s.module_id=p_module_id and s.session_number=v_slot and s.is_active) then
      raise exception 'This attendance room is not available';
    end if;
    insert into public.special_course_attendance(module_id,user_id,session_id,attendance_slot)
    values(p_module_id,v_uid,v_session,v_slot)
    on conflict(module_id,user_id,attendance_slot) do update set session_id=excluded.session_id;
    return jsonb_build_object('ok',true,'attendance_slot',v_slot);
  end if;

  if not v_admin then raise exception 'Admin access required'; end if;
  if p_action='call_member' then
    update public.special_course_seats set asked_at=now() where module_id=p_module_id and seat_number=v_seat;
  elsif p_action='award_star' then
    update public.special_course_seats set stars=least(stars+1,999) where module_id=p_module_id and seat_number=v_seat;
  elsif p_action='remove_star' then
    update public.special_course_seats set stars=greatest(stars-1,0) where module_id=p_module_id and seat_number=v_seat;
  elsif p_action='reset_asked' then
    update public.special_course_seats set asked_at=null where module_id=p_module_id;
  else
    raise exception 'Unknown hall action';
  end if;
  return jsonb_build_object('ok',true);
end
$function$;

create or replace function public.acl_special_course_hall_action(p_action text,p_module_id text,p_args jsonb default '{}'::jsonb)
returns jsonb language sql security definer set search_path=''
as $function$select private.acl_special_course_hall_action(p_action,p_module_id,p_args)$function$;

revoke execute on function public.acl_special_course_hall_action(text,text,jsonb) from public,anon;
grant execute on function public.acl_special_course_hall_action(text,text,jsonb) to authenticated,service_role;

create or replace function public.acl_special_course_api(p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
as $function$
declare v_result jsonb;v_gender text;
begin
  v_result:=private.acl_special_course_api(p_action,p_args);
  if p_action='unlock' then
    v_gender:=lower(coalesce(p_args->>'gender',''));
    if v_gender not in ('male','female') then raise exception 'Choose male or female'; end if;
    update public.special_course_seats set gender=v_gender where module_id=p_args->>'module_id' and user_id=auth.uid();
    v_result:=v_result||jsonb_build_object(
      'seat_number',(select seat_number from public.special_course_seats where module_id=p_args->>'module_id' and user_id=auth.uid()),
      'gender',v_gender
    );
  end if;
  return v_result;
end
$function$;

revoke execute on function public.acl_special_course_api(text,jsonb) from public,anon;
grant execute on function public.acl_special_course_api(text,jsonb) to authenticated,service_role;
