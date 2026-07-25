import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { identifier, password } = await req.json();
    if (typeof identifier !== "string" || typeof password !== "string" || !identifier.trim() || !password) return json({ error: "Username/email and password are required." }, 400);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("Supabase environment variables are missing.");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    let email = identifier.trim().toLowerCase();
    let profileId: string | null = null;

    if (!email.includes("@")) {
      const { data: profile } = await adminClient.from("profiles").select("id,account_status").ilike("username", identifier.trim()).maybeSingle();
      if (!profile?.id || profile.account_status === "suspended") return json({ error: profile?.account_status === "suspended" ? "This account has been suspended. Contact the ACL administrator." : "Invalid username/email or password." }, 401);
      profileId = profile.id;
      const { data: userResult } = await adminClient.auth.admin.getUserById(profile.id);
      email = userResult?.user?.email?.toLowerCase() ?? "";
      if (!email) return json({ error: "Invalid username/email or password." }, 401);
    } else {
      const { data: authUsers } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const user = authUsers?.users?.find((u) => u.email?.toLowerCase() === email);
      profileId = user?.id ?? null;
      if (profileId) {
        const { data: profile } = await adminClient.from("profiles").select("account_status").eq("id", profileId).maybeSingle();
        if (profile?.account_status === "suspended") return json({ error: "This account has been suspended. Contact the ACL administrator." }, 401);
      }
    }

    const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) return json({ error: "Invalid username/email or password." }, 401);
    if (profileId) await adminClient.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", profileId);
    return json({ session: data.session, user: data.user });
  } catch (error) {
    console.error(error);
    return json({ error: "Login service is temporarily unavailable." }, 500);
  }
});
