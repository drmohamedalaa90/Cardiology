import { supabaseClient } from "./supabase-client.js";
import { protectAndRender } from "./session-ui.js?v=2.7.12";

const byId = (id) => document.getElementById(id);

let allProfiles = [];
let currentAdmin = null;
let statusTimeout = null;

/* =========================================================
   HELPERS
========================================================= */

function esc(value = "") {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[character]
  );
}

function show(message, type = "success") {
  const box = byId("adminStatus");

  if (!box) {
    if (type === "error") {
      console.error(message);
    } else {
      console.log(message);
    }

    return;
  }

  window.clearTimeout(statusTimeout);

  box.textContent = message;
  box.className = `status-box show ${type}`;

  statusTimeout = window.setTimeout(() => {
    box.className = "status-box";
  }, 4500);
}

function fmtDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function initials(name) {
  return String(name || "ACL")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function setText(id, value) {
  const element = byId(id);

  if (element) {
    element.textContent = String(value);
  }
}

function accountAvatar(profile, clickable = false) {
  const displayName =
    profile.full_name ||
    profile.username ||
    "Student";

  const avatar = profile.avatar_url
    ? `
      <img
        class="admin-avatar"
        src="${esc(profile.avatar_url)}"
        alt="${esc(displayName)} profile photo"
        loading="lazy"
      >
    `
    : `
      <span class="admin-avatar admin-avatar-fallback">
        ${esc(initials(displayName))}
      </span>
    `;

  if (!clickable) {
    return avatar;
  }

  return `
    <button
      type="button"
      class="admin-avatar-button"
      data-action="photo"
      data-id="${esc(profile.id)}"
      aria-label="Open profile photo"
    >
      ${avatar}
    </button>
  `;
}

/* =========================================================
   STATISTICS AND FILTERS
========================================================= */

function updateStats() {
  setText(
    "totalStudents",
    allProfiles.length
  );

  setText(
    "activeStudents",
    allProfiles.filter(
      (profile) =>
        profile.account_status === "active"
    ).length
  );

  setText(
    "suspendedStudents",
    allProfiles.filter(
      (profile) =>
        profile.account_status === "suspended"
    ).length
  );

  setText(
    "adminCount",
    allProfiles.filter(
      (profile) =>
        profile.role === "admin"
    ).length
  );
}

function filteredProfiles() {
  const query =
    byId("studentSearch")
      ?.value
      ?.trim()
      .toLowerCase() || "";

  const status =
    byId("statusFilter")
      ?.value || "all";

  const role =
    byId("roleFilter")
      ?.value || "all";

  return allProfiles.filter((profile) => {
    const haystack = [
      profile.full_name,
      profile.username,
      profile.email,
      profile.phone_e164,
      profile.academic_year,
      profile.institution
    ]
      .map((value) => String(value || ""))
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !query ||
      haystack.includes(query);

    const matchesStatus =
      status === "all" ||
      profile.account_status === status;

    const matchesRole =
      role === "all" ||
      profile.role === role;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesRole
    );
  });
}

/* =========================================================
   STUDENT TABLE
========================================================= */

function renderRows() {
  const body = byId("studentsBody");

  if (!body) {
    console.warn(
      "[ACL Admin] Missing #studentsBody in HTML."
    );

    return;
  }

  const profiles =
    filteredProfiles();

  if (!profiles.length) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">
          No accounts match the current filters.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = profiles
    .map((profile) => {
      const isSelf =
        profile.id === currentAdmin?.id;

      const isSuspended =
        profile.account_status === "suspended";

      const statusClass =
        isSuspended
          ? "status-suspended"
          : "status-active";

      const toggleLabel =
        isSuspended
          ? "Restore"
          : "Suspend";

      const displayName =
        profile.full_name ||
        "Unnamed user";

      return `
        <tr>

          <td>
            <div class="student-cell">

              ${accountAvatar(profile, true)}

              <div>
                <strong>
                  ${esc(displayName)}
                </strong>

                <small>
                  @${esc(profile.username || "not-set")}
                </small>
              </div>

            </div>
          </td>

          <td>
            <div>
              ${esc(profile.email || "—")}
            </div>

            <small>
              ${esc(profile.phone_e164 || "—")}
            </small>
          </td>

          <td>
            <div>
              ${esc(profile.academic_year || "—")}
            </div>

            <small>
              ${esc(profile.institution || "—")}
            </small>
          </td>

          <td>
            <span
              class="role-pill role-${esc(
                profile.role || "student"
              )}"
            >
              ${esc(profile.role || "student")}
            </span>
          </td>

          <td>
            <span
              class="account-pill ${statusClass}"
            >
              ${esc(
                profile.account_status || "active"
              )}
            </span>
          </td>

          <td>
            ${fmtDate(profile.created_at)}
          </td>

          <td>
            <div class="admin-actions">

              <button
                type="button"
                class="table-action-icon"
                data-action="view"
                data-id="${esc(profile.id)}"
                title="First click shows label; second click opens"
              >
                <span class="table-action-glyph">
                  👁️
                </span>

                <span class="table-action-label">
                  View
                </span>
              </button>

              <button
                type="button"
                class="table-action-icon"
                data-action="reset"
                data-id="${esc(profile.id)}"
                ${
                  profile.email
                    ? ""
                    : "disabled"
                }
                title="First click shows label; second click sends reset"
              >
                <span class="table-action-glyph">
                  🔑
                </span>

                <span class="table-action-label">
                  Reset password
                </span>
              </button>

              <button
                type="button"
                class="
                  table-action-icon
                  ${
                    isSuspended
                      ? "restore-btn"
                      : "danger-btn"
                  }
                "
                data-action="toggle"
                data-id="${esc(profile.id)}"
                ${
                  isSelf
                    ? "disabled"
                    : ""
                }
                title="${
                  isSelf
                    ? "You cannot suspend your own administrator account."
                    : toggleLabel
                }"
              >
                <span class="table-action-glyph">
                  ${isSuspended ? "✅" : "⛔"}
                </span>

                <span class="table-action-label">
                  ${toggleLabel}
                </span>
              </button>

            </div>
          </td>

        </tr>
      `;
    })
    .join("");
}

/* =========================================================
   LOAD PROFILES
========================================================= */

async function loadProfiles() {
  const body = byId("studentsBody");

  if (body) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">
          Loading registered accounts…
        </td>
      </tr>
    `;
  }

  const {
    data,
    error
  } = await supabaseClient
    .from("profiles")
    .select(`
      id,
      full_name,
      username,
      email,
      phone_e164,
      academic_year,
      institution,
      avatar_url,
      role,
      account_status,
      created_at,
      updated_at,
      last_seen_at
    `)
    .order(
      "created_at",
      {
        ascending: false
      }
    );

  if (error) {
    throw error;
  }

  const roleOrder = {
    admin: 0,
    student: 1
  };

  allProfiles = (data || []).sort(
    (first, second) => {
      const roleDifference =
        (roleOrder[first.role] ?? 9) -
        (roleOrder[second.role] ?? 9);

      if (roleDifference !== 0) {
        return roleDifference;
      }

      return (
        new Date(second.created_at || 0) -
        new Date(first.created_at || 0)
      );
    }
  );

  updateStats();
  renderRows();
}

/* =========================================================
   ACCOUNT STATUS
========================================================= */

async function toggleStatus(profile) {
  if (
    !currentAdmin ||
    profile.id === currentAdmin.id
  ) {
    throw new Error(
      "You cannot suspend your own administrator account."
    );
  }

  const nextStatus =
    profile.account_status === "suspended"
      ? "active"
      : "suspended";

  const verb =
    nextStatus === "suspended"
      ? "suspend"
      : "restore";

  const displayName =
    profile.full_name ||
    profile.username ||
    "this account";

  const confirmed =
    window.confirm(
      `Are you sure you want to ${verb} ${displayName}?`
    );

  if (!confirmed) {
    return;
  }

  const { error } =
    await supabaseClient
      .from("profiles")
      .update({
        account_status:
          nextStatus,

        updated_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        profile.id
      );

  if (error) {
    throw error;
  }

  profile.account_status =
    nextStatus;

  updateStats();
  renderRows();

  show(
    `Account ${
      nextStatus === "suspended"
        ? "suspended"
        : "restored"
    } successfully.`
  );
}

/* =========================================================
   PASSWORD RESET
========================================================= */

async function sendReset(profile) {
  if (!profile.email) {
    throw new Error(
      "This account has no email address."
    );
  }

  const confirmed =
    window.confirm(
      `Send a password-reset email to ${profile.email}?`
    );

  if (!confirmed) {
    return;
  }

  const redirectTo =
    `${window.location.origin}/Cardiology/reset-password.html`;

  const { error } =
    await supabaseClient.auth.resetPasswordForEmail(
      profile.email,
      {
        redirectTo
      }
    );

  if (error) {
    throw error;
  }

  show(
    `Password-reset email sent to ${profile.email}.`
  );
}

/* =========================================================
   STUDENT DETAILS
========================================================= */

function openDetails(profile) {
  const content =
    byId("studentDialogContent");

  const dialog =
    byId("studentDialog");

  if (!content || !dialog) {
    throw new Error(
      "Student details dialog is missing from the HTML."
    );
  }

  content.innerHTML = `
    <div class="dialog-profile">

      ${accountAvatar(profile)}

      <div>
        <h2>
          ${esc(profile.full_name || "Unnamed user")}
        </h2>

        <p class="muted">
          @${esc(profile.username || "not-set")}
        </p>
      </div>

    </div>

    <dl class="detail-grid">

      <div>
        <dt>Email</dt>
        <dd>${esc(profile.email || "—")}</dd>
      </div>

      <div>
        <dt>WhatsApp</dt>
        <dd>${esc(profile.phone_e164 || "—")}</dd>
      </div>

      <div>
        <dt>Position</dt>
        <dd>${esc(profile.academic_year || "—")}</dd>
      </div>

      <div>
        <dt>Institution</dt>
        <dd>${esc(profile.institution || "—")}</dd>
      </div>

      <div>
        <dt>Role</dt>
        <dd>${esc(profile.role || "student")}</dd>
      </div>

      <div>
        <dt>Status</dt>
        <dd>${esc(profile.account_status || "active")}</dd>
      </div>

      <div>
        <dt>Registered</dt>
        <dd>${fmtDate(profile.created_at)}</dd>
      </div>

      <div>
        <dt>Last activity</dt>
        <dd>${fmtDate(profile.last_seen_at)}</dd>
      </div>

      <div class="detail-full">
        <dt>User ID</dt>

        <dd class="mono">
          ${esc(profile.id)}
        </dd>
      </div>

    </dl>
  `;

  dialog.showModal();
}

/* =========================================================
   PROFILE PHOTO
========================================================= */

function openPhoto(profile) {
  if (!profile.avatar_url) {
    show(
      "This student has not uploaded a profile photo.",
      "error"
    );

    return;
  }

  const title =
    byId("photoDialogTitle");

  const image =
    byId("photoDialogImage");

  const dialog =
    byId("photoDialog");

  if (!title || !image || !dialog) {
    throw new Error(
      "Profile photo dialog is missing from the HTML."
    );
  }

  const displayName =
    profile.full_name ||
    profile.username ||
    "Student";

  title.textContent =
    `${displayName} — profile photo`;

  image.src =
    profile.avatar_url;

  image.alt =
    `${displayName} profile photo`;

  dialog.showModal();
}

/* =========================================================
   CSV EXPORT
========================================================= */

function exportCsv() {
  const rows =
    filteredProfiles();

  const fields = [
    "full_name",
    "username",
    "email",
    "phone_e164",
    "academic_year",
    "institution",
    "role",
    "account_status",
    "created_at",
    "last_seen_at"
  ];

  const quote = (value) =>
    `"${String(value ?? "")
      .replace(/"/g, '""')}"`;

  const csv = [
    fields.join(","),

    ...rows.map((row) =>
      fields
        .map((field) =>
          quote(row[field])
        )
        .join(",")
    )
  ].join("\r\n");

  const blob =
    new Blob(
      [
        "\ufeff",
        csv
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href =
    url;

  link.download =
    `acl-registered-students-${
      new Date()
        .toISOString()
        .slice(0, 10)
    }.csv`;

  document.body.appendChild(link);

  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  byId("studentSearch")
    ?.addEventListener(
      "input",
      renderRows
    );

  byId("statusFilter")
    ?.addEventListener(
      "change",
      renderRows
    );

  byId("roleFilter")
    ?.addEventListener(
      "change",
      renderRows
    );

  byId("refreshStudents")
    ?.addEventListener(
      "click",
      async () => {
        try {
          await loadProfiles();

          show(
            "Student list refreshed."
          );
        } catch (error) {
          console.error(error);

          show(
            error.message ||
            "Could not refresh students.",
            "error"
          );
        }
      }
    );

  /*
   * Supports either export-button ID.
   * Missing buttons no longer crash the page.
   */

  byId("exportCsv")
    ?.addEventListener(
      "click",
      exportCsv
    );

  byId("exportStudentsCsv")
    ?.addEventListener(
      "click",
      exportCsv
    );

  byId("studentsBody")
    ?.addEventListener(
      "click",
      async (event) => {
        const button =
          event.target.closest(
            "button[data-action]"
          );

        if (!button) {
          return;
        }

        const profile =
          allProfiles.find(
            (item) =>
              item.id ===
              button.dataset.id
          );

        if (!profile) {
          return;
        }

        /*
         * First click expands the icon label.
         * Second click performs the action.
         */

        if (
          button.classList.contains(
            "table-action-icon"
          ) &&
          !button.classList.contains(
            "is-expanded"
          )
        ) {
          event.preventDefault();

          document
            .querySelectorAll(
              ".table-action-icon.is-expanded"
            )
            .forEach((item) => {
              item.classList.remove(
                "is-expanded"
              );
            });

          button.classList.add(
            "is-expanded"
          );

          return;
        }

        button.disabled =
          true;

        try {
          switch (
            button.dataset.action
          ) {
            case "view":
              openDetails(profile);
              break;

            case "photo":
              openPhoto(profile);
              break;

            case "toggle":
              await toggleStatus(
                profile
              );
              break;

            case "reset":
              await sendReset(
                profile
              );
              break;

            default:
              break;
          }
        } catch (error) {
          console.error(error);

          show(
            error.message ||
            "Admin action failed.",
            "error"
          );
        } finally {
          button.disabled =
            false;

          button.classList.remove(
            "is-expanded"
          );
        }
      }
    );

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest(
          ".table-action-icon"
        )
      ) {
        return;
      }

      document
        .querySelectorAll(
          ".table-action-icon.is-expanded"
        )
        .forEach((item) => {
          item.classList.remove(
            "is-expanded"
          );
        });
    }
  );
}

/* =========================================================
   INITIALIZATION
========================================================= */

async function init() {
  try {
    currentAdmin =
      await protectAndRender(
        "login.html"
      );

    if (!currentAdmin) {
      return;
    }

    if (
      currentAdmin.role !==
      "admin"
    ) {
      window.location.replace(
        "modules.html"
      );

      return;
    }

    bindEvents();

    await loadProfiles();
  } catch (error) {
    console.error(
      "Admin initialization failed:",
      error
    );

    show(
      error.message ||
      "Could not load the admin dashboard.",
      "error"
    );

    const body =
      byId("studentsBody");

    if (body) {
      body.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="table-empty"
          >
            Admin data could not be loaded:
            ${esc(
              error.message ||
              "Unknown error"
            )}
          </td>
        </tr>
      `;
    }
  }
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    init,
    {
      once: true
    }
  );
} else {
  init();
}
