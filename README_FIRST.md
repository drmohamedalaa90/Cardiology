# ACL Expert Edition — Steps 3.7 to 3.9

## Step 3.7 — Secure answer review
After High or Low confidence is saved, the candidate receives the correct answer, awarded points, explanation and reference through a secure Supabase RPC. Correct options are not included in the initial browser question query.

## Step 3.8 — Review the flashcard
The review panel displays a **Review the flashcard** button. Topic cards use **FLASHCARD**. Genuine named clinical-trial cards use **TRIAL FLASHCARD**. The SQL file includes three substantial demonstration flashcards.

## Step 3.9 — Final review
The final screen retains server-calculated scoring and adds an expandable question-by-question review when enabled.

## Installation
1. Run `ACL_Step3_7_to_3_9_Migration.sql` in Supabase SQL Editor.
2. Enter your project URL and publishable key in `supabase-config.js`.
3. Replace the candidate files with `index.html`, `styles.css`, `app.js`, and `supabase-config.js`.
4. Start with Live Server and test the three demo questions.
5. Add the included admin Quiz Builder fields and save snippet to your main admin project.

## Existing Step 3.4–3.6 functions required
- `acl_start_or_resume_attempt`
- `acl_save_answer_with_confidence`
- `acl_record_attempt_event`
- `acl_submit_and_score_attempt`

This package adds:
- `acl_get_question_review`

## Admin choices
- `feedback_mode`: `immediate`, `after_submission`, or `none`
- `show_flashcards`: true/false
- `show_final_review`: true/false
- `require_review_before_next`: true/false

## Session isolation
Candidate quiz: `acl-candidate-auth-v2`
Admin site should continue using a different key such as `acl-admin-auth-v1`.
