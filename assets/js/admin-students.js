import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL ADMIN STUDENTS v1.0.0 LOADED"
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


let adminProfile =
  null;


let students =
  [];


let isLoading =
  false;


let isSaving =
  false;


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
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[
        character
      ]
  );
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


  return [
    "admin",
    "administrator"
  ].includes(
    role
  )
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


  if (
    [
      "suspended",
      "blocked",
      "disabled"
    ].includes(
      status
    )
  ) {
    return "suspended";
  }


  if (
    [
      "pending",
      "inactive"
    ].includes(
      status
    )
  ) {
    return "pending";
  }


  return "active";
}


function isAdminProfile(
  profile
) {
  const role =
    String(
      profile?.role ||
      ""
    )
      .trim()
      .toLowerCase();


  return Boolean(
    profile?.is_admin ||
    role === "admin" ||
    role === "administrator"
  );
}


function displayName(
  student
) {
  return (
    student.full_name ||
    student.display_name ||
    student.username ||
    student.email ||
    "ACL Account"
  );
}


function initials(
  student
) {
  const name =
    displayName(
      student
    );


  return name
    .split(
      /\s+/
    )
    .filter(
      Boolean
    )
    .slice(
      0,
      2
    )
    .map(
      (word) =>
        word[
          0
        ]?.toUpperCase() ||
        ""
    )
    .join(
      ""
    ) ||
    "ACL";
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


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle:
        "medium"
    }
  ).format(
    date
  );
}


function setStatus(
  message = "",
  type = ""
) {
  const box =
    byId(
      "studentStatus"
    );


  if (!box) {
    return;
  }


  box.textContent =
    message;


  box.className =
    `status-box ${type}`.trim();


  box.hidden =
    !message;
}


function setButtonBusy(
  button,
  busy,
  busyText,
  normalText
) {
  if (!button) {
    return;
  }


  button.disabled =
    busy;


  button.textContent =
    busy
      ? busyText
      : normalText;
}


/* =========================================================
   EDITION CONTEXT
========================================================= */

function applyEditionContext() {
  const isBasic =
    selectedEdition ===
    "basic";


  const badge =
    byId(
      "adminStudentsEditionBadge"
    );


  const themeColor =
    byId(
      "adminStudentsThemeColor"
    );


  if (badge) {
    badge.textContent =
      isBasic
        ? "BASIC EDITION"
        : "EXPERT EDITION";
  }


  if (themeColor) {
    themeColor.content =
      isBasic
        ? "#105541"
        : "#123f72";
  }


  const links = {
    adminStudentsDashboardLink:
      "admin.html",

    adminStudentsAccessLink:
      "admin-access.html"
  };


  Object.entries(
    links
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
    `Student Management | ACL ${
      isBasic
        ? "Basic Edition"
        : "Expert Edition"
    } Admin`;


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
   LOAD STUDENTS
========================================================= */

async function loadStudents() {
  if (isLoading) {
    return;
  }


  isLoading =
    true;


  const refreshButton =
    byId(
      "refreshStudents"
    );


  setButtonBusy(
    refreshButton,
    true,
    "Refreshing…",
    "Refresh"
  );


  setStatus(
    "Loading registered accounts…"
  );


  byId(
    "studentTableBody"
  ).innerHTML = `
    <tr>
      <td
        class="student-empty"
        colspan="8"
      >
        Loading registered accounts…
      </td>
    </tr>
  `;


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
          email,
          full_name,
          username,
          academic_year,
          institution,
          phone_e164,
          role,
          account_status,
          avatar_url,
          created_at,
          updated_at
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


    students =
      (
        data ||
        []
      ).map(
        (student) => ({
          ...student,

          role:
            normalizeRole(
              student.role
            ),

          account_status:
            normalizeAccountStatus(
              student.account_status
            )
        })
      );


    renderStatistics();
    renderStudents();


    setStatus(
      ""
    );
  } catch (error) {
    console.error(
      "STUDENT LOAD ERROR:",
      error
    );


    students =
      [];


    renderStatistics();


    byId(
      "studentTableBody"
    ).innerHTML = `
      <tr>
        <td
          class="student-empty"
          colspan="8"
        >
          Registered accounts could not be loaded.
        </td>
      </tr>
    `;


    setStatus(
      error.message ||
      "Registered accounts could not be loaded.",
      "error"
    );
  } finally {
    isLoading =
      false;


    setButtonBusy(
      refreshButton,
      false,
      "Refreshing…",
      "Refresh"
    );
  }
}


/* =========================================================
   STATISTICS
========================================================= */

function renderStatistics() {
  byId(
    "studentTotalCount"
  ).textContent =
    String(
      students.length
    );


  byId(
    "studentActiveCount"
  ).textContent =
    String(
      students.filter(
        (student) =>
          normalizeAccountStatus(
            student.account_status
          ) ===
          "active"
      ).length
    );


  byId(
    "studentSuspendedCount"
  ).textContent =
    String(
      students.filter(
        (student) =>
          normalizeAccountStatus(
            student.account_status
          ) ===
          "suspended"
      ).length
    );


  byId(
    "studentAdminCount"
  ).textContent =
    String(
      students.filter(
        (student) =>
          normalizeRole(
            student.role
          ) ===
          "admin"
      ).length
    );
}


/* =========================================================
   FILTER STUDENTS
========================================================= */

function filteredStudents() {
  const search =
    byId(
      "studentSearch"
    )
      .value
      .trim()
      .toLowerCase();


  const role =
    byId(
      "studentRoleFilter"
    ).value;


  const accountStatus =
    byId(
      "studentStatusFilter"
    ).value;


  return students.filter(
    (student) => {
      const matchesRole =
        role === "all" ||
        normalizeRole(
          student.role
        ) ===
        role;


      const matchesStatus =
        accountStatus ===
          "all" ||
        normalizeAccountStatus(
          student.account_status
        ) ===
        accountStatus;


      const searchableText = [
        student.full_name,
        student.display_name,
        student.username,
        student.email,
        student.phone_e164,
        student.institution,
        student.academic_year,
        student.role,
        student.account_status
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
        !search ||
        searchableText.includes(
          search
        );


      return (
        matchesRole &&
        matchesStatus &&
        matchesSearch
      );
    }
  );
}


/* =========================================================
   STUDENT ROW
========================================================= */

function studentRowHtml(
  student
) {
  const status =
    normalizeAccountStatus(
      student.account_status
    );


  const role =
    normalizeRole(
      student.role
    );


  const avatar =
    student.avatar_url
      ? `
        <img
          src="${escapeHtml(
            student.avatar_url
          )}"
          alt=""
          loading="lazy"
        >
      `
      : escapeHtml(
          initials(
            student
          )
        );


  const isCurrentAdmin =
    String(
      student.id
    ) ===
    String(
      adminProfile?.id
    );


  return `
    <tr data-student-id="${escapeHtml(
      student.id
    )}">

      <td>

        <div class="student-name-cell">

          <span class="student-avatar">
            ${avatar}
          </span>


          <span>

            <strong>
              ${escapeHtml(
                displayName(
                  student
                )
              )}
            </strong>

            <small>
              ${escapeHtml(
                student.email ||
                student.username ||
                "No email"
              )}
            </small>

          </span>

        </div>

      </td>


      <td>
        ${escapeHtml(
          student.academic_year ||
          "—"
        )}
      </td>


      <td>
        ${escapeHtml(
          student.institution ||
          "—"
        )}
      </td>


      <td>
        ${escapeHtml(
          student.phone_e164 ||
          "—"
        )}
      </td>


      <td>
        ${escapeHtml(
          role === "admin"
            ? "Administrator"
            : "Student"
        )}
      </td>


      <td>

        <span
          class="
            student-status
            ${escapeHtml(
              status
            )}
          "
        >
          ${escapeHtml(
            status
          )}
        </span>

      </td>


      <td>
        ${escapeHtml(
          formatDate(
            student.created_at
          )
        )}
      </td>


      <td>

        <div class="student-actions">

          <button
            class="secondary-btn edit-student"
            type="button"
          >
            Edit
          </button>


          <button
            class="${
              status === "active"
                ? "danger-btn"
                : "secondary-btn"
            } quick-student-status"
            type="button"
            data-next-status="${
              status === "active"
                ? "suspended"
                : "active"
            }"
            ${
              isCurrentAdmin
                ? "disabled"
                : ""
            }
          >
            ${
              status === "active"
                ? "Suspend"
                : "Activate"
            }
          </button>

        </div>

      </td>

    </tr>
  `;
}


/* =========================================================
   RENDER STUDENTS
========================================================= */

function renderStudents() {
  const rows =
    filteredStudents();


  byId(
    "studentVisibleCount"
  ).textContent =
    `${rows.length} account${
      rows.length === 1
        ? ""
        : "s"
    }`;


  byId(
    "studentTableBody"
  ).innerHTML =
    rows.length
      ? rows
          .map(
            studentRowHtml
          )
          .join(
            ""
          )
      : `
        <tr>
          <td
            class="student-empty"
            colspan="8"
          >
            No accounts match the selected filters.
          </td>
        </tr>
      `;
}


/* =========================================================
   OPEN EDITOR
========================================================= */

function openStudentEditor(
  student
) {
  if (!student) {
    return;
  }


  byId(
    "studentEditorId"
  ).value =
    student.id;


  byId(
    "studentEditorName"
  ).textContent =
    displayName(
      student
    );


  byId(
    "studentEditorEmail"
  ).textContent =
    student.email ||
    student.username ||
    "No email available";


  byId(
    "studentEditorRole"
  ).value =
    normalizeRole(
      student.role
    );


  byId(
    "studentEditorStatus"
  ).value =
    normalizeAccountStatus(
      student.account_status
    );


  const isCurrentAdmin =
    String(
      student.id
    ) ===
    String(
      adminProfile?.id
    );


  byId(
    "studentEditorRole"
  ).disabled =
    isCurrentAdmin;


  byId(
    "studentEditorStatus"
  ).disabled =
    isCurrentAdmin;


  byId(
    "saveStudentEditor"
  ).disabled =
    isCurrentAdmin;


  byId(
    "studentEditorDialog"
  ).showModal();
}


/* =========================================================
   SAVE STUDENT
========================================================= */

async function saveStudentChanges() {
  if (isSaving) {
    return;
  }


  const id =
    byId(
      "studentEditorId"
    ).value;


  const student =
    students.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          id
        )
    );


  if (!student) {
    throw new Error(
      "The selected account could not be found."
    );
  }


  if (
    String(
      student.id
    ) ===
    String(
      adminProfile.id
    )
  ) {
    throw new Error(
      "You cannot change your own administrator role or account status from this page."
    );
  }


  const payload = {
    role:
      normalizeRole(
        byId(
          "studentEditorRole"
        ).value
      ),

    account_status:
      normalizeAccountStatus(
        byId(
          "studentEditorStatus"
        ).value
      )
  };


  isSaving =
    true;


  const saveButton =
    byId(
      "saveStudentEditor"
    );


  setButtonBusy(
    saveButton,
    true,
    "Saving…",
    "Save changes"
  );


  setStatus(
    "Saving account changes…"
  );


  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "profiles"
        )
        .update(
          payload
        )
        .eq(
          "id",
          id
        );


    if (error) {
      throw error;
    }


    byId(
      "studentEditorDialog"
    ).close();


    await loadStudents();


    setStatus(
      "Account updated successfully.",
      "success"
    );
  } finally {
    isSaving =
      false;


    setButtonBusy(
      saveButton,
      false,
      "Saving…",
      "Save changes"
    );
  }
}


/* =========================================================
   QUICK STATUS
========================================================= */

async function updateStudentStatus(
  student,
  nextStatus,
  button
) {
  if (
    String(
      student.id
    ) ===
    String(
      adminProfile.id
    )
  ) {
    setStatus(
      "You cannot suspend your own administrator account.",
      "error"
    );


    return;
  }


  const confirmed =
    window.confirm(
      nextStatus ===
        "suspended"
        ? `Suspend ${displayName(
            student
          )}?`
        : `Activate ${displayName(
            student
          )}?`
    );


  if (!confirmed) {
    return;
  }


  const normalText =
    button.textContent.trim();


  setButtonBusy(
    button,
    true,
    "Updating…",
    normalText
  );


  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "profiles"
        )
        .update({
          account_status:
            normalizeAccountStatus(
              nextStatus
            )
        })
        .eq(
          "id",
          student.id
        );


    if (error) {
      throw error;
    }


    await loadStudents();


    setStatus(
      nextStatus ===
        "suspended"
        ? "Account suspended."
        : "Account activated.",
      "success"
    );
  } catch (error) {
    setStatus(
      error.message ||
      "The account status could not be updated.",
      "error"
    );
  } finally {
    setButtonBusy(
      button,
      false,
      "Updating…",
      normalText
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  byId(
    "refreshStudents"
  )?.addEventListener(
    "click",
    loadStudents
  );


  byId(
    "studentSearch"
  )?.addEventListener(
    "input",
    renderStudents
  );


  byId(
    "studentRoleFilter"
  )?.addEventListener(
    "change",
    renderStudents
  );


  byId(
    "studentStatusFilter"
  )?.addEventListener(
    "change",
    renderStudents
  );


  byId(
    "studentTableBody"
  )?.addEventListener(
    "click",
    async (event) => {
      const row =
        event.target.closest(
          "[data-student-id]"
        );


      if (!row) {
        return;
      }


      const student =
        students.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              row.dataset.studentId
            )
        );


      if (!student) {
        return;
      }


      if (
        event.target.closest(
          ".edit-student"
        )
      ) {
        openStudentEditor(
          student
        );


        return;
      }


      const quickButton =
        event.target.closest(
          ".quick-student-status"
        );


      if (quickButton) {
        await updateStudentStatus(
          student,
          quickButton.dataset.nextStatus,
          quickButton
        );
      }
    }
  );


  byId(
    "studentEditorForm"
  )?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      try {
        await saveStudentChanges();
      } catch (error) {
        console.error(
          "STUDENT SAVE ERROR:",
          error
        );


        setStatus(
          error.message ||
          "The account could not be updated.",
          "error"
        );
      }
    }
  );


  byId(
    "closeStudentEditor"
  )?.addEventListener(
    "click",
    () => {
      byId(
        "studentEditorDialog"
      ).close();
    }
  );


  byId(
    "cancelStudentEditor"
  )?.addEventListener(
    "click",
    () => {
      byId(
        "studentEditorDialog"
      ).close();
    }
  );


  byId(
    "studentEditorDialog"
  )?.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        byId(
          "studentEditorDialog"
        )
      ) {
        byId(
          "studentEditorDialog"
        ).close();
      }
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeAdminStudents() {
  try {
    applyEditionContext();


    adminProfile =
      await protectAndRender(
        "login.html"
      );


    if (!adminProfile) {
      return;
    }


    if (
      !isAdminProfile(
        adminProfile
      )
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


    await loadStudents();
  } catch (error) {
    console.error(
      "ADMIN STUDENTS INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Student management could not be initialized.",
      "error"
    );


    byId(
      "studentTableBody"
    ).innerHTML = `
      <tr>
        <td
          class="student-empty"
          colspan="8"
        >
          Student management could not be loaded.
        </td>
      </tr>
    `;
  }
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAdminStudents,
    {
      once:
        true
    }
  );
} else {
  void initializeAdminStudents();
}
