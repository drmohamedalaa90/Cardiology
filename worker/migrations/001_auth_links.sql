-- ACL identity bridge: apply only after review on the Neon permanent branch.
-- No existing profiles, scores, attendance, or progress are modified.
BEGIN;
CREATE TABLE IF NOT EXISTS public.acl_auth_links (
  auth_user_id uuid PRIMARY KEY,
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT now(),
  verified_email_at timestamptz NOT NULL,
  link_method text NOT NULL CHECK (link_method IN ('verified_email', 'manual_verification')),
  linked_by text NOT NULL DEFAULT 'server'
);
CREATE INDEX IF NOT EXISTS acl_auth_links_profile_idx ON public.acl_auth_links(profile_id);
REVOKE ALL ON public.acl_auth_links FROM PUBLIC;
COMMIT;

-- IMPORTANT: Linking must happen only in a trusted server transaction:
-- 1. Verify Better Auth session server-side (never accept client-supplied auth_user_id).
-- 2. Read the provider-verified email and compare case-insensitively to profiles.email.
-- 3. Require exactly one matching profile and no pre-existing conflicting link.
-- 4. For mismatched emails or the anonymous profile, require manual ownership verification.
-- 5. Never modify public.profiles.id or elevate role based on OAuth claims.
-- 6. Do not grant direct anonymous access to this mapping table.
