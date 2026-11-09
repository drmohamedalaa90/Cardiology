import { ACL_CONFIG } from "./config.js";
import {
  createClient,
  SupabaseAuthAdapter
} from "https://esm.sh/@neondatabase/neon-js";

const neonClient = createClient({
  auth: {
    url: ACL_CONFIG.neonAuthUrl,
    adapter: SupabaseAuthAdapter(),
    allowAnonymous: true
  },
  dataApi: {
    url: ACL_CONFIG.neonDataApiUrl
  }
});

const nativeAuth = neonClient.auth;
const ACL_API = "https://acl-neon-api.drmohamedalaa90.workers.dev";
function legacyToken() { return sessionStorage.getItem("aclLegacyToken") || localStorage.getItem("aclLegacyToken"); }
async function legacySession() {
  const token = legacyToken();
  if (!token) return null;
  try {
    const response = await fetch(ACL_API + "/auth/me", {headers:{Authorization:"Bearer " + token}});
    const result = await response.json();
    if (!response.ok || !result.authenticated || !result.linked || !result.profile?.id) throw new Error("expired");
    const profile = result.profile;
    return {access_token:token,token_type:"bearer",user:{
      id:profile.id, role:profile.role, user_metadata:{full_name:profile.full_name},
      app_metadata:{provider:"acl_legacy"}, email:profile.email || ""
    }};
  } catch {
    sessionStorage.removeItem("aclLegacyToken");localStorage.removeItem("aclLegacyToken");
    sessionStorage.removeItem("aclLegacyProfile");localStorage.removeItem("aclLegacyProfile");
    return null;
  }
}

let cachedProfileId = "";
let mediaStorage = null;

async function aclProfileId(session) {
  if (cachedProfileId) return cachedProfileId;
  const token =
    session?.access_token ||
    session?.accessToken ||
    (typeof nativeAuth.getJWTToken === "function"
      ? await nativeAuth.getJWTToken()
      : "");
  if (!token) return "";
  const response = await fetch(
    "https://acl-neon-api.drmohamedalaa90.workers.dev/auth/me",
    { headers: { Authorization: "Bearer " + token } }
  );
  if (!response.ok) throw new Error("ACL identity lookup failed");
  const result = await response.json();
  cachedProfileId = result?.profile?.id || "";
  return cachedProfileId;
}

async function mapSession(session) {
  if (!session?.user) return session;
  try {
    const id = await aclProfileId(session);
    if (!id) return session;
    return { ...session, user: { ...session.user, id, auth_user_id: session.user.id } };
  } catch {
    return session;
  }
}

const authCompat = new Proxy(nativeAuth, {
  get(target, property) {
    if (property === "getSession") {
      return async (...args) => {
        if (legacyToken()) { const session = await legacySession(); if (session) return {data:{session},error:null}; }
        const result = await target.getSession(...args);
        if (result?.data?.session) {
          return {
            ...result,
            data: { ...result.data, session: await mapSession(result.data.session) }
          };
        }
        return result;
      };
    }

    if (property === "getUser" && typeof target.getUser === "function") {
      return async (...args) => {
        if (legacyToken()) { const session = await legacySession(); if (session) return {data:{user:session.user},error:null}; }
        const result = await target.getUser(...args);
        if (result?.data?.user) {
          const session = await mapSession({ user: result.data.user });
          return { ...result, data: { ...result.data, user: session.user } };
        }
        return result;
      };
    }

    if (property === "onAuthStateChange" && typeof target.onAuthStateChange === "function") {
      return (callback) => target.onAuthStateChange((event, session) => {
        void mapSession(session).then(mapped => callback(event, mapped));
      });
    }

    if (property === "signOut" && typeof target.signOut === "function") {
      return async (...args) => {
        sessionStorage.removeItem("aclLegacyToken");localStorage.removeItem("aclLegacyToken");
        sessionStorage.removeItem("aclLegacyProfile");localStorage.removeItem("aclLegacyProfile");
        const result = await target.signOut(...args);
        cachedProfileId = "";
        return result;
      };
    }

    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  }
});

// Keep the existing ACL modules unchanged: Neon provides the same PostgREST,
// RPC and Supabase-style authentication surface through this adapter. The
// auth wrapper exposes the linked ACL profile UUID to legacy direct inserts.
export const supabaseClient = new Proxy(neonClient, {
  get(target, property) {
    if (property === "auth") return authCompat;
    if (property === "storage" && mediaStorage) return mediaStorage;
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  }
});

// Temporary media-only bridge. Authentication, profiles, learning records,
// RPCs and RLS all use Neon. This can be removed when Neon Object Storage is
// available in this project's region.
if (window.supabase && ACL_CONFIG.mediaStorageUrl) {
  const mediaClient = window.supabase.createClient(
    ACL_CONFIG.mediaStorageUrl,
    ACL_CONFIG.mediaStoragePublishableKey,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  mediaStorage = mediaClient.storage;
}
