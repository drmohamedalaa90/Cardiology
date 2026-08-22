import { supabaseClient } from "./supabase-client.js";

function aclWithTimeout(promise, ms, label = "Request") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error(`${label} timed out`)),
      ms
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

function profileFallbackFromUser(user) {
  if (!user) return null;
  const m = user.user_metadata || {};
  const displayName =
    m.display_name ||
    m.full_name ||
    m.name ||
    user.email?.split("@")[0] ||
    "ACL User";

  return {
    id: user.id,
    email: user.email || "",
    display_name: displayName,
    full_name: m.full_name || m.name || displayName,
    avatar_url: m.avatar_url || m.picture || "",
    role: m.role || "member",
    account_status: "active",
    __auth_fallback: true
  };
}

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

/* Permanent product rename: Alexandria Cardiology League -> Cardiology League */
const OLD_BRAND = "Alexandria Cardiology League";
const OLD_BRAND_UPPER = "ALEXANDRIA CARDIOLOGY LEAGUE";
const NEW_BRAND = "Cardiology League";
const NEW_BRAND_UPPER = "CARDIOLOGY LEAGUE";
function renameBrandText(value) {
  return String(value || "")
    .replaceAll(OLD_BRAND_UPPER, NEW_BRAND_UPPER)
    .replaceAll(OLD_BRAND, NEW_BRAND);
}
function applyBrandRename(scope = document) {
  if (document.title) document.title = renameBrandText(document.title);
  const rootNode = scope?.nodeType ? scope : document;
  if (rootNode.nodeType === Node.TEXT_NODE) {
    const next = renameBrandText(rootNode.nodeValue);
    if (next !== rootNode.nodeValue) rootNode.nodeValue = next;
    return;
  }
  if (rootNode.nodeType !== Node.ELEMENT_NODE && rootNode !== document) return;
  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const next = renameBrandText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  const elements = rootNode === document ? document.querySelectorAll("*") : [rootNode, ...rootNode.querySelectorAll("*")];
  for (const el of elements) {
    for (const attr of ["aria-label", "alt", "title", "placeholder"]) {
      if (!el.hasAttribute?.(attr)) continue;
      const current = el.getAttribute(attr);
      const next = renameBrandText(current);
      if (next !== current) el.setAttribute(attr, next);
    }
  }
}
applyBrandRename(document);
const brandObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "characterData") applyBrandRename(mutation.target);
    for (const node of mutation.addedNodes || []) applyBrandRename(node);
  }
  if (document.title) document.title = renameBrandText(document.title);
});
brandObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
document.addEventListener("DOMContentLoaded", () => applyBrandRename(document), { once: true });
window.addEventListener("load", () => applyBrandRename(document), { once: true });

if (pageName !== "home.html" && !document.querySelector('link[data-acl-page-polish]')) {
  const polish = document.createElement('link');
  polish.rel = 'stylesheet';
  polish.dataset.aclPagePolish = 'true';
  polish.href = root + 'assets/css/page-polish-20260820.css?v=2';
  document.head.appendChild(polish);
}

if (!nested && !shellExcludedPages.has(pageName) && !document.getElementById("aclSharedShell")) {
  try {
    await import("./acl-shared-shell.js?v=3.0.1");
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
  try {
    const { data, error } = await aclWithTimeout(
      supabaseClient.auth.getSession(),
      6000,
      "Session restoration"
    );

    if (error || !data?.session?.user) {
      location.replace(root + relativeLogin);
      return null;
    }

    return data.session;
  } catch (error) {
    console.warn("ACL session restoration:", error);
    location.replace(root + relativeLogin);
    return null;
  }
}

export async function loadProfile() {
  let user = null;

  try {
    const { data: sessionData, error: sessionError } =
      await aclWithTimeout(
        supabaseClient.auth.getSession(),
        6000,
        "Session restoration"
      );

    if (sessionError) throw sessionError;

    user = sessionData?.session?.user || null;
    if (!user) return null;

    try {
      const { data, error } = await aclWithTimeout(
        supabaseClient
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),
        5000,
        "Profile loading"
      );

      if (!error && data) {
        return {
          ...data,
          id: data.id || user.id,
          email: user.email || data.email || "",
          display_name:
            data.display_name ||
            data.full_name ||
            user.user_metadata?.display_name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "ACL User",
          avatar_url:
            data.avatar_url ||
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            ""
        };
      }

      if (error) console.warn("ACL profile fallback:", error);
    } catch (profileError) {
      console.warn("ACL profile timeout/fallback:", profileError);
    }

    return profileFallbackFromUser(user);
  } catch (error) {
    console.warn("ACL loadProfile:", error);
    return profileFallbackFromUser(user);
  }
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
  applyBrandRename(document);
  return profile;
}

export async function signOut() {
  try { await supabaseClient.auth.signOut(); } catch (error) { console.warn(error); }
  try { sessionStorage.removeItem(EDITION_KEY); } catch {}
  location.replace(root + "login.html");
}

window.aclSignOut = signOut;
