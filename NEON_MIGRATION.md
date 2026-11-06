# ACL → Neon migration (work in progress)

**Status: NOT READY TO DEPLOY.** This branch is isolated from `main`; do not merge until all tests pass.

## Verified baseline (5 Nov 2026)
- Permanent Neon branch `acl-migration-permanent`: 64 public tables, 210 profiles.
- 209 profiles have distinct nonempty emails; one anonymous profile has one quiz attempt and must be retained.
- Better Auth tables `neon_auth.user`, `neon_auth.account`, `neon_auth.session` were empty when checked.
- Google OAuth custom credentials configured, but Google OAuth publishing status remains **Testing**; only allowlisted testers can authenticate.
- Production site remains GitHub Pages and uses Supabase throughout.

## Repository audit
- `acl-access.html` loads the Supabase browser SDK.
- `assets/js/auth.js` imports `supabase-client.js`.
- `assets/js/session-ui.js` depends on Supabase sessions.
- `assets/js/supabase-client.js` creates a Supabase client from `assets/js/config.js`.
- `supabase/functions/username-login/index.ts` is a Supabase Edge Function.
- Many feature modules and RPCs query Supabase directly. Replacing login alone would break them.

## Required implementation before launch
1. Inventory every `supabaseClient`, `window.supabase`, RPC, storage, realtime and Edge Function usage; classify public/private/admin actions.
2. Deploy a server-side HTTPS API with `DATABASE_URL` kept in server secrets. **Never** put a Neon Postgres connection string or service credential in GitHub Pages JavaScript.
3. Validate Better Auth sessions server-side, enforce authorization and admin checks for every endpoint, and implement explicit permission tests. Do not rely on browser-controlled `role` fields.
4. Link identities through a server-side verified-email flow. Preserve `public.profiles.id` and use a mapping table keyed by `neon_auth.user.id`; never blindly overwrite profile UUIDs or create privileged accounts from matching strings.
5. For students whose Google account email differs from their existing ACL email, require an additional secure ownership verification. Handle the anonymous profile separately.
6. Port Supabase RLS policies, database RPCs, functions, storage URLs, and realtime features to the new architecture. Audit existing `auth.uid()` references and foreign keys to `auth.users` in the migrated schema.
7. Configure Google OAuth production access and non-Google email sign-in. Testing mode is **not** sufficient for 209 students.
8. Test full user flows against the Neon permanent branch: sign-in, account mapping, student progress, quizzes, attendance, roles, admin operations, media, PWA and mobile; validate no data loss.
9. Rotate any database secrets that were previously exposed in screenshots.
10. Keep `main` and the existing Supabase deployment unchanged until a verified cutover with rollback plan.

## Critical caveat
The imported 64 public tables are not a drop-in replacement for Supabase Auth, Supabase REST, RLS or Supabase Edge Functions. A secure backend is required. No live migration should be represented as complete merely because SQL data was imported.
