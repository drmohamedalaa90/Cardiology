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
  const metadata = user.user_metadata || {};
  return {
    ...data,
    email: user.email,
    full_name:
      data?.full_name ||
      metadata.full_name ||
      metadata.name ||
      metadata.display_name ||
      "",
    avatar_url:
      data?.avatar_url ||
      metadata.avatar_url ||
      metadata.picture ||
      metadata.photo_url ||
      ""
  };
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
  window.aclCurrentProfile = profile;
  renderUserChip(profile);
  renderAdminLink(profile);
  buildUnifiedHeader();
  return profile;
}

export async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.replace(nestedPath("login.html"));
}
window.aclSignOut = signOut;

const iconSvgs = {
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
  admin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V7z"/><path d="m9 12 2 2 4-4"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>`,
  modules: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  progress: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19v-5M16 19V6M3 20h18"/></svg>`,
  contact: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>`,
  signout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></svg>`
};

function createDrawerItem({ type, label, href, action, admin = false }) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = `acl-drawer-item${admin ? " acl-drawer-admin-item" : ""}`;
  item.innerHTML = `
    <span class="acl-drawer-item-icon">${iconSvgs[type]}</span>
    <span class="acl-drawer-item-label">${label}</span>
  `;
  item.addEventListener("click", () => {
    closeAclDrawer();
    if (typeof action === "function") {
      action();
    } else if (href) {
      window.location.assign(href);
    }
  });
  return item;
}

function openAclDrawer() {
  document.body.classList.add("acl-drawer-open");
  document.querySelector(".acl-side-drawer")?.setAttribute("aria-hidden", "false");
  document.querySelector(".acl-drawer-overlay")?.setAttribute("aria-hidden", "false");
}

function closeAclDrawer() {
  document.body.classList.remove("acl-drawer-open");
  document.querySelector(".acl-side-drawer")?.setAttribute("aria-hidden", "true");
  document.querySelector(".acl-drawer-overlay")?.setAttribute("aria-hidden", "true");
}

function buildUnifiedHeader() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  topbar.classList.add("acl-drawer-header");

  const brand = topbar.querySelector(".brand-link, .brand");
  if (brand) brand.classList.add("acl-drawer-brand");

  const oldNav = topbar.querySelector("nav");
  const profile = window.aclCurrentProfile || null;
  const isAdmin = Boolean(
    profile?.is_admin ||
    profile?.role === "admin" ||
    profile?.role === "administrator" ||
    oldNav?.querySelector("#adminNavLink")
  );

  topbar.querySelector(".compact-header-second-row")?.remove();
  topbar.querySelector(".acl-menu-button")?.remove();

  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "acl-menu-button";
  menuButton.setAttribute("aria-label", "Open navigation menu");
  menuButton.innerHTML = iconSvgs.menu;
  menuButton.addEventListener("click", openAclDrawer);
  topbar.appendChild(menuButton);

  oldNav?.setAttribute("hidden", "hidden");
  if (oldNav) oldNav.style.display = "none";

  document.querySelector(".acl-side-drawer")?.remove();
  document.querySelector(".acl-drawer-overlay")?.remove();

  const overlay = document.createElement("button");
  overlay.type = "button";
  overlay.className = "acl-drawer-overlay";
  overlay.setAttribute("aria-label", "Close navigation menu");
  overlay.setAttribute("aria-hidden", "true");
  overlay.addEventListener("click", closeAclDrawer);

  const drawer = document.createElement("aside");
  drawer.className = "acl-side-drawer";
  drawer.setAttribute("aria-hidden", "true");

  const drawerHeader = document.createElement("div");
  drawerHeader.className = "acl-drawer-top";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "acl-drawer-close";
  closeButton.setAttribute("aria-label", "Close navigation menu");
  closeButton.innerHTML = iconSvgs.close;
  closeButton.addEventListener("click", closeAclDrawer);

  const identity = document.createElement("div");
  identity.className = "acl-drawer-identity";

  const avatar = document.createElement("div");
  avatar.className = "acl-drawer-avatar";
  const candidateName =
    profile?.full_name ||
    profile?.display_name ||
    profile?.name ||
    profile?.username ||
    profile?.email ||
    "Signed-in user";

  const avatarUrl =
    profile?.avatar_url ||
    profile?.photo_url ||
    profile?.profile_photo_url ||
    profile?.image_url ||
    "";

  const initials = candidateName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "U";

  const showInitials = () => {
    avatar.replaceChildren();
    avatar.textContent = initials;
  };

  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = `${candidateName} profile photo`;
    img.addEventListener("error", showInitials, { once: true });
    avatar.appendChild(img);
  } else {
    showInitials();
  }

  const identityCopy = document.createElement("div");
  identityCopy.className = "acl-drawer-identity-copy";

  const nameElement = document.createElement("strong");
  nameElement.textContent = candidateName;

  const signedInElement = document.createElement("span");
  signedInElement.textContent = "Signed in";

  identityCopy.appendChild(nameElement);
  identityCopy.appendChild(signedInElement);

  identity.appendChild(avatar);
  identity.appendChild(identityCopy);

  drawerHeader.appendChild(identity);
  drawerHeader.appendChild(closeButton);

  const divider = document.createElement("div");
  divider.className = "acl-drawer-divider";

  const menu = document.createElement("nav");
  menu.className = "acl-drawer-menu";

  if (isAdmin) {
    menu.appendChild(createDrawerItem({
      type: "admin",
      label: "Admin",
      href: nestedPath("admin.html"),
      admin: true
    }));
  }

  menu.appendChild(createDrawerItem({
    type: "profile",
    label: "Edit profile",
    href: nestedPath("profile.html")
  }));

  menu.appendChild(createDrawerItem({
    type: "modules",
    label: "Modules",
    href: nestedPath("modules.html")
  }));

  menu.appendChild(createDrawerItem({
    type: "progress",
    label: "My Progress",
    href: nestedPath("progress.html")
  }));

  menu.appendChild(createDrawerItem({
    type: "contact",
    label: "Contact us",
    href: "mailto:drmohamedalaa90@gmail.com"
  }));

  menu.appendChild(createDrawerItem({
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

  drawer.appendChild(drawerHeader);
  drawer.appendChild(divider);
  drawer.appendChild(menu);

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAclDrawer();
  }, { once: false });
}

let aclHeaderHydrationPromise = null;

async function hydrateHeaderProfile() {
  if (window.aclCurrentProfile) return window.aclCurrentProfile;
  if (aclHeaderHydrationPromise) return aclHeaderHydrationPromise;

  aclHeaderHydrationPromise = (async () => {
    try {
      const profile = await loadProfile();
      if (!profile) return null;

      try {
        const { data: rpcAdmin, error: rpcAdminError } = await supabaseClient.rpc("acl_is_admin");
        if (!rpcAdminError && rpcAdmin === true) {
          profile.role = "admin";
          profile.is_admin = true;
        } else {
          profile.is_admin =
            profile?.role === "admin" ||
            profile?.role === "administrator";
        }
      } catch {
        profile.is_admin =
          profile?.role === "admin" ||
          profile?.role === "administrator";
      }

      window.aclCurrentProfile = profile;
      return profile;
    } catch (error) {
      console.warn("Could not hydrate header profile:", error);
      return null;
    }
  })();

  return aclHeaderHydrationPromise;
}

async function initializeNavigation() {
  await hydrateHeaderProfile();
  buildUnifiedHeader();
}

document.addEventListener("DOMContentLoaded", initializeNavigation);
if (document.readyState !== "loading") initializeNavigation();
