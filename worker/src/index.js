import postgres from "postgres";

const AUTH_BASE = "https://ep-mute-sky-zantnre1.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth";
const ALLOWED_ORIGINS = new Set(["https://drmohamedalaa90.github.io"]);

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
          "Access-Control-Allow-Headers": "Content-Type",
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

      // Only Better Auth's own session endpoint can authenticate a request.
      // Do not trust an email, profile ID or role provided by the browser.
      const cookie = request.headers.get("Cookie");
      if (!cookie) return reply({ authenticated: false }, 401, origin);
      const sessionResponse = await fetch(AUTH_BASE + "/api/auth/get-session", {
        method: "GET",
        headers: { Cookie: cookie, Accept: "application/json" },
        redirect: "manual"
      });
      if (!sessionResponse.ok) return reply({ authenticated: false }, 401, origin);
      const sessionData = await sessionResponse.json();
      const user = sessionData?.user;
      if (!user?.id || user.emailVerified !== true)
        return reply({ authenticated: false, reason: "verified_email_required" }, 401, origin);

      // Never auto-link by email: existing ACL roles must not be claimed
      // without a separate, audited account-recovery verification process.
      const links = await sql`
        SELECT l.profile_id, p.full_name, p.role
        FROM public.acl_auth_links l
        JOIN public.profiles p ON p.id = l.profile_id
        WHERE l.auth_user_id = ${user.id}::uuid
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
