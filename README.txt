ACL LEARNING MODE RADICAL FIX — 2026-08-22

Replace exactly these 3 files in v2-development:
1) learning-expert.html
2) assets/js/learning-mode.js
3) assets/css/learning-expert-shell-v1.css

WHY IT WAS STUCK:
learning-mode.js waited for protectAndRender(), which performs another profiles-table lookup before starting the quiz.
The ACL shell had already restored the authenticated session, so the Learning page could sit indefinitely on Preparing module / Loading.

FIX:
- Learning Mode now requires only a valid Supabase Auth session.
- It no longer blocks on a second profiles-table lookup.
- Session restoration has a 6-second timeout.
- Settings loading has a 7-second timeout and still falls back to defaults.
- Quiz RPC loading has a 12-second timeout with a visible retry/error instead of endless skeleton.
- All question, confidence, Life Savers, flashcard, answer, progress and challenge logic is otherwise preserved from the original learning-mode.js.
- Original proven Learning DOM is preserved.
