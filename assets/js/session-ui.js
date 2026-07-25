import { supabaseClient } from "./supabase-client.js";

export async function requireSession(relativeLogin = "login.html") {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.replace(relativeLogin);
    return null;
  }
  return data.session;
}

export async function loadProfile() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single();
  if (error) throw error;
  return { ...data, email: user.email };
}

export function renderUserChip(profile) {
  const chip = document.getElementById("userChip");
  if (!chip || !profile) return;
  const nested = location.pathname.includes("/modules/");
  const profileHref = nested ? "../../profile.html" : "profile.html";
  const initials = (profile.full_name || "ACL").split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase();
  chip.href = profileHref;
  chip.innerHTML = profile.avatar_url
    ? `<img src="${profile.avatar_url}" alt=""><span>Signed in as <b>${profile.full_name}</b></span>`
    : `<span class="avatar-placeholder">${initials}</span><span>Signed in as <b>${profile.full_name}</b></span>`;

  if (!chip.closest(".user-area")) {
    const wrapper = document.createElement("div");
    wrapper.className = "user-area";
    chip.parentNode.insertBefore(wrapper, chip);
    wrapper.appendChild(chip);
    const quickLinks = document.createElement("div");
    quickLinks.className = "user-quick-links";
    quickLinks.innerHTML = `<a href="${profileHref}">Edit profile</a><a href="mailto:drmohamedalaa90@gmail.com">Contact us</a>`;
    wrapper.appendChild(quickLinks);
  }
}

function renderAdminLink(profile) {
  if (profile?.role !== "admin") return;
  const nav = document.querySelector(".topbar nav");
  if (!nav || document.getElementById("adminNavLink")) return;
  const link = document.createElement("a");
  link.id = "adminNavLink";
  link.className = "nav-btn admin-nav-btn";
  link.href = location.pathname.includes("/modules/") ? "../../admin.html" : "admin.html";
  link.textContent = "Admin";
  const signOutButton = [...nav.querySelectorAll("button")].find(btn => /sign out/i.test(btn.textContent));
  nav.insertBefore(link, signOutButton || null);
}

export async function protectAndRender(relativeLogin = "login.html") {
  const session = await requireSession(relativeLogin);
  if (!session) return null;
  const profile = await loadProfile();
  if (!profile || profile.account_status === "suspended") {
    await supabaseClient.auth.signOut();
    alert("This account has been suspended. Contact the ACL administrator.");
    window.location.replace(relativeLogin);
    return null;
  }
  renderUserChip(profile);
  renderAdminLink(profile);
  return profile;
}

export async function signOut() {
  await supabaseClient.auth.signOut();
  const nested = location.pathname.includes("/modules/");
  window.location.replace(nested ? "../../login.html" : "login.html");
}
window.aclSignOut = signOut;
