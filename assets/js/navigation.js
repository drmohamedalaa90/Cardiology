import { supabaseClient } from "./supabase-client.js";

export async function requireSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
    return null;
  }
  return data.session;
}

export async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

window.aclSignOut = signOut;
