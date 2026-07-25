import { ACL_CONFIG } from "./config.js";

export const supabaseClient = window.supabase.createClient(
  ACL_CONFIG.supabaseUrl,
  ACL_CONFIG.supabasePublishableKey
);
