import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.8.0";


console.log(
  "ACL ADMIN QUIZZES v3.2.0 LOADED"
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


let questions =
  [];


let quizzes =
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


function positiveInteger(
  value,
  fallback = 0
) {
  const parsed =
    Math.floor(
      Number(
        value
      )
    );


  return Number.isFinite(
    parsed
  ) &&
  parsed > 0
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


function normalizeMode(
  value
) {
  const mode =
    String(
      value ||
      "learning"
    )
      .trim()
      .toLowerCase();


  return [
    "learning",
    "practice",
    "competition"
  ].includes(
    mode
  )
    ? mode
    : "learning";
}


function normalizeSelectionMode(
  value
) {
  return String(
    value ||
    "fixed"
  )
    .trim()
    .toLowerCase() ===
    "random"
    ? "random"
    : "fixed";
}


function normalizeTimerMode(
  value
) {
  const normalized =
    String(
      value ||
      "none"
    )
      .trim()
      .toLowerCase();


  const aliases = {
    none:
      "none",

    quiz:
      "per_quiz",

    per_quiz:
      "per_quiz",

    "per-quiz":
      "per_quiz",

    question:
      "per_question",

    per_question:
      "per_question",

    "per-question":
      "per_question"
  };


  return (
    aliases[
      normalized
    ] ||
    "none"
  );
}


function normalizeFinalViolationAction(
  value
) {
  const normalized =
    String(
      value ||
      "terminate"
    )
      .trim()
      .toLowerCase();


  return normalized ===
    "omit"
    ? "omit"
    : "terminate";
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
    role ===
      "admin" ||
    role ===
      "administrator"
  );
}


function setStatus(
  message = "",
  type = ""
) {
  const box =
    byId(
      "quizBuilderStatus"
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
    Boolean(
      busy
    );


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


function selectedQuestionIds() {
  return [
    ...document.querySelectorAll(
      ".picker-check:checked"
    )
  ].map(
    (input) =>
      input.value
  );
}


function updateSelectedCount() {
  const counter =
    byId(
      "selectedQuestionCount"
    );


  if (counter) {
    counter.textContent =
      `${
        selectedQuestionIds()
          .length
      } selected`;
  }
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
      "adminQuizzesEditionBadge"
    );


  const themeColor =
    byId(
      "adminQuizzesThemeColor"
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
    adminQuizzesDashboardLink:
      "admin.html",

    adminQuizzesQuestionsLink:
      "admin-questions.html"
  };


  Object.entries(
    links
  ).forEach(
    ([
      id,
      path
    ]) => {
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
    `Quiz Builder | ACL ${
      isBasic
        ? "Basic Edition"
        : "Expert Edition"
    } Admin`;


  const url =
    new URL(
      window.location.href
    );


  url.searchParams.set(
    "edition",
    selectedEdition
  );


  window.history.replaceState(
    {},
    "",
    url
  );
}


/* =========================================================
   TIMER CONTROLS
========================================================= */

function updateTimerControls() {
  const timerMode =
    normalizeTimerMode(
      byId(
        "quizTimerMode"
      )?.value
    );


  const totalDurationField =
    byId(
      "quizTotalDurationField"
    );


  const questionDurationField =
    byId(
      "quizQuestionDurationField"
    );


  const totalDurationInput =
    byId(
      "quizTimeLimit"
    );


  const questionDurationInput =
    byId(
      "quizQuestionTimeLimit"
    );


  if (totalDurationField) {
    totalDurationField.hidden =
      timerMode !==
      "per_quiz";
  }


  if (questionDurationField) {
    questionDurationField.hidden =
      timerMode !==
      "per_question";
  }


  if (totalDurationInput) {
    totalDurationInput.required =
      timerMode ===
      "per_quiz";

    totalDurationInput.disabled =
      timerMode !==
      "per_quiz";
  }


  if (questionDurationInput) {
    questionDurationInput.required =
      timerMode ===
      "per_question";

    questionDurationInput.disabled =
      timerMode !==
      "per_question";
  }
}


/* =========================================================
   ANTI-CHEAT CONTROLS
========================================================= */

function antiCheatEnabled() {
  return (
    byId(
      "quizAntiCheatEnabled"
    )?.value ===
    "true"
  );
}


function updateAntiCheatControls() {
  const enabled =
    antiCheatEnabled();


  const finalActionField =
    byId(
      "quizFinalViolationField"
    );


  const finalActionInput =
    byId(
      "quizFinalViolationAction"
    );


  const summary =
    byId(
      "quizAntiCheatSummary"
    );


  if (finalActionField) {
    finalActionField.hidden =
      !enabled;
  }


  if (finalActionInput) {
    finalActionInput.disabled =
      !enabled;
  }


  if (summary) {
    summary.hidden =
      !enabled;
  }
}


function updateModeControls() {
  const mode =
    normalizeMode(
      byId(
        "quizMode"
      )?.value
    );


  /*
   * Do not force anti-cheat on automatically.
   * The administrator remains in control.
   */

  if (
    mode !==
      "competition" &&
    antiCheatEnabled()
  ) {
    setStatus(
      "Anti-cheat is normally intended for competition mode.",
      "warning"
    );
  }
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
        display_order,
        edition
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


  const options =
    modules
      .map(
        (module) => `
          <option value="${escapeHtml(
            module.id
          )}">
            ${escapeHtml(
              module.title
            )}
          </option>
        `
      )
      .join(
        ""
      );


  byId(
    "quizModule"
  ).innerHTML =
    options;


  byId(
    "quizModuleFilter"
  ).innerHTML = `
    <option value="all">
      All modules
    </option>

    ${options}
  `;
}


/* =========================================================
   LOAD QUESTIONS
========================================================= */

async function loadQuestions() {
  const ids =
    moduleIds();


  if (!ids.length) {
    questions =
      [];


    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "questions"
      )
      .select(`
        id,
        module_id,
        stem,
        question_text,
        topic,
        difficulty,
        status,
        display_order,
        order_index,
        time_limit_seconds
      `)
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
      );


  if (error) {
    throw error;
  }


  questions =
    data ||
    [];
}


/* =========================================================
   LOAD QUIZZES
========================================================= */

async function loadQuizzes() {
  if (isLoading) {
    return;
  }


  isLoading =
    true;


  const refreshButton =
    byId(
      "refreshQuizzes"
    );


  setButtonBusy(
    refreshButton,
    true,
    "Refreshing…",
    "Refresh"
  );


  setStatus(
    "Loading quizzes…"
  );


  byId(
    "quizList"
  ).innerHTML = `
    <div class="empty-state">
      Loading quizzes…
    </div>
  `;


  try {
    const ids =
      moduleIds();


    if (!ids.length) {
      quizzes =
        [];


      renderStats();
      filterList();


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
          "quizzes"
        )
        .select(`
          *,
          quiz_questions (
            question_id,
            display_order
          )
        `)
        .eq(
          "edition",
          selectedEdition
        )
        .in(
          "module_id",
          ids
        )
        .order(
          "display_order",
          {
            ascending:
              true
          }
        )
        .order(
          "created_at",
          {
            ascending:
              true
          }
        );


    if (error) {
      throw error;
    }


    quizzes =
      (
        data ||
        []
      ).map(
        (quiz) => ({
          ...quiz,

          status:
            normalizeStatus(
              quiz.status
            ),

          mode:
            normalizeMode(
              quiz.mode
            ),

          selection_mode:
            normalizeSelectionMode(
              quiz.selection_mode
            ),

          timer_mode:
            normalizeTimerMode(
              quiz.timer_mode
            ),

          quiz_questions:
            (
              quiz.quiz_questions ||
              []
            ).sort(
              (
                first,
                second
              ) =>
                numberValue(
                  first.display_order
                ) -
                numberValue(
                  second.display_order
                )
            )
        })
      );


    renderStats();
    filterList();


    setStatus(
      ""
    );
  } catch (
    error
  ) {
    console.error(
      "QUIZ LOAD ERROR:",
      error
    );


    quizzes =
      [];


    renderStats();


    byId(
      "quizList"
    ).innerHTML = `
      <div class="empty-state">
        Quizzes could not be loaded.
      </div>
    `;


    setStatus(
      error.message ||
      "Quizzes could not be loaded.",
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

function renderStats() {
  byId(
    "quizTotal"
  ).textContent =
    String(
      quizzes.length
    );


  byId(
    "quizPublished"
  ).textContent =
    String(
      quizzes.filter(
        (quiz) =>
          normalizeStatus(
            quiz.status
          ) ===
          "published"
      ).length
    );


  byId(
    "quizDraft"
  ).textContent =
    String(
      quizzes.filter(
        (quiz) =>
          normalizeStatus(
            quiz.status
          ) ===
          "draft"
      ).length
    );


  byId(
    "quizAssigned"
  ).textContent =
    String(
      quizzes.reduce(
        (
          total,
          quiz
        ) =>
          total +
          (
            quiz.quiz_questions
              ?.length ||
            0
          ),
        0
      )
    );
}


/* =========================================================
   QUIZ CARD
========================================================= */

function timerDescription(
  quiz
) {
  const mode =
    normalizeTimerMode(
      quiz.timer_mode
    );


  if (
    mode ===
    "per_quiz"
  ) {
    const seconds =
      positiveInteger(
        quiz.quiz_duration_seconds ??
        quiz.time_limit_seconds,
        0
      );


    return seconds
      ? `${Math.ceil(
          seconds /
          60
        )} min total`
      : "Quiz timer";
  }


  if (
    mode ===
    "per_question"
  ) {
    const seconds =
      positiveInteger(
        quiz.default_question_time_seconds,
        0
      );


    return seconds
      ? `${seconds}s/question`
      : "Question timer";
  }


  return "No timer";
}


function quizCardHtml(
  quiz
) {
  const module =
    modules.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          quiz.module_id
        )
    );


  const status =
    normalizeStatus(
      quiz.status
    );


  const mode =
    normalizeMode(
      quiz.mode
    );


  return `
    <article
      class="quiz-admin-card"
      data-id="${escapeHtml(
        quiz.id
      )}"
    >

      <div class="module-admin-head">

        <div>

          <span class="status-pill ${escapeHtml(
            status
          )}">
            ${escapeHtml(
              titleCase(
                status
              )
            )}
          </span>

          <span class="difficulty-pill intermediate">
            ${escapeHtml(
              titleCase(
                mode
              )
            )}
          </span>

        </div>

        <span class="order-badge">
          #${numberValue(
            quiz.display_order,
            100
          )}
        </span>

      </div>

      <h2>
        ${escapeHtml(
          quiz.title ||
          "Untitled quiz"
        )}
      </h2>

      <p>
        ${escapeHtml(
          quiz.description ||
          "No description"
        )}
      </p>

      <div class="module-admin-meta">

        <span>
          ${escapeHtml(
            module?.title ||
            "Unassigned module"
          )}
        </span>

        <span>
          ${
            quiz.quiz_questions
              ?.length ||
            0
          }
          in pool
        </span>

        <span>
          ${numberValue(
            quiz.question_count,
            1
          )}
          delivered
        </span>

        <span>
          ${escapeHtml(
            timerDescription(
              quiz
            )
          )}
        </span>

        ${
          quiz.anti_cheat_enabled
            ? `
              <span>
                Anti-cheat enabled
              </span>
            `
            : ""
        }

      </div>

      <div class="quiz-admin-actions">

        <button
          class="secondary-btn edit-quiz"
          type="button"
        >
          Edit
        </button>

        <button
          class="secondary-btn duplicate-quiz-card"
          type="button"
        >
          Duplicate
        </button>

        <button
          class="secondary-btn quick-quiz-status"
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
   FILTER QUIZZES
========================================================= */

function filterList() {
  const search =
    byId(
      "quizSearch"
    )
      .value
      .trim()
      .toLowerCase();


  const moduleId =
    byId(
      "quizModuleFilter"
    ).value;


  const selectedStatus =
    byId(
      "quizStatusFilter"
    ).value;


  const filtered =
    quizzes.filter(
      (quiz) => {
        const module =
          modules.find(
            (item) =>
              String(
                item.id
              ) ===
              String(
                quiz.module_id
              )
          );


        const matchesModule =
          moduleId ===
            "all" ||
          String(
            quiz.module_id
          ) ===
          String(
            moduleId
          );


        const matchesStatus =
          selectedStatus ===
            "all" ||
          normalizeStatus(
            quiz.status
          ) ===
          selectedStatus;


        const searchableText = [
          quiz.title,
          quiz.slug,
          quiz.description,
          module?.title
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


        return (
          matchesModule &&
          matchesStatus &&
          (
            !search ||
            searchableText.includes(
              search
            )
          )
        );
      }
    );


  byId(
    "quizList"
  ).innerHTML =
    filtered.length
      ? filtered
          .map(
            quizCardHtml
          )
          .join(
            ""
          )
      : `
        <div class="empty-state">
          No quizzes match these filters.
        </div>
      `;
}


/* =========================================================
   QUESTION PICKER
========================================================= */

function renderPicker(
  chosenIds = null
) {
  const currentlySelected =
    chosenIds ||
    selectedQuestionIds();


  const moduleId =
    byId(
      "quizModule"
    ).value;


  const search =
    byId(
      "pickerSearch"
    )
      .value
      .trim()
      .toLowerCase();


  const filtered =
    questions.filter(
      (question) => {
        const matchesModule =
          String(
            question.module_id
          ) ===
          String(
            moduleId
          );


        const searchableText = [
          question.stem,
          question.question_text,
          question.topic,
          question.difficulty
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


        return (
          matchesModule &&
          (
            !search ||
            searchableText.includes(
              search
            )
          )
        );
      }
    );


  byId(
    "questionPicker"
  ).innerHTML =
    filtered.length
      ? filtered
          .map(
            (question) => `
              <label class="question-picker-item picker-question">

                <input
                  class="picker-check"
                  type="checkbox"
                  value="${escapeHtml(
                    question.id
                  )}"
                  ${
                    currentlySelected.includes(
                      String(
                        question.id
                      )
                    )
                      ? "checked"
                      : ""
                  }
                >

                <span>

                  <strong>
                    ${escapeHtml(
                      question.stem ||
                      question.question_text ||
                      "Untitled question"
                    )}
                  </strong>

                  <p>
                    ${escapeHtml(
                      question.topic ||
                      "No topic"
                    )}
                    ·
                    ${escapeHtml(
                      titleCase(
                        question.difficulty
                      )
                    )}
                  </p>

                </span>

                <span class="picker-order">
                  #${numberValue(
                    question.display_order ??
                    question.order_index,
                    0
                  )}
                </span>

              </label>
            `
          )
          .join(
            ""
          )
      : `
        <div class="empty-state">
          No questions are available for this module.
        </div>
      `;


  updateSelectedCount();
}


/* =========================================================
   FORM
========================================================= */

function fillForm(
  quiz = null,
  duplicate = false
) {
  byId(
    "quizForm"
  ).reset();


  const source =
    quiz ||
    {};


  byId(
    "quizDialogTitle"
  ).textContent =
    duplicate
      ? "Duplicate Quiz"
      : quiz
        ? "Edit Quiz"
        : "Create Quiz";


  byId(
    "quizId"
  ).value =
    duplicate
      ? ""
      : source.id ||
        "";


  byId(
    "quizModule"
  ).value =
    source.module_id ||
    modules[
      0
    ]?.id ||
    "";


  byId(
    "quizTitle"
  ).value =
    duplicate
      ? `${source.title || ""} Copy`
      : source.title ||
        "";


  byId(
    "quizSlug"
  ).value =
    duplicate
      ? slugify(
          `${
            source.slug ||
            source.title ||
            "quiz"
          }-copy`
        )
      : source.slug ||
        "";


  byId(
    "quizStatus"
  ).value =
    duplicate
      ? "draft"
      : normalizeStatus(
          source.status
        );


  byId(
    "quizMode"
  ).value =
    normalizeMode(
      source.mode
    );


  byId(
    "quizSelection"
  ).value =
    normalizeSelectionMode(
      source.selection_mode
    );


  byId(
    "quizQuestionCount"
  ).value =
    numberValue(
      source.question_count,
      10
    );


  const timerMode =
    normalizeTimerMode(
      source.timer_mode ||
      (
        source.time_limit_seconds
          ? "per_quiz"
          : "none"
      )
    );


  byId(
    "quizTimerMode"
  ).value =
    timerMode;


  byId(
    "quizTimeLimit"
  ).value =
    source.quiz_duration_seconds ||
    source.time_limit_seconds
      ? Math.ceil(
          numberValue(
            source.quiz_duration_seconds ??
            source.time_limit_seconds,
            0
          ) /
          60
        )
      : "";


  byId(
    "quizQuestionTimeLimit"
  ).value =
    positiveInteger(
      source.default_question_time_seconds,
      0
    ) ||
    "";


  byId(
    "quizAntiCheatEnabled"
  ).value =
    source.anti_cheat_enabled
      ? "true"
      : "false";


  byId(
    "quizFinalViolationAction"
  ).value =
    normalizeFinalViolationAction(
      source.final_violation_action
    );


  byId(
    "quizPassing"
  ).value =
    numberValue(
      source.passing_percentage,
      70
    );


  byId(
    "quizOrder"
  ).value =
    numberValue(
      source.display_order,
      100
    );


  byId(
    "quizDescription"
  ).value =
    source.description ||
    "";


  byId(
    "quizRandomQuestions"
  ).checked =
    Boolean(
      source.randomize_questions
    );


  byId(
    "quizRandomOptions"
  ).checked =
    source.randomize_options ??
    true;


  byId(
    "quizAllowReview"
  ).checked =
    source.allow_review ??
    true;


  byId(
    "quizShowExplanations"
  ).checked =
    source.show_explanations ??
    true;


  const selectedIds =
    (
      source.quiz_questions ||
      []
    ).map(
      (item) =>
        String(
          item.question_id
        )
    );


  renderPicker(
    selectedIds
  );


  updateTimerControls();
  updateAntiCheatControls();


  byId(
    "duplicateQuizButton"
  ).hidden =
    !quiz ||
    duplicate;


  byId(
    "archiveQuizButton"
  ).hidden =
    !quiz ||
    duplicate;


  byId(
    "quizDialog"
  ).showModal();
}


/* =========================================================
   PAYLOAD
========================================================= */

function buildPayload() {
  const title =
    byId(
      "quizTitle"
    ).value.trim();


  const slug =
    slugify(
      byId(
        "quizSlug"
      ).value ||
      title
    );


  const timerMode =
    normalizeTimerMode(
      byId(
        "quizTimerMode"
      ).value
    );


  const quizMinutes =
    positiveInteger(
      byId(
        "quizTimeLimit"
      ).value,
      0
    );


  const questionSeconds =
    positiveInteger(
      byId(
        "quizQuestionTimeLimit"
      ).value,
      0
    );


  const securityEnabled =
    antiCheatEnabled();


  return {
    module_id:
      byId(
        "quizModule"
      ).value,

    edition:
      selectedEdition,

    title,

    slug,

    description:
      byId(
        "quizDescription"
      ).value.trim() ||
      null,

    mode:
      normalizeMode(
        byId(
          "quizMode"
        ).value
      ),

    selection_mode:
      normalizeSelectionMode(
        byId(
          "quizSelection"
        ).value
      ),

    question_count:
      Math.max(
        1,
        positiveInteger(
          byId(
            "quizQuestionCount"
          ).value,
          1
        )
      ),

    timer_mode:
      timerMode,

    quiz_duration_seconds:
      timerMode ===
        "per_quiz"
        ? quizMinutes *
          60
        : null,

    default_question_time_seconds:
      timerMode ===
        "per_question"
        ? questionSeconds
        : null,

    /*
     * Kept for compatibility with older quiz pages.
     */

    time_limit_seconds:
      timerMode ===
        "per_quiz"
        ? quizMinutes *
          60
        : null,

    anti_cheat_enabled:
      securityEnabled,

    final_violation_action:
      securityEnabled
        ? normalizeFinalViolationAction(
            byId(
              "quizFinalViolationAction"
            ).value
          )
        : null,

    randomize_questions:
      byId(
        "quizRandomQuestions"
      ).checked,

    randomize_options:
      byId(
        "quizRandomOptions"
      ).checked,

    allow_review:
      byId(
        "quizAllowReview"
      ).checked,

    show_explanations:
      byId(
        "quizShowExplanations"
      ).checked,

    passing_percentage:
      Math.min(
        100,
        Math.max(
          0,
          numberValue(
            byId(
              "quizPassing"
            ).value,
            70
          )
        )
      ),

    status:
      normalizeStatus(
        byId(
          "quizStatus"
        ).value
      ),

    display_order:
      numberValue(
        byId(
          "quizOrder"
        ).value,
        100
      ),

    created_by:
      adminProfile.id
  };
}


/* =========================================================
   VALIDATION
========================================================= */

function validateQuiz(
  payload,
  selectedIds
) {
  if (!payload.module_id) {
    throw new Error(
      "Select a module."
    );
  }


  if (!payload.title) {
    throw new Error(
      "Quiz title is required."
    );
  }


  if (
    !payload.slug ||
    !/^[a-z0-9-]+$/.test(
      payload.slug
    )
  ) {
    throw new Error(
      "The slug may contain only lowercase letters, numbers, and hyphens."
    );
  }


  if (!selectedIds.length) {
    throw new Error(
      "Select at least one question."
    );
  }


  if (
    payload.question_count >
    selectedIds.length
  ) {
    throw new Error(
      "Questions delivered cannot exceed the selected question pool."
    );
  }


  if (
    payload.timer_mode ===
      "per_quiz" &&
    !positiveInteger(
      payload.quiz_duration_seconds,
      0
    )
  ) {
    throw new Error(
      "Enter the whole-quiz duration."
    );
  }


  if (
    payload.timer_mode ===
      "per_question" &&
    !positiveInteger(
      payload.default_question_time_seconds,
      0
    )
  ) {
    throw new Error(
      "Enter the default time per question."
    );
  }


  if (
    payload.anti_cheat_enabled &&
    payload.mode !==
      "competition"
  ) {
    throw new Error(
      "Anti-cheat can only be enabled for competition mode."
    );
  }


  const validQuestionIds =
    new Set(
      questions
        .filter(
          (question) =>
            String(
              question.module_id
            ) ===
            String(
              payload.module_id
            )
        )
        .map(
          (question) =>
            String(
              question.id
            )
        )
    );


  if (
    selectedIds.some(
      (id) =>
        !validQuestionIds.has(
          String(
            id
          )
        )
    )
  ) {
    throw new Error(
      "One or more selected questions do not belong to this module."
    );
  }
}


/* =========================================================
   QUIZ QUESTIONS
========================================================= */

async function saveQuizQuestions(
  quizId,
  selectedIds
) {
  const {
    error: deleteError
  } =
    await supabaseClient
      .from(
        "quiz_questions"
      )
      .delete()
      .eq(
        "quiz_id",
        quizId
      );


  if (deleteError) {
    throw deleteError;
  }


  const rows =
    selectedIds.map(
      (
        questionId,
        index
      ) => ({
        quiz_id:
          quizId,

        question_id:
          questionId,

        display_order:
          index +
          1
      })
    );


  const {
    error: insertError
  } =
    await supabaseClient
      .from(
        "quiz_questions"
      )
      .insert(
        rows
      );


  if (insertError) {
    throw insertError;
  }
}


/* =========================================================
   SAVE
========================================================= */

async function saveQuiz() {
  if (isSaving) {
    return;
  }


  const payload =
    buildPayload();


  const selectedIds =
    selectedQuestionIds();


  validateQuiz(
    payload,
    selectedIds
  );


  isSaving =
    true;


  const saveButton =
    byId(
      "quizForm"
    ).querySelector(
      'button[type="submit"]'
    );


  setButtonBusy(
    saveButton,
    true,
    "Saving…",
    "Save Quiz"
  );


  setStatus(
    "Saving quiz…"
  );


  try {
    const existingId =
      byId(
        "quizId"
      ).value;


    let quizId =
      existingId;


    if (existingId) {
      const {
        error
      } =
        await supabaseClient
          .from(
            "quizzes"
          )
          .update(
            payload
          )
          .eq(
            "id",
            existingId
          )
          .eq(
            "edition",
            selectedEdition
          );


      if (error) {
        throw error;
      }
    } else {
      const {
        data,
        error
      } =
        await supabaseClient
          .from(
            "quizzes"
          )
          .insert(
            payload
          )
          .select(
            "id"
          )
          .single();


      if (error) {
        throw error;
      }


      quizId =
        data.id;
    }


    await saveQuizQuestions(
      quizId,
      selectedIds
    );


    byId(
      "quizDialog"
    ).close();


    await loadQuizzes();


    setStatus(
      payload.status ===
        "published"
        ? "Quiz saved and published."
        : "Quiz saved successfully.",
      "success"
    );
  } catch (
    error
  ) {
    console.error(
      "QUIZ SAVE ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The quiz could not be saved.",
      "error"
    );
  } finally {
    isSaving =
      false;


    setButtonBusy(
      saveButton,
      false,
      "Saving…",
      "Save Quiz"
    );
  }
}


/* =========================================================
   PREVIEW
========================================================= */

function previewQuiz() {
  const ids =
    selectedQuestionIds();


  const picked =
    ids
      .map(
        (id) =>
          questions.find(
            (question) =>
              String(
                question.id
              ) ===
              String(
                id
              )
          )
      )
      .filter(
        Boolean
      );


  const timerMode =
    normalizeTimerMode(
      byId(
        "quizTimerMode"
      ).value
    );


  const timerText =
    timerMode ===
      "per_quiz"
      ? `${
          byId(
            "quizTimeLimit"
          ).value ||
          "0"
        } minutes total`
      : timerMode ===
          "per_question"
        ? `${
            byId(
              "quizQuestionTimeLimit"
            ).value ||
            "0"
          } seconds per question`
        : "No timer";


  byId(
    "quizPreviewContent"
  ).innerHTML = `
    <span class="admin-kicker">
      QUIZ PREVIEW
    </span>

    <h2>
      ${escapeHtml(
        byId(
          "quizTitle"
        ).value ||
        "Untitled quiz"
      )}
    </h2>

    <p>
      ${escapeHtml(
        byId(
          "quizDescription"
        ).value ||
        ""
      )}
    </p>

    <div class="module-admin-meta">

      <span>
        ${escapeHtml(
          titleCase(
            byId(
              "quizMode"
            ).value
          )
        )}
      </span>

      <span>
        ${picked.length}
        selected
      </span>

      <span>
        ${escapeHtml(
          timerText
        )}
      </span>

      <span>
        ${
          antiCheatEnabled()
            ? "Anti-cheat enabled"
            : "Anti-cheat disabled"
        }
      </span>

    </div>

    <ol class="preview-question-list">

      ${picked
        .map(
          (question) => `
            <li>

              <strong>
                ${escapeHtml(
                  question.stem ||
                  question.question_text ||
                  "Untitled question"
                )}
              </strong>

              <small>
                ${escapeHtml(
                  question.topic ||
                  "No topic"
                )}
              </small>

            </li>
          `
        )
        .join(
          ""
        )}

    </ol>
  `;


  byId(
    "quizPreviewDialog"
  ).showModal();
}


/* =========================================================
   ARCHIVE
========================================================= */

async function archiveQuiz() {
  const id =
    byId(
      "quizId"
    ).value;


  if (
    !id ||
    !window.confirm(
      "Archive this quiz?"
    )
  ) {
    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from(
        "quizzes"
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
    setStatus(
      error.message,
      "error"
    );


    return;
  }


  byId(
    "quizDialog"
  ).close();


  await loadQuizzes();


  setStatus(
    "Quiz archived.",
    "success"
  );
}


/* =========================================================
   QUICK STATUS
========================================================= */

async function updateQuizStatus(
  quiz,
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
          "quizzes"
        )
        .update({
          status:
            normalizeStatus(
              nextStatus
            )
        })
        .eq(
          "id",
          quiz.id
        )
        .eq(
          "edition",
          selectedEdition
        );


    if (error) {
      throw error;
    }


    await loadQuizzes();


    setStatus(
      nextStatus ===
        "published"
        ? "Quiz published."
        : "Quiz moved to draft.",
      "success"
    );
  } catch (
    error
  ) {
    setStatus(
      error.message ||
      "Quiz status could not be updated.",
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
    "quizForm"
  )?.addEventListener(
    "submit",
    async (
      event
    ) => {
      event.preventDefault();


      await saveQuiz();
    }
  );


  byId(
    "newQuizButton"
  )?.addEventListener(
    "click",
    () => {
      fillForm();
    }
  );


  byId(
    "closeQuizDialog"
  )?.addEventListener(
    "click",
    () => {
      byId(
        "quizDialog"
      ).close();
    }
  );


  byId(
    "cancelQuizButton"
  )?.addEventListener(
    "click",
    () => {
      byId(
        "quizDialog"
      ).close();
    }
  );


  byId(
    "quizTitle"
  )?.addEventListener(
    "input",
    () => {
      if (
        !byId(
          "quizId"
        ).value
      ) {
        byId(
          "quizSlug"
        ).value =
          slugify(
            byId(
              "quizTitle"
            ).value
          );
      }
    }
  );


  byId(
    "quizModule"
  )?.addEventListener(
    "change",
    () => {
      renderPicker(
        []
      );
    }
  );


  byId(
    "quizTimerMode"
  )?.addEventListener(
    "change",
    updateTimerControls
  );


  byId(
    "quizAntiCheatEnabled"
  )?.addEventListener(
    "change",
    updateAntiCheatControls
  );


  byId(
    "quizMode"
  )?.addEventListener(
    "change",
    updateModeControls
  );


  byId(
    "pickerSearch"
  )?.addEventListener(
    "input",
    () => {
      renderPicker(
        selectedQuestionIds()
      );
    }
  );


  byId(
    "questionPicker"
  )?.addEventListener(
    "change",
    updateSelectedCount
  );


  byId(
    "selectAllQuestions"
  )?.addEventListener(
    "click",
    () => {
      document
        .querySelectorAll(
          ".picker-check"
        )
        .forEach(
          (input) => {
            input.checked =
              true;
          }
        );


      updateSelectedCount();
    }
  );


  byId(
    "clearQuestions"
  )?.addEventListener(
    "click",
    () => {
      document
        .querySelectorAll(
          ".picker-check"
        )
        .forEach(
          (input) => {
            input.checked =
              false;
          }
        );


      updateSelectedCount();
    }
  );


  byId(
    "previewQuizButton"
  )?.addEventListener(
    "click",
    previewQuiz
  );


  byId(
    "refreshQuizzes"
  )?.addEventListener(
    "click",
    loadQuizzes
  );


  byId(
    "quizSearch"
  )?.addEventListener(
    "input",
    filterList
  );


  byId(
    "quizModuleFilter"
  )?.addEventListener(
    "change",
    filterList
  );


  byId(
    "quizStatusFilter"
  )?.addEventListener(
    "change",
    filterList
  );


  byId(
    "quizList"
  )?.addEventListener(
    "click",
    async (
      event
    ) => {
      const target =
        event.target instanceof
        Element
          ? event.target
          : null;


      const card =
        target?.closest(
          ".quiz-admin-card"
        );


      if (!card) {
        return;
      }


      const quiz =
        quizzes.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              card.dataset.id
            )
        );


      if (!quiz) {
        return;
      }


      if (
        target.closest(
          ".edit-quiz"
        )
      ) {
        fillForm(
          quiz
        );


        return;
      }


      if (
        target.closest(
          ".duplicate-quiz-card"
        )
      ) {
        fillForm(
          quiz,
          true
        );


        return;
      }


      const quickButton =
        target.closest(
          ".quick-quiz-status"
        );


      if (quickButton) {
        await updateQuizStatus(
          quiz,
          quickButton.dataset.status,
          quickButton
        );
      }
    }
  );


  byId(
    "duplicateQuizButton"
  )?.addEventListener(
    "click",
    () => {
      const quiz =
        quizzes.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              byId(
                "quizId"
              ).value
            )
        );


      if (quiz) {
        fillForm(
          quiz,
          true
        );
      }
    }
  );


  byId(
    "archiveQuizButton"
  )?.addEventListener(
    "click",
    archiveQuiz
  );


  byId(
    "quizDialog"
  )?.addEventListener(
    "click",
    (
      event
    ) => {
      if (
        event.target ===
        byId(
          "quizDialog"
        )
      ) {
        byId(
          "quizDialog"
        ).close();
      }
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeAdminQuizzes() {
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


    updateTimerControls();
    updateAntiCheatControls();


    await loadModules();
    await loadQuestions();
    await loadQuizzes();
  } catch (
    error
  ) {
    console.error(
      "ADMIN QUIZZES INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The quiz builder could not be initialized.",
      "error"
    );


    const list =
      byId(
        "quizList"
      );


    if (list) {
      list.innerHTML = `
        <div class="empty-state">
          Quiz management could not be loaded.
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
    () => {
      void initializeAdminQuizzes();
    },
    {
      once:
        true
    }
  );
} else {
  void initializeAdminQuizzes();
}
