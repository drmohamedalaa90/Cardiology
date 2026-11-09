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
    if (url.pathname !== "/health" && url.pathname !== "/auth/me" && url.pathname !== "/admin/students" && url.pathname !== "/admin/learning-summary" && url.pathname !== "/ecg/hall" && url.pathname !== "/ecg/rooms")
      return reply({ error: "not_found" }, 404, origin);

    const connectionString = env.ACL_DB?.connectionString || env.DATABASE_URL;
    if (!connectionString) return reply({ error: "database_not_configured" }, 503, origin);
    const sql = postgres(connectionString, { max: 1, connect_timeout: 8 });
    try {
      if (url.pathname === "/health") {
        const result = await sql`SELECT 1 AS ok`;
        const [data] = await sql`SELECT
          (SELECT COUNT(*)::int FROM public.profiles) AS profiles,
          (SELECT COUNT(*)::int FROM public.modules) AS modules,
          (SELECT COUNT(*)::int FROM public.special_course_seats) AS hall_seats,
          (SELECT COUNT(*)::int FROM public.ecg_attendance_records) AS attendance_records`;
        return reply({ connected: result[0].ok === 1, data, authentication: "migration_pending" }, 200, origin);
      }

      // Verify a signed, unexpired Neon Auth JWT before accessing ACL records.
      const match = /^Bearer (.+)$/i.exec(request.headers.get("Authorization") || "");
      if (!match) return reply({ authenticated: false }, 401, origin);
      let payload;
      try {
        ({ payload } = await jwtVerify(match[1], jwks, {
          issuer: new URL(AUTH_BASE).origin,
          algorithms: ["EdDSA"]
        }));
      } catch {
        return reply({ authenticated: false }, 401, origin);
      }
      const authUserId = payload.sub;
      if (!authUserId || !/^[0-9a-f-]{36}$/i.test(authUserId)) return reply({ authenticated: false }, 401, origin);

      // Never auto-link by email: existing ACL roles must not be claimed
      // without a separate, audited account-recovery verification process.
      const links = await sql`
        SELECT l.profile_id, p.payload->>'full_name' AS full_name, p.payload->>'role' AS role
        FROM public.acl_auth_links l
        JOIN public.profiles p ON p.id = l.profile_id
        WHERE l.auth_user_id = ${authUserId}::uuid
        LIMIT 1
      `;
      if (!links.length)
        return reply({ authenticated: true, linked: false }, 200, origin);
      if (url.pathname === "/ecg/rooms") {
        const rooms = await sql`SELECT payload FROM public.special_course_sessions ORDER BY payload->>'created_at' NULLS LAST`;
        return reply({ rooms: rooms.map(r => r.payload) }, 200, origin);
      }
      if (url.pathname === "/ecg/hall") {
        const seats = await sql`
          SELECT s.seat_number, s.user_id, p.payload->>'full_name' AS full_name,
                 p.payload->>'display_name' AS display_name
          FROM public.special_course_seats s
          LEFT JOIN public.profiles p ON p.id = s.user_id
          ORDER BY s.seat_number
        `;
        return reply({ capacity: 200, occupied: seats.length, seats }, 200, origin);
      }
      if (url.pathname === "/admin/students") {
        if (links[0].role !== "admin") return reply({ error: "forbidden" }, 403, origin);
        const students = await sql`
          SELECT id, payload->>'full_name' AS full_name,
                 payload->>'academic_year' AS academic_year,
                 payload->>'role' AS role,
                 payload->>'xp' AS xp,
                 payload->>'account_status' AS account_status
          FROM public.profiles ORDER BY payload->>'full_name' LIMIT 500
        `;
        return reply({ students, count: students.length }, 200, origin);
      }
      if (url.pathname === "/admin/learning-summary") {
        if (links[0].role !== "admin") return reply({ error: "forbidden" }, 403, origin);
        const [summary] = await sql`
          SELECT
          (SELECT COUNT(*)::int FROM public.profiles) AS profiles,
          (SELECT COUNT(*)::int FROM public.quiz_attempts) AS quiz_attempts,
          (SELECT COUNT(*)::int FROM public.ecg_attendance_records) AS attendance_records,
          (SELECT COUNT(*)::int FROM public.special_course_seats) AS hall_seats
        `;
        return reply({ summary }, 200, origin);
      }
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
