import { supabaseClient } from "./supabase-client.js";

const VALID_EDITIONS = new Set(["basic", "expert"]);
const EDITION_KEY = "aclSelectedEdition";
const nested = location.pathname.includes("/modules/");
const root = nested ? "../../" : "";
const pageName = location.pathname.split("/").pop()?.toLowerCase() || "";
const shellExcludedPages = new Set([
  "home.html",
  "modules.html",
  "login.html",
  "forgot-password.html",
  "reset-password.html",
  "confirm.html",
  "index.html",
  "pathways.html",
  "admin.html",
  "competition-dashboard.html"
]);

if (pageName !== "home.html" && !document.querySelector('link[data-acl-page-polish]')) {
  const polish = document.createElement('link');
  polish.rel = 'stylesheet';
  polish.dataset.aclPagePolish = 'true';
  polish.href = root + 'assets/css/page-polish-20260820.css?v=2';
  document.head.appendChild(polish);
}
if (pageName !== "home.html" && !document.querySelector('link[data-acl-universal-drawer]')) {
  const drawerCss = document.createElement('link');
  drawerCss.rel = 'stylesheet';
  drawerCss.dataset.aclUniversalDrawer = 'true';
  drawerCss.href = root + 'assets/css/acl-universal-drawer-20260820.css?v=5';
  document.head.appendChild(drawerCss);
}

if (!nested && !shellExcludedPages.has(pageName) && !document.getElementById("aclSharedShell")) {
  try {
    await import("./acl-shared-shell.js?v=3.0.1");
    await import("./acl-universal-drawer-20260820.js?v=4");
  } catch (error) {
    console.warn("ACL shared shell load error", error);
  }
}

function normalizeEdition(value) {
  const v = String(value || "").trim().toLowerCase();
  return VALID_EDITIONS.has(v) ? v : "";
}

function savedEdition() {
  try { return normalizeEdition(sessionStorage.getItem(EDITION_KEY)) || normalizeEdition(localStorage.getItem(EDITION_KEY)); }
  catch { return ""; }
}

function saveEdition(value) {
  const edition = normalizeEdition(value);
  if (!edition) return;
  try { sessionStorage.setItem(EDITION_KEY, edition); } catch {}
  try { localStorage.setItem(EDITION_KEY, edition); } catch {}
}

export function resolveAclEdition({ requireEdition = true, updateUrl = true } = {}) {
  const params = new URLSearchParams(location.search);
  let edition = normalizeEdition(params.get("edition")) || savedEdition();
  if (!edition) {
    if (requireEdition) location.replace(root + "pathways.html");
    return null;
  }
  saveEdition(edition);
  document.body.classList.remove("acl-theme-basic", "acl-theme-expert");
  document.body.classList.add(edition === "basic" ? "acl-theme-basic" : "acl-theme-expert");
  if (updateUrl && !normalizeEdition(params.get("edition"))) {
    const url = new URL(location.href);
    url.searchParams.set("edition", edition);
    history.replaceState({}, "", url);
  }
  return edition;
}

export function aclUrl(path, edition = resolveAclEdition({ requireEdition: false, updateUrl: false })) {
  const url = new URL(path, location.href);
  const normalized = normalizeEdition(edition);
  if (normalized) url.searchParams.set("edition", normalized);
  return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}

export async function requireSession(relativeLogin = "login.html") {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data?.session) {
    location.replace(root + relativeLogin);
    return null;
  }
  return data.session;
}

export async function loadProfile() {
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return null;
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const metadata = user.user_metadata || {};
  const displayName = data.display_name || data.full_name || metadata.display_name || metadata.full_name || metadata.name || data.username || user.email || "ACL User";
  return {
    ...data,
    id: data.id || user.id,
    email: user.email || data.email || "",
    display_name: displayName,
    full_name: data.full_name || metadata.full_name || metadata.name || metadata.display_name || displayName,
    avatar_url: data.avatar_url || metadata.avatar_url || metadata.picture || metadata.photo_url || ""
  };
}

export function renderUserChip(profile) {
  const chip = document.getElementById("userChip");
  if (!chip || !profile) return;
  const displayName = profile.display_name || profile.full_name || profile.username || "ACL User";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0] || "").join("").toUpperCase() || "ACL";
  chip.href = aclUrl(root + "profile.html");
  chip.innerHTML = profile.avatar_url
    ? `<img src="${profile.avatar_url}" alt=""><span>Signed in as <b>${displayName}</b></span>`
    : `<span class="avatar-placeholder">${initials}</span><span>Signed in as <b>${displayName}</b></span>`;
}

async function applyAdminStatus(profile) {
  if (!profile) return profile;
  try {
    const { data, error } = await supabaseClient.rpc("acl_is_admin");
    if (!error && data === true) {
      profile.role = "admin";
      profile.is_admin = true;
      return profile;
    }
  } catch {}
  profile.is_admin = profile.role === "admin" || profile.role === "administrator";
  return profile;
}

function renderAdminLink(profile) {
  if (!profile?.is_admin && profile?.role !== "admin") return;
  const nav = document.querySelector(".topbar nav");
  if (!nav || document.getElementById("adminNavLink")) return;
  const link = document.createElement("a");
  link.id = "adminNavLink";
  link.className = "nav-btn admin-nav-btn";
  link.href = root + "admin.html";
  link.textContent = "Admin";
  const signOutButton = [...nav.querySelectorAll("button")].find(btn => /sign out/i.test(btn.textContent));
  nav.insertBefore(link, signOutButton || null);
}

export async function protectAndRender(relativeLogin = "login.html") {
  const session = await requireSession(relativeLogin);
  if (!session) return null;
  let profile = await loadProfile();
  if (!profile) {
    await supabaseClient.auth.signOut();
    location.replace(root + relativeLogin);
    return null;
  }
  profile = await applyAdminStatus(profile);
  if (profile.account_status === "suspended") {
    await supabaseClient.auth.signOut();
    alert("This account has been suspended. Contact the ACL administrator.");
    location.replace(root + relativeLogin);
    return null;
  }
  window.aclCurrentProfile = profile;
  renderUserChip(profile);
  renderAdminLink(profile);
  return profile;
}

export async function signOut() {
  try { await supabaseClient.auth.signOut(); } catch (error) { console.warn(error); }
  try { sessionStorage.removeItem(EDITION_KEY); } catch {}
  location.replace(root + "login.html");
}

window.aclSignOut = signOut;
