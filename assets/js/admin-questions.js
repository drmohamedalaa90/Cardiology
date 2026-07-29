import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL ADMIN QUESTIONS v3.0.0 LOADED"
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


const questionList =
  byId(
    "adminQuestionsList"
  );


const questionDialog =
  byId(
    "questionDialog"
  );


const questionForm =
  byId(
    "questionForm"
  );


const aiQuestionDialog =
  byId(
    "aiQuestionDialog"
  );


let modules =
  [];


let questions =
  [];


let adminProfile =
  null;


let optionCounter =
  0;


let aiDrafts =
  [];


let activeAiDraftId =
  null;


let isLoadingQuestions =
  false;


let isSavingQuestion =
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
  const number =
    Number(
      value
    );


  return Number.isFinite(
    number
  )
    ? number
    : fallback;
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


function normalizeDifficulty(
  value
) {
  const difficulty =
    String(
      value ||
      "intermediate"
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
    : "intermediate";
}


function normalizeQuestionType(
  value
) {
  const questionType =
    String(
      value ||
      "single_best_answer"
    )
      .trim()
      .toLowerCase();


  const supportedTypes = [
    "single_best_answer",
    "multiple_response",
    "true_false",
    "image_based",
    "ordering",
    "matching",
    "short_answer"
  ];


  return supportedTypes.includes(
    questionType
  )
    ? questionType
    : "single_best_answer";
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
      "adminQuestionsStatus"
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


function selectedModuleIds() {
  return modules
    .map(
      (module) =>
        module.id
    )
    .filter(
      Boolean
    );
}


/* =========================================================
   EDITION SETUP
========================================================= */

function applyEditionContext() {
  const isBasic =
    selectedEdition ===
    "basic";


  const badge =
    byId(
      "adminQuestionsEditionBadge"
    );


  const themeColor =
    byId(
      "adminQuestionsThemeColor"
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
    adminQuestionsStudentsLink:
      "admin.html",

    adminQuestionsModulesLink:
      "admin-modules.html"
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
    `Question Bank | ACL ${
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
   MODULE OPTIONS
========================================================= */

function moduleOptions(
  selected = ""
) {
  return modules
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
              selected
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
    );
}


/* =========================================================
   STATISTICS
========================================================= */

function renderStats() {
  byId(
    "questionTotal"
  ).textContent =
    String(
      questions.length
    );


  byId(
    "questionPublished"
  ).textContent =
    String(
      questions.filter(
        (question) =>
          normalizeStatus(
            question.status
          ) ===
          "published"
      ).length
    );


  byId(
    "questionDraft"
  ).textContent =
    String(
      questions.filter(
        (question) =>
          normalizeStatus(
            question.status
          ) ===
          "draft"
      ).length
    );


  byId(
    "questionModules"
  ).textContent =
    String(
      new Set(
        questions
          .map(
            (question) =>
              question.module_id
          )
          .filter(
            Boolean
          )
      ).size
    );
}


/* =========================================================
   QUESTION CARD
========================================================= */

function questionCardHtml(
  question
) {
  const module =
    modules.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          question.module_id
        )
    );


  const status =
    normalizeStatus(
      question.status
    );


  const difficulty =
    normalizeDifficulty(
      question.difficulty
    );


  const questionType =
    normalizeQuestionType(
      question.question_type
    );


  const correctAnswers =
    (
      question.question_options ||
      []
    )
      .filter(
        (option) =>
          option.is_correct
      )
      .map(
        (option) =>
          option.option_key
      )
      .join(
        ", "
      ) ||
    "Not set";


  const stem =
    question.stem ||
    question.question_text ||
    "Untitled question";


  const scenario =
    question.clinical_scenario ||
    question.scenario ||
    "";


  return `
    <article
      class="question-admin-card"
      data-id="${escapeHtml(
        question.id
      )}"
    >

      <div class="question-admin-head">

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


          <span
            class="
              difficulty-pill
              ${escapeHtml(
                difficulty
              )}
            "
          >
            ${escapeHtml(
              titleCase(
                difficulty
              )
            )}
          </span>

        </div>


        <span class="order-badge">
          #${numberValue(
            question.display_order ??
            question.order_index
          )}
        </span>

      </div>


      <div class="question-module-label">
        ${escapeHtml(
          module?.title ||
          question.module_id ||
          "Unassigned module"
        )}
        ·
        ${escapeHtml(
          titleCase(
            questionType
          )
        )}
      </div>


      <h2>
        ${escapeHtml(
          stem
        )}
      </h2>


      ${
        scenario
          ? `
            <p class="question-scenario-preview">
              ${escapeHtml(
                scenario
              )}
            </p>
          `
          : ""
      }


      <div class="module-admin-meta">

        <span>
          ${escapeHtml(
            question.topic ||
            "No topic"
          )}
        </span>

        <span>
          ${numberValue(
            question.default_seconds ??
            question.time_limit_seconds,
            60
          )}
          sec
        </span>

        <span>
          ${
            (
              question.question_options ||
              []
            ).length
          }
          options
        </span>

        <span>
          Correct:
          ${escapeHtml(
            correctAnswers
          )}
        </span>

      </div>


      <div class="question-admin-actions">

        <button
          class="secondary-btn edit-question"
          type="button"
        >
          Edit
        </button>


        <button
          class="secondary-btn duplicate-question-card"
          type="button"
        >
          Duplicate
        </button>


        <button
          class="secondary-btn quick-question-status"
          data-status="${
            status ===
              "published"
              ? "draft"
              : "published"
          }"
          type="button"
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
   FILTER QUESTIONS
========================================================= */

function applyFilters() {
  if (!questionList) {
    return;
  }


  const moduleId =
    byId(
      "questionModuleFilter"
    )
      ?.value ||
    "all";


  const selectedStatus =
    byId(
      "questionStatusFilter"
    )
      ?.value ||
    "all";


  const query =
    byId(
      "questionSearch"
    )
      ?.value
      .trim()
      .toLowerCase() ||
    "";


  const filtered =
    questions.filter(
      (question) => {
        const matchesModule =
          moduleId ===
            "all" ||
          String(
            question.module_id
          ) ===
            String(
              moduleId
            );


        const matchesStatus =
          selectedStatus ===
            "all" ||
          normalizeStatus(
            question.status
          ) ===
            selectedStatus;


        const searchable = [
          question.stem,
          question.question_text,
          question.clinical_scenario,
          question.scenario,
          question.topic,
          question.subtopic,
          question.external_id,
          question.reference_text,
          question.id
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
          searchable.includes(
            query
          );


        return (
          matchesModule &&
          matchesStatus &&
          matchesSearch
        );
      }
    );


  questionList.innerHTML =
    filtered.length
      ? filtered
          .map(
            questionCardHtml
          )
          .join(
            ""
          )
      : `
        <div class="empty-state">
          No questions match these filters.
        </div>
      `;
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


  const filter =
    byId(
      "questionModuleFilter"
    );


  const formModule =
    byId(
      "questionModule"
    );


  const aiModule =
    byId(
      "aiModule"
    );


  if (filter) {
    filter.innerHTML = `
      <option value="all">
        All modules
      </option>

      ${moduleOptions()}
    `;
  }


  if (formModule) {
    formModule.innerHTML =
      moduleOptions();
  }


  if (aiModule) {
    aiModule.innerHTML =
      moduleOptions();
  }
}


/* =========================================================
   LOAD QUESTIONS
========================================================= */

async function loadQuestions() {
  if (isLoadingQuestions) {
    return;
  }


  isLoadingQuestions =
    true;


  const refreshButton =
    byId(
      "refreshQuestions"
    );


  setButtonBusy(
    refreshButton,
    true,
    "Refreshing…",
    "Refresh"
  );


  setStatus(
    "Loading question bank…"
  );


  if (questionList) {
    questionList.innerHTML = `
      <div class="empty-state">
        Loading questions…
      </div>
    `;
  }


  try {
    const moduleIds =
      selectedModuleIds();


    if (!moduleIds.length) {
      questions =
        [];


      renderStats();
      applyFilters();


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
          "questions"
        )
        .select(`
          *,
          question_options (*)
        `)
        .in(
          "module_id",
          moduleIds
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


    questions =
      (
        data ||
        []
      ).map(
        (question) => ({
          ...question,

          status:
            normalizeStatus(
              question.status
            ),

          difficulty:
            normalizeDifficulty(
              question.difficulty
            ),

          question_type:
            normalizeQuestionType(
              question.question_type
            ),

          question_options:
            (
              question.question_options ||
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
    applyFilters();


    setStatus(
      ""
    );
  } catch (error) {
    console.error(
      "QUESTION LOAD ERROR:",
      error
    );


    questions =
      [];


    renderStats();


    if (questionList) {
      questionList.innerHTML = `
        <div class="empty-state">
          The question bank could not be loaded.
        </div>
      `;
    }


    setStatus(
      error.message ||
      "The question bank could not be loaded.",
      "error"
    );
  } finally {
    isLoadingQuestions =
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
   AI DRAFT HELPERS
========================================================= */

function normalizeAiDraftRow(
  row
) {
  let payload =
    row.payload ||
    {};


  if (
    typeof payload ===
    "string"
  ) {
    try {
      payload =
        JSON.parse(
          payload
        );
    } catch {
      payload =
        {};
    }
  }


  return {
    ...row,
    payload
  };
}


function renderAiDrafts() {
  const host =
    byId(
      "aiDraftList"
    );


  if (!host) {
    return;
  }


  if (!aiDrafts.length) {
    host.innerHTML = `
      <div class="ai-empty">
        No pending AI drafts. Generate questions when you are ready.
      </div>
    `;


    return;
  }


  host.innerHTML =
    aiDrafts
      .map(
        (row) => {
          const payload =
            row.payload ||
            {};


          const module =
            modules.find(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  row.module_id
                )
            );


          return `
            <article
              class="ai-draft-card"
              data-ai-draft-id="${escapeHtml(
                row.id
              )}"
            >

              <span class="ai-review-badge">
                Awaiting review
              </span>


              <h3>
                ${escapeHtml(
                  payload.stem ||
                  "Untitled generated question"
                )}
              </h3>


              <div class="ai-draft-meta">

                <span>
                  ${escapeHtml(
                    module?.title ||
                    row.module_id ||
                    "Module"
                  )}
                </span>

                <span>
                  ${escapeHtml(
                    titleCase(
                      payload.difficulty ||
                      "intermediate"
                    )
                  )}
                </span>

                <span>
                  ${escapeHtml(
                    titleCase(
                      payload.question_type ||
                      "single_best_answer"
                    )
                  )}
                </span>

                <span>
                  ${
                    Array.isArray(
                      payload.options
                    )
                      ? payload.options.length
                      : 0
                  }
                  options
                </span>

              </div>


              <div class="ai-draft-actions">

                <button
                  class="primary-btn review-ai-draft"
                  type="button"
                >
                  Review and edit
                </button>


                <button
                  class="secondary-btn reject-ai-draft"
                  type="button"
                >
                  Reject
                </button>

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
   LOAD AI DRAFTS
========================================================= */

async function loadAiDrafts() {
  const moduleIds =
    selectedModuleIds();


  if (!moduleIds.length) {
    aiDrafts =
      [];


    renderAiDrafts();


    return;
  }


  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "ai_question_drafts"
        )
        .select(
          "*"
        )
        .eq(
          "status",
          "pending"
        )
        .in(
          "module_id",
          moduleIds
        )
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


    aiDrafts =
      (
        data ||
        []
      ).map(
        normalizeAiDraftRow
      );


    renderAiDrafts();
  } catch (error) {
    console.warn(
      "AI drafts unavailable:",
      error
    );


    aiDrafts =
      [];


    renderAiDrafts();
  }
}


/* =========================================================
   AI DRAFT TO QUESTION
========================================================= */

function draftToQuestion(
  row
) {
  const payload =
    row.payload ||
    {};


  return {
    module_id:
      row.module_id,

    question_type:
      normalizeQuestionType(
        payload.question_type
      ),

    status:
      "draft",

    clinical_scenario:
      payload.clinical_scenario ||
      payload.scenario ||
      "",

    stem:
      payload.stem ||
      "",

    topic:
      payload.topic ||
      "",

    subtopic:
      payload.subtopic ||
      "",

    difficulty:
      normalizeDifficulty(
        payload.difficulty
      ),

    default_seconds:
      numberValue(
        payload.default_seconds,
        60
      ),

    points:
      1,

    negative_points:
      0,

    display_order:
      100,

    explanation:
      payload.explanation ||
      "",

    reference_text:
      payload.reference_text ||
      "",

    reference_url:
      "",

    confidence_enabled:
      false,

    randomize_options:
      true,

    question_options:
      (
        payload.options ||
        []
      ).map(
        (
          option,
          index
        ) => ({
          option_key:
            option.key ||
            option.option_key ||
            String.fromCharCode(
              65 +
              index
            ),

          option_text:
            option.text ||
            option.option_text ||
            "",

          image_url:
            option.image_url ||
            null,

          is_correct:
            Boolean(
              option.is_correct
            ),

          display_order:
            index +
            1
        })
      )
  };
}


/* =========================================================
   OPEN AI DIALOG
========================================================= */

function openAiDialog() {
  const moduleSelect =
    byId(
      "aiModule"
    );


  if (!moduleSelect) {
    return;
  }


  moduleSelect.innerHTML =
    moduleOptions();


  const filteredModule =
    byId(
      "questionModuleFilter"
    )?.value;


  moduleSelect.value =
    filteredModule &&
    filteredModule !==
      "all"
      ? filteredModule
      : modules[
          0
        ]?.id ||
        "";


  byId(
    "aiGenerationProgress"
  ).textContent =
    "";


  aiQuestionDialog?.showModal();
}


/* =========================================================
   REJECT AI DRAFT
========================================================= */

async function rejectAiDraft(
  id
) {
  const confirmed =
    window.confirm(
      "Reject this AI-generated draft?"
    );


  if (!confirmed) {
    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from(
        "ai_question_drafts"
      )
      .update({
        status:
          "rejected",

        reviewed_at:
          new Date()
            .toISOString(),

        reviewed_by:
          adminProfile.id
      })
      .eq(
        "id",
        id
      );


  if (error) {
    setStatus(
      error.message,
      "error"
    );


    return;
  }


  await loadAiDrafts();


  setStatus(
    "AI draft rejected.",
    "success"
  );
}


/* =========================================================
   OPTION EDITOR
========================================================= */

function updateOptionHelp() {
  const questionType =
    normalizeQuestionType(
      byId(
        "questionType"
      ).value
    );


  const multiple =
    questionType ===
    "multiple_response";


  const help =
    byId(
      "optionHelp"
    );


  if (help) {
    help.textContent =
      multiple
        ? "Choose every correct answer."
        : questionType ===
            "short_answer"
          ? "Add one accepted answer; alternative accepted answers may be added as options."
          : "Choose one correct answer.";
  }


  document
    .querySelectorAll(
      ".option-correct"
    )
    .forEach(
      (input) => {
        input.type =
          multiple
            ? "checkbox"
            : "radio";


        if (!multiple) {
          input.name =
            "correctOption";
        } else {
          input.removeAttribute(
            "name"
          );
        }
      }
    );
}


function addOption(
  option = {}
) {
  optionCounter +=
    1;


  const row =
    document.createElement(
      "div"
    );


  const defaultKey =
    option.option_key ||
    String.fromCharCode(
      64 +
      optionCounter
    );


  const multiple =
    normalizeQuestionType(
      byId(
        "questionType"
      ).value
    ) ===
    "multiple_response";


  row.className =
    "option-row";


  row.dataset.optionId =
    option.id ||
    "";


  row.innerHTML = `
    <span class="option-letter">
      ${escapeHtml(
        defaultKey
      )}
    </span>


    <input
      class="option-key"
      type="hidden"
      value="${escapeHtml(
        defaultKey
      )}"
    >


    <label
      class="correct-choice"
      title="Correct answer"
    >

      <input
        class="option-correct"
        ${
          multiple
            ? 'type="checkbox"'
            : 'type="radio" name="correctOption"'
        }
        ${
          option.is_correct
            ? "checked"
            : ""
        }
      >

      <span>
        Correct
      </span>

    </label>


    <input
      class="option-text"
      required
      placeholder="Answer option"
      value="${escapeHtml(
        option.option_text ||
        ""
      )}"
    >


    <input
      class="option-image"
      type="url"
      placeholder="Optional image URL"
      value="${escapeHtml(
        option.image_url ||
        ""
      )}"
    >


    <button
      class="remove-option"
      type="button"
      aria-label="Remove option"
    >
      ×
    </button>
  `;


  byId(
    "optionRows"
  ).appendChild(
    row
  );


  renumberOptions();
}


function renumberOptions() {
  [
    ...document.querySelectorAll(
      ".option-row"
    )
  ].forEach(
    (
      row,
      index
    ) => {
      const key =
        String.fromCharCode(
          65 +
          index
        );


      row.querySelector(
        ".option-letter"
      ).textContent =
        key;


      row.querySelector(
        ".option-key"
      ).value =
        key;
    }
  );
}


function clearOptions() {
  byId(
    "optionRows"
  ).innerHTML =
    "";


  optionCounter =
    0;
}


/* =========================================================
   QUESTION FORM
========================================================= */

function fillForm(
  question = null,
  duplicate = false
) {
  activeAiDraftId =
    null;


  questionForm.reset();
  clearOptions();


  const source =
    question ||
    {};


  byId(
    "questionDialogTitle"
  ).textContent =
    duplicate
      ? "Duplicate question"
      : question
        ? "Edit question"
        : "Create question";


  byId(
    "questionId"
  ).value =
    duplicate
      ? ""
      : source.id ||
        "";


  byId(
    "questionModule"
  ).value =
    source.module_id ||
    modules[
      0
    ]?.id ||
    "";


  byId(
    "questionType"
  ).value =
    normalizeQuestionType(
      source.question_type
    );


  byId(
    "questionExternalId"
  ).value =
    duplicate
      ? ""
      : source.external_id ||
        "";


  byId(
    "questionStatus"
  ).value =
    duplicate
      ? "draft"
      : normalizeStatus(
          source.status
        );


  byId(
    "questionStatus"
  ).disabled =
    false;


  byId(
    "questionScenario"
  ).value =
    source.clinical_scenario ||
    source.scenario ||
    "";


  byId(
    "questionStem"
  ).value =
    source.stem ||
    source.question_text ||
    "";


  byId(
    "questionTopic"
  ).value =
    source.topic ||
    "";


  byId(
    "questionSubtopic"
  ).value =
    source.subtopic ||
    "";


  byId(
    "questionDifficulty"
  ).value =
    normalizeDifficulty(
      source.difficulty ||
      (
        selectedEdition ===
          "expert"
          ? "expert"
          : "foundation"
      )
    );


  byId(
    "questionSeconds"
  ).value =
    numberValue(
      source.default_seconds ??
      source.time_limit_seconds,
      60
    );


  byId(
    "questionPoints"
  ).value =
    numberValue(
      source.points,
      1
    );


  byId(
    "questionNegativePoints"
  ).value =
    numberValue(
      source.negative_points,
      0
    );


  byId(
    "questionOrder"
  ).value =
    numberValue(
      source.display_order ??
      source.order_index,
      100
    );


  byId(
    "questionImageUrl"
  ).value =
    source.image_url ||
    "";


  byId(
    "questionImageAlt"
  ).value =
    source.image_alt ||
    "";


  byId(
    "questionExplanation"
  ).value =
    source.explanation ||
    "";


  byId(
    "questionReferenceText"
  ).value =
    source.reference_text ||
    "";


  byId(
    "questionReferenceUrl"
  ).value =
    source.reference_url ||
    "";


  byId(
    "questionConfidence"
  ).checked =
    source.confidence_enabled ??
    false;


  byId(
    "questionRandomize"
  ).checked =
    source.randomize_options ??
    true;


  const options =
    source.question_options ||
    [];


  if (options.length) {
    options.forEach(
      addOption
    );
  } else {
    [
      1,
      2,
      3,
      4
    ].forEach(
      () => {
        addOption();
      }
    );
  }


  updateOptionHelp();


  byId(
    "archiveQuestionButton"
  ).hidden =
    !question ||
    duplicate;


  byId(
    "duplicateQuestionButton"
  ).hidden =
    !question ||
    duplicate;


  questionDialog.showModal();
}


/* =========================================================
   QUESTION PAYLOAD
========================================================= */

function questionPayload() {
  const stem =
    byId(
      "questionStem"
    ).value.trim();


  return {
    module_id:
      byId(
        "questionModule"
      ).value,

    external_id:
      byId(
        "questionExternalId"
      ).value.trim() ||
      null,

    question_type:
      normalizeQuestionType(
        byId(
          "questionType"
        ).value
      ),

    stem,

    question_text:
      stem,

    clinical_scenario:
      byId(
        "questionScenario"
      ).value.trim() ||
      null,

    scenario:
      byId(
        "questionScenario"
      ).value.trim() ||
      null,

    image_url:
      byId(
        "questionImageUrl"
      ).value.trim() ||
      null,

    image_alt:
      byId(
        "questionImageAlt"
      ).value.trim() ||
      null,

    explanation:
      byId(
        "questionExplanation"
      ).value.trim() ||
      null,

    reference_text:
      byId(
        "questionReferenceText"
      ).value.trim() ||
      null,

    reference_url:
      byId(
        "questionReferenceUrl"
      ).value.trim() ||
      null,

    topic:
      byId(
        "questionTopic"
      ).value.trim() ||
      null,

    subtopic:
      byId(
        "questionSubtopic"
      ).value.trim() ||
      null,

    difficulty:
      normalizeDifficulty(
        byId(
          "questionDifficulty"
        ).value
      ),

    default_seconds:
      Math.max(
        5,
        numberValue(
          byId(
            "questionSeconds"
          ).value,
          60
        )
      ),

    time_limit_seconds:
      Math.max(
        5,
        numberValue(
          byId(
            "questionSeconds"
          ).value,
          60
        )
      ),

    points:
      Math.max(
        0,
        numberValue(
          byId(
            "questionPoints"
          ).value,
          1
        )
      ),

    negative_points:
      Math.max(
        0,
        numberValue(
          byId(
            "questionNegativePoints"
          ).value,
          0
        )
      ),

    confidence_enabled:
      byId(
        "questionConfidence"
      ).checked,

    randomize_options:
      byId(
        "questionRandomize"
      ).checked,

    display_order:
      numberValue(
        byId(
          "questionOrder"
        ).value,
        100
      ),

    order_index:
      numberValue(
        byId(
          "questionOrder"
        ).value,
        100
      ),

    status:
      normalizeStatus(
        byId(
          "questionStatus"
        ).value
      ),

    created_by:
      adminProfile.id
  };
}


/* =========================================================
   OPTION PAYLOAD
========================================================= */

function optionPayload(
  questionId
) {
  return [
    ...document.querySelectorAll(
      ".option-row"
    )
  ].map(
    (
      row,
      index
    ) => ({
      id:
        row.dataset.optionId ||
        undefined,

      question_id:
        questionId,

      option_key:
        row.querySelector(
          ".option-key"
        ).value,

      option_text:
        row.querySelector(
          ".option-text"
        ).value.trim(),

      image_url:
        row.querySelector(
          ".option-image"
        ).value.trim() ||
        null,

      is_correct:
        row.querySelector(
          ".option-correct"
        ).checked,

      display_order:
        index +
        1
    })
  );
}


/* =========================================================
   VALIDATION
========================================================= */

function validateQuestion(
  payload
) {
  if (!payload.module_id) {
    throw new Error(
      "Select a module."
    );
  }


  if (!payload.stem) {
    throw new Error(
      "Question stem is required."
    );
  }


  const optionRows = [
    ...document.querySelectorAll(
      ".option-row"
    )
  ];


  if (!optionRows.length) {
    throw new Error(
      "Add at least one answer option."
    );
  }


  const emptyOptions =
    optionRows.filter(
      (row) =>
        !row
          .querySelector(
            ".option-text"
          )
          .value
          .trim()
    );


  if (emptyOptions.length) {
    throw new Error(
      "Complete all answer-option fields or remove unused options."
    );
  }


  const correctCount =
    optionRows.filter(
      (row) =>
        row.querySelector(
          ".option-correct"
        ).checked
    ).length;


  if (
    payload.question_type !==
      "short_answer" &&
    correctCount ===
      0
  ) {
    throw new Error(
      "Select at least one correct answer."
    );
  }


  if (
    payload.question_type !==
      "multiple_response" &&
    correctCount >
      1
  ) {
    throw new Error(
      "This question type allows only one correct answer."
    );
  }


  return true;
}


/* =========================================================
   SAVE OPTIONS
========================================================= */

async function saveOptions(
  questionId
) {
  const options =
    optionPayload(
      questionId
    );


  const existingIds =
    options
      .filter(
        (option) =>
          option.id
      )
      .map(
        (option) =>
          option.id
      );


  let deleteQuery =
    supabaseClient
      .from(
        "question_options"
      )
      .delete()
      .eq(
        "question_id",
        questionId
      );


  if (
    existingIds.length
  ) {
    deleteQuery =
      deleteQuery.not(
        "id",
        "in",
        `(${existingIds.join(
          ","
        )})`
      );
  }


  const {
    error: deleteError
  } =
    await deleteQuery;


  if (deleteError) {
    throw deleteError;
  }


  const normalized =
    options.map(
      (option) => {
        const copy = {
          ...option
        };


        if (!copy.id) {
          delete copy.id;
        }


        return copy;
      }
    );


  if (!normalized.length) {
    return;
  }


  const {
    error: optionError
  } =
    await supabaseClient
      .from(
        "question_options"
      )
      .upsert(
        normalized,
        {
          onConflict:
            "id"
        }
      );


  if (optionError) {
    throw optionError;
  }
}


/* =========================================================
   SAVE QUESTION
========================================================= */

async function saveQuestion() {
  if (isSavingQuestion) {
    return;
  }


  const payload =
    questionPayload();


  if (activeAiDraftId) {
    payload.status =
      "draft";
  }


  validateQuestion(
    payload
  );


  isSavingQuestion =
    true;


  const submitButton =
    questionForm.querySelector(
      'button[type="submit"]'
    );


  setButtonBusy(
    submitButton,
    true,
    "Saving…",
    "Save question"
  );


  setStatus(
    "Saving question…"
  );


  try {
    const existingId =
      byId(
        "questionId"
      ).value;


    let questionId =
      existingId;


    if (existingId) {
      const {
        error
      } =
        await supabaseClient
          .from(
            "questions"
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
            selectedModuleIds()
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
            "questions"
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


      questionId =
        data.id;
    }


    await saveOptions(
      questionId
    );


    if (activeAiDraftId) {
      const {
        error: reviewError
      } =
        await supabaseClient
          .from(
            "ai_question_drafts"
          )
          .update({
            status:
              "approved",

            linked_question_id:
              questionId,

            reviewed_at:
              new Date()
                .toISOString(),

            reviewed_by:
              adminProfile.id
          })
          .eq(
            "id",
            activeAiDraftId
          );


      if (reviewError) {
        throw new Error(
          `Question saved, but AI review status failed: ${reviewError.message}`
        );
      }


      activeAiDraftId =
        null;


      await loadAiDrafts();
    }


    questionDialog.close();


    await loadQuestions();


    setStatus(
      payload.status ===
        "published"
        ? "Question saved and published."
        : "Question saved successfully.",
      "success"
    );
  } catch (error) {
    console.error(
      "QUESTION SAVE ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The question could not be saved.",
      "error"
    );
  } finally {
    isSavingQuestion =
      false;


    setButtonBusy(
      submitButton,
      false,
      "Saving…",
      "Save question"
    );
  }
}


/* =========================================================
   ARCHIVE QUESTION
========================================================= */

async function archiveQuestion() {
  const id =
    byId(
      "questionId"
    ).value;


  if (!id) {
    return;
  }


  const confirmed =
    window.confirm(
      "Archive this question?"
    );


  if (!confirmed) {
    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from(
        "questions"
      )
      .update({
        status:
          "archived"
      })
      .eq(
        "id",
        id
      )
      .in(
        "module_id",
        selectedModuleIds()
      );


  if (error) {
    setStatus(
      error.message,
      "error"
    );


    return;
  }


  questionDialog.close();


  await loadQuestions();


  setStatus(
    "Question archived.",
    "success"
  );
}


/* =========================================================
   QUICK QUESTION STATUS
========================================================= */

async function updateQuestionStatus(
  question,
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
          "questions"
        )
        .update({
          status:
            normalizeStatus(
              nextStatus
            )
        })
        .eq(
          "id",
          question.id
        )
        .in(
          "module_id",
          selectedModuleIds()
        );


    if (error) {
      throw error;
    }


    await loadQuestions();


    setStatus(
      nextStatus ===
        "published"
        ? "Question published."
        : "Question moved to draft.",
      "success"
    );
  } catch (error) {
    setStatus(
      error.message ||
      "Question status could not be updated.",
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
   AI GENERATION
========================================================= */

async function generateAiDrafts(
  event
) {
  event.preventDefault();


  const submitButton =
    byId(
      "submitAiGeneration"
    );


  const progress =
    byId(
      "aiGenerationProgress"
    );


  const moduleId =
    byId(
      "aiModule"
    ).value;


  const prompt =
    byId(
      "aiPrompt"
    ).value.trim();


  if (!moduleId) {
    progress.textContent =
      "Select a module.";


    return;
  }


  if (!prompt) {
    progress.textContent =
      "Enter the topic and instructions.";


    return;
  }


  setButtonBusy(
    submitButton,
    true,
    "Generating…",
    "Generate drafts"
  );


  progress.textContent =
    "Generating secure review drafts…";


  try {
    const module =
      modules.find(
        (item) =>
          String(
            item.id
          ) ===
          String(
            moduleId
          )
      );


    const {
      data,
      error
    } =
      await supabaseClient
        .functions
        .invoke(
          "generate-question-drafts",
          {
            body: {
              module_id:
                moduleId,

              module_title:
                module?.title ||
                "",

              edition:
                selectedEdition,

              count:
                Math.min(
                  10,
                  Math.max(
                    1,
                    numberValue(
                      byId(
                        "aiQuestionCount"
                      ).value,
                      5
                    )
                  )
                ),

              difficulty:
                normalizeDifficulty(
                  byId(
                    "aiDifficulty"
                  ).value
                ),

              question_type:
                normalizeQuestionType(
                  byId(
                    "aiQuestionType"
                  ).value
                ),

              prompt,

              reference_context:
                byId(
                  "aiReferenceContext"
                ).value.trim()
            }
          }
        );


    if (error) {
      throw error;
    }


    if (data?.error) {
      throw new Error(
        data.error
      );
    }


    progress.textContent =
      `${
        data?.created_count ||
        0
      } draft question(s) generated for review.`;


    await loadAiDrafts();


    window.setTimeout(
      () => {
        aiQuestionDialog.close();
      },
      700
    );
  } catch (error) {
    console.error(
      "AI GENERATION ERROR:",
      error
    );


    progress.textContent =
      error.message ||
      "AI generation failed.";
  } finally {
    setButtonBusy(
      submitButton,
      false,
      "Generating…",
      "Generate drafts"
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  questionForm?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      await saveQuestion();
    }
  );


  byId(
    "newQuestionButton"
  )?.addEventListener(
    "click",
    () => {
      fillForm();
    }
  );


  byId(
    "closeQuestionDialog"
  )?.addEventListener(
    "click",
    () => {
      questionDialog.close();
    }
  );


  byId(
    "cancelQuestionButton"
  )?.addEventListener(
    "click",
    () => {
      questionDialog.close();
    }
  );


  byId(
    "addOptionButton"
  )?.addEventListener(
    "click",
    () => {
      addOption();
    }
  );


  byId(
    "questionType"
  )?.addEventListener(
    "change",
    updateOptionHelp
  );


  byId(
    "refreshQuestions"
  )?.addEventListener(
    "click",
    async () => {
      await Promise.all([
        loadQuestions(),
        loadAiDrafts()
      ]);
    }
  );


  byId(
    "questionModuleFilter"
  )?.addEventListener(
    "change",
    applyFilters
  );


  byId(
    "questionStatusFilter"
  )?.addEventListener(
    "change",
    applyFilters
  );


  byId(
    "questionSearch"
  )?.addEventListener(
    "input",
    applyFilters
  );


  byId(
    "optionRows"
  )?.addEventListener(
    "click",
    (event) => {
      const removeButton =
        event.target.closest(
          ".remove-option"
        );


      if (!removeButton) {
        return;
      }


      removeButton
        .closest(
          ".option-row"
        )
        .remove();


      renumberOptions();
    }
  );


  byId(
    "archiveQuestionButton"
  )?.addEventListener(
    "click",
    archiveQuestion
  );


  byId(
    "duplicateQuestionButton"
  )?.addEventListener(
    "click",
    () => {
      const question =
        questions.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              byId(
                "questionId"
              ).value
            )
        );


      if (question) {
        fillForm(
          question,
          true
        );
      }
    }
  );


  byId(
    "generateAiQuestionsButton"
  )?.addEventListener(
    "click",
    openAiDialog
  );


  byId(
    "generateAiQuestionsButtonSecondary"
  )?.addEventListener(
    "click",
    openAiDialog
  );


  byId(
    "closeAiQuestionDialog"
  )?.addEventListener(
    "click",
    () => {
      aiQuestionDialog.close();
    }
  );


  byId(
    "cancelAiQuestionDialog"
  )?.addEventListener(
    "click",
    () => {
      aiQuestionDialog.close();
    }
  );


  byId(
    "aiQuestionForm"
  )?.addEventListener(
    "submit",
    generateAiDrafts
  );


  byId(
    "aiDraftList"
  )?.addEventListener(
    "click",
    async (event) => {
      const card =
        event.target.closest(
          "[data-ai-draft-id]"
        );


      if (!card) {
        return;
      }


      const row =
        aiDrafts.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              card.dataset.aiDraftId
            )
        );


      if (!row) {
        return;
      }


      if (
        event.target.closest(
          ".reject-ai-draft"
        )
      ) {
        await rejectAiDraft(
          row.id
        );


        return;
      }


      if (
        event.target.closest(
          ".review-ai-draft"
        )
      ) {
        const generatedQuestion =
          draftToQuestion(
            row
          );


        fillForm(
          generatedQuestion,
          true
        );


        activeAiDraftId =
          row.id;


        byId(
          "questionDialogTitle"
        ).textContent =
          "Review AI-generated question";


        byId(
          "questionStatus"
        ).value =
          "draft";


        byId(
          "questionStatus"
        ).disabled =
          true;
      }
    }
  );


  questionDialog?.addEventListener(
    "close",
    () => {
      byId(
        "questionStatus"
      ).disabled =
        false;


      activeAiDraftId =
        null;
    }
  );


  questionList?.addEventListener(
    "click",
    async (event) => {
      const card =
        event.target.closest(
          ".question-admin-card"
        );


      if (!card) {
        return;
      }


      const question =
        questions.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              card.dataset.id
            )
        );


      if (!question) {
        return;
      }


      if (
        event.target.closest(
          ".edit-question"
        )
      ) {
        fillForm(
          question
        );


        return;
      }


      if (
        event.target.closest(
          ".duplicate-question-card"
        )
      ) {
        fillForm(
          question,
          true
        );


        return;
      }


      const quickButton =
        event.target.closest(
          ".quick-question-status"
        );


      if (quickButton) {
        await updateQuestionStatus(
          question,
          quickButton.dataset.status,
          quickButton
        );
      }
    }
  );


  questionDialog?.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        questionDialog
      ) {
        questionDialog.close();
      }
    }
  );


  aiQuestionDialog?.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        aiQuestionDialog
      ) {
        aiQuestionDialog.close();
      }
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeAdminQuestions() {
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


    await Promise.all([
      loadQuestions(),
      loadAiDrafts()
    ]);
  } catch (error) {
    console.error(
      "ADMIN QUESTIONS INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The question bank could not be initialized.",
      "error"
    );


    if (questionList) {
      questionList.innerHTML = `
        <div class="empty-state">
          Question management could not be loaded.
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
    initializeAdminQuestions,
    {
      once:
        true
    }
  );
} else {
  void initializeAdminQuestions();
}
