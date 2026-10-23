import { ACL_CONFIG } from "./config.js";

const REMEMBER_KEY = "aclRememberMe";

const authStorage = {
  getItem(key) {
    try {
      const remember = localStorage.getItem(REMEMBER_KEY);
      if (remember === "0") {
        return sessionStorage.getItem(key);
      }

      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key, value) {
    try {
      const remember = localStorage.getItem(REMEMBER_KEY);
      if (remember === "0") {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      }
    } catch {}
  },

  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {}

    try {
      sessionStorage.removeItem(key);
    } catch {}
  }
};

export const supabaseClient = window.supabase.createClient(
  ACL_CONFIG.supabaseUrl,
  ACL_CONFIG.supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authStorage
    }
  }
);
