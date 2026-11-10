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

function decodeQuizJson(value, fallback) {
  let decoded=value;
  for(let i=0;i<3&&typeof decoded==="string";i++){
    try{decoded=JSON.parse(decoded)}catch{return fallback}
  }
  return Array.isArray(fallback) ? (Array.isArray(decoded)?decoded:fallback)
    : (decoded&&typeof decoded==="object"&&!Array.isArray(decoded)?decoded:fallback);
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
    if (request.method === "POST" && !["/auth/legacy-login","/learning/course/edit","/learning/native-quiz"].includes(url.pathname)) return reply({ error: "method_not_allowed" }, 405, origin);
    if (request.method !== "GET" && request.method !== "POST") return reply({ error: "method_not_allowed" }, 405, origin);
    if (request.method === "POST" && !ALLOWED_ORIGINS.has(origin)) return reply({ error: "origin_forbidden" }, 403, origin);
    if (url.pathname !== "/health" && url.pathname !== "/auth/me" && url.pathname !== "/admin/students" && url.pathname !== "/admin/learning-summary" && url.pathname !== "/ecg/hall" && url.pathname !== "/ecg/rooms" && url.pathname !== "/auth/legacy-login" && url.pathname !== "/learning/course" && url.pathname !== "/learning/modules" && url.pathname !== "/learning/attempts" && url.pathname !== "/learning/special-courses" && url.pathname !== "/learning/forum" && url.pathname !== "/learning/course/edit" && url.pathname !== "/learning/native-quiz")
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
      if (url.pathname === "/learning/native-quiz") {
        const courseId=url.searchParams.get("course") || "";
        if (!/^basic-special-[a-z0-9-]{20,80}$/.test(courseId)) return reply({error:"invalid_course"},400,origin);
        const profileId=links[0].profile_id;
        // Question Studio is restricted to the designated ACL administrator's verified legacy identity.
        const [studioOwner]=await sql`
          SELECT 1 AS allowed FROM acl_migration.member_identity_map
          WHERE legacy_user_id::text=${profileId}
            AND lower(email)='drmohamedalaa90@gmail.com' LIMIT 1
        `;
        const admin=links[0].role==="admin" && !!studioOwner;
        const [course]=await sql`SELECT id FROM public.modules WHERE id=${courseId} AND payload->>'is_special_course'='true' LIMIT 1`;
        if(!course)return reply({error:"course_not_found"},404,origin);
        const [quizRoom]=await sql`SELECT payload FROM public.special_course_sessions WHERE payload->>'module_id'=${courseId} AND (payload->>'session_number'='5' OR payload->>'title' ILIKE '%Quiz Room%') LIMIT 1`;
        const roomLocked=quizRoom?.payload?.is_locked!==false;
        if(request.method==="POST"){
          let body;try{body=await request.json()}catch{return reply({error:"invalid_json"},400,origin)}
          if(body?.action==="join"){
            if(admin)return reply({error:"admin_preview_only"},403,origin);
            const [ready]=await sql`SELECT settings FROM public.acl_native_quizzes WHERE course_id=${courseId}`;
            if(!decodeQuizJson(ready?.settings,{})?.published)return reply({error:"quiz_not_released"},403,origin);
            const [prior]=await sql`SELECT 1 FROM public.acl_native_quiz_attempts WHERE course_id=${courseId} AND profile_id=${profileId}`;
            if(prior)return reply({error:"attempt_already_completed"},409,origin);
            await sql`INSERT INTO public.acl_native_quiz_sessions(course_id,profile_id) VALUES (${courseId},${profileId}) ON CONFLICT(course_id,profile_id) DO NOTHING`;
            return reply({success:true},200,origin);
          }
          if(body?.action==="start_all"){
            if(!admin)return reply({error:"admin_required"},403,origin);
            const [quiz]=await sql`SELECT settings FROM public.acl_native_quizzes WHERE course_id=${courseId}`;
            if(!quiz)return reply({error:"quiz_not_configured"},409,origin);
            const settings=decodeQuizJson(quiz.settings,{});
            if(settings.started)return reply({error:"quiz_already_started"},409,origin);
            if(!settings.published)return reply({error:"publish_quiz_first"},409,origin);
            const [waiting]=await sql`SELECT count(*)::int AS count FROM public.acl_native_quiz_sessions WHERE course_id=${courseId} AND terminated=false`;
            if(!waiting?.count)return reply({error:"no_candidates_in_waiting_room"},409,origin);
            settings.started=true;settings.started_at=new Date().toISOString();
            await sql.begin(async tx=>{
              await tx`UPDATE public.acl_native_quizzes SET settings=${sql.json(settings)},updated_at=now() WHERE course_id=${courseId}`;
              await tx`UPDATE public.acl_native_quiz_sessions SET started_at=now() WHERE course_id=${courseId} AND terminated=false`;
            });
            return reply({success:true,started_at:settings.started_at},200,origin);
          }
          if(body?.action==="start"){
            if(admin)return reply({error:"admin_preview_only"},403,origin);
            const [ready]=await sql`SELECT settings FROM public.acl_native_quizzes WHERE course_id=${courseId}`;
            const readySettings=decodeQuizJson(ready?.settings,{});
            if(!readySettings.published)return reply({error:"quiz_not_released"},403,origin);
            if(!readySettings.started)return reply({error:"waiting_for_administrator"},409,origin);
            const prior=await sql`SELECT 1 FROM public.acl_native_quiz_attempts WHERE course_id=${courseId} AND profile_id=${profileId}`;
            if(prior.length)return reply({error:"attempt_already_completed"},409,origin);
            const [session]=await sql`INSERT INTO public.acl_native_quiz_sessions(course_id,profile_id) VALUES (${courseId},${profileId}) ON CONFLICT(course_id,profile_id) DO UPDATE SET course_id=excluded.course_id RETURNING started_at,incidents,terminated`;
            if(session.terminated)return reply({error:"quiz_terminated"},403,origin);
            return reply({success:true,started_at:session.started_at,incidents:session.incidents.length},200,origin);
          }
          if(body?.action==="incident"){
            if(admin)return reply({error:"admin_preview_only"},403,origin);
            const kind=String(body.kind||"screen_change").slice(0,60);
            if(!["tab_hidden","window_blur","fullscreen_exit"].includes(kind))return reply({error:"invalid_incident"},400,origin);
            const [session]=await sql`UPDATE public.acl_native_quiz_sessions SET incidents=incidents||jsonb_build_array(jsonb_build_object('kind',${kind},'at',now())),terminated=(jsonb_array_length(incidents)+1>=4) WHERE course_id=${courseId} AND profile_id=${profileId} AND terminated=false RETURNING incidents,terminated`;
            if(!session)return reply({error:"session_not_active"},409,origin);
            const count=session.incidents.length;
            if(session.terminated){
              const [record]=await sql`SELECT started_at FROM public.acl_native_quiz_sessions WHERE course_id=${courseId} AND profile_id=${profileId}`;
              const duration=Math.max(0,Math.round((Date.now()-new Date(record.started_at).getTime())/1000));
              await sql`INSERT INTO public.acl_native_quiz_attempts(course_id,profile_id,answers,score,total,violations,started_at,duration_seconds,correct_count,terminated,mistakes)
                VALUES (${courseId},${profileId},'[]'::jsonb,0,0,${sql.json(session.incidents)},${record.started_at},${duration},0,true,'[]'::jsonb)
                ON CONFLICT DO NOTHING`;
            }
            return reply({count,terminated:session.terminated,penalty:count>=3?4:count>=2?1:0},200,origin);
          }
          if(body?.action==="reset_attempt"){
            if(!admin)return reply({error:"admin_required"},403,origin);
            const target=String(body.profile_id||"");
            if(!target||target.length>150)return reply({error:"invalid_member"},400,origin);
            const [known]=await sql`SELECT 1 FROM public.profiles WHERE id=${target}`;
            if(!known)return reply({error:"member_not_found"},404,origin);
            await sql.begin(async tx=>{
              await tx`DELETE FROM public.acl_native_quiz_attempts WHERE course_id=${courseId} AND profile_id=${target}`;
              await tx`DELETE FROM public.acl_native_quiz_sessions WHERE course_id=${courseId} AND profile_id=${target}`;
            });
            return reply({success:true},200,origin);
          }
          if(body?.action==="reset_all"){
            if(!admin)return reply({error:"admin_required"},403,origin);
            if(body.confirm!=="RESET ALL ATTEMPTS")return reply({error:"confirmation_required"},400,origin);
            await sql.begin(async tx=>{
              await tx`DELETE FROM public.acl_native_quiz_attempts WHERE course_id=${courseId}`;
              await tx`DELETE FROM public.acl_native_quiz_sessions WHERE course_id=${courseId}`;
            });
            return reply({success:true},200,origin);
          }
          if(body?.action==="save"){
            if(!admin)return reply({error:"admin_required"},403,origin);
            const settings=body.settings,questions=body.questions;
            if(!settings || !Array.isArray(questions) || questions.length>300 || JSON.stringify(body).length>500000)return reply({error:"invalid_quiz"},400,origin);
            if(questions.some(q=>typeof q.text!=="string"||q.text.length>5000||!Array.isArray(q.answers)||q.answers.length!==4||!Number.isInteger(q.correct)||q.correct<0||q.correct>3))return reply({error:"invalid_questions"},400,origin);
            await sql`INSERT INTO public.acl_native_quizzes(course_id,settings,questions) VALUES (${courseId},${sql.json(settings)},${sql.json(questions)}) ON CONFLICT(course_id) DO UPDATE SET settings=excluded.settings,questions=excluded.questions,updated_at=now()`;
            return reply({success:true},200,origin);
          }
          if(body?.action==="submit"){
            const [quiz]=await sql`SELECT settings,questions FROM public.acl_native_quizzes WHERE course_id=${courseId}`;
            const settings=decodeQuizJson(quiz?.settings,{}),allQuestions=decodeQuizJson(quiz?.questions,[]);
            if(!settings.published)return reply({error:"quiz_not_released"},403,origin);
            if(!settings.started)return reply({error:"waiting_for_administrator"},403,origin);
            if(roomLocked&&!settings.started)return reply({error:"quiz_room_locked"},403,origin);
            const [session]=await sql`SELECT started_at,incidents,terminated FROM public.acl_native_quiz_sessions WHERE course_id=${courseId} AND profile_id=${profileId}`;
            if(!session)return reply({error:"quiz_not_started"},403,origin);
            const questions=allQuestions.slice(0,Math.min(300,Math.max(1,Number(settings.count)||10)));
            const answers=body.answers;
            if(!Array.isArray(answers)||answers.length!==questions.length||answers.some(x=>!Number.isInteger(x)||x< -1||x>3))return reply({error:"invalid_answers"},400,origin);
            const correct=questions.reduce((sum,q,i)=>sum+Number(answers[i]===q.correct),0);
            const mistakes=questions.map((q,i)=>answers[i]===q.correct?null:({question:i+1,question_text:q.text,selected:answers[i],correct:q.correct})).filter(Boolean);
            const count=session.incidents.length,penalty=count>=3?4:count>=2?1:0;
            const score=session.terminated?0:Math.max(0,correct-penalty);
            const duration=Math.max(0,Math.round((Date.now()-new Date(session.started_at).getTime())/1000));
            const saved=await sql`INSERT INTO public.acl_native_quiz_attempts(course_id,profile_id,answers,score,total,violations,started_at,duration_seconds,correct_count,terminated,mistakes)
              VALUES (${courseId},${profileId},${sql.json(answers)},${score},${questions.length},${sql.json(session.incidents)},${session.started_at},${duration},${correct},${session.terminated},${sql.json(mistakes)})
              ON CONFLICT DO NOTHING RETURNING score,total`;
            if(!saved.length)return reply({error:"attempt_already_completed"},409,origin);
            return reply({success:true,score,total:questions.length,correct,penalty,terminated:session.terminated,duration_seconds:duration,violations:count},200,origin);
          }
          return reply({error:"invalid_action"},400,origin);
        }
        const [quiz]=await sql`SELECT settings,questions FROM public.acl_native_quizzes WHERE course_id=${courseId}`;
        const [attempt]=await sql`SELECT score,total,completed_at,duration_seconds,terminated FROM public.acl_native_quiz_attempts WHERE course_id=${courseId} AND profile_id=${profileId}`;
        const [session]=await sql`SELECT started_at,incidents,terminated FROM public.acl_native_quiz_sessions WHERE course_id=${courseId} AND profile_id=${profileId}`;
        const settings=decodeQuizJson(quiz?.settings,{count:10,seconds:60,published:false,order:"manual"});
        const questions=decodeQuizJson(quiz?.questions,[]);
        if(admin){
          const results=await sql`SELECT a.profile_id,coalesce(p.payload->>'full_name',p.payload->>'display_name','ACL Member') AS name,a.score,a.total,a.correct_count,a.duration_seconds,a.terminated,a.violations,a.mistakes,a.answers,a.started_at,a.completed_at
            FROM public.acl_native_quiz_attempts a LEFT JOIN public.profiles p ON p.id=a.profile_id
            WHERE a.course_id=${courseId} ORDER BY a.terminated ASC,a.score DESC,a.duration_seconds ASC NULLS LAST,a.completed_at ASC`;
          const ongoing=await sql`SELECT s.profile_id,coalesce(p.payload->>'full_name',p.payload->>'display_name','ACL Member') AS name,s.started_at,s.incidents,s.terminated
            FROM public.acl_native_quiz_sessions s LEFT JOIN public.profiles p ON p.id=s.profile_id
            WHERE s.course_id=${courseId} AND NOT EXISTS(SELECT 1 FROM public.acl_native_quiz_attempts a WHERE a.course_id=s.course_id AND a.profile_id=s.profile_id) ORDER BY s.started_at DESC`;
          return reply({admin:true,room_locked:roomLocked,settings,questions,attempt:attempt||null,results,ongoing},200,origin);
        }
        if(!settings.published)return reply({admin:false,room_locked:roomLocked,settings:{published:false},questions:[],attempt:attempt||null},200,origin);
        if(!settings.started)return reply({admin:false,room_locked:roomLocked,waiting_room:true,settings:{published:true,started:false},questions:[],attempt:attempt||null,session:session?{started_at:session.started_at,incidents:session.incidents.length,terminated:session.terminated}:null},200,origin);
        return reply({admin:false,room_locked:roomLocked&&!settings.started,settings,questions:questions.slice(0,Math.max(1,Number(settings.count)||10)).map(({correct,explanation,...q})=>q),attempt:attempt||null,session:session?{started_at:session.started_at,incidents:session.incidents.length,terminated:session.terminated}:null},200,origin);
      }
      if (url.pathname === "/learning/course/edit") {
        if (request.method !== "POST") return reply({error:"method_not_allowed"},405,origin);
        if (links[0].role !== "admin") return reply({error:"admin_required"},403,origin);
        const rawLength=Number(request.headers.get("content-length")||0);
        if(rawLength>65536)return reply({error:"request_too_large"},413,origin);
        let body;
        try{body=await request.json()}catch{return reply({error:"invalid_json"},400,origin)}
        const courseId=body?.module_id,action=body?.action,args=body?.args||{};
        if(typeof courseId!=="string"||!/^basic-special-[a-z0-9-]{20,80}$/.test(courseId))return reply({error:"invalid_course"},400,origin);
        if(!["save_session","save_item","delete_session","delete_item"].includes(action))return reply({error:"unsupported_action"},400,origin);
        const course=await sql`SELECT id FROM public.modules WHERE id=${courseId} AND payload->>'is_special_course'='true' LIMIT 1`;
        if(!course.length)return reply({error:"course_not_found"},404,origin);
        const isSession=action.endsWith("session"),table=isSession?"special_course_sessions":"special_course_content";
        const id=typeof args.id==="string"?args.id:null;
        if(action.startsWith("delete_")){
          if(!id)return reply({error:"missing_id"},400,origin);
          if(isSession){
            const children=await sql`SELECT COUNT(*)::int AS count FROM public.special_course_content WHERE payload->>'session_id'=${id} AND payload->>'module_id'=${courseId}`;
            if(children[0].count>0)return reply({error:"room_not_empty"},409,origin);
            await sql`DELETE FROM public.special_course_sessions WHERE id=${id} AND payload->>'module_id'=${courseId}`;
          }else{
            await sql`DELETE FROM public.special_course_content WHERE id=${id} AND payload->>'module_id'=${courseId}`;
          }
          return reply({success:true},200,origin);
        }
        const fields=isSession?["title","session_number","display_order","is_active","is_locked"]:["title","subtitle","url","session_id","item_type","display_order","is_active","cover_image_url"];
        const patch={};
        for(const field of fields)if(Object.prototype.hasOwnProperty.call(args,field))patch[field]=args[field];
        if(isSession){
          if(typeof patch.title!=="string"||!patch.title.trim()||!Number.isInteger(Number(patch.session_number))||Number(patch.session_number)<1)return reply({error:"invalid_session"},400,origin);
        }else{
          if(typeof patch.title!=="string"||!patch.title.trim()||typeof patch.session_id!=="string")return reply({error:"invalid_item"},400,origin);
          const parent=await sql`SELECT id FROM public.special_course_sessions WHERE id=${patch.session_id} AND payload->>'module_id'=${courseId}`;
          if(!parent.length)return reply({error:"invalid_session"},400,origin);
          if(patch.url && typeof patch.url==="string" && patch.url!=="#" && !/^https:\/\//i.test(patch.url))return reply({error:"invalid_url"},400,origin);
        }
        if(patch.title.length>250)return reply({error:"title_too_long"},400,origin);
        if(id){
          const rows=isSession?await sql`UPDATE public.special_course_sessions SET payload=payload||${JSON.stringify({...patch,updated_at:new Date().toISOString()})}::jsonb WHERE id=${id} AND payload->>'module_id'=${courseId} RETURNING payload`:await sql`UPDATE public.special_course_content SET payload=payload||${JSON.stringify({...patch,updated_at:new Date().toISOString()})}::jsonb WHERE id=${id} AND payload->>'module_id'=${courseId} RETURNING payload`;
          if(!rows.length)return reply({error:"record_not_found"},404,origin);
          return reply({success:true,item:rows[0].payload},200,origin);
        }
        const newId=crypto.randomUUID(),payload={...patch,id:newId,module_id:courseId,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        if(isSession)await sql`INSERT INTO public.special_course_sessions(id,payload) VALUES (${newId},${JSON.stringify(payload)}::jsonb)`;
        else await sql`INSERT INTO public.special_course_content(id,payload) VALUES (${newId},${JSON.stringify(payload)}::jsonb)`;
        return reply({success:true,item:payload},200,origin);
      }
      if (url.pathname === "/learning/forum") {
        const moduleId=url.searchParams.get("module")||"";
        if(!moduleId || moduleId.length>150)return reply({error:"invalid_module"},400,origin);
        const qs=await sql`SELECT payload FROM public.module_forum_questions WHERE payload->>'module_id'=${moduleId} ORDER BY payload->>'created_at' DESC`;
        const ids=qs.map(x=>x.payload.id);
        const answers=ids.length?await sql`SELECT payload FROM public.module_forum_answers WHERE payload->>'question_id'=ANY(${ids}) ORDER BY payload->>'created_at'`:[];
        const likes=await sql`SELECT payload FROM public.module_forum_answer_likes`;
        const authors=[...new Set([...qs,...answers].map(x=>x.payload.author_id).filter(Boolean))];
        const profiles=authors.length?await sql`SELECT id,payload FROM public.profiles WHERE id=ANY(${authors})`:[];
        const names=new Map(profiles.map(x=>[x.id,x.payload]));
        const authorFor=(p)=>{const profile=names.get(p.author_id)||{};return {name:profile.display_name||profile.full_name||"ACL Member",anonymous:!!p.is_anonymous,admin:profile.role==="admin"};};
        return reply({is_admin:links[0].role==="admin",questions:qs.map(x=>({
          id:x.payload.id,body:x.payload.body,created_at:x.payload.created_at,author:authorFor(x.payload),
          answers:answers.filter(a=>a.payload.question_id===x.payload.id).map(a=>({
            id:a.payload.id,body:a.payload.body,created_at:a.payload.created_at,author:authorFor(a.payload),
            verified:!!a.payload.is_admin_verified,likes:likes.filter(l=>l.payload.answer_id===a.payload.id).length,liked_by_me:false
          }))
        }))},200,origin);
      }
      if (url.pathname === "/learning/course") {
        const courseId=url.searchParams.get("course");
        if(!courseId || !/^basic-special-[a-z0-9-]{20,80}$/.test(courseId))
          return reply({error:"invalid_course"},400,origin);
        const courses=await sql`SELECT payload FROM public.modules WHERE id=${courseId} AND payload->>'is_special_course'='true' LIMIT 1`;
        if(!courses.length)return reply({error:"course_not_found"},404,origin);
        const sessions=await sql`SELECT payload FROM public.special_course_sessions WHERE payload->>'module_id'=${courseId} ORDER BY payload->>'display_order'`;
        const items=await sql`SELECT payload FROM public.special_course_content WHERE payload->>'module_id'=${courseId} ORDER BY payload->>'display_order'`;
        const seats=await sql`SELECT s.user_id,s.seat_number,s.payload,p.payload AS profile
          FROM public.special_course_seats s LEFT JOIN public.profiles p ON p.id=s.user_id
          WHERE s.module_id=${courseId} ORDER BY s.seat_number`;
        const attendance=await sql`SELECT user_id,attendance_slot,payload FROM public.ecg_attendance_records WHERE module_id=${courseId}`;
        const reviews=await sql`SELECT user_id,attendance_slot,status FROM public.ecg_attendance_reviews WHERE module_id=${courseId}`;
        const reviewByUser=new Map();
        for(const review of reviews){
          if(!reviewByUser.has(review.user_id))reviewByUser.set(review.user_id,new Map());
          reviewByUser.get(review.user_id).set(Number(review.attendance_slot),review.status);
        }
        // Reproduce the original ACL hall colour rules from the legacy course function.
        const roomBySlot=new Map(sessions.map(row=>[Number(row.payload.session_number),row.payload]));
        const attendanceByUser=new Map();
        for(const entry of attendance){
          if(!attendanceByUser.has(entry.user_id))attendanceByUser.set(entry.user_id,new Map());
          attendanceByUser.get(entry.user_id).set(Number(entry.attendance_slot),entry.payload);
        }
        const statusFor=(record,room)=>{
          if(!record)return room?.lecture_ended_at?"red":null;
          if(room?.lecture_started_at && record.checked_at && new Date(record.checked_at)>new Date(room.lecture_started_at))return "orange";
          if(record.checked_out_at && (!room?.lecture_ended_at || new Date(record.checked_out_at)<new Date(room.lecture_ended_at)))return "orange";
          if(room?.lecture_ended_at && !record.checked_out_at)return "orange";
          return "green";
        };
        const memberRows=seats.map(seat=>({
          seat_number:seat.seat_number,user_id:seat.user_id,
          name:seat.profile?.display_name||seat.profile?.full_name||seat.profile?.name||"ACL Member",
          gender:seat.payload?.gender||seat.profile?.gender||null,is_you:seat.user_id===links[0].profile_id,
          stars:Number(seat.payload?.stars||0),asked:!!seat.payload?.asked_at,
          suspended:!!seat.payload?.suspended_at,
          attendance:[1,2,3,4].map(slot=>{
            const record=attendanceByUser.get(seat.user_id)?.get(slot);
            const room=roomBySlot.get(slot);
            return {slot,status:reviewByUser.get(seat.user_id)?.get(slot)||record?.status||statusFor(record,room),
              checked_in_at:record?.checked_at||null,checked_out_at:record?.checked_out_at||null};
          })
        }));
        return reply({course:{...courses[0].payload,logo_url:courses[0].payload.special_logo_url},
          sessions:sessions.map(row=>row.payload),items:items.map(row=>row.payload),
          candidate_name:links[0].full_name||"ACL Member",
          admin:links[0].role==="admin",
          hall:{capacity:200,occupied:memberRows.length,members:memberRows,rooms:sessions.map(row=>row.payload),admin:links[0].role==="admin"}
        },200,origin);
      }
      if (url.pathname === "/learning/modules") {
        const rows = await sql`SELECT payload FROM public.modules WHERE payload->>'edition' = 'basic' ORDER BY payload->>'title'`;
        return reply({ modules: rows.map(r => r.payload).filter(m => m.is_special_course !== true) }, 200, origin);
      }
      if (url.pathname === "/learning/attempts") {
        const rows = await sql`SELECT payload FROM public.quiz_attempts WHERE payload->>'user_id' = ${links[0].profile_id} LIMIT 1000`;
        return reply({ attempts: rows.map(r => r.payload) }, 200, origin);
      }
      if (url.pathname === "/learning/special-courses") {
        const courses = await sql`SELECT payload FROM public.modules WHERE payload->>'edition'='basic' AND payload->>'is_special_course'='true'`;
        const seats = await sql`SELECT module_id,seat_number FROM public.special_course_seats WHERE user_id=${links[0].profile_id}`;
        return reply({ courses: courses.map(row => {
          const course = row.payload;
          const seat = seats.find(item => item.module_id === course.id);
          return {...course, released:course.status==="published", has_access:!!seat || links[0].role==="admin", seat_number:seat?.seat_number||null, logo_url:course.special_logo_url||null};
        }) }, 200, origin);
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
