ACL Expert Learning Mode Fix v6 — 2026-08-22

Three requested corrections:

1) SELECTED ANSWER COLOR
   - Before Check answer: selected option is dark ACL blue, not red.
   - Red is now reserved for a confirmed wrong answer after checking.
   - Correct answer can still become green after checking.

2) CONFIDENCE OFF = NO CONFIDENCE RESULTS
   - High/Low confidence result cards are completely omitted when Confidence Answering was disabled.
   - Confidence-specific recommendations and Dr. Corazón wording are also omitted.
   - Scoring remains standard 1 point per correct answer when confidence is off.

3) UNFINISHED ATTEMPT CAN NEVER COLLAPSE TO 1 QUESTION
   - The original 10/20/30/50 session size is stored inside the saved Life Saver state.
   - A local recovery copy of the complete selected question IDs is also saved.
   - On resume, ACL validates cloud question_ids; if incomplete, it restores the local set or rebuilds the missing questions from the full bank.
   - Existing broken one-question attempts are repaired using cloud question_count / saved recovery / URL count; if all legacy metadata is broken, ACL uses the normal 20-question fallback instead of opening a 1-question session.
   - Already answered/current questions remain fixed; only missing/unseen questions are reconstructed.

Replace these files:
- learning-expert.html
- assets/css/learning-session-chrome-20260822.css
- assets/js/learning-mode.js
- assets/js/learning-bootstrap-20260822.js
- assets/js/learning-session-tools-20260822.js (included unchanged for a complete matched package)
