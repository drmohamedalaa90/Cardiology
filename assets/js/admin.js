import { supabaseClient } from "./supabase-client.js";
import { protectAndRender } from "./session-ui.js?v=3.0.0";

const byId = (id) => document.getElementById(id);

let allProfiles = [];
let currentAdmin = null;
let statusTimeout = null;
let eventsBound = false;

/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value = "") {
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

function setText(id, value) {
  const element = byId(id);

  if (element) {
    element.textContent = String(value);
  }
}

function showStatus(message, type = "success") {
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

function formatDate(value) {
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

function getInitials(name) {
  return String(name || "ACL")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function safelyBind(id, eventName, handler) {
  const element = byId(id);

  if (!element) {
    console.info(
      `[ACL Admin] Optional element not found: #${id}`
    );

    return false;
  }

  element.addEventListener(
    eventName,
    handler
  );

  return true;
}

function showTableMessage(
  message,
  className = "table-empty"
) {
  const body = byId("studentsBody");

  if (!body) {
    console.error(
      "[ACL Admin] Missing #studentsBody."
    );

    return;
  }

  body.innerHTML = `
    <tr>
      <td
        colspan="7"
        class="${escapeHtml(className)}"
      >
        ${escapeHtml(message)}
      </td>
    </tr>
  `;
}

/* =========================================================
   AVATARS
========================================================= */

function accountAvatar(
  profile,
  clickable = false
) {
  const displayName =
    profile.full_name ||
    profile.username ||
    "Student";

  const avatar = profile.avatar_url
    ? `
      <img
        class="admin-avatar"
        src="${escapeHtml(profile.avatar_url)}"
        alt="${escapeHtml(displayName)} profile photo"
        loading="lazy"
      >
    `
    : `
      <span
        class="admin-avatar admin-avatar-fallback"
      >
        ${escapeHtml(getInitials(displayName))}
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
      data-id="${escapeHtml(profile.id)}"
      aria-label="Open profile photo"
    >
      ${avatar}
    </button>
  `;
}

/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics() {
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

/* =========================================================
   FILTERING
========================================================= */

function getFilteredProfiles() {
  const searchQuery =
    byId("studentSearch")
      ?.value
      ?.trim()
      .toLowerCase() || "";

  const selectedStatus =
    byId("statusFilter")
      ?.value || "all";

  const selectedRole =
    byId("roleFilter")
      ?.value || "all";

  return allProfiles.filter((profile) => {
    const searchableText = [
      profile.full_name,
      profile.username,
      profile.email,
      profile.phone_e164,
      profile.academic_year,
      profile.institution
    ]
      .map((value) =>
        String(value || "")
      )
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !searchQuery ||
      searchableText.includes(
        searchQuery
      );

    const matchesStatus =
      selectedStatus === "all" ||
      profile.account_status ===
        selectedStatus;

    const matchesRole =
      selectedRole === "all" ||
      profile.role === selectedRole;

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
    console.error(
      "[ACL Admin] Missing #studentsBody."
    );

    return;
  }

  const profiles =
    getFilteredProfiles();

  if (!profiles.length) {
    showTableMessage(
      "No accounts match the current filters."
    );

    return;
  }

  body.innerHTML = profiles
    .map((profile) => {
      const isSelf =
        profile.id === currentAdmin?.id;

      const isSuspended =
        profile.account_status ===
        "suspended";

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

      const role =
        profile.role ||
        "student";

      const accountStatus =
        profile.account_status ||
        "active";

      return `
        <tr>

          <td>
            <div class="student-cell">

              ${accountAvatar(
                profile,
                true
              )}

              <div>
                <strong>
                  ${escapeHtml(displayName)}
                </strong>

                <small>
                  @${escapeHtml(
                    profile.username ||
                    "not-set"
                  )}
                </small>
              </div>

            </div>
          </td>

          <td>
            <div>
              ${escapeHtml(
                profile.email || "—"
              )}
            </div>

            <small>
              ${escapeHtml(
                profile.phone_e164 || "—"
              )}
            </small>
          </td>

          <td>
            <div>
              ${escapeHtml(
                profile.academic_year ||
                "—"
              )}
            </div>

            <small>
              ${escapeHtml(
                profile.institution || "—"
              )}
            </small>
          </td>

          <td>
            <span
              class="role-pill role-${escapeHtml(
                role
              )}"
            >
              ${escapeHtml(role)}
            </span>
          </td>

          <td>
            <span
              class="account-pill ${statusClass}"
            >
              ${escapeHtml(accountStatus)}
            </span>
          </td>

          <td>
            ${formatDate(
              profile.created_at
            )}
          </td>

          <td>
            <div class="admin-actions">

              <button
                type="button"
                class="table-action-icon"
                data-action="view"
                data-id="${escapeHtml(
                  profile.id
                )}"
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
                data-id="${escapeHtml(
                  profile.id
                )}"
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
                data-id="${escapeHtml(
                  profile.id
                )}"
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
                  ${
                    isSuspended
                      ? "✅"
                      : "⛔"
                  }
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
  showTableMessage(
    "Loading registered accounts…"
  );

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
    throw new Error(
      `Could not load registered accounts: ${error.message}`
    );
  }

  const roleOrder = {
    admin: 0,
    student: 1
  };

  allProfiles = (data || []).sort(
    (firstProfile, secondProfile) => {
      const roleDifference =
        (
          roleOrder[
            firstProfile.role
          ] ?? 9
        ) -
        (
          roleOrder[
            secondProfile.role
          ] ?? 9
        );

      if (roleDifference !== 0) {
        return roleDifference;
      }

      return (
        new Date(
          secondProfile.created_at || 0
        ) -
        new Date(
          firstProfile.created_at || 0
        )
      );
    }
  );

  updateStatistics();
  renderRows();
}

/* =========================================================
   ACCOUNT STATUS
========================================================= */

async function toggleAccountStatus(
  profile
) {
  if (
    !currentAdmin ||
    profile.id === currentAdmin.id
  ) {
    throw new Error(
      "You cannot suspend your own administrator account."
    );
  }

  const nextStatus =
    profile.account_status ===
    "suspended"
      ? "active"
      : "suspended";

  const actionWord =
    nextStatus === "suspended"
      ? "suspend"
      : "restore";

  const displayName =
    profile.full_name ||
    profile.username ||
    "this account";

  const confirmed =
    window.confirm(
      `Are you sure you want to ${actionWord} ${displayName}?`
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

  updateStatistics();
  renderRows();

  showStatus(
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

async function sendPasswordReset(
  profile
) {
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

  showStatus(
    `Password-reset email sent to ${profile.email}.`
  );
}

/* =========================================================
   STUDENT DETAILS
========================================================= */

function openStudentDetails(profile) {
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
          ${escapeHtml(
            profile.full_name ||
            "Unnamed user"
          )}
        </h2>

        <p class="muted">
          @${escapeHtml(
            profile.username ||
            "not-set"
          )}
        </p>
      </div>

    </div>

    <dl class="detail-grid">

      <div>
        <dt>Email</dt>
        <dd>
          ${escapeHtml(
            profile.email || "—"
          )}
        </dd>
      </div>

      <div>
        <dt>WhatsApp</dt>
        <dd>
          ${escapeHtml(
            profile.phone_e164 || "—"
          )}
        </dd>
      </div>

      <div>
        <dt>Position</dt>
        <dd>
          ${escapeHtml(
            profile.academic_year || "—"
          )}
        </dd>
      </div>

      <div>
        <dt>Institution</dt>
        <dd>
          ${escapeHtml(
            profile.institution || "—"
          )}
        </dd>
      </div>

      <div>
        <dt>Role</dt>
        <dd>
          ${escapeHtml(
            profile.role || "student"
          )}
        </dd>
      </div>

      <div>
        <dt>Status</dt>
        <dd>
          ${escapeHtml(
            profile.account_status ||
            "active"
          )}
        </dd>
      </div>

      <div>
        <dt>Registered</dt>
        <dd>
          ${formatDate(
            profile.created_at
          )}
        </dd>
      </div>

      <div>
        <dt>Last activity</dt>
        <dd>
          ${formatDate(
            profile.last_seen_at
          )}
        </dd>
      </div>

      <div class="detail-full">
        <dt>User ID</dt>

        <dd class="mono">
          ${escapeHtml(profile.id)}
        </dd>
      </div>

    </dl>
  `;

  if (
    typeof dialog.showModal ===
    "function"
  ) {
    dialog.showModal();
  } else {
    dialog.setAttribute(
      "open",
      ""
    );
  }
}

/* =========================================================
   PROFILE PHOTO
========================================================= */

function openProfilePhoto(profile) {
  if (!profile.avatar_url) {
    showStatus(
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

  if (
    typeof dialog.showModal ===
    "function"
  ) {
    dialog.showModal();
  } else {
    dialog.setAttribute(
      "open",
      ""
    );
  }
}

/* =========================================================
   CSV EXPORT
========================================================= */

function exportProfilesCsv() {
  const rows =
    getFilteredProfiles();

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

  const quoteCsvValue = (value) =>
    `"${String(value ?? "")
      .replace(/"/g, '""')}"`;

  const csvContent = [
    fields.join(","),

    ...rows.map((row) =>
      fields
        .map((field) =>
          quoteCsvValue(
            row[field]
          )
        )
        .join(",")
    )
  ].join("\r\n");

  const blob =
    new Blob(
      [
        "\ufeff",
        csvContent
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

  const objectUrl =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href =
    objectUrl;

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
    URL.revokeObjectURL(
      objectUrl
    );
  }, 0);
}

/* =========================================================
   TABLE ACTIONS
========================================================= */

async function handleTableClick(event) {
  if (
    !(
      event.target instanceof
      Element
    )
  ) {
    return;
  }

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

  button.disabled = true;

  try {
    switch (
      button.dataset.action
    ) {
      case "view":
        openStudentDetails(profile);
        break;

      case "photo":
        openProfilePhoto(profile);
        break;

      case "toggle":
        await toggleAccountStatus(
          profile
        );
        break;

      case "reset":
        await sendPasswordReset(
          profile
        );
        break;

      default:
        break;
    }
  } catch (error) {
    console.error(error);

    showStatus(
      error.message ||
      "Admin action failed.",
      "error"
    );
  } finally {
    button.disabled = false;

    button.classList.remove(
      "is-expanded"
    );
  }
}

/* =========================================================
   EVENT BINDING
========================================================= */

function bindEvents() {
  if (eventsBound) {
    return;
  }

  eventsBound = true;

  safelyBind(
    "studentSearch",
    "input",
    renderRows
  );

  safelyBind(
    "statusFilter",
    "change",
    renderRows
  );

  safelyBind(
    "roleFilter",
    "change",
    renderRows
  );

  safelyBind(
    "refreshStudents",
    "click",
    async () => {
      try {
        await loadProfiles();

        showStatus(
          "Student list refreshed."
        );
      } catch (error) {
        console.error(error);

        showStatus(
          error.message ||
          "Could not refresh students.",
          "error"
        );

        showTableMessage(
          error.message ||
          "Could not refresh students."
        );
      }
    }
  );

  /*
   * Supports both possible export-button IDs.
   * Missing buttons will no longer crash the application.
   */

  safelyBind(
    "exportCsv",
    "click",
    exportProfilesCsv
  );

  safelyBind(
    "exportStudentsCsv",
    "click",
    exportProfilesCsv
  );

  safelyBind(
    "studentsBody",
    "click",
    handleTableClick
  );

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target instanceof
          Element &&
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

async function initializeAdminPage() {
  try {
    currentAdmin =
      await protectAndRender(
        "login.html"
      );

    if (!currentAdmin) {
      return;
    }

    if (
      currentAdmin.role !== "admin"
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

    showStatus(
      error.message ||
      "Could not load the admin dashboard.",
      "error"
    );

    showTableMessage(
      `Admin data could not be loaded: ${
        error.message ||
        "Unknown error"
      }`
    );
  }
}

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAdminPage,
    {
      once: true
    }
  );
} else {
  initializeAdminPage();
}
