import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL ADMIN COMPETITIONS v3.0.0 LOADED"
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


let modules =
  [];


let quizzes =
  [];


let competitions =
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
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
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
    "draft",
    "published",
    "archived"
  ].includes(
    status
  )
    ? status
    : "draft";
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


function setStatus(
  message = "",
  type = ""
) {
  const box =
    byId(
      "status"
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


function moduleIds() {
  return modules
    .map(
      (module) =>
        module.id
    )
    .filter(
      Boolean
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


function formatDateTime(
  value
) {
  if (!value) {
    return "Not scheduled";
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
    return "Invalid date";
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  ).format(
    date
  );
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
      "adminCompetitionsEditionBadge"
    );


  const themeColor =
    byId(
      "adminCompetitionsThemeColor"
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


  const editionLinks = {
    adminCompetitionsDashboardLink:
      "admin.html",

    adminCompetitionsQuizLink:
      "admin-quizzes.html"
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
    `Competition Manager | ACL ${
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
   LOAD MODULES
========================================================= */

async function loadModules() {
  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "modules"
      )
      .select(`
        id,
        title,
        status,
        edition,
        display_order
      `)
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


  modules =
    data ||
    [];


  renderModuleOptions();
}


/* =========================================================
   LOAD QUIZZES
========================================================= */

async function loadQuizzes() {
  const ids =
    moduleIds();


  if (!ids.length) {
    quizzes =
      [];


    renderQuizOptions();


    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "quizzes"
      )
      .select(`
        id,
        module_id,
        title,
        status,
        edition,
        display_order
      `)
      .eq(
        "edition",
        selectedEdition
      )
      .in(
        "module_id",
        ids
      )
      .neq(
        "status",
        "archived"
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


  quizzes =
    data ||
    [];


  renderQuizOptions();
}


/* =========================================================
   LOAD COMPETITIONS
========================================================= */

async function loadCompetitions() {
  if (isLoading) {
    return;
  }


  isLoading =
    true;


  setStatus(
    "Loading competitions…"
  );


  byId(
    "competitionList"
  ).innerHTML = `
    <div class="empty-state">
      Loading competitions…
    </div>
  `;


  try {
    const ids =
      moduleIds();


    if (!ids.length) {
      competitions =
        [];


      renderCompetitions();


      setStatus(
        "No modules are available in this edition.",
        "warning"
      );


      return;
    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "competitions"
        )
        .select(
          "*"
        )
        .in(
          "module_id",
          ids
        )
        .order(
          "opens_at",
          {
            ascending:
              false
          }
        );


    if (error) {
      throw error;
    }


    competitions =
      (
        data ||
        []
      ).map(
        (competition) => ({
          ...competition,

          status:
            normalizeStatus(
              competition.status
            )
        })
      );


    renderCompetitions();


    setStatus(
      ""
    );
  } catch (error) {
    console.error(
      "COMPETITION LOAD ERROR:",
      error
    );


    competitions =
      [];


    byId(
      "competitionList"
    ).innerHTML = `
      <div class="empty-state">
        Competitions could not be loaded.
      </div>
    `;


    setStatus(
      error.message ||
      "Competitions could not be loaded.",
      "error"
    );
  } finally {
    isLoading =
      false;
  }
}


/* =========================================================
   MODULE AND QUIZ OPTIONS
========================================================= */

function renderModuleOptions(
  selectedId = ""
) {
  const select =
    byId(
      "moduleId"
    );


  if (!select) {
    return;
  }


  select.innerHTML =
    modules.length
      ? modules
          .map(
            (module) => `
              <option
                value="${escapeHtml(
                  module.id
                )}"
                ${
                  String(
                    module.id
                  ) ===
                  String(
                    selectedId
                  )
                    ? "selected"
                    : ""
                }
              >
                ${escapeHtml(
                  module.title
                )}
              </option>
            `
          )
          .join(
            ""
          )
      : `
        <option value="">
          No modules available
        </option>
      `;


  renderQuizOptions();
}


function renderQuizOptions(
  selectedId = ""
) {
  const moduleId =
    byId(
      "moduleId"
    )?.value ||
    "";


  const select =
    byId(
      "quizId"
    );


  if (!select) {
    return;
  }


  const availableQuizzes =
    quizzes.filter(
      (quiz) =>
        String(
          quiz.module_id
        ) ===
        String(
          moduleId
        )
    );


  select.innerHTML =
    availableQuizzes.length
      ? availableQuizzes
          .map(
            (quiz) => `
              <option
                value="${escapeHtml(
                  quiz.id
                )}"
                ${
                  String(
                    quiz.id
                  ) ===
                  String(
                    selectedId
                  )
                    ? "selected"
                    : ""
                }
              >
                ${escapeHtml(
                  quiz.title
                )}
              </option>
            `
          )
          .join(
            ""
          )
      : `
        <option value="">
          No quizzes available for this module
        </option>
      `;
}


/* =========================================================
   COMPETITION STATE
========================================================= */

function competitionState(
  competition
) {
  const status =
    normalizeStatus(
      competition.status
    );


  if (
    status !==
    "published"
  ) {
    return status;
  }


  const now =
    Date.now();


  const opensAt =
    new Date(
      competition.opens_at
    ).getTime();


  const closesAt =
    new Date(
      competition.closes_at
    ).getTime();


  if (
    Number.isFinite(
      opensAt
    ) &&
    now <
      opensAt
  ) {
    return "upcoming";
  }


  if (
    Number.isFinite(
      closesAt
    ) &&
    now >
      closesAt
  ) {
    return "closed";
  }


  return "live";
}


/* =========================================================
   RENDER COMPETITIONS
========================================================= */

function renderCompetitions() {
  const host =
    byId(
      "competitionList"
    );


  if (!host) {
    return;
  }


  if (!competitions.length) {
    host.innerHTML = `
      <div class="empty-state">
        No competitions are available in this edition yet.
      </div>
    `;


    return;
  }


  host.innerHTML =
    competitions
      .map(
        (competition) => {
          const state =
            competitionState(
              competition
            );


          const module =
            modules.find(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  competition.module_id
                )
            );


          const quiz =
            quizzes.find(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  competition.quiz_id
                )
            );


          const durationMinutes =
            Math.max(
              1,
              Math.round(
                numberValue(
                  competition.duration_seconds,
                  1200
                ) /
                60
              )
            );


          const leaderboardUrl =
            aclUrl(
              `competition-dashboard.html?id=${encodeURIComponent(
                competition.id
              )}`,
              selectedEdition
            );


          return `
            <article
              class="competition-admin-card"
              data-id="${escapeHtml(
                competition.id
              )}"
            >

              <div class="module-admin-head">

                <span
                  class="
                    status-pill
                    ${escapeHtml(
                      state
                    )}
                  "
                >
                  ${escapeHtml(
                    titleCase(
                      state
                    )
                  )}
                </span>

              </div>


              <h2>
                ${escapeHtml(
                  competition.title ||
                  "Untitled competition"
                )}
              </h2>


              <p>
                ${escapeHtml(
                  competition.description ||
                  "No description"
                )}
              </p>


              <div class="module-admin-meta">

                <span>
                  ${escapeHtml(
                    module?.title ||
                    "Unknown module"
                  )}
                </span>

                <span>
                  ${escapeHtml(
                    quiz?.title ||
                    "Unknown quiz"
                  )}
                </span>

                <span>
                  Opens:
                  ${escapeHtml(
                    formatDateTime(
                      competition.opens_at
                    )
                  )}
                </span>

                <span>
                  Closes:
                  ${escapeHtml(
                    formatDateTime(
                      competition.closes_at
                    )
                  )}
                </span>

                <span>
                  ${durationMinutes}
                  min
                </span>

                <span>
                  ${numberValue(
                    competition.warnings_allowed,
                    2
                  )}
                  warnings
                </span>

              </div>


              <div class="competition-admin-actions">

                <button
                  class="secondary-btn edit-competition"
                  type="button"
                >
                  Edit
                </button>


                <button
                  class="secondary-btn quick-competition-status"
                  type="button"
                  data-status="${
                    competition.status ===
                      "published"
                      ? "draft"
                      : "published"
                  }"
                >
                  ${
                    competition.status ===
                      "published"
                      ? "Unpublish"
                      : "Publish"
                  }
                </button>


                <a
                  class="secondary-btn"
                  href="${escapeHtml(
                    leaderboardUrl
                  )}"
                >
                  Leaderboard
                </a>

              </div>

            </article>
          `;
        }
      )
      .join(
        ""
      );
}


/* =========================================================
   OPEN EDITOR
========================================================= */

function openCompetitionDialog(
  competition = null
) {
  const form =
    byId(
      "competitionForm"
    );


  form.reset();


  const source =
    competition ||
    {};


  byId(
    "dialogTitle"
  ).textContent =
    competition
      ? "Edit Competition"
      : "Create Competition";


  byId(
    "competitionId"
  ).value =
    source.id ||
    "";


  renderModuleOptions(
    source.module_id ||
    modules[
      0
    ]?.id ||
    ""
  );


  byId(
    "moduleId"
  ).value =
    source.module_id ||
    modules[
      0
    ]?.id ||
    "";


  renderQuizOptions(
    source.quiz_id ||
    ""
  );


  byId(
    "quizId"
  ).value =
    source.quiz_id ||
    quizzes.find(
      (quiz) =>
        String(
          quiz.module_id
        ) ===
        String(
          byId(
            "moduleId"
          ).value
        )
    )?.id ||
    "";


  byId(
    "title"
  ).value =
    source.title ||
    "";


  byId(
    "slug"
  ).value =
    source.slug ||
    "";


  byId(
    "description"
  ).value =
    source.description ||
    "";


  byId(
    "opensAt"
  ).value =
    toLocalInput(
      source.opens_at
    );


  byId(
    "closesAt"
  ).value =
    toLocalInput(
      source.closes_at
    );


  byId(
    "duration"
  ).value =
    Math.max(
      1,
      Math.round(
        numberValue(
          source.duration_seconds,
          1200
        ) /
        60
      )
    );


  byId(
    "warnings"
  ).value =
    numberValue(
      source.warnings_allowed,
      2
    );


  byId(
    "competitionStatus"
  ).value =
    normalizeStatus(
      source.status
    );


  byId(
    "confidence"
  ).checked =
    source.confidence_scoring ??
    true;


  byId(
    "randomQuestions"
  ).checked =
    source.randomize_questions ??
    true;


  byId(
    "randomOptions"
  ).checked =
    source.randomize_options ??
    true;


  byId(
    "leaderboard"
  ).checked =
    source.leaderboard_visible ??
    true;


  byId(
    "antiCheat"
  ).checked =
    source.anti_cheat_enabled ??
    true;


  byId(
    "competitionDialog"
  ).showModal();
}


/* =========================================================
   PAYLOAD
========================================================= */

function buildPayload() {
  const title =
    byId(
      "title"
    ).value.trim();


  const slug =
    slugify(
      byId(
        "slug"
      ).value ||
      title
    );


  return {
    module_id:
      byId(
        "moduleId"
      ).value,

    quiz_id:
      byId(
        "quizId"
      ).value,

    title,

    slug,

    description:
      byId(
        "description"
      ).value.trim() ||
      null,

    opens_at:
      toIso(
        byId(
          "opensAt"
        ).value
      ),

    closes_at:
      toIso(
        byId(
          "closesAt"
        ).value
      ),

    duration_seconds:
      Math.max(
        60,
        numberValue(
          byId(
            "duration"
          ).value,
          20
        ) *
        60
      ),

    warnings_allowed:
      Math.min(
        10,
        Math.max(
          0,
          numberValue(
            byId(
              "warnings"
            ).value,
            2
          )
        )
      ),

    status:
      normalizeStatus(
        byId(
          "competitionStatus"
        ).value
      ),

    confidence_scoring:
      byId(
        "confidence"
      ).checked,

    randomize_questions:
      byId(
        "randomQuestions"
      ).checked,

    randomize_options:
      byId(
        "randomOptions"
      ).checked,

    leaderboard_visible:
      byId(
        "leaderboard"
      ).checked,

    anti_cheat_enabled:
      byId(
        "antiCheat"
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
  if (!payload.module_id) {
    throw new Error(
      "Select a module."
    );
  }


  if (!payload.quiz_id) {
    throw new Error(
      "Select a quiz."
    );
  }


  if (!payload.title) {
    throw new Error(
      "Competition title is required."
    );
  }


  if (!payload.slug) {
    throw new Error(
      "Competition slug is required."
    );
  }


  if (
    !/^[a-z0-9-]+$/.test(
      payload.slug
    )
  ) {
    throw new Error(
      "The slug may contain only lowercase letters, numbers, and hyphens."
    );
  }


  if (
    !payload.opens_at ||
    !payload.closes_at
  ) {
    throw new Error(
      "Opening and closing times are required."
    );
  }


  if (
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


  const matchingQuiz =
    quizzes.find(
      (quiz) =>
        String(
          quiz.id
        ) ===
        String(
          payload.quiz_id
        )
    );


  if (
    !matchingQuiz ||
    String(
      matchingQuiz.module_id
    ) !==
    String(
      payload.module_id
    )
  ) {
    throw new Error(
      "The selected quiz does not belong to the selected module."
    );
  }


  return true;
}


/* =========================================================
   SAVE COMPETITION
========================================================= */

async function saveCompetition() {
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
    byId(
      "competitionForm"
    ).querySelector(
      'button[type="submit"]'
    );


  setButtonBusy(
    saveButton,
    true,
    "Saving…",
    "Save Competition"
  );


  setStatus(
    "Saving competition…"
  );


  try {
    const existingId =
      byId(
        "competitionId"
      ).value;


    let response;


    if (existingId) {
      response =
        await supabaseClient
          .from(
            "competitions"
          )
          .update(
            payload
          )
          .eq(
            "id",
            existingId
          )
          .in(
            "module_id",
            moduleIds()
          );
    } else {
      response =
        await supabaseClient
          .from(
            "competitions"
          )
          .insert(
            payload
          );
    }


    if (response.error) {
      throw response.error;
    }


    byId(
      "competitionDialog"
    ).close();


    await loadCompetitions();


    setStatus(
      payload.status ===
        "published"
        ? "Competition saved and published."
        : "Competition saved successfully.",
      "success"
    );
  } catch (error) {
    console.error(
      "COMPETITION SAVE ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The competition could not be saved.",
      "error"
    );
  } finally {
    isSaving =
      false;


    setButtonBusy(
      saveButton,
      false,
      "Saving…",
      "Save Competition"
    );
  }
}


/* =========================================================
   QUICK STATUS
========================================================= */

async function updateCompetitionStatus(
  competition,
  nextStatus,
  button
) {
  const normalText =
    button.textContent;


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
          "competitions"
        )
        .update({
          status:
            normalizeStatus(
              nextStatus
            )
        })
        .eq(
          "id",
          competition.id
        )
        .in(
          "module_id",
          moduleIds()
        );


    if (error) {
      throw error;
    }


    await loadCompetitions();


    setStatus(
      nextStatus ===
        "published"
        ? "Competition published."
        : "Competition moved to draft.",
      "success"
    );
  } catch (error) {
    setStatus(
      error.message ||
      "Competition status could not be updated.",
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
    "competitionForm"
  )?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      await saveCompetition();
    }
  );


  byId(
    "newCompetition"
  )?.addEventListener(
    "click",
    () => {
      openCompetitionDialog();
    }
  );


  byId(
    "closeDialog"
  )?.addEventListener(
    "click",
    () => {
      byId(
        "competitionDialog"
      ).close();
    }
  );


  byId(
    "cancel"
  )?.addEventListener(
    "click",
    () => {
      byId(
        "competitionDialog"
      ).close();
    }
  );


  byId(
    "moduleId"
  )?.addEventListener(
    "change",
    () => {
      renderQuizOptions();
    }
  );


  byId(
    "title"
  )?.addEventListener(
    "input",
    () => {
      if (
        !byId(
          "competitionId"
        ).value
      ) {
        byId(
          "slug"
        ).value =
          slugify(
            byId(
              "title"
            ).value
          );
      }
    }
  );


  byId(
    "competitionList"
  )?.addEventListener(
    "click",
    async (event) => {
      const card =
        event.target.closest(
          "[data-id]"
        );


      if (!card) {
        return;
      }


      const competition =
        competitions.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              card.dataset.id
            )
        );


      if (!competition) {
        return;
      }


      if (
        event.target.closest(
          ".edit-competition"
        )
      ) {
        openCompetitionDialog(
          competition
        );


        return;
      }


      const quickButton =
        event.target.closest(
          ".quick-competition-status"
        );


      if (quickButton) {
        await updateCompetitionStatus(
          competition,
          quickButton.dataset.status,
          quickButton
        );
      }
    }
  );


  byId(
    "competitionDialog"
  )?.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        byId(
          "competitionDialog"
        )
      ) {
        byId(
          "competitionDialog"
        ).close();
      }
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeAdminCompetitions() {
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


    await loadModules();
    await loadQuizzes();
    await loadCompetitions();
  } catch (error) {
    console.error(
      "ADMIN COMPETITIONS INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The competition manager could not be initialized.",
      "error"
    );


    byId(
      "competitionList"
    ).innerHTML = `
      <div class="empty-state">
        Competition management could not be loaded.
      </div>
    `;
  }
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAdminCompetitions,
    {
      once:
        true
    }
  );
} else {
  void initializeAdminCompetitions();
}
