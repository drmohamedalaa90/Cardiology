import { supabaseClient } from "./supabase-client.js";

export async function requireSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "acl-access.html?build=20261023-clean";
    return null;
  }
  return data.session;
}

export async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = "acl-access.html?build=20261023-clean";
}

window.aclSignOut = signOut;
