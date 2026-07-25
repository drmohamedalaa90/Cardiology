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
  admin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V7z"/><path d="M8.5 10.5 10 14l2-2 2 2 1.5-3.5"/></svg>`,
  modules: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5c2.7-1.2 5.4-.9 8.5 1.1v12c-3.1-2-5.8-2.3-8.5-1.1z"/><path d="M20.5 5.5c-2.7-1.2-5.4-.9-8.5 1.1v12c3.1-2 5.8-2.3 8.5-1.1z"/></svg>`,
  progress: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19v-5M16 19V6M3 20h18"/><path d="m4 10 6-4 6 3 4-5"/></svg>`,
  analytics: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9h9A9 9 0 1 1 12 3z"/><path d="M15 3.5A7.5 7.5 0 0 1 20.5 9H15z"/></svg>`,
  contact: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>`,
  signout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></svg>`
};

function makeHeaderAction({ type, label, href, onClick }) {
  const action = document.createElement(href ? "a" : "button");
  action.className = `unified-icon-btn mobile-icon-${type}`;
  action.innerHTML = `<span class="mobile-icon-glyph">${iconSvgs[type]}</span><span class="mobile-icon-label">${label}</span>`;
  action.setAttribute("aria-label", label);
  action.title = label;
  if (href) action.href = href;
  else action.type = "button";

  // Desktop labels are always visible. On narrow screens, first tap expands and second activates.
  action.addEventListener("click", (event) => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      const expanded = action.classList.contains("is-expanded");
      if (!expanded) {
        event.preventDefault();
        event.stopPropagation();
        action.parentElement?.querySelectorAll(".is-expanded").forEach(btn => {
          if (btn !== action) btn.classList.remove("is-expanded");
        });
        action.classList.add("is-expanded");
        return;
      }
    }
    if (onClick) {
      event.preventDefault();
      onClick();
    }
  });
  return action;
}

let outsideHandlerInstalled = false;

function buildUnifiedHeader() {
  const topbar = document.querySelector(".topbar");
  const nav = topbar?.querySelector("nav");
  if (!topbar || !nav) return;

  topbar.classList.add("unified-topbar");
  const brand = topbar.querySelector(".brand-link, .brand");
  brand?.classList.add("unified-brand");

  let row = topbar.querySelector(".unified-account-row");
  if (!row) {
    row = document.createElement("div");
    row.className = "unified-account-row";
    topbar.appendChild(row);
  }
  row.replaceChildren();

  const chip = nav.querySelector("#userChip");
  const isAdmin = Boolean(nav.querySelector("#adminNavLink"));

  if (chip) {
    const identity = document.createElement("a");
    identity.className = "unified-signed-user";
    identity.href = chip.href || nestedPath("profile.html");
    const image = chip.querySelector("img")?.cloneNode(true) ||
                  chip.querySelector(".avatar-placeholder")?.cloneNode(true);
    if (image) identity.appendChild(image);

    const name = chip.querySelector(".user-name")?.textContent || "ACL User";
    const copy = document.createElement("span");
    copy.className = "unified-user-copy";
    copy.innerHTML = `<strong>${name}</strong><small>Edit profile ✎</small>`;
    identity.appendChild(copy);
    row.appendChild(identity);
  }

  const actions = document.createElement("div");
  actions.className = "unified-icon-actions";

  if (isAdmin) {
    actions.appendChild(makeHeaderAction({
      type: "admin",
      label: "Admin",
      href: nestedPath("admin.html")
    }));
  }

  actions.appendChild(makeHeaderAction({
    type: "modules",
    label: "Modules",
    href: nestedPath("modules.html")
  }));
  actions.appendChild(makeHeaderAction({
    type: "progress",
    label: "My Progress",
    href: nestedPath("progress.html")
  }));

  if (isAdmin) {
    actions.appendChild(makeHeaderAction({
      type: "analytics",
      label: "Analytics",
      href: nestedPath("admin-analytics.html")
    }));
  }

  actions.appendChild(makeHeaderAction({
    type: "contact",
    label: "Contact us",
    href: "mailto:drmohamedalaa90@gmail.com"
  }));
  actions.appendChild(makeHeaderAction({
    type: "signout",
    label: "Sign Out",
    onClick: () => window.aclSignOut?.()
  }));

  row.appendChild(actions);

  if (!outsideHandlerInstalled) {
    document.addEventListener("click", (event) => {
      document.querySelectorAll(".unified-icon-actions").forEach(group => {
        if (!group.contains(event.target)) {
          group.querySelectorAll(".is-expanded").forEach(btn => btn.classList.remove("is-expanded"));
        }
      });
    });
    outsideHandlerInstalled = true;
  }
}

function initializeNavigation() { buildUnifiedHeader(); }
document.addEventListener("DOMContentLoaded", initializeNavigation);
if (document.readyState !== "loading") initializeNavigation();
