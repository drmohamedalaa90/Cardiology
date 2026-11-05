import postgres from "postgres";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH_BASE = "https://ep-mute-sky-zantnre1.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth";
const jwks = createRemoteJWKSet(new URL(AUTH_BASE + "/.well-known/jwks.json"));
const ALLOWED_ORIGINS = new Set(["https://drmohamedalaa90.github.io", "https://acl-google-test.pages.dev"]);

function headers(origin) {
  const h = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin" };
  if (ALLOWED_ORIGINS.has(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Credentials"] = "true";
  }
  return h;
}
function reply(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: headers(origin) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          ...headers(origin),
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "600"
        }
      });
    }
    if (request.method !== "GET") return reply({ error: "method_not_allowed" }, 405, origin);
    if (url.pathname !== "/health" && url.pathname !== "/auth/me")
      return reply({ error: "not_found" }, 404, origin);

    const sql = postgres(env.ACL_DB.connectionString, { max: 1 });
    try {
      if (url.pathname === "/health") {
        const result = await sql`SELECT 1 AS ok`;
        return reply({ connected: result[0].ok === 1 }, 200, origin);
      }

      // Verify a signed, unexpired Neon Auth JWT before accessing ACL records.
      const match = /^Bearer (.+)$/i.exec(request.headers.get("Authorization") || "");
      if (!match) return reply({ authenticated: false }, 401, origin);
      // Verify opaque session tokens with Neon Auth, never trust client identity.
      const sessionToken = match[1];
      if (sessionToken.length > 4096 || /[\r\n;,\s]/.test(sessionToken)) return reply({ authenticated: false }, 401, origin);
      const sessionResponse = await fetch(AUTH_BASE + "/get-session", {
        headers: { "Cookie": "better-auth.session_token=" + sessionToken, "Accept": "application/json" },
        redirect: "manual"
      });
      if (!sessionResponse.ok) return reply({ authenticated: false }, 401, origin);
      const verifiedSession = await sessionResponse.json();
      const authUserId = verifiedSession?.user?.id;
      if (!authUserId || !/^[0-9a-f-]{36}$/i.test(authUserId)) return reply({ authenticated: false }, 401, origin);

      // Never auto-link by email: existing ACL roles must not be claimed
      // without a separate, audited account-recovery verification process.
      const links = await sql`
        SELECT l.profile_id, p.full_name, p.role
        FROM public.acl_auth_links l
        JOIN public.profiles p ON p.id = l.profile_id
        WHERE l.auth_user_id = ${authUserId}::uuid
        LIMIT 1
      `;
      if (!links.length)
        return reply({ authenticated: true, linked: false }, 200, origin);
      return reply({
        authenticated: true,
        linked: true,
        profile: {
          id: links[0].profile_id,
          full_name: links[0].full_name,
          role: links[0].role
        }
      }, 200, origin);
    } catch (error) {
      console.error("ACL API error", error?.message);
      return reply({ error: "internal_error" }, 500, origin);
    } finally {
      await sql.end();
    }
  }
};
