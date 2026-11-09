/**
 * ACL legacy credential migration — run LOCALLY in a trusted environment only.
 * Never put either connection string or exported hashes into GitHub, chat, or logs.
 * Requires Node 20+ and npm install postgres (outside this repository).
 *
 * SUPABASE_DATABASE_URL and NEON_DATABASE_URL must be supplied as process
 * environment variables. Read-only access to Supabase auth.users is sufficient.
 * The destination role must be allowed to INSERT into acl_migration.
 *
 * This script transfers password VERIFIERS, not plaintext passwords.
 * It does NOT enable login by itself; a reviewed authentication/session backend
 * is required before using these verifiers.
 */
import postgres from "postgres";

const sourceUrl = process.env.SUPABASE_DATABASE_URL;
const targetUrl = process.env.NEON_DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  throw new Error("Set SUPABASE_DATABASE_URL and NEON_DATABASE_URL privately.");
}
if (sourceUrl === targetUrl) throw new Error("Source and target must differ.");
const source = postgres(sourceUrl, { max: 1, connect_timeout: 10, ssl: "require" });
const target = postgres(targetUrl, { max: 1, connect_timeout: 10, ssl: "require" });
try {
  const users = await source`
    SELECT id, encrypted_password
    FROM auth.users
    WHERE encrypted_password IS NOT NULL AND encrypted_password <> ''
  `;
  const [total] = await source`SELECT count(*)::int AS n FROM auth.users`;
  const [mapped] = await target`
    SELECT count(*)::int AS n FROM acl_migration.member_identity_map
  `;
  if (total.n !== mapped.n) throw new Error("Account totals differ; refusing import.");
  if (users.length !== 209 || total.n !== 210)
    throw new Error("Unexpected account count; review before importing.");
  const map = await target`SELECT legacy_user_id::text AS id FROM acl_migration.member_identity_map`;
  const ids = new Set(map.map(x => x.id));
  if (users.some(u => !ids.has(u.id))) throw new Error("Unmapped user; refusing import.");
  if (users.some(u => !/^\\$2[aby]\\$\\d\\d\\$/.test(u.encrypted_password)))
    throw new Error("Unexpected password hash format; refusing import.");

  await target.begin(async tx => {
    for (const user of users) {
      await tx`
        INSERT INTO acl_migration.legacy_password_credentials
          (legacy_user_id, encrypted_password)
        VALUES (${user.id}::uuid, ${user.encrypted_password})
        ON CONFLICT (legacy_user_id)
        DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password
      `;
    }
  });
  const [result] = await target`
    SELECT count(*)::int AS n FROM acl_migration.legacy_password_credentials
  `;
  if (result.n !== users.length) throw new Error("Post-import count mismatch.");
  console.log("Credential verifiers migrated and counts verified:", result.n);
  console.log("Login remains disabled until secure verifier/session implementation is deployed.");
} finally {
  await Promise.allSettled([source.end(), target.end()]);
}
