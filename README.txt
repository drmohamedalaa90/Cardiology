ACL Progress Freeze Fix — 2026-08-22

Replace:
1. progress.html
2. assets/js/progress-dashboard-v2.js   (new)

Why the old page could freeze:
- progress-dashboard-v1 used listAttempts(), which SELECTed * from every quiz_attempt.
- That transferred every saved answers JSON and question_ids array even though the dashboard did not need them initially.
- progress-dashboard-v1 imported session-ui.js. session-ui installs a whole-document MutationObserver and scans newly rendered DOM nodes, which becomes expensive on a data-heavy progress page.

The v2 page:
- loads acl-shared-shell directly;
- does not load session-ui.js;
- restores auth with a 6-second timeout;
- initially fetches compact attempt metadata only;
- limits confidence answer payloads to the most recent confidence-enabled attempts;
- lazy-loads the answers of one attempt only when Review is clicked;
- limits the initial completed-attempt DOM list to the latest 40 rows.

No database migration is required.
