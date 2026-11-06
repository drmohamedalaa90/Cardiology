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

// Keep existing ACL modules unchanged: Neon exposes the same PostgREST query,
// RPC and Supabase-style auth surface through this adapter.
export const supabaseClient = neonClient;

// Temporary media-only bridge. Authentication, profiles, learning records,
// RPCs and RLS all use Neon. The bridge can be removed when storage is moved
// to a region supported by Neon Object Storage.
if (window.supabase && ACL_CONFIG.mediaStorageUrl) {
  const mediaClient = window.supabase.createClient(
    ACL_CONFIG.mediaStorageUrl,
    ACL_CONFIG.mediaStoragePublishableKey,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  if (!supabaseClient.storage) {
    Object.defineProperty(supabaseClient, "storage", {
      value: mediaClient.storage,
      enumerable: true
    });
  }
}
