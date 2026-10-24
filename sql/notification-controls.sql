
create table private.acl_notification_controls(
 owner_key text not null, notification_key text not null,
 hidden boolean not null default false, position integer, cutoff timestamptz,
 primary key(owner_key,notification_key)
);
alter table private.acl_notification_controls enable row level security;
revoke all on private.acl_notification_controls from public,anon,authenticated;
create function private.acl_notification_manage(p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,auth as $$
declare uid uuid:=auth.uid(); admin boolean; owner text; k text; i integer:=0; result jsonb;
begin
 if uid is null then raise exception 'Sign in required';end if;
 admin:=public.acl_is_basic_question_admin();
 owner:=uid::text;
 if p_action like 'admin_%' then
  if not admin then raise exception 'Admin access required';end if;owner:='*';
 end if;
 if p_action in ('dismiss','admin_remove','clear','admin_clear') then
  if p_action in ('clear','admin_clear') then
   insert into private.acl_notification_controls(owner_key,notification_key,cutoff) values(owner,'__cutoff',clock_timestamp())
   on conflict(owner_key,notification_key) do update set cutoff=excluded.cutoff;
  else
   k:=p_args->>'key';if k is null or length(k)>200 then raise exception 'Invalid notification';end if;
   insert into private.acl_notification_controls(owner_key,notification_key,hidden) values(owner,k,true)
   on conflict(owner_key,notification_key) do update set hidden=true;
  end if;
 elsif p_action='admin_reorder' then
  if jsonb_array_length(p_args->'keys')>1000 then raise exception 'Too many notifications';end if;
  for k in select jsonb_array_elements_text(p_args->'keys') loop
   i:=i+1;
   insert into private.acl_notification_controls(owner_key,notification_key,position) values('*',k,i)
   on conflict(owner_key,notification_key) do update set position=excluded.position;
  end loop;
 elsif p_action<>'state' then raise exception 'Unknown action';
 end if;
 select jsonb_build_object('admin',admin,'controls',coalesce(jsonb_agg(jsonb_build_object('key',c.notification_key,'hidden',c.hidden,'position',c.position,'cutoff',c.cutoff)), '[]'::jsonb))
 into result from private.acl_notification_controls c where c.owner_key in ('*',uid::text);
 return result;
end $$;
revoke all on function private.acl_notification_manage(text,jsonb) from public,anon;
grant execute on function private.acl_notification_manage(text,jsonb) to authenticated;
create function public.acl_notification_manage(p_action text,p_args jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select private.acl_notification_manage(p_action,p_args)$$;
revoke all on function public.acl_notification_manage(text,jsonb) from public,anon;
grant execute on function public.acl_notification_manage(text,jsonb) to authenticated;
do $block$
declare source text;
begin
 select pg_get_functiondef('public.acl_basic_notifications()'::regprocedure) into source;
 source:=replace(source,'public.acl_basic_notifications()','private.acl_basic_notifications_raw()');
 execute source;
end $block$;
revoke all on function private.acl_basic_notifications_raw() from public,anon,authenticated;
create function private.acl_basic_notifications_filtered() returns jsonb language sql stable security definer
set search_path=pg_catalog,public,private,auth as $$
 with feed as(select value as item from jsonb_array_elements(private.acl_basic_notifications_raw()->'items')),
 visible as(select f.item from feed f where auth.uid() is not null and not exists(
 select 1 from private.acl_notification_controls c where c.owner_key in ('*',auth.uid()::text)
 and ((c.notification_key=f.item->>'key' and c.hidden) or (c.notification_key='__cutoff' and (f.item->>'event_at')::timestamptz<=c.cutoff))))
 select jsonb_build_object('unread_count',count(*) filter(where (item->>'is_unread')::boolean),'items',
 coalesce(jsonb_agg(item order by coalesce((select c.position from private.acl_notification_controls c where c.owner_key='*' and c.notification_key=item->>'key'),2147483647),(item->>'event_at')::timestamptz desc),'[]'::jsonb)) from visible
$$;
revoke all on function private.acl_basic_notifications_filtered() from public,anon;
grant execute on function private.acl_basic_notifications_filtered() to authenticated;
create or replace function public.acl_basic_notifications() returns jsonb language sql stable security invoker set search_path='' as $$ select private.acl_basic_notifications_filtered() $$;
revoke all on function public.acl_basic_notifications() from public,anon;
grant execute on function public.acl_basic_notifications() to authenticated;
-- Launch with an empty notification feed; homepage news remains intact.
insert into private.acl_notification_controls(owner_key,notification_key,cutoff) values('*','__cutoff',clock_timestamp());
