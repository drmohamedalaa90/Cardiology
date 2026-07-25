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
    ? `<img src="${profile.avatar_url}" alt=""><span class="user-chip-copy"><span class="user-name">${profile.full_name}</span><span class="edit-profile-link">/ Edit profile</span></span>`
    : `<span class="avatar-placeholder">${initials}</span><span class="user-chip-copy"><span class="user-name">${profile.full_name}</span><span class="edit-profile-link">/ Edit profile</span></span>`;

  const nav = chip.closest("nav");
  if (nav && !nav.querySelector(".contact-nav-link")) {
    const contact = document.createElement("a");
    contact.className = "nav-btn contact-nav-link";
    contact.href = "mailto:drmohamedalaa90@gmail.com";
    contact.textContent = "Contact us";
    nav.insertBefore(contact, chip);
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


const mobileIconSvgs = {
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
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


function mobileLabelFor(element) {
  const href = (element.getAttribute?.("href") || "").toLowerCase();
  const label = (element.textContent || "").trim();
  if (element.classList?.contains("user-chip") || href.includes("profile")) return "Edit profile";
  if (element.classList?.contains("contact-nav-link") || href.startsWith("mailto:")) return "Contact us";
  if (href.includes("modules")) return "Modules";
  if (href.includes("progress")) return "My Progress";
  if (label.toLowerCase().includes("sign out")) return "Sign Out";
  return label || "Open";
}

function buildMobileQuickActions(nav, topbar) {
  if (!nav || !topbar || topbar.querySelector(".mobile-quick-actions")) return;
  const quick = document.createElement("div");
  quick.className = "mobile-quick-actions";
  quick.setAttribute("aria-label", "Quick navigation");

  const wanted = ["profile", "modules", "progress", "contact", "signout"];
  const sourceItems = [...nav.children].filter((item) => item.matches?.("a,button"));

  wanted.forEach((type) => {
    const source = sourceItems.find((item) => navIconFor(item) === type);
    if (!source) return;
    const action = source.tagName === "A" ? document.createElement("a") : document.createElement("button");
    action.className = `mobile-quick-action mobile-quick-${type}`;
    action.innerHTML = `<span class="mobile-quick-icon">${mobileIconSvgs[type]}</span><span class="mobile-quick-label">${mobileLabelFor(source)}</span>`;
    action.setAttribute("aria-label", mobileLabelFor(source));
    action.title = mobileLabelFor(source);
    if (source.tagName === "A") action.href = source.href;
    else {
      action.type = "button";
      action.addEventListener("click", () => window.aclSignOut?.());
    }

    // First tap reveals and enlarges the label; a second tap performs the action.
    action.addEventListener("click", (event) => {
      if (!window.matchMedia("(max-width: 760px)").matches) return;
      if (!action.classList.contains("is-expanded")) {
        event.preventDefault();
        event.stopPropagation();
        quick.querySelectorAll(".is-expanded").forEach((item) => item.classList.remove("is-expanded"));
        action.classList.add("is-expanded");
        window.clearTimeout(action._collapseTimer);
        action._collapseTimer = window.setTimeout(() => action.classList.remove("is-expanded"), 1800);
      }
    }, true);
    quick.appendChild(action);
  });
  topbar.appendChild(quick);
}

function orderMobileDrawer(nav, drawerHead) {
  const items = [...nav.children].filter((item) => item !== drawerHead && item.matches?.("a,button"));
  const rank = { profile: 1, modules: 2, progress: 3, admin: 4, contact: 5, signout: 6 };
  items.sort((a,b) => (rank[navIconFor(a)] || 99) - (rank[navIconFor(b)] || 99));
  items.forEach((item) => nav.appendChild(item));
}

function decorateMobileNav(nav) {
  if (!nav || nav.dataset.mobileReady === "true") return;
  nav.dataset.mobileReady = "true";
  nav.id ||= "aclMobileNavigation";

  const drawerHead = document.createElement("div");
  drawerHead.className = "mobile-drawer-head";
  drawerHead.innerHTML = `<strong>ACL Navigation</strong><button type="button" class="mobile-drawer-close" aria-label="Close navigation">${mobileIconSvgs.close}</button>`;
  nav.prepend(drawerHead);

  [...nav.children].forEach((item) => {
    if (item === drawerHead || !item.matches("a,button")) return;
    if (!item.querySelector(".mobile-nav-icon")) {
      const icon = document.createElement("span");
      icon.className = "mobile-nav-icon";
      icon.innerHTML = mobileIconSvgs[navIconFor(item)];
      item.prepend(icon);
    }
  });

  orderMobileDrawer(nav, drawerHead);

  const topbar = nav.closest(".topbar");
  if (!topbar) return;
  buildMobileQuickActions(nav, topbar);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "mobile-menu-trigger";
  trigger.setAttribute("aria-label", "Open navigation");
  trigger.setAttribute("aria-controls", nav.id);
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = mobileIconSvgs.menu;
  topbar.appendChild(trigger);

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "mobile-nav-backdrop";
  backdrop.setAttribute("aria-label", "Close navigation");
  document.body.appendChild(backdrop);

  const setOpen = (open) => {
    document.body.classList.toggle("mobile-nav-open", open);
    trigger.setAttribute("aria-expanded", String(open));
  };

  trigger.addEventListener("click", () => setOpen(!document.body.classList.contains("mobile-nav-open")));
  backdrop.addEventListener("click", () => setOpen(false));
  drawerHead.querySelector("button").addEventListener("click", () => setOpen(false));
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a,button") && !event.target.closest(".mobile-drawer-close")) setOpen(false);
  });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") setOpen(false); });
}

function initializeMobileNavigation() {
  const nav = document.querySelector(".topbar nav");
  if (nav) decorateMobileNav(nav);
}

document.addEventListener("DOMContentLoaded", initializeMobileNavigation);
if (document.readyState !== "loading") initializeMobileNavigation();
