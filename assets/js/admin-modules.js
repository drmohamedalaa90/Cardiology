import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL ADMIN MODULES v3.0.0 LOADED"
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


const grid =
  byId(
    "adminModulesGrid"
  );


const dialog =
  byId(
    "moduleDialog"
  );


const form =
  byId(
    "moduleForm"
  );


let allModules =
  [];


let adminProfile =
  null;


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


function titleCase(
  value
) {
  return String(
    value ||
    ""
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}


function numberValue(
  value,
  fallback = 0
) {
  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


function slugify(
  value
) {
  return String(
    value ||
    ""
  )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}


function toLocalInput(
  value
) {
  if (!value) {
    return "";
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
    return "";
  }


  const timezoneOffset =
    date.getTimezoneOffset() *
    60000;


  return new Date(
    date.getTime() -
    timezoneOffset
  )
    .toISOString()
    .slice(
      0,
      16
    );
}


function toIso(
  value
) {
  if (!value) {
    return null;
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
    return null;
  }


  return date.toISOString();
}


function setStatus(
  message = "",
  type = ""
) {
  const box =
    byId(
      "adminModulesStatus"
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


function normalizeStatus(
  value
) {
  const status =
    String(
      value ||
      "draft"
    )
      .trim()
      .toLowerCase();


  return [
    "published",
    "coming_soon",
    "draft",
    "archived"
  ].includes(
    status
  )
    ? status
    : "draft";
}


function normalizeDifficulty(
  value
) {
  const difficulty =
    String(
      value ||
      "foundation"
    )
      .trim()
      .toLowerCase();


  return [
    "foundation",
    "intermediate",
    "advanced",
    "expert"
  ].includes(
    difficulty
  )
    ? difficulty
    : "foundation";
}


function normalizeAccessType(
  value
) {
  const accessType =
    String(
      value ||
      "open"
    )
      .trim()
      .toLowerCase();


  return [
    "open",
    "subscription",
    "passcode",
    "minimum_score",
    "admin_assigned"
  ].includes(
    accessType
  )
    ? accessType
    : "open";
}


/* =========================================================
   EDITION SETUP
========================================================= */

function applyEditionContext() {
  const badge =
    byId(
      "adminModulesEditionBadge"
    );


  const themeColor =
    byId(
      "adminModulesThemeColor"
    );


  if (badge) {
    badge.textContent =
      selectedEdition ===
        "basic"
        ? "BASIC EDITION"
        : "EXPERT EDITION";
  }


  if (themeColor) {
    themeColor.content =
      selectedEdition ===
        "basic"
        ? "#105541"
        : "#123f72";
  }


  const links = {
    adminModulesStudentsLink:
      "admin.html",

    adminModulesQuestionsLink:
      "admin-questions.html"
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
    `Manage Modules | ACL ${
      selectedEdition ===
        "basic"
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
   STATISTICS
========================================================= */

function renderStats() {
  byId(
    "moduleTotal"
  ).textContent =
    String(
      allModules.length
    );


  byId(
    "modulePublished"
  ).textContent =
    String(
      allModules.filter(
        (module) =>
          normalizeStatus(
            module.status
          ) ===
          "published"
      ).length
    );


  byId(
    "moduleComing"
  ).textContent =
    String(
      allModules.filter(
        (module) =>
          normalizeStatus(
            module.status
          ) ===
          "coming_soon"
      ).length
    );


  byId(
    "moduleHidden"
  ).textContent =
    String(
      allModules.filter(
        (module) =>
          [
            "draft",
            "archived"
          ].includes(
            normalizeStatus(
              module.status
            )
          )
      ).length
    );
}


/* =========================================================
   MODULE CARD
========================================================= */

function moduleCardHtml(
  module
) {
  const status =
    normalizeStatus(
      module.status
    );


  const difficulty =
    normalizeDifficulty(
      module.difficulty
    );


  const accessType =
    normalizeAccessType(
      module.access_type
    );


  const description =
    module.short_description ||
    module.description ||
    "No description";


  return `
    <article
      class="admin-module-card"
      data-id="${escapeHtml(
        module.id
      )}"
    >

      <div class="admin-module-card-head">

        <div>

          <span
            class="
              status-pill
              ${escapeHtml(
                status
              )}
            "
          >
            ${escapeHtml(
              titleCase(
                status
              )
            )}
          </span>


          <h2>
            ${escapeHtml(
              module.title ||
              "Untitled module"
            )}
          </h2>


          <code>
            ${escapeHtml(
              module.slug ||
              module.id
            )}
          </code>

        </div>


        <span class="order-badge">
          #${numberValue(
            module.display_order
          )}
        </span>

      </div>


      <div class="admin-module-card-body">

        <p>
          ${escapeHtml(
            description
          )}
        </p>


        <div class="module-admin-meta">

          <span>
            ${escapeHtml(
              module.category ||
              "General Cardiology"
            )}
          </span>

          <span>
            ${escapeHtml(
              titleCase(
                difficulty
              )
            )}
          </span>

          <span>
            ${escapeHtml(
              titleCase(
                accessType
              )
            )}
          </span>

          <span>
            ${numberValue(
              module.question_count
            )}
            Qs
          </span>

        </div>


        <div class="admin-module-flags">

          ${
            module.learning_mode_enabled
              ? "<span>Learning</span>"
              : ""
          }

          ${
            module.competition_mode_enabled
              ? "<span>Competition</span>"
              : ""
          }

          ${
            module.is_featured
              ? "<span>Featured</span>"
              : ""
          }

        </div>

      </div>


      <div class="admin-module-card-actions">

        <button
          class="secondary-btn edit-module"
          type="button"
        >
          Edit
        </button>


        <button
          class="secondary-btn quick-status"
          type="button"
          data-status="${
            status ===
              "published"
              ? "draft"
              : "published"
          }"
        >
          ${
            status ===
              "published"
              ? "Unpublish"
              : "Publish"
          }
        </button>

      </div>

    </article>
  `;
}


/* =========================================================
   FILTER MODULES
========================================================= */

function applyFilters() {
  if (!grid) {
    return;
  }


  const query =
    byId(
      "moduleSearch"
    )
      ?.value
      .trim()
      .toLowerCase() ||
    "";


  const selectedStatus =
    byId(
      "moduleStatusFilter"
    )
      ?.value ||
    "all";


  const filtered =
    allModules.filter(
      (module) => {
        const matchesStatus =
          selectedStatus ===
            "all" ||
          normalizeStatus(
            module.status
          ) ===
            selectedStatus;


        const searchableText = [
          module.title,
          module.slug,
          module.category,
          module.short_description,
          module.description,
          module.full_description
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
          searchableText.includes(
            query
          );


        return (
          matchesStatus &&
          matchesSearch
        );
      }
    );


  grid.innerHTML =
    filtered.length
      ? filtered
          .map(
            moduleCardHtml
          )
          .join(
            ""
          )
      : `
        <div class="empty-state">
          No modules match these filters.
        </div>
      `;
}


/* =========================================================
   LOAD MODULES
========================================================= */

async function loadModules() {
  if (isLoading) {
    return;
  }


  isLoading =
    true;


  const refreshButton =
    byId(
      "refreshModules"
    );


  setButtonBusy(
    refreshButton,
    true,
    "Refreshing…",
    "Refresh"
  );


  setStatus(
    "Loading modules…"
  );


  if (grid) {
    grid.innerHTML = `
      <div class="empty-state">
        Loading ${escapeHtml(
          selectedEdition ===
            "basic"
            ? "Basic Edition"
            : "Expert Edition"
        )} modules…
      </div>
    `;
  }


  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "modules"
        )
        .select(
          "*"
        )
        .eq(
          "edition",
          selectedEdition
        )
        .order(
          "display_order",
          {
            ascending:
              true
          }
        )
        .order(
          "title",
          {
            ascending:
              true
          }
        );


    if (error) {
      throw error;
    }


    allModules =
      data ||
      [];


    renderStats();
    applyFilters();


    setStatus(
      ""
    );
  } catch (error) {
    console.error(
      "MODULE LOAD ERROR:",
      error
    );


    allModules =
      [];


    renderStats();


    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          Modules could not be loaded.
        </div>
      `;
    }


    setStatus(
      error.message ||
      "Modules could not be loaded.",
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
   FORM
========================================================= */

function fillForm(
  module = null
) {
  if (
    !form ||
    !dialog
  ) {
    return;
  }


  form.reset();


  byId(
    "moduleDialogTitle"
  ).textContent =
    module
      ? "Edit module"
      : "Create module";


  byId(
    "moduleOriginalId"
  ).value =
    module?.id ||
    "";


  byId(
    "moduleTitle"
  ).value =
    module?.title ||
    "";


  byId(
    "moduleSlug"
  ).value =
    module?.slug ||
    module?.id ||
    "";


  byId(
    "moduleShortDescription"
  ).value =
    module?.short_description ||
    module?.description ||
    "";


  byId(
    "moduleFullDescription"
  ).value =
    module?.full_description ||
    "";


  byId(
    "moduleCategory"
  ).value =
    module?.category ||
    "General Cardiology";


  byId(
    "moduleDifficulty"
  ).value =
    normalizeDifficulty(
      module?.difficulty ||
      (
        selectedEdition ===
          "expert"
          ? "expert"
          : "foundation"
      )
    );


  byId(
    "moduleStatus"
  ).value =
    normalizeStatus(
      module?.status
    );


  byId(
    "moduleAccessType"
  ).value =
    normalizeAccessType(
      module?.access_type
    );


  byId(
    "moduleMinimumScore"
  ).value =
    module?.minimum_score ??
    0;


  byId(
    "moduleEstimatedMinutes"
  ).value =
    module?.estimated_minutes ??
    10;


  byId(
    "moduleQuestionCount"
  ).value =
    module?.question_count ??
    0;


  byId(
    "moduleDisplayOrder"
  ).value =
    module?.display_order ??
    100;


  byId(
    "moduleOpensAt"
  ).value =
    toLocalInput(
      module?.opens_at
    );


  byId(
    "moduleClosesAt"
  ).value =
    toLocalInput(
      module?.closes_at
    );


  byId(
    "moduleCoverUrl"
  ).value =
    module?.cover_image_url ||
    "";


  byId(
    "moduleLaunchPath"
  ).value =
    module?.launch_path ||
    "";


  byId(
    "moduleLearning"
  ).checked =
    module?.learning_mode_enabled ??
    true;


  byId(
    "moduleCompetition"
  ).checked =
    module?.competition_mode_enabled ??
    false;


  byId(
    "moduleFeatured"
  ).checked =
    module?.is_featured ??
    false;


  byId(
    "deleteModuleButton"
  ).hidden =
    !module;


  byId(
    "moduleSlug"
  ).readOnly =
    Boolean(
      module
    );


  dialog.showModal();
}


/* =========================================================
   PAYLOAD
========================================================= */

function buildPayload() {
  const existingId =
    byId(
      "moduleOriginalId"
    ).value.trim();


  const slug =
    slugify(
      byId(
        "moduleSlug"
      ).value ||
      byId(
        "moduleTitle"
      ).value
    );


  return {
    id:
      existingId ||
      slug,

    slug,

    edition:
      selectedEdition,

    title:
      byId(
        "moduleTitle"
      ).value.trim(),

    description:
      byId(
        "moduleShortDescription"
      ).value.trim(),

    short_description:
      byId(
        "moduleShortDescription"
      ).value.trim(),

    full_description:
      byId(
        "moduleFullDescription"
      ).value.trim() ||
      null,

    category:
      byId(
        "moduleCategory"
      ).value.trim() ||
      "General Cardiology",

    difficulty:
      normalizeDifficulty(
        byId(
          "moduleDifficulty"
        ).value
      ),

    status:
      normalizeStatus(
        byId(
          "moduleStatus"
        ).value
      ),

    access_type:
      normalizeAccessType(
        byId(
          "moduleAccessType"
        ).value
      ),

    minimum_score:
      Math.max(
        0,
        numberValue(
          byId(
            "moduleMinimumScore"
          ).value
        )
      ),

    estimated_minutes:
      Math.max(
        1,
        numberValue(
          byId(
            "moduleEstimatedMinutes"
          ).value,
          10
        )
      ),

    question_count:
      Math.max(
        0,
        numberValue(
          byId(
            "moduleQuestionCount"
          ).value
        )
      ),

    display_order:
      numberValue(
        byId(
          "moduleDisplayOrder"
        ).value,
        100
      ),

    opens_at:
      toIso(
        byId(
          "moduleOpensAt"
        ).value
      ),

    closes_at:
      toIso(
        byId(
          "moduleClosesAt"
        ).value
      ),

    cover_image_url:
      byId(
        "moduleCoverUrl"
      ).value.trim() ||
      null,

    launch_path:
      byId(
        "moduleLaunchPath"
      ).value.trim() ||
      null,

    learning_mode_enabled:
      byId(
        "moduleLearning"
      ).checked,

    competition_mode_enabled:
      byId(
        "moduleCompetition"
      ).checked,

    is_featured:
      byId(
        "moduleFeatured"
      ).checked,

    created_by:
      adminProfile.id
  };
}


/* =========================================================
   VALIDATION
========================================================= */

function validatePayload(
  payload
) {
  if (!payload.title) {
    throw new Error(
      "Module title is required."
    );
  }


  if (!payload.slug) {
    throw new Error(
      "Module slug is required."
    );
  }


  if (
    !/^[a-z0-9-]+$/.test(
      payload.slug
    )
  ) {
    throw new Error(
      "The module slug may contain only lowercase letters, numbers, and hyphens."
    );
  }


  if (!payload.description) {
    throw new Error(
      "Short description is required."
    );
  }


  if (
    payload.opens_at &&
    payload.closes_at &&
    new Date(
      payload.closes_at
    ) <=
      new Date(
        payload.opens_at
      )
  ) {
    throw new Error(
      "Closing time must be after opening time."
    );
  }


  return true;
}


/* =========================================================
   SAVE MODULE
========================================================= */

async function saveModule() {
  if (isSaving) {
    return;
  }


  const payload =
    buildPayload();


  validatePayload(
    payload
  );


  isSaving =
    true;


  const saveButton =
    form.querySelector(
      'button[type="submit"]'
    );


  setButtonBusy(
    saveButton,
    true,
    "Saving…",
    "Save module"
  );


  setStatus(
    "Saving module…"
  );


  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "modules"
        )
        .upsert(
          payload,
          {
            onConflict:
              "id"
          }
        );


    if (error) {
      throw error;
    }


    dialog.close();


    await loadModules();


    setStatus(
      "Module saved successfully.",
      "success"
    );
  } catch (error) {
    console.error(
      "MODULE SAVE ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The module could not be saved.",
      "error"
    );
  } finally {
    isSaving =
      false;


    setButtonBusy(
      saveButton,
      false,
      "Saving…",
      "Save module"
    );
  }
}


/* =========================================================
   ARCHIVE MODULE
========================================================= */

async function archiveModule() {
  const id =
    byId(
      "moduleOriginalId"
    ).value.trim();


  if (!id) {
    return;
  }


  const confirmed =
    window.confirm(
      "Archive this module? Existing quiz attempts will be preserved."
    );


  if (!confirmed) {
    return;
  }


  const button =
    byId(
      "deleteModuleButton"
    );


  setButtonBusy(
    button,
    true,
    "Archiving…",
    "Archive module"
  );


  setStatus(
    "Archiving module…"
  );


  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "modules"
        )
        .update({
          status:
            "archived"
        })
        .eq(
          "id",
          id
        )
        .eq(
          "edition",
          selectedEdition
        );


    if (error) {
      throw error;
    }


    dialog.close();


    await loadModules();


    setStatus(
      "Module archived successfully.",
      "success"
    );
  } catch (error) {
    console.error(
      "MODULE ARCHIVE ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The module could not be archived.",
      "error"
    );
  } finally {
    setButtonBusy(
      button,
      false,
      "Archiving…",
      "Archive module"
    );
  }
}


/* =========================================================
   QUICK STATUS
========================================================= */

async function updateModuleStatus(
  module,
  nextStatus,
  button
) {
  setButtonBusy(
    button,
    true,
    "Updating…",
    button.textContent
  );


  setStatus(
    "Updating module status…"
  );


  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "modules"
        )
        .update({
          status:
            normalizeStatus(
              nextStatus
            )
        })
        .eq(
          "id",
          module.id
        )
        .eq(
          "edition",
          selectedEdition
        );


    if (error) {
      throw error;
    }


    await loadModules();


    setStatus(
      nextStatus ===
        "published"
        ? "Module published."
        : "Module moved to draft.",
      "success"
    );
  } catch (error) {
    console.error(
      "MODULE STATUS ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Module status could not be updated.",
      "error"
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  form?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      await saveModule();
    }
  );


  byId(
    "newModuleButton"
  )?.addEventListener(
    "click",
    () => {
      fillForm();
    }
  );


  byId(
    "closeModuleDialog"
  )?.addEventListener(
    "click",
    () => {
      dialog.close();
    }
  );


  byId(
    "cancelModuleButton"
  )?.addEventListener(
    "click",
    () => {
      dialog.close();
    }
  );


  byId(
    "refreshModules"
  )?.addEventListener(
    "click",
    loadModules
  );


  byId(
    "moduleSearch"
  )?.addEventListener(
    "input",
    applyFilters
  );


  byId(
    "moduleStatusFilter"
  )?.addEventListener(
    "change",
    applyFilters
  );


  byId(
    "moduleTitle"
  )?.addEventListener(
    "input",
    () => {
      if (
        !byId(
          "moduleOriginalId"
        ).value
      ) {
        byId(
          "moduleSlug"
        ).value =
          slugify(
            byId(
              "moduleTitle"
            ).value
          );
      }
    }
  );


  byId(
    "deleteModuleButton"
  )?.addEventListener(
    "click",
    archiveModule
  );


  grid?.addEventListener(
    "click",
    async (event) => {
      const cardElement =
        event.target.closest(
          ".admin-module-card"
        );


      if (!cardElement) {
        return;
      }


      const module =
        allModules.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              cardElement.dataset.id
            )
        );


      if (!module) {
        return;
      }


      if (
        event.target.closest(
          ".edit-module"
        )
      ) {
        fillForm(
          module
        );


        return;
      }


      const quickButton =
        event.target.closest(
          ".quick-status"
        );


      if (quickButton) {
        await updateModuleStatus(
          module,
          quickButton.dataset.status,
          quickButton
        );
      }
    }
  );


  dialog?.addEventListener(
    "click",
    (event) => {
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

async function initializeAdminModules() {
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
      adminProfile.role !==
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


    await loadModules();
  } catch (error) {
    console.error(
      "ADMIN MODULES INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The module manager could not be initialized.",
      "error"
    );


    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          Module management could not be loaded.
        </div>
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
    initializeAdminModules,
    {
      once:
        true
    }
  );
} else {
  void initializeAdminModules();
}
