import { supabaseClient } from "./supabase-client.js";

/* =========================================================
   ACL COMMAND CENTER — DRAWER + PROFILE + MODULE SYNC
   2026-08-22 FIX
   Key repair:
   - The drawer no longer depends on #modules cards existing.
   - On Home / Progress / Challenges / etc, it loads module
     names directly from Supabase.
========================================================= */

const body = document.body;
body.classList.add("acl-profile-pending");
body.classList.remove("acl-profile-ready");

const backdrop = document.getElementById("aclDrawerBackdrop");
const toggle = document.getElementById("aclDrawerToggle");
const isMobile = () => matchMedia("(max-width:820px)").matches;

function edition() {
  const q = new URLSearchParams(location.search).get("edition");
  let saved = null;

  try {
    saved =
      sessionStorage.getItem("aclSelectedEdition") ||
      localStorage.getItem("aclSelectedEdition");
  } catch {}

  const value = String(q || saved || "expert").toLowerCase();
  return value === "basic" ? "basic" : "expert";
}

const activeEdition = edition();

try {
  sessionStorage.setItem("aclSelectedEdition", activeEdition);
} catch {}

try {
  localStorage.setItem("aclSelectedEdition", activeEdition);
} catch {}

const headerEdition = document.getElementById("aclHeaderEdition");
if (headerEdition) {
  headerEdition.textContent =
    activeEdition === "basic"
      ? "THE BASIC EDITION"
      : "THE EXPERT EDITION";
}

const welcomeEyebrow = document.getElementById("aclWelcomeEyebrow");
if (welcomeEyebrow) {
  welcomeEyebrow.textContent =
    activeEdition === "basic"
      ? "ACL BASIC EDITION"
      : "ACL EXPERT EDITION";
}

document.querySelectorAll("[data-edition-link]").forEach(a => {
  a.classList.toggle(
    "is-selected",
    a.dataset.editionLink === activeEdition
  );
});

/* =========================================================
   DRAWER OPEN / CLOSE
========================================================= */

function openDrawer() {
  if (isMobile()) {
    body.classList.add("drawer-open");
    if (backdrop) backdrop.hidden = false;
  } else {
    body.classList.remove("drawer-collapsed");
  }

  toggle?.setAttribute("aria-expanded", "true");
}

function closeDrawer() {
  if (isMobile()) {
    body.classList.remove("drawer-open");
    if (backdrop) backdrop.hidden = true;
  } else {
    body.classList.add("drawer-collapsed");
  }

  toggle?.setAttribute("aria-expanded", "false");
}

toggle?.addEventListener("click", () => {
  if (isMobile()) {
    body.classList.contains("drawer-open")
      ? closeDrawer()
      : openDrawer();
  } else {
    body.classList.contains("drawer-collapsed")
      ? openDrawer()
      : closeDrawer();
  }
});

backdrop?.addEventListener("click", closeDrawer);

document
  .getElementById("aclMobileModulesButton")
  ?.addEventListener("click", openDrawer);

window.addEventListener(
  "resize",
  () => {
    if (!isMobile()) {
      body.classList.remove("drawer-open");
      if (backdrop) backdrop.hidden = true;
    }
  },
  { passive: true }
);

document.querySelectorAll("[data-collapse-target]").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(
      btn.dataset.collapseTarget
    );

    if (!target) return;

    const open = target.hidden;

    target.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));

    const ch = btn.querySelector(".acl-chevron");
    if (ch) ch.textContent = open ? "⌄" : "›";
  });
});

/* =========================================================
   AUTH / PROFILE
========================================================= */

async function signOut() {
  try {
    await supabaseClient.auth.signOut();
  } catch (e) {
    console.warn(e);
  }

  location.replace("login.html");
}

document
  .getElementById("aclHeaderLogout")
  ?.addEventListener("click", signOut);

document
  .getElementById("aclDrawerLogout")
  ?.addEventListener("click", signOut);

const chooseName = (p, u) =>
  p?.display_name ||
  p?.full_name ||
  p?.name ||
  u?.user_metadata?.display_name ||
  u?.user_metadata?.full_name ||
  u?.email?.split("@")[0] ||
  "Member";

const choosePhoto = (p, u) =>
  p?.avatar_url ||
  p?.photo_url ||
  p?.profile_photo_url ||
  u?.user_metadata?.avatar_url ||
  u?.user_metadata?.picture ||
  "";

async function withTimeout(promise, ms, label) {
  let timer = null;

  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error(`${label} timed out`)),
      ms
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

async function loadProfileIntoShell() {
  try {
    const {
      data: { session },
      error: sessionError
    } = await withTimeout(
      supabaseClient.auth.getSession(),
      6000,
      "Session restoration"
    );

    if (sessionError) throw sessionError;

    if (!session?.user) {
      location.replace("login.html");
      return null;
    }

    const u = session.user;
    let p = null;

    try {
      const profileResult = await withTimeout(
        supabaseClient
          .from("profiles")
          .select("*")
          .eq("id", u.id)
          .maybeSingle(),
        6000,
        "Profile"
      );

      if (!profileResult.error) {
        p = profileResult.data;
      }
    } catch (profileError) {
      console.warn(
        "ACL profile lookup skipped",
        profileError
      );
    }

    const name = chooseName(p, u);
    const photo = choosePhoto(p, u);

    [
      "aclHeaderUserName",
      "aclDrawerName",
      "aclWelcomeName"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = name;
    });

    const av = document.getElementById("aclDrawerAvatar");

    if (av) {
      if (photo) {
        const img = document.createElement("img");
        img.src = photo;
        img.alt = "";
        av.replaceChildren(img);
      } else {
        av.textContent =
          name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(x => x[0])
            .join("")
            .toUpperCase() || "ACL";
      }
    }

    body.classList.remove("acl-profile-pending");
    body.classList.add("acl-profile-ready");

    return session;
  } catch (e) {
    console.warn("ACL shell profile", e);
    location.replace("login.html");
    return null;
  }
}

/* =========================================================
   MODULE FAMILY HELPERS
========================================================= */

function familyFromText(value = "") {
  const t = String(value).toLowerCase();

  if (/ecg|rhythm|electrocard/.test(t)) {
    return "ecg";
  }

  if (/echo|echocardiograph|imaging|cmr|cardiac mri/.test(t)) {
    return "echo";
  }

  if (
    /pci|tavi|mitral|tricuspid|left main|cto|circulatory|intervention/.test(t)
  ) {
    return "interventions";
  }

  return "basic";
}

function rowFamily(moduleRow) {
  return familyFromText(
    [
      moduleRow?.title,
      moduleRow?.category,
      moduleRow?.slug
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function rowIsLocked(moduleRow) {
  const status = String(
    moduleRow?.status || ""
  ).toLowerCase();

  return (
    status === "draft" ||
    status === "coming_soon" ||
    !moduleRow?.launch_path
  );
}

function moduleHubHref(moduleRow) {
  if (!moduleRow?.id) return "#";

  const p = new URLSearchParams({
    edition: activeEdition,
    module: String(moduleRow.id)
  });

  if (moduleRow.slug) {
    p.set("slug", String(moduleRow.slug));
  }

  return `module-hub.html?${p.toString()}`;
}

function drawerHosts() {
  return {
    basic: document.querySelector(
      '[data-module-family="basic"]'
    ),
    ecg: document.querySelector(
      '[data-module-family="ecg"]'
    ),
    echo: document.querySelector(
      '[data-module-family="echo"]'
    ),
    interventions: document.querySelector(
      '[data-module-family="interventions"]'
    )
  };
}

function setDrawerMessage(message) {
  const hosts = drawerHosts();

  Object.values(hosts).forEach(host => {
    if (!host) return;
    host.innerHTML = "";

    const span = document.createElement("span");
    span.className = "acl-tree-empty";
    span.textContent = message;

    host.appendChild(span);
  });
}

function renderDrawerRows(rows) {
  const buckets = {
    basic: [],
    ecg: [],
    echo: [],
    interventions: []
  };

  rows.forEach(row => {
    buckets[rowFamily(row)].push(row);
  });

  const hosts = drawerHosts();

  Object.entries(buckets).forEach(([key, list]) => {
    const host = hosts[key];
    if (!host) return;

    host.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("span");
      empty.className = "acl-tree-empty";
      empty.textContent = "No modules in this edition yet";
      host.appendChild(empty);
      return;
    }

    list.forEach(row => {
      const a = document.createElement("a");
      a.textContent =
        String(row.title || "ACL module").trim();

      const locked = rowIsLocked(row);

      if (locked) {
        a.href = "#";
        a.classList.add("is-locked");
        a.setAttribute("aria-disabled", "true");

        a.addEventListener("click", event => {
          event.preventDefault();
        });
      } else {
        a.href = moduleHubHref(row);
      }

      host.appendChild(a);
    });
  });
}

/* =========================================================
   DIRECT DRAWER MODULE LOADER
   This is the actual fix for Home / Progress / Challenges.
========================================================= */

async function loadDrawerCatalogDirect() {
  /*
   * modules.html owns its own module-card renderer.
   * On that page, keep the existing DOM synchronization below.
   */
  if (document.getElementById("modules")) {
    return;
  }

  const hasAnyDrawerHost =
    Object.values(drawerHosts()).some(Boolean);

  if (!hasAnyDrawerHost) {
    return;
  }

  try {
    const result = await withTimeout(
      supabaseClient
        .from("modules")
        .select(
          "id,title,slug,category,status,launch_path,display_order,edition"
        )
        .eq("edition", activeEdition)
        .order("display_order", { ascending: true })
        .order("title", { ascending: true }),
      8000,
      "Drawer modules"
    );

    if (result.error) {
      throw result.error;
    }

    const rows = Array.isArray(result.data)
      ? result.data
      : [];

    renderDrawerRows(rows);
  } catch (error) {
    console.error(
      "ACL DRAWER MODULE LOAD ERROR",
      error
    );

    setDrawerMessage("Could not load modules");
  }
}

/* =========================================================
   EXISTING MODULE-CARD SYNC FOR modules.html
========================================================= */

function family(title, card) {
  const t = String(title || "").toLowerCase();

  if (
    /ecg|rhythm|electrocard/.test(t) ||
    card.classList.contains("module-ecg")
  ) {
    return "ecg";
  }

  if (
    /echo|echocardiograph/.test(t) ||
    card.classList.contains("module-imaging")
  ) {
    return "echo";
  }

  if (
    /pci|tavi|mitral|tricuspid|left main|cto|circulatory|intervention/.test(t) ||
    card.classList.contains("module-intervention")
  ) {
    return "interventions";
  }

  return "basic";
}

function rawStatus(card) {
  return (
    card.querySelector(
      ".module-progress-line span"
    )?.textContent || ""
  )
    .trim()
    .toLowerCase();
}

function rawScore(card) {
  return (
    card.querySelector(
      ".module-progress-line strong"
    )?.textContent || ""
  ).trim();
}

function titleOf(card) {
  return (
    card.querySelector("h2")?.textContent?.trim() ||
    "ACL module"
  );
}

function actionOf(card) {
  return card.querySelector(".module-action");
}

function isLocked(card) {
  const a = actionOf(card);

  return (
    card.classList.contains("locked") ||
    card.classList.contains("coming") ||
    a?.classList.contains("disabled")
  );
}

function inferPercent(card) {
  const txt = [
    rawScore(card),
    rawStatus(card),
    card.textContent
  ].join(" ");

  const m = txt.match(
    /(\d+(?:\.\d+)?)\s*%/
  );

  if (m) {
    return Math.max(
      0,
      Math.min(100, Number(m[1]))
    );
  }

  if (rawStatus(card).includes("completed")) {
    return 100;
  }

  if (rawStatus(card).includes("progress")) {
    return 55;
  }

  return 0;
}

function inferMeta(card) {
  const txt =
    card.textContent.replace(/\s+/g, " ");

  const frac = txt.match(
    /(\d+)\s*\/\s*(\d+)/
  );

  if (frac) {
    return `${frac[1]} / ${frac[2]} questions`;
  }

  const st = rawStatus(card);

  return st.includes("completed")
    ? "Completed"
    : st.includes("progress")
      ? "In progress"
      : "Not started";
}

function visualClass(card) {
  const f = family(titleOf(card), card);

  return f === "interventions"
    ? "is-intervention"
    : f === "echo"
      ? "is-echo"
      : "";
}

function iconFor(card) {
  const f = family(titleOf(card), card);

  if (f === "interventions") return "♧";
  if (f === "echo") return "◉";
  if (f === "ecg") return "〽";
  return "♡";
}

function buildDrawer(cards) {
  const buckets = {
    basic: [],
    ecg: [],
    echo: [],
    interventions: []
  };

  cards.forEach(c => {
    buckets[
      family(titleOf(c), c)
    ].push(c);
  });

  Object.entries(buckets).forEach(
    ([key, list]) => {
      const host =
        document.querySelector(
          `[data-module-family="${key}"]`
        );

      if (!host) return;

      host.innerHTML = "";

      if (!list.length) {
        host.innerHTML =
          '<span class="acl-tree-empty">No modules in this edition yet</span>';
        return;
      }

      list.forEach(c => {
        const a =
          document.createElement("a");

        a.textContent = titleOf(c);

        const act = actionOf(c);

        a.href =
          !isLocked(c) && act
            ? act.getAttribute("href")
            : "#";

        if (isLocked(c)) {
          a.classList.add("is-locked");
          a.addEventListener(
            "click",
            e => e.preventDefault()
          );
        }

        host.appendChild(a);
      });
    }
  );
}

function buildContinue(cards) {
  const host =
    document.getElementById(
      "aclContinueLearning"
    );

  if (!host) return;

  const prioritized = cards
    .filter(
      c =>
        rawStatus(c).includes("progress") ||
        rawStatus(c).includes("completed")
    )
    .slice(0, 3);

  const chosen =
    prioritized.length
      ? prioritized
      : cards
          .filter(c => !isLocked(c))
          .slice(0, 3);

  host.innerHTML = "";

  chosen.forEach(c => {
    const pct = inferPercent(c);
    const act = actionOf(c);
    const locked = isLocked(c);

    const art =
      document.createElement("article");

    art.className =
      `acl-continue-card ${visualClass(c)}`;

    art.innerHTML = `
      <div class="acl-continue-card-top">
        <div class="acl-continue-icon">${iconFor(c)}</div>
        <div class="acl-continue-copy">
          <h3>${titleOf(c)}</h3>
          <small>${rawStatus(c) || "Not started"}</small>
        </div>
        <strong class="acl-continue-percent">${pct}%</strong>
      </div>
      <div class="acl-continue-progress">
        <span style="width:${pct}%"></span>
      </div>
      <div class="acl-continue-meta">${inferMeta(c)}</div>
      <a
        href="${!locked && act ? act.getAttribute("href") : "#"}"
        ${locked ? 'aria-disabled="true" tabindex="-1"' : ""}
      >›</a>
    `;

    host.appendChild(art);
  });
}

function stats(cards) {
  let done = 0;
  let prog = 0;

  cards.forEach(c => {
    const s = rawStatus(c);

    if (s.includes("completed")) {
      done++;
    } else if (s.includes("progress")) {
      prog++;
    }
  });

  const eligible =
    cards.filter(
      c => !c.classList.contains("coming")
    ).length || 1;

  const set = (id, value) => {
    const e = document.getElementById(id);
    if (e) e.textContent = value;
  };

  set("aclStatCompleted", done);
  set("aclStatInProgress", prog);
  set(
    "aclStatOverall",
    Math.round((done / eligible) * 100) + "%"
  );
}

/* =========================================================
   SAFE MODULE SYNC
========================================================= */

let lastSignature = "";

function syncModulesIntoShell() {
  const cards = [
    ...document.querySelectorAll(
      "#modules .module-card"
    )
  ];

  if (!cards.length) {
    return false;
  }

  const signature = cards
    .map(
      c =>
        c.dataset.moduleId ||
        titleOf(c)
    )
    .join("|");

  if (signature === lastSignature) {
    return true;
  }

  lastSignature = signature;

  buildDrawer(cards);
  buildContinue(cards);
  stats(cards);

  return true;
}

function scheduleSafeSync() {
  const delays = [
    250,
    700,
    1500,
    3000,
    6000
  ];

  delays.forEach(ms => {
    setTimeout(() => {
      try {
        syncModulesIntoShell();
      } catch (e) {
        console.warn(
          "ACL shell sync skipped",
          e
        );
      }
    }, ms);
  });
}

document.addEventListener(
  "acl:modules-rendered",
  () => {
    try {
      syncModulesIntoShell();
    } catch (e) {
      console.warn(
        "ACL shell sync skipped",
        e
      );
    }
  }
);

/* =========================================================
   BOOT
========================================================= */

const profilePromise =
  loadProfileIntoShell();

profilePromise
  .then(session => {
    if (session) {
      return loadDrawerCatalogDirect();
    }
    return null;
  })
  .catch(error => {
    console.warn(
      "ACL drawer startup skipped",
      error
    );
  });

scheduleSafeSync();

document.addEventListener(
  "keydown",
  e => {
    if (
      e.key === "Escape" &&
      body.classList.contains("drawer-open")
    ) {
      closeDrawer();
    }
  }
);
