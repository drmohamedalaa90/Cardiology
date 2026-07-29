import {
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL ADMIN SHELL v3.1.0 LOADED"
);


/* =========================================================
   EDITION
========================================================= */

const selectedEdition =
  resolveAclEdition();


/* =========================================================
   ADMIN NAVIGATION
========================================================= */

const ADMIN_ITEMS = [
  {
    key:
      "students",

    label:
      "Students",

    detail:
      "Accounts",

    icon:
      "👥",

    href:
      "admin.html"
  },

  {
    key:
      "modules",

    label:
      "Modules",

    detail:
      "Catalogue",

    icon:
      "📚",

    href:
      "admin-modules.html"
  },

  {
    key:
      "questions",

    label:
      "Question Bank",

    detail:
      "Content",

    icon:
      "❓",

    href:
      "admin-questions.html"
  },

  {
    key:
      "authoring",

    label:
      "Authoring",

    detail:
      "Question editor",

    icon:
      "✍️",

    href:
      "question-authoring.html"
  },

  {
    key:
      "quizzes",

    label:
      "Quiz Builder",

    detail:
      "Assessments",

    icon:
      "🧩",

    href:
      "admin-quizzes.html"
  },

  {
    key:
      "competitions",

    label:
      "Competitions",

    detail:
      "Official rounds",

    icon:
      "🏆",

    href:
      "admin-competitions.html"
  },

  {
    key:
      "access",

    label:
      "Access Engine",

    detail:
      "Rules",

    icon:
      "🔐",

    href:
      "admin-access.html"
  },

  {
    key:
      "push",

    label:
      "Push Alerts",

    detail:
      "Send notifications",

    icon:
      "🔔",

    href:
      "admin-push.html"
  },

  {
    key:
      "analytics",

    label:
      "Analytics",

    detail:
      "Reports",

    icon:
      "📊",

    href:
      "admin-analytics.html"
  }
];


/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(
  value = ""
) {
  return String(
    value ??
    ""
  ).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[
        character
      ]
  );
}


function currentPageName() {
  const pathname =
    window.location.pathname;


  const pageName =
    pathname
      .split(
        "/"
      )
      .filter(
        Boolean
      )
      .pop();


  return (
    pageName ||
    "admin.html"
  )
    .split(
      "?"
    )[0]
    .split(
      "#"
    )[0];
}


function detectActiveKey(
  host
) {
  const explicitActive =
    String(
      host.dataset.active ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    ADMIN_ITEMS.some(
      (item) =>
        item.key ===
        explicitActive
    )
  ) {
    return explicitActive;
  }


  const pageName =
    currentPageName();


  return (
    ADMIN_ITEMS.find(
      (item) =>
        item.href ===
        pageName
    )?.key ||
    ""
  );
}


function editionLabel() {
  return selectedEdition ===
    "basic"
    ? "BASIC EDITION"
    : "EXPERT EDITION";
}


/* =========================================================
   NAVIGATION ITEM
========================================================= */

function adminItemHtml(
  item,
  activeKey
) {
  const isActive =
    item.key ===
    activeKey;


  return `
    <a
      class="
        acl-admin-nav-item
        ${
          isActive
            ? "is-active"
            : ""
        }
      "
      href="${escapeHtml(
        aclUrl(
          item.href,
          selectedEdition
        )
      )}"
      ${
        isActive
          ? 'aria-current="page"'
          : ""
      }
      data-admin-item="${escapeHtml(
        item.key
      )}"
    >

      <span
        class="acl-admin-nav-icon"
        aria-hidden="true"
      >
        ${escapeHtml(
          item.icon
        )}
      </span>


      <span class="acl-admin-nav-copy">

        <strong>
          ${escapeHtml(
            item.label
          )}
        </strong>

        <small>
          ${escapeHtml(
            item.detail
          )}
        </small>

      </span>

    </a>
  `;
}


/* =========================================================
   ADMIN SHELL
========================================================= */

function renderAdminShell() {
  const hosts =
    document.querySelectorAll(
      "[data-admin-shell]"
    );


  hosts.forEach(
    (host) => {
      const activeKey =
        detectActiveKey(
          host
        );


      host.className =
        "acl-admin-shell";


      host.dataset.edition =
        selectedEdition;


      host.innerHTML = `
        <div class="acl-admin-shell-heading">

          <div class="acl-admin-shell-title">

            <span>
              ADMIN CONTROL CENTRE
            </span>

            <strong>
              ${escapeHtml(
                editionLabel()
              )}
            </strong>

          </div>


          <a
            class="acl-admin-shell-home"
            href="${escapeHtml(
              aclUrl(
                "admin.html",
                selectedEdition
              )
            )}"
          >
            Admin home
          </a>

        </div>


        <nav
          class="acl-admin-nav-line"
          aria-label="Administration sections"
        >
          ${ADMIN_ITEMS
            .map(
              (item) =>
                adminItemHtml(
                  item,
                  activeKey
                )
            )
            .join(
              ""
            )}
        </nav>
      `;
    }
  );
}


/* =========================================================
   MOBILE INTERACTION
========================================================= */

function bindAdminShellInteraction() {
  document.addEventListener(
    "click",
    (event) => {
      const navigationItem =
        event.target.closest(
          ".acl-admin-nav-item"
        );


      if (!navigationItem) {
        return;
      }


      if (
        window.matchMedia(
          "(max-width: 760px)"
        ).matches &&
        !navigationItem.classList.contains(
          "is-label-visible"
        )
      ) {
        event.preventDefault();


        document
          .querySelectorAll(
            ".acl-admin-nav-item.is-label-visible"
          )
          .forEach(
            (item) => {
              if (
                item !==
                navigationItem
              ) {
                item.classList.remove(
                  "is-label-visible"
                );
              }
            }
          );


        navigationItem.classList.add(
          "is-label-visible"
        );
      }
    }
  );


  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest(
          ".acl-admin-nav-item"
        )
      ) {
        return;
      }


      document
        .querySelectorAll(
          ".acl-admin-nav-item.is-label-visible"
        )
        .forEach(
          (item) => {
            item.classList.remove(
              "is-label-visible"
            );
          }
        );
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

function initializeAdminShell() {
  renderAdminShell();
  bindAdminShellInteraction();
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAdminShell,
    {
      once:
        true
    }
  );
} else {
  initializeAdminShell();
}
