import {
  ACL_CONFIG
} from "./config.js";


if (
  !window.supabase ||
  typeof window.supabase.createClient !==
    "function"
) {
  throw new Error(
    "Supabase JavaScript library was not loaded."
  );
}


export const supabaseClient =
  window.supabase.createClient(
    ACL_CONFIG.supabaseUrl,
    ACL_CONFIG.supabasePublishableKey,
    {
      auth: {
        persistSession:
          true,

        autoRefreshToken:
          true,

        detectSessionInUrl:
          true
      }
    }
  );
