-- ACL Expert Edition V2 — Phase 2.4
-- Student learning mode, secure answer checking, retries and quiz-specific progress.
-- Run after phase2_3_quiz_builder_patch.sql. Safe to run more than once.

alter table public.quiz_attempts add column if not exists quiz_id uuid references public.quizzes(id) on delete set null;
alter table public.quiz_attempts add column if not exists quiz_title text;
alter table public.quiz_attempts add column if not exists mode text not null default 'learning';
alter table public.quiz_attempts add column if not exists percentage numeric;
alter table public.quiz_attempts add column if not exists passed boolean;

update public.quiz_attempts set quiz_title = coalesce(nullif(quiz_title,''), module_title) where quiz_title is null or quiz_title='';

drop index if exists public.quiz_attempts_one_open_per_module;
create unique index if not exists quiz_attempts_one_open_per_quiz
on public.quiz_attempts(user_id, quiz_id)
where status='in_progress' and quiz_id is not null;
create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts(user_id,quiz_id,updated_at desc);

-- Returns a published learning/practice quiz without answer keys.
create or replace function public.acl_get_learning_quiz(p_quiz_slug text, p_module_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  result jsonb;
begin
  if not public.acl_is_active_user() then raise exception 'Account is not active'; end if;

  select jsonb_build_object(
    'id',z.id,'module_id',z.module_id,'slug',z.slug,'title',z.title,
    'description',z.description,'mode',z.mode,'selection_mode',z.selection_mode,
    'question_count',z.question_count,'randomize_questions',z.randomize_questions,
    'randomize_options',z.randomize_options,'allow_review',z.allow_review,
    'show_explanations',z.show_explanations,'passing_percentage',z.passing_percentage,
    'module_title',m.title,
    'questions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',q.id,'question_type',q.question_type,'stem',q.stem,
        'clinical_scenario',q.clinical_scenario,'image_url',q.image_url,'image_alt',q.image_alt,
        'topic',q.topic,'subtopic',q.subtopic,'difficulty',q.difficulty,
        'points',coalesce(qq.points_override,q.points),'confidence_enabled',q.confidence_enabled,
        'display_order',qq.display_order,
        'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'key',o.option_key,'text',o.option_text,'image_url',o.image_url,'display_order',o.display_order) order by o.display_order) from public.question_options o where o.question_id=q.id),'[]'::jsonb)
      ) order by qq.display_order)
      from public.quiz_questions qq join public.questions q on q.id=qq.question_id
      where qq.quiz_id=z.id and q.status='published'
    ),'[]'::jsonb)
  ) into result
  from public.quizzes z join public.modules m on m.id=z.module_id
  where z.slug=p_quiz_slug and (p_module_id is null or z.module_id=p_module_id)
    and z.status='published' and z.mode in ('learning','practice') and m.status='published';

  if result is null then raise exception 'Published learning quiz not found'; end if;
  return result;
end; $$;

grant execute on function public.acl_get_learning_quiz(text,text) to authenticated;

-- Checks one answer server-side and returns only the feedback needed after submission.
create or replace function public.acl_check_learning_answer(p_quiz_id uuid,p_question_id uuid,p_option_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  q record;
  correct_ids uuid[];
  chosen uuid[];
  ok boolean;
begin
  if not public.acl_is_active_user() then raise exception 'Account is not active'; end if;
  select qu.question_type,qu.explanation,qu.reference_text,qu.reference_url,coalesce(qq.points_override,qu.points) points
  into q from public.quiz_questions qq join public.questions qu on qu.id=qq.question_id
  join public.quizzes z on z.id=qq.quiz_id
  where qq.quiz_id=p_quiz_id and qq.question_id=p_question_id and z.status='published' and z.mode in ('learning','practice');
  if not found then raise exception 'Question is not available in this quiz'; end if;

  select coalesce(array_agg(id order by id),'{}'::uuid[]) into correct_ids
  from public.question_options where question_id=p_question_id and is_correct;
  select coalesce(array_agg(x order by x),'{}'::uuid[]) into chosen from unnest(coalesce(p_option_ids,'{}'::uuid[])) x;
  ok := chosen = correct_ids;
  return jsonb_build_object('correct',ok,'points',case when ok then q.points else 0 end,
    'correct_option_ids',correct_ids,'explanation',q.explanation,
    'reference_text',q.reference_text,'reference_url',q.reference_url);
end; $$;

grant execute on function public.acl_check_learning_answer(uuid,uuid,uuid[]) to authenticated;

-- Activate the PPCI learning pilot and route its module card to the new generic player.
update public.quizzes set status='published',mode='learning',allow_review=true,show_explanations=true where module_id='ppci-fundamentals' and slug='ppci-pilot';
update public.modules set launch_path='learning.html?module=ppci-fundamentals&quiz=ppci-pilot',learning_mode_enabled=true,status='published' where id='ppci-fundamentals';
