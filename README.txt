ACL Expert Learning Mode — Professional Header + Floating Timer + Notes
2026-08-22

Replace these exact files on v2-development:

1. learning-expert.html
2. assets/css/learning-session-chrome-20260822.css   (NEW)
3. assets/js/learning-session-tools-20260822.js      (NEW)
4. assets/js/learning-mode.js
5. assets/js/learning-bootstrap-20260822.js

What this restores/fixes:
- Removes the oversized duplicated module/quiz hero.
- Restores a compact professional module-session header under the global ACL header.
- Back-to-Module stays in normal flow on mobile and cannot cover the module title.
- Floating per-question COUNTDOWN timer (default 60 sec; uses configured time if present).
- +1 Minute Life Saver immediately adds 60 seconds to the visible countdown.
- Floating Notes button.
- Per-question notes panel with autosave on this device.
- Timer resets/switches with the actual question and pauses once the question is answered.
- Cache-busted Learning Mode import.

No Supabase migration is required for this UI fix.
