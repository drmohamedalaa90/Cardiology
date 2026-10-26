create table if not exists public.special_course_sessions (
  id uuid primary key default gen_random_uuid(),
  module_id text not null references public.modules(id) on delete cascade,
  session_number integer not null default 1 check (session_number > 0),
  title text not null check (length(trim(title)) between 1 and 160),
  display_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists special_course_sessions_module_order_idx
  on public.special_course_sessions(module_id, display_order, session_number);

alter table public.special_course_sessions enable row level security;
revoke all on public.special_course_sessions from anon, authenticated;

alter table public.special_course_content
  add column if not exists session_id uuid references public.special_course_sessions(id) on delete cascade;

create index if not exists special_course_content_session_idx
  on public.special_course_content(session_id, display_order);

insert into public.special_course_sessions(module_id, session_number, title, display_order, is_active)
select c.module_id,
       row_number() over(partition by c.module_id order by min(c.display_order), c.section_title)::integer,
       c.section_title,
       row_number() over(partition by c.module_id order by min(c.display_order), c.section_title)::integer,
       true
from public.special_course_content c
where c.session_id is null
group by c.module_id, c.section_title
on conflict do nothing;

update public.special_course_content c
set session_id=s.id
from public.special_course_sessions s
where c.session_id is null
  and s.module_id=c.module_id
  and s.title=c.section_title;

insert into public.special_course_sessions(module_id,session_number,title,display_order,is_active)
select m.id,v.n,v.title,v.n,true
from public.modules m
cross join (values
  (1,'What Is an ECG?'),
  (2,'Clinical Uses of the ECG'),
  (3,'Basic Cardiac Anatomy'),
  (4,'Cardiac Electrophysiology'),
  (5,'ECG Electrodes and Leads'),
  (6,'Understanding ECG Graph Paper'),
  (7,'ECG Waves, Intervals, and Segments'),
  (8,'Normal Sinus Rhythm: Recognition and Criteria')
) as v(n,title)
where m.is_special_course
  and lower(m.title) like 'ecg demystified%'
  and not exists(select 1 from public.special_course_sessions s where s.module_id=m.id);

create or replace function private.acl_special_course_content_api(p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_admin boolean;
  v_id text:=p_args->>'module_id';
  v_course public.modules%rowtype;
  v_access boolean;
  v_item uuid;
  v_session uuid;
  v_session_title text;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  v_admin:=public.acl_is_basic_question_admin();
  select * into v_course from public.modules where id=v_id and edition='basic' and is_special_course;
  if not found then raise exception 'Special course not found'; end if;
  v_access:=v_admin or not v_course.passcode_required or exists(
    select 1 from public.course_access ca
    where ca.user_id=v_uid and ca.module_id=v_id and ca.status='granted' and ca.access_version=v_course.passcode_version
  );

  if p_action='get' then
    if not v_admin and (not v_course.is_active or v_course.status<>'published' or not v_course.basic_admin_released) then
      raise exception 'Course is not available';
    end if;
    if not v_access then raise exception 'Course passcode required'; end if;
    select jsonb_build_object(
      'admin',v_admin,
      'has_access',v_access,
      'course',jsonb_build_object('id',v_course.id,'title',v_course.title,'description',coalesce(v_course.short_description,v_course.description,''),'cover_image_url',v_course.cover_image_url,'logo_url',v_course.special_logo_url),
      'candidate_name',coalesce((select coalesce(display_name,full_name,email) from public.profiles where id=v_uid),'ACL Candidate'),
      'sessions',coalesce((
        select jsonb_agg(jsonb_build_object('id',s.id,'session_number',s.session_number,'title',s.title,'display_order',s.display_order,'is_active',s.is_active) order by s.display_order,s.session_number,s.created_at)
        from public.special_course_sessions s where s.module_id=v_id and (v_admin or s.is_active)
      ),'[]'::jsonb),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object('id',c.id,'session_id',c.session_id,'section_title',c.section_title,'item_type',c.item_type,'title',c.title,'subtitle',c.subtitle,'url',c.url,'display_order',c.display_order,'is_active',c.is_active) order by c.display_order,c.created_at)
        from public.special_course_content c where c.module_id=v_id and (v_admin or c.is_active)
      ),'[]'::jsonb),
      'certificate',coalesce((select to_jsonb(sc) from public.special_course_certificates sc where sc.module_id=v_id),jsonb_build_object('module_id',v_id,'enabled',false,'certificate_title','Certificate of Completion','completion_text','has successfully completed','signatory_name','Dr. Mohamed Alaa','signatory_role','Founder, Alexandria Cardiology League'))
    ) into v_result;
    return v_result;
  end if;

  if not v_admin then raise exception 'Admin access required'; end if;

  if p_action='save_session' then
    if nullif(p_args->>'id','') is null then
      insert into public.special_course_sessions(module_id,session_number,title,display_order,is_active)
      values(v_id,greatest(coalesce((p_args->>'session_number')::integer,1),1),trim(p_args->>'title'),coalesce((p_args->>'display_order')::integer,1),coalesce((p_args->>'is_active')::boolean,true));
    else
      v_session:=(p_args->>'id')::uuid;
      update public.special_course_sessions
      set session_number=greatest(coalesce((p_args->>'session_number')::integer,session_number),1),title=trim(p_args->>'title'),display_order=coalesce((p_args->>'display_order')::integer,display_order),is_active=coalesce((p_args->>'is_active')::boolean,is_active),updated_at=now()
      where id=v_session and module_id=v_id;
      update public.special_course_content c set section_title=s.title,updated_at=now()
      from public.special_course_sessions s where c.session_id=s.id and s.id=v_session and s.module_id=v_id;
    end if;
    return jsonb_build_object('ok',true);
  elsif p_action='delete_session' then
    delete from public.special_course_sessions where id=(p_args->>'id')::uuid and module_id=v_id;
    return jsonb_build_object('ok',true);
  elsif p_action='save_item' then
    v_session:=nullif(p_args->>'session_id','')::uuid;
    if v_session is not null then
      select title into v_session_title from public.special_course_sessions where id=v_session and module_id=v_id;
      if not found then raise exception 'Session not found'; end if;
    else
      v_session_title:=coalesce(nullif(trim(p_args->>'section_title'),''),'Course content');
    end if;
    if nullif(p_args->>'id','') is null then
      insert into public.special_course_content(module_id,session_id,section_title,item_type,title,subtitle,url,display_order,is_active)
      values(v_id,v_session,v_session_title,p_args->>'item_type',trim(p_args->>'title'),nullif(trim(p_args->>'subtitle'),''),coalesce(nullif(trim(p_args->>'url'),''),'#'),coalesce((p_args->>'display_order')::integer,1),coalesce((p_args->>'is_active')::boolean,true));
    else
      v_item:=(p_args->>'id')::uuid;
      update public.special_course_content
      set session_id=v_session,section_title=v_session_title,item_type=p_args->>'item_type',title=trim(p_args->>'title'),subtitle=nullif(trim(p_args->>'subtitle'),''),url=coalesce(nullif(trim(p_args->>'url'),''),'#'),display_order=coalesce((p_args->>'display_order')::integer,display_order),is_active=coalesce((p_args->>'is_active')::boolean,is_active),updated_at=now()
      where id=v_item and module_id=v_id;
    end if;
    return jsonb_build_object('ok',true);
  elsif p_action='delete_item' then
    delete from public.special_course_content where id=(p_args->>'id')::uuid and module_id=v_id;
    return jsonb_build_object('ok',true);
  elsif p_action='save_certificate' then
    insert into public.special_course_certificates(module_id,enabled,certificate_title,certificate_subtitle,completion_text,signatory_name,signatory_role,logo_url,background_url,updated_at)
    values(v_id,coalesce((p_args->>'enabled')::boolean,false),coalesce(nullif(trim(p_args->>'certificate_title'),''),'Certificate of Completion'),nullif(trim(p_args->>'certificate_subtitle'),''),coalesce(nullif(trim(p_args->>'completion_text'),''),'has successfully completed'),coalesce(nullif(trim(p_args->>'signatory_name'),''),'Dr. Mohamed Alaa'),coalesce(nullif(trim(p_args->>'signatory_role'),''),'Founder, Alexandria Cardiology League'),nullif(trim(p_args->>'logo_url'),''),nullif(trim(p_args->>'background_url'),''),now())
    on conflict(module_id) do update set enabled=excluded.enabled,certificate_title=excluded.certificate_title,certificate_subtitle=excluded.certificate_subtitle,completion_text=excluded.completion_text,signatory_name=excluded.signatory_name,signatory_role=excluded.signatory_role,logo_url=coalesce(excluded.logo_url,public.special_course_certificates.logo_url),background_url=coalesce(excluded.background_url,public.special_course_certificates.background_url),updated_at=now();
    return jsonb_build_object('ok',true);
  else
    raise exception 'Unknown action';
  end if;
end
$function$;

revoke execute on function public.acl_special_course_content_api(text,jsonb) from anon, public;
grant execute on function public.acl_special_course_content_api(text,jsonb) to authenticated, service_role;
