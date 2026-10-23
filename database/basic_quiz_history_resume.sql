-- Basic solo quizzes require the full safe question bank for faithful resume.
-- History exclusions are applied by the client only when creating a new attempt.
CREATE OR REPLACE FUNCTION public.acl_get_learning_quiz_v2(p_quiz_slug text, p_module_id text DEFAULT NULL::text, p_review_mode text DEFAULT 'normal'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare vq public.quizzes%rowtype; v_module_title text; v_total int; v_mastered int; v_result jsonb;
begin
 if not public.acl_is_active_user() then raise exception 'Account is not active'; end if;
 select z.* into vq from public.quizzes z where z.slug=p_quiz_slug and (p_module_id is null or z.module_id=p_module_id) and z.status='published' and z.mode in('learning','practice') limit 1;
 if not found then raise exception 'Published learning quiz not found'; end if;
 if not exists(select 1 from public.acl_module_access(vq.module_id) a where a.allowed) then raise exception 'Module access is restricted'; end if;
 select title into v_module_title from public.modules where id=vq.module_id and status='published';
 with active as (select q.id from public.quiz_questions qq join public.questions q on q.id=qq.question_id where qq.quiz_id=vq.id and q.status='published'),
 hist as (select (x.item->>'questionId')::uuid qid, lower(coalesce(x.item->>'correct','false'))='true' correct from public.quiz_attempts qa cross join lateral jsonb_array_elements(coalesce(qa.answers,'[]'::jsonb)) x(item) where qa.user_id=auth.uid() and qa.module_id=vq.module_id and x.item ? 'questionId'),
 mastered as (select distinct qid from hist where correct)
 select (select count(*) from active),(select count(*) from mastered m join active a on a.id=m.qid) into v_total,v_mastered;
 with hist as (
   select (x.item->>'questionId')::uuid qid, lower(coalesce(x.item->>'correct','false'))='true' correct,
          coalesce(nullif(x.item->>'answeredAt','')::timestamptz,qa.completed_at,qa.created_at) answered_at
   from public.quiz_attempts qa cross join lateral jsonb_array_elements(coalesce(qa.answers,'[]'::jsonb)) x(item)
   where qa.user_id=auth.uid() and qa.module_id=vq.module_id and x.item ? 'questionId'
 ), latest as (select distinct on(qid) qid,correct,answered_at from hist order by qid,answered_at desc nulls last),
 mastered as (select distinct qid from hist where correct),
 base as (
   select q.*,qq.display_order quiz_order,
          exists(select 1 from public.question_stars s where s.user_id=auth.uid() and s.question_id=q.id) starred,
          exists(select 1 from mastered m where m.qid=q.id) mastered_once,
          l.correct latest_correct,l.answered_at latest_answered,
          coalesce((q.metadata->>'case_based')::boolean,false) case_based,
          (select max(length(o.option_text)) filter(where o.is_correct)-max(length(o.option_text)) filter(where not o.is_correct) from public.question_options o where o.question_id=q.id) option_gap
   from public.quiz_questions qq join public.questions q on q.id=qq.question_id left join latest l on l.qid=q.id
   where qq.quiz_id=vq.id and q.status='published'
 ), filtered as (
   select * from base where
    case lower(coalesce(p_review_mode,'normal'))
      when 'incorrect' then latest_correct is false
      when 'starred' then starred
      else (vq.edition='basic' or v_mastered>=v_total or not mastered_once)
    end
 )
 select jsonb_build_object(
  'id',vq.id,'module_id',vq.module_id,'slug',vq.slug,'title',vq.title,'description',vq.description,'edition',vq.edition,'mode',vq.mode,
  'selection_mode',vq.selection_mode,'question_count',vq.question_count,'available_question_count',(select count(*) from filtered),
  'randomize_questions',false,'randomize_options',vq.randomize_options,'allow_review',vq.allow_review,'show_explanations',vq.show_explanations,
  'passing_percentage',vq.passing_percentage,'module_title',v_module_title,'review_mode',lower(coalesce(p_review_mode,'normal')),
  'review_counts',public.acl_get_module_review_summary(vq.module_id),
  'questions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',f.id,'question_type',f.question_type,'stem',f.stem,'clinical_scenario',f.clinical_scenario,'image_url',f.image_url,'image_alt',f.image_alt,
      'topic',f.topic,'subtopic',f.subtopic,'difficulty',f.difficulty,'points',f.points,'confidence_enabled',f.confidence_enabled,'display_order',f.quiz_order,
      'dr_corazon_hint',f.dr_corazon_hint,'starred',f.starred,
      'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'key',o.option_key,'text',o.option_text,'image_url',o.image_url,'display_order',o.display_order) order by o.display_order) from public.question_options o where o.question_id=f.id),'[]'::jsonb)
    ) order by
      case when f.latest_answered is null then 0 else 1 end,
      case when f.case_based then 0 else 1 end,
      case when coalesce(f.option_gap,0)<=50 then 0 else 1 end,
      md5(auth.uid()::text||f.id::text)
  ) from filtered f),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $function$
