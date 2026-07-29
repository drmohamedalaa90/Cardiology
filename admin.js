import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL ADMIN v3.0.0 LOADED"
);


/* =========================================================
   EDITION
========================================================= */

const selectedEdition =
  resolveAclEdition();


/* =========================================================
   PAGE STATE
========================================================= */

const byId =
  (id) =>
    document.getElementById(
      id
    );


let allProfiles =
  [];


let currentAdmin =
  null;


let statusTimeout =
  null;


let isLoadingProfiles =
  false;


/* =========================================================
   GENERAL HELPERS
========================================================= */

function escapeHtml(
  value = ""
) {
  return String(
    value
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


function showStatus(
  message = "",
  type = "success",
  duration = 4500
) {
  const box =
    byId(
      "adminStatus"
    );


  if (!box) {
    if (
      type ===
      "error"
    ) {
      console.error(
        message
      );
    } else {
      console.log(
        message
      );
    }


    return;
  }


  window.clearTimeout(
    statusTimeout
  );


  box.textContent =
    message;


  box.className =
    `status-box show ${type}`.trim();


  if (
    duration >
    0
  ) {
    statusTimeout =
      window.setTimeout(
        () => {
          box.textContent =
            "";


          box.className =
            "status-box";
        },
        duration
      );
  }
}


function formatDate(
  value
) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return date.toLocaleString(
    [],
    {
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  );
}


function initials(
  name
) {
  return (
    String(
      name ||
      "ACL"
    )
      .trim()
      .split(
        /\s+/
      )
      .slice(
        0,
        2
      )
      .map(
        (part) =>
          part[
            0
          ] ||
          ""
      )
      .join(
        ""
      )
      .toUpperCase() ||
    "ACL"
  );
}


function setText(
  id,
  value
) {
  const element =
    byId(
      id
    );


  if (element) {
    element.textContent =
      String(
        value
      );
  }
}


function normalizeRole(
  value
) {
  const role =
    String(
      value ||
      "student"
    )
      .trim()
      .toLowerCase();


  return role ===
    "admin"
    ? "admin"
    : "student";
}


function normalizeAccountStatus(
  value
) {
  const status =
    String(
      value ||
      "active"
    )
      .trim()
      .toLowerCase();


  return status ===
    "suspended"
    ? "suspended"
    : "active";
}


function setButtonLoading(
  button,
  loading,
  loadingText,
  normalText
) {
  if (!button) {
    return;
  }


  button.disabled =
    loading;


  button.textContent =
    loading
      ? loadingText
      : normalText;
}


/* =========================================================
   EDITION-AWARE PAGE SETUP
========================================================= */

function applyEditionContext() {
  const isBasic =
    selectedEdition ===
    "basic";


  document.body.classList.remove(
    "acl-theme-basic",
    "acl-theme-expert"
  );


  document.body.classList.add(
    isBasic
      ? "acl-theme-basic"
      : "acl-theme-expert"
  );


  const editionBadge =
    byId(
      "adminEditionBadge"
    );


  if (editionBadge) {
    editionBadge.textContent =
      isBasic
        ? "BASIC EDITION"
        : "EXPERT EDITION";
  }


  const themeColor =
    byId(
      "adminThemeColor"
    );


  if (themeColor) {
    themeColor.content =
      isBasic
        ? "#105541"
        : "#123f72";
  }


  const editionLinks = {
    adminCompetitionsLink:
      "admin-competitions.html",

    adminAnalyticsLink:
      "admin-analytics.html",

    adminQuestionAuthoringLink:
      "question-authoring.html",

    adminNotificationsLink:
      "notifications.html",

    adminLeaderboardLink:
      "leaderboard.html",

    adminAchievementsLink:
      "achievements.html",

    adminModulesLink:
      "modules.html",

    adminProgressLink:
      "progress.html"
  };


  Object.entries(
    editionLinks
  ).forEach(
    (
      [
        id,
        path
      ]
    ) => {
      const link =
        byId(
          id
        );


      if (link) {
        link.href =
          aclUrl(
            path,
            selectedEdition
          );
      }
    }
  );


  document.title =
    `ACL Admin | ${
      isBasic
        ? "Basic Edition"
        : "Expert Edition"
    }`;


  const currentUrl =
    new URL(
      window.location.href
    );


  currentUrl.searchParams.set(
    "edition",
    selectedEdition
  );


  window.history.replaceState(
    {},
    "",
    currentUrl
  );
}


/* =========================================================
   ACCOUNT AVATAR
========================================================= */

function accountAvatar(
  profile,
  clickable = false
) {
  const displayName =
    profile.full_name ||
    profile.username ||
    "Student";


  const avatar =
    profile.avatar_url
      ? `
        <img
          class="admin-avatar"
          src="${escapeHtml(
            profile.avatar_url
          )}"
          alt="${escapeHtml(
            displayName
          )} profile photo"
          loading="lazy"
        >
      `
      : `
        <span
          class="
            admin-avatar
            admin-avatar-fallback
          "
        >
          ${escapeHtml(
            initials(
              displayName
            )
          )}
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
      data-id="${escapeHtml(
        profile.id
      )}"
      aria-label="Open profile photo"
    >
      ${avatar}
    </button>
  `;
}


/* =========================================================
   STATISTICS
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
        normalizeAccountStatus(
          profile.account_status
        ) ===
        "active"
    ).length
  );


  setText(
    "suspendedStudents",
    allProfiles.filter(
      (profile) =>
        normalizeAccountStatus(
          profile.account_status
        ) ===
        "suspended"
    ).length
  );


  setText(
    "adminCount",
    allProfiles.filter(
      (profile) =>
        normalizeRole(
          profile.role
        ) ===
        "admin"
    ).length
  );
}


/* =========================================================
   FILTERING
========================================================= */

function filteredProfiles() {
  const query =
    byId(
      "studentSearch"
    )
      ?.value
      ?.trim()
      .toLowerCase() ||
    "";


  const status =
    byId(
      "statusFilter"
    )
      ?.value ||
    "all";


  const role =
    byId(
      "roleFilter"
    )
      ?.value ||
    "all";


  return allProfiles.filter(
    (profile) => {
      const haystack = [
        profile.full_name,
        profile.username,
        profile.email,
        profile.phone_e164,
        profile.academic_year,
        profile.institution
      ]
        .map(
          (value) =>
            String(
              value ||
              ""
            )
        )
        .join(
          " "
        )
        .toLowerCase();


      const matchesSearch =
        !query ||
        haystack.includes(
          query
        );


      const matchesStatus =
        status ===
          "all" ||
        normalizeAccountStatus(
          profile.account_status
        ) ===
          status;


      const matchesRole =
        role ===
          "all" ||
        normalizeRole(
          profile.role
        ) ===
          role;


      return (
        matchesSearch &&
        matchesStatus &&
        matchesRole
      );
    }
  );
}


/* =========================================================
   STUDENT TABLE
========================================================= */

function renderRows() {
  const body =
    byId(
      "studentsBody"
    );


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
        <td
          colspan="7"
          class="table-empty"
        >
          No accounts match the current filters.
        </td>
      </tr>
    `;


    return;
  }


  body.innerHTML =
    profiles
      .map(
        (profile) => {
          const isSelf =
            String(
              profile.id
            ) ===
            String(
              currentAdmin?.id
            );


          const accountStatus =
            normalizeAccountStatus(
              profile.account_status
            );


          const role =
            normalizeRole(
              profile.role
            );


          const isSuspended =
            accountStatus ===
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
            profile.username ||
            "Unnamed user";


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
                      ${escapeHtml(
                        displayName
                      )}
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
                    profile.email ||
                    "—"
                  )}
                </div>

                <small>
                  ${escapeHtml(
                    profile.phone_e164 ||
                    "—"
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
                    profile.institution ||
                    "—"
                  )}
                </small>

              </td>


              <td>

                <span
                  class="
                    role-pill
                    role-${escapeHtml(
                      role
                    )}
                  "
                >
                  ${escapeHtml(
                    role
                  )}
                </span>

              </td>


              <td>

                <span
                  class="
                    account-pill
                    ${statusClass}
                  "
                >
                  ${escapeHtml(
                    accountStatus
                  )}
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
        }
      )
      .join(
        ""
      );
}


/* =========================================================
   LOAD PROFILES
========================================================= */

async function loadProfiles() {
  if (isLoadingProfiles) {
    return;
  }


  isLoadingProfiles =
    true;


  const body =
    byId(
      "studentsBody"
    );


  const refreshButton =
    byId(
      "refreshStudents"
    );


  if (body) {
    body.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="table-empty"
        >
          Loading registered accounts…
        </td>
      </tr>
    `;
  }


  setButtonLoading(
    refreshButton,
    true,
    "Refreshing…",
    "Refresh"
  );


  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "profiles"
        )
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
            ascending:
              false
          }
        );


    if (error) {
      throw error;
    }


    const roleOrder = {
      admin:
        0,

      student:
        1
    };


    allProfiles =
      (
        data ||
        []
      ).sort(
        (
          first,
          second
        ) => {
          const firstRole =
            normalizeRole(
              first.role
            );


          const secondRole =
            normalizeRole(
              second.role
            );


          const roleDifference =
            (
              roleOrder[
                firstRole
              ] ??
              9
            ) -
            (
              roleOrder[
                secondRole
              ] ??
              9
            );


          if (
            roleDifference !==
            0
          ) {
            return roleDifference;
          }


          return (
            new Date(
              second.created_at ||
              0
            ) -
            new Date(
              first.created_at ||
              0
            )
          );
        }
      );


    updateStats();
    renderRows();
  } finally {
    isLoadingProfiles =
      false;


    setButtonLoading(
      refreshButton,
      false,
      "Refreshing…",
      "Refresh"
    );
  }
}


/* =========================================================
   ACCOUNT STATUS
========================================================= */

async function toggleStatus(
  profile
) {
  if (
    !currentAdmin ||
    String(
      profile.id
    ) ===
    String(
      currentAdmin.id
    )
  ) {
    throw new Error(
      "You cannot suspend your own administrator account."
    );
  }


  const currentStatus =
    normalizeAccountStatus(
      profile.account_status
    );


  const nextStatus =
    currentStatus ===
      "suspended"
      ? "active"
      : "suspended";


  const verb =
    nextStatus ===
      "suspended"
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


  const {
    error
  } =
    await supabaseClient
      .from(
        "profiles"
      )
      .update({
        account_status:
          nextStatus,

        updated_at:
          new Date()
            .toISOString()
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


  showStatus(
    `Account ${
      nextStatus ===
        "suspended"
        ? "suspended"
        : "restored"
    } successfully.`
  );
}


/* =========================================================
   PASSWORD RESET
========================================================= */

async function sendReset(
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


  const redirectUrl =
    new URL(
      "reset-password.html",
      window.location.href
    );


  redirectUrl.searchParams.set(
    "edition",
    selectedEdition
  );


  const {
    error
  } =
    await supabaseClient
      .auth
      .resetPasswordForEmail(
        profile.email,
        {
          redirectTo:
            redirectUrl.href
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

function openDetails(
  profile
) {
  const content =
    byId(
      "studentDialogContent"
    );


  const dialog =
    byId(
      "studentDialog"
    );


  if (
    !content ||
    !dialog
  ) {
    throw new Error(
      "Student details dialog is missing from the HTML."
    );
  }


  content.innerHTML = `
    <div class="dialog-profile">

      ${accountAvatar(
        profile
      )}

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
            profile.email ||
            "—"
          )}
        </dd>
      </div>


      <div>
        <dt>WhatsApp</dt>
        <dd>
          ${escapeHtml(
            profile.phone_e164 ||
            "—"
          )}
        </dd>
      </div>


      <div>
        <dt>Position</dt>
        <dd>
          ${escapeHtml(
            profile.academic_year ||
            "—"
          )}
        </dd>
      </div>


      <div>
        <dt>Institution</dt>
        <dd>
          ${escapeHtml(
            profile.institution ||
            "—"
          )}
        </dd>
      </div>


      <div>
        <dt>Role</dt>
        <dd>
          ${escapeHtml(
            normalizeRole(
              profile.role
            )
          )}
        </dd>
      </div>


      <div>
        <dt>Status</dt>
        <dd>
          ${escapeHtml(
            normalizeAccountStatus(
              profile.account_status
            )
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

        <dt>
          User ID
        </dt>

        <dd class="mono">
          ${escapeHtml(
            profile.id
          )}
        </dd>

      </div>

    </dl>
  `;


  dialog.showModal();
}


/* =========================================================
   PROFILE PHOTO
========================================================= */

function openPhoto(
  profile
) {
  if (!profile.avatar_url) {
    showStatus(
      "This student has not uploaded a profile photo.",
      "error"
    );


    return;
  }


  const title =
    byId(
      "photoDialogTitle"
    );


  const image =
    byId(
      "photoDialogImage"
    );


  const dialog =
    byId(
      "photoDialog"
    );


  if (
    !title ||
    !image ||
    !dialog
  ) {
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


  if (!rows.length) {
    showStatus(
      "There are no accounts to export.",
      "error"
    );


    return;
  }


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


  const quote =
    (value) =>
      `"${String(
        value ??
        ""
      ).replace(
        /"/g,
        '""'
      )}"`;


  const csv = [
    fields
      .map(
        quote
      )
      .join(
        ","
      ),

    ...rows.map(
      (row) =>
        fields
          .map(
            (field) =>
              quote(
                row[
                  field
                ]
              )
          )
          .join(
            ","
          )
    )
  ].join(
    "\r\n"
  );


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
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    `acl-registered-accounts-${selectedEdition}-${
      new Date()
        .toISOString()
        .slice(
          0,
          10
        )
    }.csv`;


  document.body.appendChild(
    link
  );


  link.click();
  link.remove();


  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      );
    },
    0
  );


  showStatus(
    `${rows.length} account${
      rows.length ===
        1
        ? ""
        : "s"
    } exported successfully.`
  );
}


/* =========================================================
   TABLE ACTION HANDLING
========================================================= */

async function handleTableAction(
  button
) {
  const profile =
    allProfiles.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          button.dataset.id
        )
    );


  if (!profile) {
    throw new Error(
      "The selected account could not be found."
    );
  }


  const action =
    button.dataset.action;


  switch (
    action
  ) {
    case "view":
      openDetails(
        profile
      );
      break;


    case "photo":
      openPhoto(
        profile
      );
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
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  byId(
    "studentSearch"
  )?.addEventListener(
    "input",
    renderRows
  );


  byId(
    "statusFilter"
  )?.addEventListener(
    "change",
    renderRows
  );


  byId(
    "roleFilter"
  )?.addEventListener(
    "change",
    renderRows
  );


  byId(
    "refreshStudents"
  )?.addEventListener(
    "click",
    async () => {
      try {
        await loadProfiles();


        showStatus(
          "Student list refreshed."
        );
      } catch (error) {
        console.error(
          error
        );


        showStatus(
          error.message ||
          "Could not refresh students.",
          "error"
        );
      }
    }
  );


  /*
   * Supports the current HTML ID and previous legacy IDs.
   */

  byId(
    "exportCsvBtn"
  )?.addEventListener(
    "click",
    exportCsv
  );


  byId(
    "exportCsv"
  )?.addEventListener(
    "click",
    exportCsv
  );


  byId(
    "exportStudentsCsv"
  )?.addEventListener(
    "click",
    exportCsv
  );


  byId(
    "studentsBody"
  )?.addEventListener(
    "click",
    async (event) => {
      const button =
        event.target.closest(
          "button[data-action]"
        );


      if (
        !button ||
        button.disabled
      ) {
        return;
      }


      /*
       * Avatar photo button opens immediately.
       */

      if (
        button.dataset.action ===
        "photo"
      ) {
        try {
          await handleTableAction(
            button
          );
        } catch (error) {
          console.error(
            error
          );


          showStatus(
            error.message ||
            "Admin action failed.",
            "error"
          );
        }


        return;
      }


      /*
       * First click expands the action label.
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
          .forEach(
            (item) => {
              item.classList.remove(
                "is-expanded"
              );
            }
          );


        button.classList.add(
          "is-expanded"
        );


        return;
      }


      button.disabled =
        true;


      try {
        await handleTableAction(
          button
        );
      } catch (error) {
        console.error(
          error
        );


        showStatus(
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
        .forEach(
          (item) => {
            item.classList.remove(
              "is-expanded"
            );
          }
        );
    }
  );


  byId(
    "studentDialog"
  )?.addEventListener(
    "click",
    (event) => {
      const dialog =
        event.currentTarget;


      if (
        event.target ===
        dialog
      ) {
        dialog.close();
      }
    }
  );


  byId(
    "photoDialog"
  )?.addEventListener(
    "click",
    (event) => {
      const dialog =
        event.currentTarget;


      if (
        event.target ===
        dialog
      ) {
        dialog.close();
      }
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeAdminPage() {
  try {
    applyEditionContext();


    currentAdmin =
      await protectAndRender(
        "login.html"
      );


    if (!currentAdmin) {
      return;
    }


    if (
      normalizeRole(
        currentAdmin.role
      ) !==
      "admin"
    ) {
      window.location.replace(
        aclUrl(
          "modules.html",
          selectedEdition
        )
      );


      return;
    }


    bindEvents();


    await loadProfiles();


    showStatus(
      `Admin dashboard loaded for ${
        selectedEdition ===
          "basic"
          ? "Basic Edition"
          : "Expert Edition"
      }.`
    );
  } catch (error) {
    console.error(
      "Admin initialization failed:",
      error
    );


    showStatus(
      error.message ||
      "Could not load the admin dashboard.",
      "error",
      0
    );


    const body =
      byId(
        "studentsBody"
      );


    if (body) {
      body.innerHTML = `
        <tr>

          <td
            colspan="7"
            class="table-empty"
          >
            Admin data could not be loaded:
            ${escapeHtml(
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
    initializeAdminPage,
    {
      once:
        true
    }
  );
} else {
  void initializeAdminPage();
}
