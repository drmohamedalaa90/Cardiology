create or replace function private.acl_mark_missing_checkouts_orange()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
as $function$
begin
  if new.lecture_ended_at is not null
     and (old.lecture_ended_at is distinct from new.lecture_ended_at) then
    insert into public.special_course_attendance_reviews(
      module_id,user_id,attendance_slot,status,reviewed_by,reviewed_at
    )
    select a.module_id,a.user_id,a.attendance_slot,'orange',null,now()
    from public.special_course_attendance a
    where a.module_id=new.module_id
      and a.session_id=new.id
      and a.checked_at is not null
      and a.checked_out_at is null
    on conflict(module_id,user_id,attendance_slot)
    do update set status='orange',reviewed_by=null,reviewed_at=now();
  end if;
  return new;
end
$function$;

drop trigger if exists acl_mark_missing_checkouts_orange_trigger on public.special_course_sessions;
create trigger acl_mark_missing_checkouts_orange_trigger
after update of lecture_ended_at on public.special_course_sessions
for each row execute function private.acl_mark_missing_checkouts_orange();

-- Backfill already-ended rooms so current circles are corrected immediately.
insert into public.special_course_attendance_reviews(
  module_id,user_id,attendance_slot,status,reviewed_by,reviewed_at
)
select a.module_id,a.user_id,a.attendance_slot,'orange',null,now()
from public.special_course_attendance a
join public.special_course_sessions s on s.id=a.session_id and s.module_id=a.module_id
where s.lecture_ended_at is not null
  and a.checked_at is not null
  and a.checked_out_at is null
on conflict(module_id,user_id,attendance_slot)
do update set status='orange',reviewed_by=null,reviewed_at=now();
