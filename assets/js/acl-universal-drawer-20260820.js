/* =========================================================
   ACL UNIVERSAL DRAWER — SAFE REPLACEMENT
   Version: 2026-08-22
========================================================= */
(() => {
  "use strict";

  const VERSION = "2026-08-22-safe";
  const PAGE = (location.pathname.split("/").pop() || "home.html").toLowerCase();

  const params = new URLSearchParams(location.search);
  let edition = (params.get("edition") || "").toLowerCase();

  if (!["basic", "expert"].includes(edition)) {
    try {
      edition = (localStorage.getItem("aclSelectedEdition") || "expert").toLowerCase();
    } catch {
      edition = "expert";
    }
  }

  if (!["basic", "expert"].includes(edition)) edition = "expert";
  try { localStorage.setItem("aclSelectedEdition", edition); } catch {}

  const withEdition = (path) => {
    const u = new URL(path, location.href);
    u.searchParams.set("edition", edition);
    return `${u.pathname}${u.search}${u.hash}`;
  };

  const icons = {
    home: "⌂",
    modules: "▦",
    progress: "▤",
    study: "◆",
    challenge: "⚔",
    competitions: "🏆",
    friends: "♧",
    notifications: "🔔",
    settings: "⚙"
  };

  const isActive = (...pages) => pages.includes(PAGE);

  function navItem(key, label, href, pages = []) {
    return `
      <a class="acl-safe-drawer-link ${isActive(...pages) ? "is-active" : ""}"
         href="${withEdition(href)}">
        <span class="acl-safe-drawer-icon">${icons[key] || "•"}</span>
        <span>${label}</span>
      </a>`;
  }

  function ensureBackdrop() {
    let backdrop = document.getElementById("aclDrawerBackdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "aclDrawerBackdrop";
      backdrop.className = "acl-drawer-backdrop";
      backdrop.hidden = true;
      document.body.appendChild(backdrop);
    }
    return backdrop;
  }

  function ensureDrawer() {
    let drawer = document.getElementById("aclCommandDrawer");
    if (!drawer) {
      drawer = document.createElement("aside");
      drawer.id = "aclCommandDrawer";
      drawer.className = "acl-command-drawer";
      drawer.setAttribute("aria-label", "ACL navigation");
      document.body.appendChild(drawer);
    }

    drawer.dataset.safeDrawerVersion = VERSION;
    drawer.classList.add("acl-safe-drawer");

    drawer.innerHTML = `
      <div class="acl-safe-drawer-inner">
        <div class="acl-safe-profile">
          <div class="acl-safe-avatar">ACL</div>
          <div class="acl-safe-profile-copy">
            <strong id="aclSafeDrawerName">Member</strong>
            <a href="${withEdition("profile.html")}">Edit profile</a>
          </div>
        </div>

        <nav class="acl-safe-drawer-nav" aria-label="Main navigation">
          ${navItem("home", "Home", "home.html", ["home.html"])}
          ${navItem("modules", "Modules", "modules.html", ["modules.html"])}
          ${navItem("progress", "My Progress", "progress.html", ["progress.html"])}
          ${navItem("study", "Mind Maps & Flashcards", "study.html", ["study.html"])}
          ${navItem("challenge", "Challenge Friends", "challenge.html", ["challenge.html"])}
          ${navItem("competitions", "Formal ACL Competitions", "competitions.html", ["competitions.html", "competition-dashboard.html"])}
          ${navItem("friends", "Friends", "home.html#friends", ["friends.html"])}
          ${navItem("notifications", "Messages & Notifications", "notifications.html", ["notifications.html"])}
          ${navItem("settings", "Settings", "settings.html", ["settings.html"])}
        </nav>

        <div class="acl-safe-streak">
          <small>DAILY STREAK</small>
          <div><strong id="aclSafeStreak">—</strong><span>days</span></div>
        </div>

        <button id="aclSafeDrawerLogout" class="acl-safe-logout" type="button">
          <span>↪</span><span>Log out</span>
        </button>
      </div>
    `;

    return drawer;
  }

  function syncName() {
    const target = document.getElementById("aclSafeDrawerName");
    if (!target) return;

    const candidates = [
      document.getElementById("aclHeaderUserName"),
      document.getElementById("aclDrawerName"),
      document.getElementById("welcomeName")
    ];

    for (const el of candidates) {
      const text = (el?.textContent || "").trim();
      if (text && !/^member$/i.test(text) && !/^doctor$/i.test(text)) {
        target.textContent = text;
        break;
      }
    }
  }

  function syncStreak() {
    const target = document.getElementById("aclSafeStreak");
    if (!target) return;
    try {
      const value = Number(localStorage.getItem("acl_streak"));
      if (Number.isFinite(value) && value >= 0) target.textContent = String(value);
    } catch {}
  }

  function isMobile() {
    return window.matchMedia("(max-width: 820px)").matches;
  }

  function openDrawer() {
    if (!isMobile()) return;
    document.body.classList.add("acl-drawer-open");
    ensureBackdrop().hidden = false;
    document.getElementById("aclDrawerToggle")?.setAttribute("aria-expanded", "true");
  }

  function closeDrawer() {
    document.body.classList.remove("acl-drawer-open");
    ensureBackdrop().hidden = true;
    document.getElementById("aclDrawerToggle")?.setAttribute("aria-expanded", "false");
  }

  function bindDrawerControls() {
    const backdrop = ensureBackdrop();
    if (!backdrop.dataset.safeBound) {
      backdrop.dataset.safeBound = "1";
      backdrop.addEventListener("click", closeDrawer);
    }

    const toggle = document.getElementById("aclDrawerToggle");
    if (toggle && !toggle.dataset.safeBound) {
      toggle.dataset.safeBound = "1";
      toggle.addEventListener("click", (e) => {
        if (!isMobile()) return;
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.contains("acl-drawer-open") ? closeDrawer() : openDrawer();
      });
    }

    const mobileModules = document.getElementById("aclMobileModulesButton");
    if (mobileModules && !mobileModules.dataset.safeBound) {
      mobileModules.dataset.safeBound = "1";
      mobileModules.addEventListener("click", (e) => {
        e.preventDefault();
        openDrawer();
      });
    }

    const logout = document.getElementById("aclSafeDrawerLogout");
    if (logout && !logout.dataset.safeBound) {
      logout.dataset.safeBound = "1";
      logout.addEventListener("click", async () => {
        try {
          if (window.supabaseClient?.auth) await window.supabaseClient.auth.signOut();
        } catch {}
        location.href = "login.html";
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    }, { passive: true });

    window.addEventListener("resize", () => {
      if (!isMobile()) closeDrawer();
    }, { passive: true });
  }

  function init() {
    document.body.classList.add("acl-safe-drawer-enabled");
    ensureDrawer();
    bindDrawerControls();
    syncName();
    syncStreak();
    setTimeout(syncName, 500);
    setTimeout(syncName, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
