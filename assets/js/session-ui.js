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
  if (!(profile?.is_admin || profile?.role === "admin" || profile?.role === "administrator")) return;
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

  // Resolve administrator status from the secure database RPC as the source of truth.
  // This also normalizes older profile rows whose role value may not literally be "admin".
  try {
    const { data: rpcAdmin, error: rpcAdminError } = await supabaseClient.rpc("acl_is_admin");
    if (!rpcAdminError && rpcAdmin === true) {
      profile.role = "admin";
      profile.is_admin = true;
    } else {
      profile.is_admin = profile?.role === "admin" || profile?.role === "administrator";
      if (profile.is_admin) profile.role = "admin";
    }
  } catch {
    profile.is_admin = profile?.role === "admin" || profile?.role === "administrator";
    if (profile.is_admin) profile.role = "admin";
  }

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
  admin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V7z"/><path d="m9 12 2 2 4-4"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>`,
  modules: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  progress: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19v-5M16 19V6M3 20h18"/></svg>`,
  contact: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>`,
  signout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></svg>`
};

function createCompactAction({ type, label, href, action }) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `compact-header-action compact-${type}`;
  element.setAttribute("aria-label", label);
  element.innerHTML = `
    <span class="compact-action-icon">${iconSvgs[type]}</span>
    <span class="compact-action-label">${label}</span>
  `;

  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const expanded = element.classList.contains("is-expanded");
    if (!expanded) {
      document.querySelectorAll(".compact-header-action.is-expanded").forEach((item) => {
        if (item !== element) item.classList.remove("is-expanded");
      });
      element.classList.add("is-expanded");
      return;
    }

    if (typeof action === "function") {
      action();
      return;
    }

    if (href) {
      window.location.assign(href);
    }
  });

  return element;
}

let compactOutsideHandlerBound = false;

function buildUnifiedHeader() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  topbar.classList.add("compact-two-row-header");

  const brand = topbar.querySelector(".brand-link, .brand");
  if (brand) brand.classList.add("compact-header-brand");

  const oldNav = topbar.querySelector("nav");
  const profile = window.aclCurrentProfile || null;
  const isAdmin = Boolean(
    profile?.is_admin ||
    profile?.role === "admin" ||
    profile?.role === "administrator" ||
    oldNav?.querySelector("#adminNavLink")
  );

  let secondRow = topbar.querySelector(".compact-header-second-row");
  if (!secondRow) {
    secondRow = document.createElement("div");
    secondRow.className = "compact-header-second-row";
    topbar.appendChild(secondRow);
  }
  secondRow.replaceChildren();

  const identity = document.createElement("div");
  identity.className = "compact-user-identity";
  identity.setAttribute("aria-label", "Signed-in user");

  const avatar = document.createElement("div");
  avatar.className = "compact-user-avatar";
  const avatarUrl = profile?.avatar_url || profile?.photo_url || "";
  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = "";
    avatar.appendChild(img);
  } else {
    avatar.textContent = (profile?.full_name || profile?.username || "U").trim().charAt(0).toUpperCase();
  }

  const identityText = document.createElement("div");
  identityText.className = "compact-user-text";
  identityText.innerHTML = `
    <strong>${profile?.full_name || profile?.username || "Signed-in user"}</strong>
    <span>Signed in</span>
  `;

  identity.appendChild(avatar);
  identity.appendChild(identityText);
  secondRow.appendChild(identity);

  const actions = document.createElement("div");
  actions.className = "compact-header-actions";

  if (isAdmin) {
    actions.appendChild(createCompactAction({
      type: "admin",
      label: "Admin",
      href: nestedPath("admin.html")
    }));
  }

  actions.appendChild(createCompactAction({
    type: "profile",
    label: "Edit profile",
    href: nestedPath("profile.html")
  }));

  actions.appendChild(createCompactAction({
    type: "modules",
    label: "Modules",
    href: nestedPath("modules.html")
  }));

  actions.appendChild(createCompactAction({
    type: "progress",
    label: "My Progress",
    href: nestedPath("progress.html")
  }));

  actions.appendChild(createCompactAction({
    type: "contact",
    label: "Contact us",
    href: "mailto:drmohamedalaa90@gmail.com"
  }));

  actions.appendChild(createCompactAction({
    type: "signout",
    label: "Sign out",
    action: () => {
      if (typeof window.aclSignOut === "function") {
        window.aclSignOut();
      } else {
        window.location.assign(nestedPath("login.html"));
      }
    }
  }));

  secondRow.appendChild(actions);

  if (oldNav) oldNav.style.display = "none";

  if (!compactOutsideHandlerBound) {
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".compact-header-action")) {
        document.querySelectorAll(".compact-header-action.is-expanded").forEach((item) => {
          item.classList.remove("is-expanded");
        });
      }
    });
    compactOutsideHandlerBound = true;
  }
}

function initializeNavigation() {
  buildUnifiedHeader();
}

document.addEventListener("DOMContentLoaded", initializeNavigation);
if (document.readyState !== "loading") initializeNavigation();
