import { supabaseClient } from "./supabase-client.js";

const isNested = location.pathname.includes("/modules/");
const root = isNested ? "../../" : "";
const page = location.pathname.split("/").pop() || "modules.html";
const params = new URLSearchParams(location.search);

let savedEdition = "";
try {
  savedEdition = localStorage.getItem("aclSelectedEdition") || "";
} catch {}

const edition =
  String(params.get("edition") || savedEdition || "expert").toLowerCase() === "basic"
    ? "basic"
    : "expert";

try {
  localStorage.setItem("aclSelectedEdition", edition);
} catch {}

function addCss(href) {
  if (
    [...document.styleSheets].some(
      sheet =>
        sheet.href &&
        sheet.href.includes(href.split("?")[0])
    )
  ) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = root + href;
  document.head.appendChild(link);
}

addCss("assets/css/acl-command-center.css?v=20260822-unified");
addCss("assets/css/acl-shared-shell.css?v=2.0.0");
addCss("assets/css/brand-restoration-20260820.css?v=1");

document
  .querySelectorAll(
    "body > header.topbar, .settings-shell > header.topbar"
  )
  .forEach(el => el.remove());

document.body.classList.add(
  "acl-command-body",
  "acl-shared-page"
);

document.body.classList.toggle(
  "acl-theme-basic",
  edition === "basic"
);

document.body.classList.toggle(
  "acl-theme-expert",
  edition === "expert"
);

const main =
  document.querySelector("body > main");

if (main) {
  main.classList.add(
    "acl-command-main",
    "acl-shared-main"
  );
}

const active = name =>
  page === name
    ? " is-active"
    : "";

const withEdition = (
  name,
  forcedEdition = edition
) =>
  `${root}${name}?edition=${forcedEdition}`;

function currentModuleId() {
  return (
    params.get("module") ||
    params.get("module_id") ||
    ""
  );
}

function moduleFamily(module) {
  const title =
    String(module?.title || "").toLowerCase();

  const slug =
    String(module?.slug || "").toLowerCase();

  const combined =
    `${title} ${slug}`;

  if (
    /ecg|rhythm|electrocard/.test(combined)
  ) {
    return "ecg";
  }

  if (
    /echo|echocardiograph|imaging/.test(combined)
  ) {
    return "echo";
  }

  if (
    /pci|tavi|mitral|tricuspid|left main|cto|circulatory|intervention/.test(combined)
  ) {
    return "interventions";
  }

  return "basic";
}

function moduleHubUrl(module) {
  const p =
    new URLSearchParams({
      edition,
      module: String(module.id)
    });

  if (module.slug) {
    p.set(
      "slug",
      String(module.slug)
    );
  }

  return (
    root +
    `module-hub.html?${p.toString()}`
  );
}

const shell =
  document.createElement("div");

shell.id =
  "aclSharedShell";

shell.innerHTML = `
<header class="acl-command-header">
  <div class="acl-command-header-left">
    <button
      id="aclDrawerToggle"
      class="acl-command-menu"
      type="button"
      aria-label="Open navigation"
      aria-controls="aclCommandDrawer"
      aria-expanded="false"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <a
      class="acl-command-brand"
      href="${withEdition("modules.html")}"
    >
      <img
        src="${root}assets/images/acl-header-mark.svg"
        alt="Cardiology League"
        class="acl-command-brand-logo"
      >
      <span class="acl-command-brand-name">
        Cardiology League
      </span>
      <span class="acl-command-brand-separator">
        •
      </span>
      <strong id="aclHeaderEdition">
        ${
          edition === "basic"
            ? "THE BASIC EDITION"
            : "THE EXPERT EDITION"
        }
      </strong>
    </a>
  </div>

  <div class="acl-command-header-actions">
    <span
      id="aclHeaderUserName"
      class="acl-command-user-name"
    ></span>

    <a
      class="acl-command-icon-btn"
      href="${root}notifications.html?edition=${edition}"
      aria-label="Notifications"
      title="Notifications"
    >
      🔔
    </a>

    <a
      class="acl-command-icon-btn"
      href="${root}settings.html?edition=${edition}"
      aria-label="Settings"
      title="Settings"
    >
      ⚙
    </a>

    <button
      id="aclHeaderLogout"
      class="acl-command-icon-btn"
      type="button"
      aria-label="Log out"
      title="Log out"
    >
      ↪
    </button>
  </div>
</header>

<div
  id="aclDrawerBackdrop"
  class="acl-drawer-backdrop"
  hidden
></div>

<aside
  id="aclCommandDrawer"
  class="acl-command-drawer"
  aria-label="ACL navigation"
>
  <div class="acl-drawer-scroll">

    <section class="acl-drawer-profile">
      <div
        id="aclDrawerAvatar"
        class="acl-drawer-avatar"
      >
        <span></span>
      </div>

      <div class="acl-drawer-profile-copy">
        <strong id="aclDrawerName"></strong>

        <a
          href="${root}profile.html?edition=${edition}"
          class="acl-drawer-edit"
        >
          Edit profile
        </a>
      </div>
    </section>

    <nav class="acl-drawer-nav">

      <a
        class="acl-drawer-link${active("home.html")}"
        href="${root}home.html?edition=${edition}"
      >
        <span class="acl-nav-icon">⌂</span>
        <span>Home</span>
      </a>

      <a
        class="acl-drawer-link${active("progress.html")}"
        href="${root}progress.html?edition=${edition}"
      >
        <span class="acl-nav-icon">▤</span>
        <span>My Progress</span>
      </a>

      <section class="acl-nav-group">
        <button
          class="acl-nav-group-toggle"
          type="button"
          data-collapse-target="aclEditionMenu"
          aria-expanded="true"
        >
          <span>
            <span class="acl-nav-icon">⇄</span>
            Editions
          </span>

          <span class="acl-chevron">
            ⌄
          </span>
        </button>

        <div
          id="aclEditionMenu"
          class="acl-nav-group-content"
        >
          <a
            href="${withEdition("modules.html","basic")}"
            class="${
              edition === "basic"
                ? "is-selected"
                : ""
            }"
          >
            Basic Edition
          </a>

          <a
            href="${withEdition("modules.html","expert")}"
            class="${
              edition === "expert"
                ? "is-selected"
                : ""
            }"
          >
            Expert Edition
          </a>
        </div>
      </section>

      <section class="acl-nav-group">
        <button
          class="acl-nav-group-toggle"
          type="button"
          data-collapse-target="aclModulesMenu"
          aria-expanded="true"
        >
          <span>
            <span class="acl-nav-icon">▦</span>
            Modules
          </span>

          <span class="acl-chevron">
            ⌄
          </span>
        </button>

        <div
          id="aclModulesMenu"
          class="acl-nav-group-content acl-module-tree"
        >

          <section class="acl-module-family">
            <button
              class="acl-module-family-toggle"
              type="button"
              data-collapse-target="aclBasicModules"
              aria-expanded="true"
            >
              <span>
                GUIDELINES / GENERAL
              </span>

              <span class="acl-chevron">
                ⌄
              </span>
            </button>

            <div
              id="aclBasicModules"
              class="acl-module-family-items"
              data-module-family="basic"
            >
              <span class="acl-tree-loading">
                Loading modules…
              </span>
            </div>
          </section>

          <section class="acl-module-family">
            <button
              class="acl-module-family-toggle"
              type="button"
              data-collapse-target="aclEcgModules"
              aria-expanded="false"
            >
              <span>ECG</span>

              <span class="acl-chevron">
                ›
              </span>
            </button>

            <div
              id="aclEcgModules"
              class="acl-module-family-items"
              data-module-family="ecg"
              hidden
            ></div>
          </section>

          <section class="acl-module-family">
            <button
              class="acl-module-family-toggle"
              type="button"
              data-collapse-target="aclEchoModules"
              aria-expanded="false"
            >
              <span>ECHO / IMAGING</span>

              <span class="acl-chevron">
                ›
              </span>
            </button>

            <div
              id="aclEchoModules"
              class="acl-module-family-items"
              data-module-family="echo"
              hidden
            ></div>
          </section>

          <section class="acl-module-family">
            <button
              class="acl-module-family-toggle"
              type="button"
              data-collapse-target="aclInterventionModules"
              aria-expanded="false"
            >
              <span>INTERVENTIONS</span>

              <span class="acl-chevron">
                ›
              </span>
            </button>

            <div
              id="aclInterventionModules"
              class="acl-module-family-items"
              data-module-family="interventions"
              hidden
            ></div>
          </section>

        </div>
      </section>

      <a
        class="acl-drawer-link${active("study.html")}"
        href="${root}study.html?edition=${edition}"
      >
        <span class="acl-nav-icon">◆</span>
        <span>Mindmaps &amp; Flashcards</span>
      </a>

      <a
        class="acl-drawer-link${active("challenge.html")}"
        href="${root}challenge.html?edition=${edition}"
      >
        <span class="acl-nav-icon">⚔</span>
        <span>Challenge Friends</span>
      </a>

      <a
        class="acl-drawer-link${active("competitions.html")}"
        href="${root}competitions.html?edition=${edition}"
      >
        <span class="acl-nav-icon">🏆</span>
        <span>Formal ACL Competitions</span>
      </a>

      <a
        class="acl-drawer-link${active("notifications.html")}"
        href="${root}notifications.html?edition=${edition}"
      >
        <span class="acl-nav-icon">🔔</span>
        <span>Notifications</span>
      </a>

      <a
        class="acl-drawer-link${active("profile.html")}"
        href="${root}profile.html?edition=${edition}"
      >
        <span class="acl-nav-icon">♙</span>
        <span>Profile</span>
      </a>

      <a
        class="acl-drawer-link${active("settings.html")}"
        href="${root}settings.html?edition=${edition}"
      >
        <span class="acl-nav-icon">⚙</span>
        <span>Settings</span>
      </a>

    </nav>
  </div>

  <button
    id="aclDrawerLogout"
    class="acl-drawer-logout"
    type="button"
  >
    <span>↪</span>
    <span>Log out</span>
  </button>
</aside>

<nav
  class="acl-mobile-bottom-nav"
  aria-label="Mobile navigation"
>
  <a
    href="${root}home.html?edition=${edition}"
    class="${
      page === "home.html"
        ? "is-active"
        : ""
    }"
  >
    <span>⌂</span>
    <small>Home</small>
  </a>

  <button
    id="aclMobileModulesButton"
    type="button"
  >
    <span>▦</span>
    <small>Menu</small>
  </button>

  <a
    href="${root}progress.html?edition=${edition}"
    class="${
      page === "progress.html"
        ? "is-active"
        : ""
    }"
  >
    <span>▤</span>
    <small>Progress</small>
  </a>

  <a
    href="${root}profile.html?edition=${edition}"
    class="${
      page === "profile.html"
        ? "is-active"
        : ""
    }"
  >
    <span>♙</span>
    <small>Profile</small>
  </a>
</nav>
`;

document.body.insertBefore(
  shell,
  document.body.firstChild
);

const backdrop =
  document.getElementById(
    "aclDrawerBackdrop"
  );

const toggle =
  document.getElementById(
    "aclDrawerToggle"
  );

const mobile = () =>
  matchMedia(
    "(max-width:820px)"
  ).matches;

function openDrawer() {
  if (mobile()) {
    document.body.classList.add(
      "drawer-open"
    );

    if (backdrop) {
      backdrop.hidden = false;
    }
  } else {
    document.body.classList.remove(
      "drawer-collapsed"
    );
  }

  toggle?.setAttribute(
    "aria-expanded",
    "true"
  );
}

function closeDrawer() {
  if (mobile()) {
    document.body.classList.remove(
      "drawer-open"
    );

    if (backdrop) {
      backdrop.hidden = true;
    }
  } else {
    document.body.classList.add(
      "drawer-collapsed"
    );
  }

  toggle?.setAttribute(
    "aria-expanded",
    "false"
  );
}

toggle?.addEventListener(
  "click",
  () => {
    if (mobile()) {
      document.body.classList.contains(
        "drawer-open"
      )
        ? closeDrawer()
        : openDrawer();
    } else {
      document.body.classList.contains(
        "drawer-collapsed"
      )
        ? openDrawer()
        : closeDrawer();
    }
  }
);

backdrop?.addEventListener(
  "click",
  closeDrawer
);

document
  .getElementById(
    "aclMobileModulesButton"
  )
  ?.addEventListener(
    "click",
    openDrawer
  );

window.addEventListener(
  "resize",
  () => {
    if (!mobile()) {
      document.body.classList.remove(
        "drawer-open"
      );

      if (backdrop) {
        backdrop.hidden = true;
      }
    }
  },
  {
    passive: true
  }
);

document
  .querySelectorAll(
    "[data-collapse-target]"
  )
  .forEach(btn => {
    btn.addEventListener(
      "click",
      () => {
        const target =
          document.getElementById(
            btn.dataset.collapseTarget
          );

        if (!target) {
          return;
        }

        const open =
          target.hidden;

        target.hidden =
          !open;

        btn.setAttribute(
          "aria-expanded",
          String(open)
        );

        const ch =
          btn.querySelector(
            ".acl-chevron"
          );

        if (ch) {
          ch.textContent =
            open
              ? "⌄"
              : "›";
        }
      }
    );
  });

async function signOut() {
  try {
    await supabaseClient.auth.signOut();
  } catch (error) {
    console.warn(error);
  }

  location.replace(
    root + "login.html"
  );
}

document
  .getElementById(
    "aclHeaderLogout"
  )
  ?.addEventListener(
    "click",
    signOut
  );

document
  .getElementById(
    "aclDrawerLogout"
  )
  ?.addEventListener(
    "click",
    signOut
  );

function timeout(
  promise,
  ms,
  label
) {
  return Promise.race([
    promise,
    new Promise(
      (_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `${label} timed out`
              )
            ),
          ms
        )
    )
  ]);
}

async function renderProfile() {
  try {
    const {
      data: {
        session
      },
      error
    } =
      await timeout(
        supabaseClient.auth.getSession(),
        6000,
        "Session"
      );

    if (
      error ||
      !session?.user
    ) {
      location.replace(
        root + "login.html"
      );

      return;
    }

    const user =
      session.user;

    const fallbackName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Member";

    const fallbackPhoto =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      "";

    applyProfileIdentity(
      fallbackName,
      fallbackPhoto
    );

    try {
      const {
        data: profile,
        error: profileError
      } =
        await timeout(
          supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle(),
          5000,
          "Profile"
        );

      if (profileError) {
        console.warn(
          "ACL profile load",
          profileError
        );
      }

      if (
        profile?.account_status ===
        "suspended"
      ) {
        await supabaseClient.auth.signOut();

        location.replace(
          root + "login.html"
        );

        return;
      }

      if (profile) {
        const name =
          profile.display_name ||
          profile.full_name ||
          profile.name ||
          fallbackName;

        const photo =
          profile.avatar_url ||
          profile.photo_url ||
          profile.profile_photo_url ||
          fallbackPhoto;

        applyProfileIdentity(
          name,
          photo
        );
      }
    } catch (error) {
      console.warn(
        "ACL profile fallback",
        error
      );
    }
  } catch (error) {
    console.warn(
      "ACL shared shell profile",
      error
    );
  }
}

function applyProfileIdentity(
  name,
  photo
) {
  [
    "aclHeaderUserName",
    "aclDrawerName"
  ].forEach(id => {
    const el =
      document.getElementById(id);

    if (el) {
      el.textContent =
        name;
    }
  });

  const avatar =
    document.getElementById(
      "aclDrawerAvatar"
    );

  if (!avatar) {
    return;
  }

  if (photo) {
    avatar.innerHTML =
      `<img src="${photo}" alt="">`;
  } else {
    avatar.textContent =
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0,2)
        .map(x => x[0])
        .join("")
        .toUpperCase() ||
      "ACL";
  }
}

async function renderModuleTree() {
  const hosts = {
    basic:
      document.querySelector(
        '[data-module-family="basic"]'
      ),

    ecg:
      document.querySelector(
        '[data-module-family="ecg"]'
      ),

    echo:
      document.querySelector(
        '[data-module-family="echo"]'
      ),

    interventions:
      document.querySelector(
        '[data-module-family="interventions"]'
      )
  };

  try {
    const {
      data,
      error
    } =
      await timeout(
        supabaseClient
          .from("modules")
          .select(
            "id,slug,title,edition,display_order,access_tier"
          )
          .eq(
            "edition",
            edition
          )
          .order(
            "display_order",
            {
              ascending: true,
              nullsFirst: false
            }
          ),
        7000,
        "Modules"
      );

    if (error) {
      throw error;
    }

    const buckets = {
      basic: [],
      ecg: [],
      echo: [],
      interventions: []
    };

    (data || [])
      .filter(
        module =>
          module?.access_tier !==
          "hidden"
      )
      .forEach(module => {
        buckets[
          moduleFamily(module)
        ].push(module);
      });

    Object.entries(
      buckets
    ).forEach(
      ([family, modules]) => {
        const host =
          hosts[family];

        if (!host) {
          return;
        }

        host.innerHTML =
          "";

        if (!modules.length) {
          host.innerHTML =
            '<span class="acl-tree-empty">No modules in this edition yet</span>';

          return;
        }

        modules.forEach(
          module => {
            const link =
              document.createElement(
                "a"
              );

            link.href =
              moduleHubUrl(
                module
              );

            link.textContent =
              module.title;

            if (
              String(module.id) ===
              String(
                currentModuleId()
              )
            ) {
              link.classList.add(
                "is-selected"
              );
            }

            host.appendChild(
              link
            );
          }
        );
      }
    );
  } catch (error) {
    console.warn(
      "ACL drawer module tree",
      error
    );

    Object.values(hosts)
      .filter(Boolean)
      .forEach(host => {
        host.innerHTML =
          '<span class="acl-tree-empty">Modules unavailable</span>';
      });
  }
}

renderProfile();
renderModuleTree();

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key ===
        "Escape" &&
      document.body.classList.contains(
        "drawer-open"
      )
    ) {
      closeDrawer();
    }
  }
);

if (
  page === "settings.html" &&
  edition === "expert"
) {
  import(
    root +
      "assets/js/expert-settings-controls.js?v=1.0.0"
  ).catch(
    error =>
      console.error(
        "ACL Expert settings controls",
        error
      )
  );
}

if (
  page === "progress.html" &&
  edition === "expert"
) {
  import(
    root +
      "assets/js/progress-topic-v1.js?v=1.0.0"
  ).catch(
    error =>
      console.warn(
        "ACL topic mastery",
        error
      )
  );
}
