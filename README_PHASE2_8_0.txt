ACL Expert Edition V2 — Phase 2.8.0
Persistent Admin Bar + Admin Login Routing + AI Question Drafting

PACKAGE SIZE
This is a compact patch and stays below the 100-file GitHub upload limit.

INSTALLATION ORDER

A) DATABASE
1. Open Supabase → SQL Editor.
2. Run:
   phase2_8_0_ai_question_drafts_patch.sql

B) WEBSITE
1. Upload all website files from this package to v2-development.
2. Preserve the assets/js and assets/css folders.
3. Replace matching files.

C) OPENAI SECRET — NEVER PUT THE API KEY IN GITHUB
The OpenAI API key is used only inside a Supabase Edge Function.

Using Supabase CLI:
  supabase secrets set OPENAI_API_KEY=YOUR_KEY
  supabase secrets set OPENAI_MODEL=gpt-5-mini
  supabase functions deploy generate-question-drafts

You can also create/deploy the function from the Supabase Edge Functions dashboard
using:
  supabase/functions/generate-question-drafts/index.ts

D) TEST
1. Sign in with an administrator account.
2. Confirm it redirects to admin.html.
3. Open every admin page and verify the same admin navigation line appears.
4. Open Question Bank → Generate with AI.
5. Generate 1–2 test questions.
6. Confirm they appear under “awaiting your approval”.
7. Click Review and edit.
8. Save. It enters the question bank as DRAFT only.
9. Publish it manually only after scientific review.

IMPORTANT
- AI questions are never published automatically.
- AI questions are never added directly to a quiz.
- The OpenAI key remains server-side in Supabase.
- Always verify clinical accuracy, guideline statements, and trial references.

Suggested commit:
ACL V2 Phase 2.8.0 persistent admin bar and AI question drafts
