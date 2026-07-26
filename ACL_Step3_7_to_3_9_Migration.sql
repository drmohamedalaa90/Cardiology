-- ACL EXPERT EDITION — STEPS 3.7 TO 3.9
-- 3.7 Secure answer review
-- 3.8 Flashcard review modal
-- 3.9 Final result and question-by-question review

begin;

alter table public.quizzes
  add column if not exists feedback_mode text
  not null default 'immediate';

alter table public.quizzes
  add column if not exists show_flashcards boolean
  not null default true;

alter table public.quizzes
  add column if not exists show_final_review boolean
  not null default true;

alter table public.quizzes
  add column if not exists require_review_before_next boolean
  not null default true;

alter table public.quizzes
  drop constraint if exists quizzes_feedback_mode_check;

alter table public.quizzes
  add constraint quizzes_feedback_mode_check
  check (feedback_mode in ('immediate', 'after_submission', 'none'));

alter table public.questions
  add column if not exists explanation text;

alter table public.questions
  add column if not exists reference_text text;

alter table public.questions
  add column if not exists flashcard_title text;

alter table public.questions
  add column if not exists flashcard_type text
  not null default 'FLASHCARD';

alter table public.questions
  add column if not exists flashcard_content jsonb
  not null default '{}'::jsonb;

alter table public.questions
  drop constraint if exists questions_flashcard_type_check;

alter table public.questions
  add constraint questions_flashcard_type_check
  check (flashcard_type in ('FLASHCARD', 'TRIAL FLASHCARD'));

create or replace function public.acl_get_question_review(
  p_attempt_id uuid,
  p_question_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_quiz public.quizzes%rowtype;
  v_question public.questions%rowtype;
  v_answer public.attempt_answers%rowtype;
  v_selected_option_id uuid;
  v_selected_key text;
  v_selected_text text;
  v_selected_correct boolean := false;
  v_correct_option_id uuid;
  v_correct_key text;
  v_correct_text text;
  v_points integer := 0;
  v_can_review boolean := false;
  v_flashcard jsonb := null;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_attempt
  from public.quiz_attempts
  where id = p_attempt_id
    and (participant_id = auth.uid() or user_id = auth.uid());

  if not found then
    raise exception 'Attempt not found';
  end if;

  select *
  into v_quiz
  from public.quizzes
  where id = v_attempt.quiz_id;

  if not found then
    raise exception 'Quiz not found';
  end if;

  if v_quiz.feedback_mode = 'none' then
    raise exception 'Answer review is disabled for this quiz';
  end if;

  v_can_review :=
    v_quiz.feedback_mode = 'immediate'
    or (
      v_quiz.feedback_mode = 'after_submission'
      and v_attempt.status::text in ('submitted', 'completed', 'expired')
    );

  if not v_can_review then
    raise exception 'Answer review is available after final submission';
  end if;

  select *
  into v_question
  from public.questions
  where id = p_question_id
    and quiz_id = v_attempt.quiz_id;

  if not found then
    raise exception 'Question not found in this quiz';
  end if;

  select *
  into v_answer
  from public.attempt_answers
  where attempt_id = p_attempt_id
    and question_id = p_question_id;

  if not found then
    raise exception 'No saved answer was found for this question';
  end if;

  v_selected_option_id :=
    case
      when coalesce(array_length(v_answer.selected_option_ids, 1), 0) > 0
      then v_answer.selected_option_ids[1]
      else null
    end;

  if v_selected_option_id is not null then
    select option_key, option_text, is_correct
    into v_selected_key, v_selected_text, v_selected_correct
    from public.question_options
    where id = v_selected_option_id
      and question_id = p_question_id;
  end if;

  select id, option_key, option_text
  into v_correct_option_id, v_correct_key, v_correct_text
  from public.question_options
  where question_id = p_question_id
    and is_correct = true
  order by display_order, order_index nulls last
  limit 1;

  v_points :=
    case
      when v_selected_option_id is null then -1
      when v_selected_correct and v_answer.confidence = 'high' then 2
      when v_selected_correct and v_answer.confidence = 'low' then 1
      when not v_selected_correct and v_answer.confidence = 'high' then -1
      else 0
    end;

  if
    v_quiz.show_flashcards
    and v_question.flashcard_title is not null
    and jsonb_typeof(v_question.flashcard_content) = 'object'
    and v_question.flashcard_content <> '{}'::jsonb
  then
    v_flashcard := jsonb_build_object(
      'type', v_question.flashcard_type,
      'title', v_question.flashcard_title,
      'content', v_question.flashcard_content
    );
  end if;

  return jsonb_build_object(
    'question_id', p_question_id,
    'is_correct', coalesce(v_selected_correct, false),
    'selected_option_id', v_selected_option_id,
    'selected_option_key', v_selected_key,
    'selected_option_text', v_selected_text,
    'correct_option_id', v_correct_option_id,
    'correct_option_key', v_correct_key,
    'correct_option_text', v_correct_text,
    'confidence', v_answer.confidence,
    'points_awarded', v_points,
    'explanation', coalesce(v_question.explanation, ''),
    'reference_text', coalesce(v_question.reference_text, ''),
    'flashcard', v_flashcard
  );
end;
$$;

grant execute
on function public.acl_get_question_review(uuid, uuid)
to authenticated;

update public.quizzes
set
  feedback_mode = 'immediate',
  show_flashcards = true,
  show_final_review = true,
  require_review_before_next = true
where slug = 'acl-expert-edition-demo-step-3';

update public.questions q
set
  explanation = 'An IVUS minimal luminal area below approximately 6 mm² generally supports a hemodynamically significant left main lesion. An MLA of 4.2 mm² therefore strongly favors significance, whereas an MLA of 8.5 mm² and an FFR of 0.92 argue against it.',
  reference_text = 'ESC/EACTS myocardial revascularization guidance and contemporary IVUS-based left-main assessment literature.',
  flashcard_type = 'FLASHCARD',
  flashcard_title = 'IVUS Assessment of Intermediate Left Main Disease',
  flashcard_content = jsonb_build_object(
    'Definition', jsonb_build_array(
      'Intermediate left main disease is an angiographically uncertain lesion requiring physiological or intravascular clarification.',
      'IVUS measures the minimal luminal area and plaque distribution directly.',
      'The left main supplies a large myocardial territory, so misclassification has major consequences.'
    ),
    'Assessment', jsonb_build_array(
      'An MLA of at least about 6 mm² is commonly used to defer revascularization safely in appropriate populations.',
      'An MLA below about 4.5–5 mm² strongly supports functional significance.',
      'Values between approximately 4.5 and 6 mm² form a grey zone and may require physiology and clinical integration.',
      'FFR at or below 0.80 supports hemodynamic significance.',
      'FFR can be affected by downstream LAD or LCx disease and inadequate hyperemia.'
    ),
    'Technical points', jsonb_build_array(
      'Use careful catheter engagement to avoid pressure damping and ostial distortion.',
      'Perform a pullback that covers the left main, bifurcation, and proximal daughter vessels.',
      'Assess plaque burden, calcium, vessel size, and disease extension into the LAD and LCx.',
      'Do not interpret MLA without considering body size, myocardial territory, and lesion location.'
    ),
    'Management', jsonb_build_array(
      'Significant left main disease generally requires revascularization unless prohibitive risk or patient preference dictates otherwise.',
      'Choice between PCI and CABG depends on anatomy, complexity, comorbidity, surgical risk, and Heart Team assessment.',
      'IVUS guidance is strongly favored when left-main PCI is performed.'
    ),
    'High-yield takeaways', jsonb_build_array(
      'MLA 4.2 mm² supports significance.',
      'MLA 8.5 mm² supports deferral rather than treatment.',
      'FFR 0.92 is not ischemic.',
      'Integrate IVUS, physiology, angiography, and clinical context.'
    )
  )
where q.quiz_id = (
  select id from public.quizzes
  where slug = 'acl-expert-edition-demo-step-3'
)
and q.order_index = 1;

update public.questions q
set
  explanation = 'A short side-branch lesion with preserved flow favors a provisional one-stent strategy. Long and extensively diseased side branches, difficult re-access, or complex distal left-main anatomy may justify a planned two-stent strategy.',
  reference_text = 'European Bifurcation Club consensus documents and contemporary bifurcation PCI evidence.',
  flashcard_type = 'FLASHCARD',
  flashcard_title = 'Choosing Provisional Versus Planned Two-Stent Bifurcation PCI',
  flashcard_content = jsonb_build_object(
    'Definition', jsonb_build_array(
      'Provisional stenting begins with one stent in the main vessel and treats the side branch only when necessary.',
      'A planned two-stent strategy treats both branches from the outset.',
      'Provisional stenting remains the default strategy for most non-complex bifurcations.'
    ),
    'Features favoring provisional stenting', jsonb_build_array(
      'Short side-branch lesion length.',
      'Preserved side-branch flow.',
      'Limited ostial disease.',
      'Small or moderate side-branch myocardial territory.',
      'Easy side-branch rewiring if required.',
      'Absence of severe side-branch calcification.'
    ),
    'Features favoring planned two-stent treatment', jsonb_build_array(
      'Long side-branch disease, commonly extending beyond 10 mm.',
      'Large clinically important side branch.',
      'Severe ostial side-branch stenosis.',
      'High risk of side-branch loss or difficult re-access.',
      'Complex true distal left-main bifurcation disease.',
      'Diffuse disease involving both daughter vessels.'
    ),
    'Provisional sequence', jsonb_build_array(
      'Wire both branches when appropriate.',
      'Prepare the main vessel and side branch selectively.',
      'Stent the main vessel across the side branch.',
      'Perform proximal optimization technique.',
      'Rewire the side branch through an appropriate distal cell if intervention is required.',
      'Use kissing balloon inflation selectively, followed by repeat POT when indicated.'
    ),
    'Pitfalls and takeaways', jsonb_build_array(
      'Do not equate every true bifurcation with a mandatory two-stent strategy.',
      'Avoid unnecessary side-branch intervention when flow and result are acceptable.',
      'Do not delay bailout treatment when a major side branch is compromised.',
      'Short side-branch disease plus preserved flow favors provisional treatment.'
    )
  )
where q.quiz_id = (
  select id from public.quizzes
  where slug = 'acl-expert-edition-demo-step-3'
)
and q.order_index = 2;

update public.questions q
set
  explanation = 'Proximal optimization technique expands the proximal stent segment to match the larger proximal main-vessel diameter, improves apposition, corrects geometric distortion, and facilitates safe distal-cell side-branch re-crossing.',
  reference_text = 'European Bifurcation Club technical consensus on proximal optimization and bifurcation PCI.',
  flashcard_type = 'FLASHCARD',
  flashcard_title = 'Proximal Optimization Technique After Bifurcation Stenting',
  flashcard_content = jsonb_build_object(
    'Definition', jsonb_build_array(
      'POT is balloon expansion of the proximal stent segment using a short non-compliant balloon sized to the proximal main vessel.',
      'It corrects the mismatch between the larger proximal vessel and the smaller distal vessel used for initial stent sizing.',
      'POT is a fundamental geometric step in contemporary bifurcation PCI.'
    ),
    'Why it matters', jsonb_build_array(
      'Improves proximal stent expansion.',
      'Improves stent apposition.',
      'Reduces proximal malapposition caused by vessel tapering.',
      'Facilitates side-branch re-crossing.',
      'Encourages distal-cell rewiring.',
      'Reduces the risk of wiring outside the stent.',
      'Restores more favorable bifurcation geometry.'
    ),
    'Technique', jsonb_build_array(
      'Choose a short non-compliant balloon sized approximately 1:1 to the proximal main vessel.',
      'Position the distal balloon marker just proximal to the carina.',
      'Avoid extending the balloon too distally into the smaller distal main vessel.',
      'Inflate sufficiently to achieve proximal expansion.',
      'Repeat POT after kissing balloon inflation when the proximal stent geometry has been altered.'
    ),
    'Common errors', jsonb_build_array(
      'Using a balloon sized only to the distal vessel.',
      'Positioning the balloon too distal and overdilating the distal main vessel.',
      'Positioning too proximal and failing to optimize the bifurcation segment.',
      'Assuming POT automatically replaces every need for kissing balloon inflation.',
      'Failing to re-POT after side-branch treatment when indicated.'
    ),
    'High-yield takeaways', jsonb_build_array(
      'POT optimizes proximal stent expansion and side-branch access.',
      'It does not intentionally underexpand the stent.',
      'It does not reduce distal vessel diameter.',
      'It does not replace final kissing balloon inflation in every case.'
    )
  )
where q.quiz_id = (
  select id from public.quizzes
  where slug = 'acl-expert-edition-demo-step-3'
)
and q.order_index = 3;

commit;

select
  slug,
  feedback_mode,
  show_flashcards,
  show_final_review,
  require_review_before_next
from public.quizzes
where slug = 'acl-expert-edition-demo-step-3';
