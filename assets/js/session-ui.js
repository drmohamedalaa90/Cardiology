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

function nestedPath(file) {
  return location.pathname.includes("/modules/") ? `../../${file}` : file;
}

export function renderUserChip(profile) {
  const chip = document.getElementById("userChip");
  if (!chip || !profile) return;
  const initials = (profile.full_name || "ACL").split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase();
  chip.href = nestedPath("profile.html");
  chip.innerHTML = profile.avatar_url
    ? `<img src="${profile.avatar_url}" alt=""><span class="user-chip-copy"><span class="user-name">${profile.full_name || "ACL User"}</span><span class="edit-profile-link">/ Edit profile</span></span>`
    : `<span class="avatar-placeholder">${initials}</span><span class="user-chip-copy"><span class="user-name">${profile.full_name || "ACL User"}</span><span class="edit-profile-link">/ Edit profile</span></span>`;

  const nav = chip.closest("nav");
  if (nav && !nav.querySelector(".contact-nav-link")) {
    const contact = document.createElement("a");
    contact.className = "nav-btn contact-nav-link";
    contact.href = "mailto:drmohamedalaa90@gmail.com";
    contact.textContent = "Contact us";
    nav.insertBefore(contact, chip);
  }
  buildUnifiedHeader();
}

function renderAdminLink(profile) {
  if (profile?.role !== "admin") return;
  const nav = document.querySelector(".topbar nav");
  if (!nav || document.getElementById("adminNavLink")) return;
  const link = document.createElement("a");
  link.id = "adminNavLink";
  link.className = "nav-btn admin-nav-btn";
  link.href = nestedPath("admin.html");
  link.textContent = "Admin";
  nav.prepend(link);
  buildUnifiedHeader();
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
  window.location.replace(nestedPath("login.html"));
}
window.aclSignOut = signOut;

const iconSvgs = {
  contact: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 7l8 6 8-6"/></svg>`,
  modules: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/></svg>`,
  progress: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7"/><path d="M3 19h18"/></svg>`,
  admin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V7z"/><path d="M9.5 12.5 11 14l3.5-4"/></svg>`,
  signout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.5 3.4-7 8-7s7.3 2.5 8 7"/></svg>`
};

function navIconFor(element) {
  const label = (element.textContent || "").trim().toLowerCase();
  const href = (element.getAttribute?.("href") || "").toLowerCase();
  if (element.classList?.contains("contact-nav-link") || href.startsWith("mailto:")) return "contact";
  if (href.includes("modules")) return "modules";
  if (href.includes("progress")) return "progress";
  if (href.includes("admin")) return "admin";
  if (href.includes("profile") || element.classList?.contains("user-chip")) return "profile";
  if (label.includes("sign out")) return "signout";
  return "modules";
}

function labelFor(type) {
  return ({ profile:"Edit profile", modules:"Modules", progress:"My Progress", admin:"Admin", contact:"Contact us", signout:"Sign out" })[type] || "Open";
}

let outsideHandlerInstalled = false;
function buildUnifiedHeader() {
  const topbar = document.querySelector(".topbar");
  const nav = topbar?.querySelector("nav");
  if (!topbar || !nav) return;

  topbar.classList.add("unified-topbar");
  const brand = topbar.querySelector(".brand-link, .brand");
  brand?.classList.add("unified-brand");

  let row = topbar.querySelector(".mobile-account-row");
  if (!row) {
    row = document.createElement("div");
    row.className = "mobile-account-row unified-account-row";
    topbar.appendChild(row);
  }
  row.innerHTML = "";

  const chip = nav.querySelector("#userChip");
  if (chip) {
    const identity = document.createElement("a");
    identity.className = "mobile-signed-user unified-signed-user";
    identity.href = chip.href || nestedPath("profile.html");
    const image = chip.querySelector("img")?.cloneNode(true) || chip.querySelector(".avatar-placeholder")?.cloneNode(true);
    if (image) identity.appendChild(image);
    const copy = document.createElement("span");
    copy.className = "unified-user-copy";
    copy.innerHTML = `<strong>${chip.querySelector(".user-name")?.textContent || "ACL User"}</strong><small>Signed in</small>`;
    identity.appendChild(copy);
    row.appendChild(identity);
  }

  const actions = document.createElement("div");
  actions.className = "mobile-icon-actions unified-icon-actions";
  const order = ["admin", "profile", "modules", "progress", "contact", "signout"];
  const sources = [...nav.children].filter(el => el.matches?.("a,button"));

  const collapseOthers = (except) => {
    actions.querySelectorAll(".mobile-icon-btn.is-expanded").forEach(btn => {
      if (btn !== except) btn.classList.remove("is-expanded");
    });
  };

  order.forEach(type => {
    const source = sources.find(el => navIconFor(el) === type);
    if (!source) return;
    const action = document.createElement(source.tagName === "A" ? "a" : "button");
    const label = labelFor(type);
    action.className = `mobile-icon-btn unified-icon-btn mobile-icon-${type}`;
    action.innerHTML = `<span class="mobile-icon-glyph">${iconSvgs[type]}</span><span class="mobile-icon-label">${label}</span>`;
    action.setAttribute("aria-label", label);
    action.title = `${label}: first click shows the label, second click opens`;
    if (source.tagName === "A") action.href = source.href;
    else action.type = "button";

    action.addEventListener("click", (event) => {
      const expanded = action.classList.contains("is-expanded");
      if (!expanded) {
        event.preventDefault();
        event.stopPropagation();
        collapseOthers(action);
        action.classList.add("is-expanded");
        return;
      }
      event.preventDefault();
      if (source.tagName === "A") window.location.href = source.href;
      else window.aclSignOut?.();
    });
    actions.appendChild(action);
  });

  row.appendChild(actions);
  if (!outsideHandlerInstalled) {
    document.addEventListener("click", (event) => {
      document.querySelectorAll(".unified-icon-actions").forEach(group => {
        if (!group.contains(event.target)) group.querySelectorAll(".is-expanded").forEach(btn => btn.classList.remove("is-expanded"));
      });
    });
    outsideHandlerInstalled = true;
  }
}

function initializeNavigation() { buildUnifiedHeader(); }
document.addEventListener("DOMContentLoaded", initializeNavigation);
window.addEventListener("resize", initializeNavigation);
if (document.readyState !== "loading") initializeNavigation();
