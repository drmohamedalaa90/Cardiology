import { supabaseClient } from "./supabase-client.js";

export async function requireSession(relativeLogin = "login.html") {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.href = relativeLogin;
    return null;
  }
  return data.session;
}

export async function loadProfile() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return { ...data, email: user.email };
}

export function renderUserChip(profile) {
  const chip = document.getElementById("userChip");
  if (!chip || !profile) return;
  const initials = (profile.full_name || "ACL")
    .split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase();
  chip.innerHTML = profile.avatar_url
    ? `<img src="${profile.avatar_url}" alt=""><span>Signed in as <b>${profile.full_name}</b></span>`
    : `<span class="avatar-placeholder">${initials}</span><span>Signed in as <b>${profile.full_name}</b></span>`;
}

export async function protectAndRender(relativeLogin = "login.html") {
  const session = await requireSession(relativeLogin);
  if (!session) return null;
  const profile = await loadProfile();
  renderUserChip(profile);
  return profile;
}

export async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}
window.aclSignOut = signOut;
