create or replace function private.acl_block_late_repeat_request()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
begin
  if new.request_type = 'repeat' and exists(
    select 1
    from public.special_course_sessions s
    where s.id = new.session_id
      and s.module_id = new.module_id
      and s.lecture_ended_at is not null
  ) then
    raise exception 'The lecture has ended. Repeat requests are closed.';
  end if;
  return new;
end
$function$;

drop trigger if exists acl_block_late_repeat_request on public.special_course_help_requests;
create trigger acl_block_late_repeat_request
before insert on public.special_course_help_requests
for each row execute function private.acl_block_late_repeat_request();
