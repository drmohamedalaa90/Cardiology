import postgres from "postgres";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { compare } from "bcryptjs";

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
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "600"
        }
      });
    }
    if (request.method === "POST" && url.pathname !== "/auth/legacy-login") return reply({ error: "method_not_allowed" }, 405, origin);
    if (request.method !== "GET" && request.method !== "POST") return reply({ error: "method_not_allowed" }, 405, origin);
    if (request.method === "POST" && !ALLOWED_ORIGINS.has(origin)) return reply({ error: "origin_forbidden" }, 403, origin);
    if (url.pathname !== "/health" && url.pathname !== "/auth/me" && url.pathname !== "/admin/students" && url.pathname !== "/admin/learning-summary" && url.pathname !== "/ecg/hall" && url.pathname !== "/ecg/rooms" && url.pathname !== "/auth/legacy-login" && url.pathname !== "/learning/modules" && url.pathname !== "/learning/attempts" && url.pathname !== "/learning/special-courses")
      return reply({ error: "not_found" }, 404, origin);

    // Prefer the explicitly configured Neon connection; Hyperdrive may target an older database.
    const connectionString = env.DATABASE_URL || env.ACL_DB?.connectionString;
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
        const [auth] = await sql`
          SELECT
            (SELECT COUNT(*)::int FROM public.acl_auth_links) AS linked_accounts,
            (SELECT COUNT(*)::int FROM public.profiles) AS total_profiles
        `;
        return reply({
          connected: result[0].ok === 1,
          data,
          authentication: auth.linked_accounts > 0 && auth.linked_accounts === auth.total_profiles
            ? "linked" : "migration_pending",
          linked_accounts: auth.linked_accounts,
          unlinked_profiles: auth.total_profiles - auth.linked_accounts
        }, 200, origin);
      }


      if (url.pathname === "/auth/legacy-login") {
        if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405, origin);
        if (!env.AUTH_SESSION_SECRET || env.AUTH_SESSION_SECRET.length < 32)
          return reply({ error: "auth_not_configured" }, 503, origin);
        const contentLength = Number(request.headers.get("content-length") || "0");
        if (contentLength > 4096) return reply({ error: "invalid_request" }, 413, origin);
        let body;
        try { body = await request.json(); } catch { return reply({ error: "invalid_request" }, 400, origin); }
        const identifier = typeof body?.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
        const password = typeof body?.password === "string" ? body.password : "";
        if (!identifier || identifier.length > 254 || password.length < 1 || password.length > 1024)
          return reply({ error: "invalid_credentials" }, 401, origin);
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + ":" + identifier));
        const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
        const [limit] = await sql`
          SELECT failures, locked_until FROM acl_migration.login_attempt_limits WHERE attempt_key = ${key}
        `;
        if (limit?.locked_until && new Date(limit.locked_until) > new Date())
          return reply({ error: "temporarily_locked" }, 429, origin);
        const accounts = await sql`
          SELECT m.legacy_user_id::text AS legacy_id, m.account_status,
                 p.id AS profile_id, p.payload->>'full_name' AS full_name,
                 p.payload->>'role' AS role, c.encrypted_password
          FROM acl_migration.member_identity_map m
          JOIN acl_migration.legacy_password_credentials c ON c.legacy_user_id = m.legacy_user_id
          JOIN public.profiles p ON p.id = m.legacy_user_id::text
          WHERE lower(m.email) = ${identifier} OR lower(m.username) = ${identifier}
          LIMIT 2
        `;
        // Always perform a bcrypt check, including for unknown usernames, to reduce enumeration.
        const dummyHash = "$2b$10$abcdefghijklmnopqrstuuJvQLX9B75tbkDXZJTFbXUJQDBqbJvN.";
        const candidate = accounts.length === 1 ? accounts[0] : null;
        const valid = await compare(password, candidate?.encrypted_password || dummyHash);
        if (!valid || !candidate || (candidate.account_status && candidate.account_status !== "active")) {
          await sql`
            INSERT INTO acl_migration.login_attempt_limits (attempt_key, failures, window_start, locked_until)
            VALUES (${key}, 1, now(), NULL)
            ON CONFLICT (attempt_key) DO UPDATE SET
              failures = CASE WHEN acl_migration.login_attempt_limits.window_start < now() - interval '15 minutes'
                THEN 1 ELSE acl_migration.login_attempt_limits.failures + 1 END,
              window_start = CASE WHEN acl_migration.login_attempt_limits.window_start < now() - interval '15 minutes'
                THEN now() ELSE acl_migration.login_attempt_limits.window_start END,
              locked_until = CASE WHEN acl_migration.login_attempt_limits.window_start >= now() - interval '15 minutes'
                AND acl_migration.login_attempt_limits.failures >= 4
                THEN now() + interval '15 minutes' ELSE NULL END
          `;
          return reply({ error: "invalid_credentials" }, 401, origin);
        }
        await sql`DELETE FROM acl_migration.login_attempt_limits WHERE attempt_key = ${key}`;
        const remember = body.remember === true;
        const seconds = remember ? 7 * 86400 : 12 * 3600;
        const token = await new SignJWT({ acl_profile_id: candidate.profile_id, auth_method: "legacy" })
          .setProtectedHeader({ alg: "HS256", typ: "JWT" })
          .setIssuer("acl-neon-api")
          .setAudience("acl-web")
          .setSubject(candidate.legacy_id)
          .setIssuedAt()
          .setExpirationTime(Math.floor(Date.now() / 1000) + seconds)
          .sign(new TextEncoder().encode(env.AUTH_SESSION_SECRET));
        return reply({ authenticated: true, token, expires_in: seconds,
          profile: { id: candidate.profile_id, full_name: candidate.full_name, role: candidate.role } }, 200, origin);
      }

      // Verify a signed, unexpired Neon Auth JWT or a legacy ACL JWT.
      const match = /^Bearer (.+)$/i.exec(request.headers.get("Authorization") || "");
      if (!match) return reply({ authenticated: false }, 401, origin);
      let payload, legacyProfileId = null;
      try {
        ({ payload } = await jwtVerify(match[1], jwks, {
          issuer: new URL(AUTH_BASE).origin, algorithms: ["EdDSA"]
        }));
      } catch {
        if (!env.AUTH_SESSION_SECRET || env.AUTH_SESSION_SECRET.length < 32)
          return reply({ authenticated: false }, 401, origin);
        try {
          ({ payload } = await jwtVerify(match[1], new TextEncoder().encode(env.AUTH_SESSION_SECRET), {
            issuer: "acl-neon-api", audience: "acl-web", algorithms: ["HS256"]
          }));
          if (payload.auth_method !== "legacy" || payload.acl_profile_id !== payload.sub)
            return reply({ authenticated: false }, 401, origin);
          legacyProfileId = payload.sub;
        } catch { return reply({ authenticated: false }, 401, origin); }
      }
      const authUserId = payload.sub;
      if (!authUserId || !/^[0-9a-f-]{36}$/i.test(authUserId)) return reply({ authenticated: false }, 401, origin);
      const links = legacyProfileId ? await sql`
        SELECT p.id AS profile_id, p.payload->>'full_name' AS full_name, p.payload->>'role' AS role
        FROM public.profiles p WHERE p.id = ${legacyProfileId} LIMIT 1
      ` : await sql`
        SELECT l.profile_id, p.payload->>'full_name' AS full_name, p.payload->>'role' AS role
        FROM public.acl_auth_links l JOIN public.profiles p ON p.id = l.profile_id
        WHERE l.auth_user_id = ${authUserId}::uuid LIMIT 1
      `;
      if (!links.length) return reply({ authenticated: true, linked: false }, 200, origin);
      if (url.pathname === "/learning/modules") {
        const rows = await sql`SELECT payload FROM public.modules
          WHERE payload->>'edition' = 'basic'
          ORDER BY CASE WHEN payload->>'display_order' ~ '^[0-9]+
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
      const code = error?.code || "";
      const category = ["42P01", "42703", "3F000"].includes(code) ? "schema_mismatch" :
        ["28P01", "28000"].includes(code) ? "database_auth_failed" :
        ["3D000"].includes(code) ? "database_not_found" :
        ["ENOTFOUND", "ETIMEDOUT", "ECONNREFUSED", "CONNECT_TIMEOUT"].includes(code) ? "database_unreachable" : "database_error";
      return reply({ error: "internal_error", category, code: /^[A-Z0-9]{5}$/.test(code) ? code : undefined }, 500, origin);
    } finally {
      await sql.end();
    }
  }
};

            THEN (payload->>'display_order')::int ELSE 9999 END, payload->>'title'`;
        return reply({ modules: rows.map(r => r.payload) }, 200, origin);
      }
      if (url.pathname === "/learning/special-courses") {
        const courses = await sql`SELECT payload FROM public.modules
          WHERE payload->>'edition'='basic' AND payload->>'is_special_course'='true'`;
        const seats = await sql`SELECT module_id,seat_number FROM public.special_course_seats
          WHERE user_id=${links[0].profile_id}`;
        return reply({courses:courses.map(row=>{
          const course=row.payload;
          const seat=seats.find(s=>s.module_id===course.id);
          return {...course,released:course.status==="published",has_access:!!seat || links[0].role==="admin",
            seat_number:seat?.seat_number||null,logo_url:course.special_logo_url||null};
        })},200,origin);
      }
      if (url.pathname === "/learning/attempts") {
        const rows = await sql`SELECT payload FROM public.quiz_attempts
          WHERE payload->>'user_id' = ${links[0].profile_id}
          ORDER BY payload->>'created_at' DESC NULLS LAST LIMIT 1000`;
        return reply({ attempts: rows.map(r => r.payload) }, 200, origin);
      }
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
      const code = error?.code || "";
      const category = ["42P01", "42703", "3F000"].includes(code) ? "schema_mismatch" :
        ["28P01", "28000"].includes(code) ? "database_auth_failed" :
        ["3D000"].includes(code) ? "database_not_found" :
        ["ENOTFOUND", "ETIMEDOUT", "ECONNREFUSED", "CONNECT_TIMEOUT"].includes(code) ? "database_unreachable" : "database_error";
      return reply({ error: "internal_error", category, code: /^[A-Z0-9]{5}$/.test(code) ? code : undefined }, 500, origin);
    } finally {
      await sql.end();
    }
  }
};
