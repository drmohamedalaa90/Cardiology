create table if not exists public.special_course_seats (
  module_id text not null references public.modules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_number integer not null check (seat_number between 1 and 200),
  assigned_at timestamptz not null default now(),
  primary key(module_id,user_id),
  unique(module_id,seat_number)
);

alter table public.special_course_seats enable row level security;
revoke all on public.special_course_seats from anon, authenticated;

insert into public.special_course_seats(module_id,user_id,seat_number,assigned_at)
select ranked.module_id,ranked.user_id,ranked.seat_number,ranked.assigned_at
from (
  select ca.module_id,ca.user_id,
         row_number() over(partition by ca.module_id order by coalesce(ca.granted_at,ca.created_at),ca.user_id)::integer seat_number,
         coalesce(ca.granted_at,ca.created_at) assigned_at
  from public.course_access ca
  join public.modules m on m.id=ca.module_id and m.is_special_course
  where ca.status='granted' and ca.access_version=m.passcode_version
) ranked
where ranked.seat_number<=200
on conflict do nothing;

create or replace function private.acl_sync_special_course_seat()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
as $function$
declare v_seat integer;
begin
  if new.status='granted' and exists(select 1 from public.modules m where m.id=new.module_id and m.is_special_course) then
    perform pg_advisory_xact_lock(hashtextextended(new.module_id,0));
    if not exists(select 1 from public.special_course_seats s where s.module_id=new.module_id and s.user_id=new.user_id) then
      select n into v_seat
      from generate_series(1,200) n
      where not exists(select 1 from public.special_course_seats s where s.module_id=new.module_id and s.seat_number=n)
      order by n limit 1;
      if v_seat is not null then
        insert into public.special_course_seats(module_id,user_id,seat_number) values(new.module_id,new.user_id,v_seat);
      end if;
    end if;
  elsif new.status<>'granted' then
    delete from public.special_course_seats where module_id=new.module_id and user_id=new.user_id;
  end if;
  return new;
end
$function$;

drop trigger if exists acl_sync_special_course_seat_trigger on public.course_access;
create trigger acl_sync_special_course_seat_trigger
after insert or update of status,access_version on public.course_access
for each row execute function private.acl_sync_special_course_seat();

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
    'members',coalesce(jsonb_agg(jsonb_build_object(
      'seat_number',s.seat_number,
      'name',coalesce(nullif(trim(p.display_name),''),nullif(trim(p.full_name),''),'ACL Member'),
      'is_you',(s.user_id=v_uid)
    ) order by s.seat_number),'[]'::jsonb)
  ) into v_result
  from public.special_course_seats s
  join public.course_access ca on ca.module_id=s.module_id and ca.user_id=s.user_id
  left join public.profiles p on p.id=s.user_id
  where s.module_id=p_module_id and ca.status='granted' and ca.access_version=v_module.passcode_version;
  return v_result;
end
$function$;

create or replace function public.acl_special_course_hall(p_module_id text)
returns jsonb
language sql
security definer
set search_path=''
as $function$select private.acl_special_course_hall(p_module_id)$function$;

revoke execute on function public.acl_special_course_hall(text) from public,anon;
grant execute on function public.acl_special_course_hall(text) to authenticated,service_role;
