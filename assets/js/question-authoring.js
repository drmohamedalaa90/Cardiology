import {
  supabaseClient
} from "./supabase-client.js";


import {
  requireAdmin
} from "./auth.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL QUESTION AUTHORING v1.0.0 LOADED"
);


/* =========================================================
   PAGE STATE
========================================================= */

const selectedEdition =
  resolveAclEdition();


const state = {
  profile: null,
  modules: [],
  quizzes: [],
  questions: [],
  selectedQuestionId: null,
  isSaving: false
};


const el =
  (id) =>
    document.getElementById(
      id
    );


/* =========================================================
   ELEMENTS
========================================================= */

const moduleFilter =
  el(
    "questionAuthoringModuleFilter"
  );


const quizFilter =
  el(
    "questionAuthoringQuizFilter"
  );


const statusFilter =
  el(
    "questionAuthoringStatusFilter"
  );


const form =
  el(
    "questionAuthoringForm"
  );


const questionList =
  el(
    "questionAuthoringQuestionList"
  );


const statusBox =
  el(
    "questionAuthoringStatus"
  );


const refreshButton =
  el(
    "refreshQuestionAuthoring"
  );


const newQuestionButton =
  el(
    "createNewQuestion"
  );


const deleteButton =
  el(
    "deleteQuestion"
  );


const duplicateButton =
  el(
    "duplicateQuestion"
  );


const resetButton =
  el(
    "resetQuestionForm"
  );


const saveDraftButton =
  el(
    "saveQuestionDraft"
  );


const publishButton =
  el(
    "publishQuestion"
  );


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


function normalizeQuestionType(
  value
) {
  const type =
    String(
      value ||
      "single_best_answer"
    )
      .trim()
      .toLowerCase();


  return [
    "single_best_answer",
    "multiple_response",
    "true_false"
  ].includes(
    type
  )
    ? type
    : "single_best_answer";
}


function normalizeDifficulty(
  value
) {
  const difficulty =
    String(
      value ||
      selectedEdition
    )
      .trim()
      .toLowerCase();


  return [
    "basic",
    "intermediate",
    "expert"
  ].includes(
    difficulty
  )
    ? difficulty
    : selectedEdition;
}


function setStatus(
  message = "",
  kind = ""
) {
  if (!statusBox) {
    return;
  }


  statusBox.textContent =
    message;


  statusBox.className =
    `authoring-status ${kind}`.trim();


  statusBox.hidden =
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


function selectedModuleId() {
  return (
    moduleFilter?.value ||
    ""
  );
}


function selectedQuizId() {
  return (
    quizFilter?.value ||
    ""
  );
}


function selectedQuestion() {
  return state.questions.find(
    (question) =>
      String(
        question.id
      ) ===
      String(
        state.selectedQuestionId
      )
  ) || null;
}


function optionInput(
  key
) {
  return el(
    `questionAuthoringOption${key}`
  );
}


function correctOptionInputs() {
  return [
    ...document.querySelectorAll(
      'input[name="questionAuthoringCorrectOption"]'
    )
  ];
}


/* =========================================================
   EDITION DISPLAY
========================================================= */

function renderEdition() {
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


  const badge =
    el(
      "questionAuthoringEditionBadge"
    );


  if (badge) {
    badge.textContent =
      isBasic
        ? "BASIC EDITION"
        : "EXPERT EDITION";
  }


  const themeColor =
    el(
      "questionAuthoringThemeColor"
    );


  if (themeColor) {
    themeColor.content =
      isBasic
        ? "#105541"
        : "#123f72";
  }


  const modulesLink =
    el(
      "questionAuthoringModulesLink"
    );


  const analyticsLink =
    el(
      "questionAuthoringAnalyticsLink"
    );


  if (modulesLink) {
    modulesLink.href =
      aclUrl(
        "modules.html",
        selectedEdition
      );
  }


  if (analyticsLink) {
    analyticsLink.href =
      aclUrl(
        "admin-analytics.html",
        selectedEdition
      );
  }


  document.title =
    `${
      isBasic
        ? "Basic"
        : "Expert"
    } Edition Question Authoring | ACL`;


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
   ADMIN PROTECTION
========================================================= */

async function protectAuthoringPage() {
  const profile =
    await protectAndRender(
      "login.html"
    );


  if (!profile) {
    return null;
  }


  await requireAdmin();


  state.profile =
    profile;


  return profile;
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
        slug,
        title,
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
          ascending: true
        }
      )
      .order(
        "title",
        {
          ascending: true
        }
      );


  if (error) {
    throw error;
  }


  state.modules =
    data ||
    [];


  const options = [
    `
      <option value="">
        Select module
      </option>
    `,

    ...state.modules.map(
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
  ].join(
    ""
  );


  if (moduleFilter) {
    moduleFilter.innerHTML =
      options;
  }


  const formModule =
    el(
      "questionAuthoringModuleId"
    );


  if (formModule) {
    formModule.innerHTML =
      options;
  }
}


/* =========================================================
   LOAD QUIZZES
========================================================= */

async function loadQuizzes(
  moduleId
) {
  state.quizzes =
    [];


  const quizOptionsDefault = `
    <option value="">
      Select quiz
    </option>
  `;


  if (quizFilter) {
    quizFilter.innerHTML =
      quizOptionsDefault;
  }


  const formQuiz =
    el(
      "questionAuthoringQuizId"
    );


  if (formQuiz) {
    formQuiz.innerHTML =
      quizOptionsDefault;
  }


  if (!moduleId) {
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
        slug,
        title,
        module_id,
        edition,
        status,
        opens_at,
        closes_at
      `)
      .eq(
        "module_id",
        moduleId
      )
      .eq(
        "edition",
        selectedEdition
      )
      .order(
        "title",
        {
          ascending: true
        }
      );


  if (error) {
    throw error;
  }


  state.quizzes =
    data ||
    [];


  const options = [
    quizOptionsDefault,

    ...state.quizzes.map(
      (quiz) => `
        <option value="${escapeHtml(
          quiz.id
        )}">
          ${escapeHtml(
            quiz.title
          )}
        </option>
      `
    )
  ].join(
    ""
  );


  if (quizFilter) {
    quizFilter.innerHTML =
      options;
  }


  if (formQuiz) {
    formQuiz.innerHTML =
      options;
  }
}


/* =========================================================
   LOAD QUESTIONS
========================================================= */

async function loadQuestions() {
  const quizId =
    selectedQuizId();


  if (!quizId) {
    state.questions =
      [];


    state.selectedQuestionId =
      null;


    renderQuestionList();


    resetForm();


    updateListDescription();


    return;
  }


  setStatus(
    "Loading questions…"
  );


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
        quiz_id,
        module_id,
        order_index,
        question_type,
        difficulty,
        topic,
        scenario,
        stem,
        question_text,
        time_limit_seconds,
        status,
        explanation,
        expert_tip,
        flashcard_type,
        flashcard_title,
        flashcard_content,
        image_url,
        reference_text,
        allow_confidence,
        allow_flashcard,
        is_active,
        created_at,
        updated_at,
        question_options (
          id,
          question_id,
          option_key,
          option_text,
          display_order,
          is_correct,
          feedback
        )
      `)
      .eq(
        "quiz_id",
        quizId
      )
      .order(
        "order_index",
        {
          ascending: true
        }
      );


  if (error) {
    throw error;
  }


  state.questions =
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


  if (
    state.selectedQuestionId &&
    !state.questions.some(
      (question) =>
        String(
          question.id
        ) ===
        String(
          state.selectedQuestionId
        )
    )
  ) {
    state.selectedQuestionId =
      null;
  }


  renderQuestionList();
  updateListDescription();


  if (
    state.selectedQuestionId
  ) {
    populateForm(
      selectedQuestion()
    );
  } else {
    resetForm();
  }


  setStatus(
    `Loaded ${state.questions.length} question${
      state.questions.length === 1
        ? ""
        : "s"
    }.`,
    "success"
  );
}


/* =========================================================
   QUESTION LIST
========================================================= */

function filteredQuestions() {
  const selectedStatus =
    statusFilter?.value ||
    "all";


  return state.questions.filter(
    (question) =>
      selectedStatus ===
        "all" ||
      normalizeStatus(
        question.status
      ) ===
        selectedStatus
  );
}


function questionPreviewText(
  question
) {
  return (
    question.stem ||
    question.question_text ||
    question.scenario ||
    "Untitled question"
  );
}


function renderQuestionList() {
  if (!questionList) {
    return;
  }


  const questions =
    filteredQuestions();


  const count =
    el(
      "questionAuthoringQuestionCount"
    );


  if (count) {
    count.textContent =
      String(
        questions.length
      );
  }


  if (!selectedQuizId()) {
    questionList.innerHTML = `
      <div class="authoring-question-list-empty">
        Select a module and quiz to load questions.
      </div>
    `;


    return;
  }


  if (!questions.length) {
    questionList.innerHTML = `
      <div class="authoring-question-list-empty">
        No questions match the current selection.
      </div>
    `;


    return;
  }


  questionList.innerHTML =
    questions.map(
      (
        question,
        index
      ) => {
        const active =
          String(
            question.id
          ) ===
          String(
            state.selectedQuestionId
          );


        const status =
          normalizeStatus(
            question.status
          );


        const preview =
          questionPreviewText(
            question
          );


        return `
          <button
            class="
              authoring-question-list-item
              ${
                active
                  ? "active"
                  : ""
              }
            "
            type="button"
            data-question-id="${escapeHtml(
              question.id
            )}"
          >

            <span class="authoring-question-number">
              ${escapeHtml(
                question.order_index ||
                index + 1
              )}
            </span>


            <span class="authoring-question-list-main">

              <strong title="${escapeHtml(
                preview
              )}">
                ${escapeHtml(
                  preview
                )}
              </strong>

              <span>
                ${escapeHtml(
                  String(
                    question.topic ||
                    question.question_type ||
                    "Question"
                  ).replaceAll(
                    "_",
                    " "
                  )
                )}
              </span>

            </span>


            <span
              class="
                authoring-question-state
                ${escapeHtml(
                  status
                )}
              "
            >
              ${escapeHtml(
                status
              )}
            </span>

          </button>
        `;
      }
    ).join(
      ""
    );
}


function updateListDescription() {
  const description =
    el(
      "questionAuthoringListDescription"
    );


  if (!description) {
    return;
  }


  const module =
    state.modules.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          selectedModuleId()
        )
    );


  const quiz =
    state.quizzes.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          selectedQuizId()
        )
    );


  if (!module) {
    description.textContent =
      "Select a module and quiz to review questions.";


    return;
  }


  if (!quiz) {
    description.textContent =
      `${module.title}: select a quiz.`;


    return;
  }


  description.textContent =
    `${module.title} · ${quiz.title}`;
}


/* =========================================================
   RESET FORM
========================================================= */

function resetForm() {
  state.selectedQuestionId =
    null;


  if (form) {
    form.reset();
  }


  el(
    "questionAuthoringQuestionId"
  ).value =
    "";


  el(
    "questionAuthoringModuleId"
  ).value =
    selectedModuleId();


  el(
    "questionAuthoringQuizId"
  ).value =
    selectedQuizId();


  el(
    "questionAuthoringOrderIndex"
  ).value =
    String(
      state.questions.length +
      1
    );


  el(
    "questionAuthoringType"
  ).value =
    "single_best_answer";


  el(
    "questionAuthoringDifficulty"
  ).value =
    selectedEdition ===
      "basic"
      ? "basic"
      : "expert";


  el(
    "questionAuthoringTimeLimit"
  ).value =
    "60";


  el(
    "questionAuthoringStatusValue"
  ).value =
    "draft";


  el(
    "questionAuthoringFlashcardType"
  ).value =
    "flashcard";


  el(
    "questionAuthoringAllowConfidence"
  ).checked =
    true;


  el(
    "questionAuthoringAllowFlashcard"
  ).checked =
    true;


  el(
    "questionAuthoringActive"
  ).checked =
    true;


  correctOptionInputs().forEach(
    (input) => {
      input.checked =
        false;
    }
  );


  renderImagePreview();


  updateFormHeading(
    null
  );


  updateActionButtons();


  renderQuestionList();
}


/* =========================================================
   FORM HEADING
========================================================= */

function updateFormHeading(
  question
) {
  const title =
    el(
      "questionAuthoringFormTitle"
    );


  const description =
    el(
      "questionAuthoringFormDescription"
    );


  const currentState =
    el(
      "questionAuthoringCurrentState"
    );


  if (!question) {
    if (title) {
      title.textContent =
        "New question";
    }


    if (description) {
      description.textContent =
        "Complete the fields below, then save as draft or publish.";
    }


    if (currentState) {
      currentState.textContent =
        "Draft";


      currentState.className =
        "authoring-question-state";
    }


    return;
  }


  const status =
    normalizeStatus(
      question.status
    );


  if (title) {
    title.textContent =
      `Edit question ${
        question.order_index ||
        ""
      }`.trim();
  }


  if (description) {
    description.textContent =
      "Update the question content, options, explanation, and publication state.";
  }


  if (currentState) {
    currentState.textContent =
      status;


    currentState.className =
      `authoring-question-state ${status}`;
  }
}


/* =========================================================
   POPULATE FORM
========================================================= */

function populateForm(
  question
) {
  if (!question) {
    resetForm();


    return;
  }


  state.selectedQuestionId =
    question.id;


  el(
    "questionAuthoringQuestionId"
  ).value =
    question.id ||
    "";


  el(
    "questionAuthoringModuleId"
  ).value =
    question.module_id ||
    selectedModuleId();


  el(
    "questionAuthoringQuizId"
  ).value =
    question.quiz_id ||
    selectedQuizId();


  el(
    "questionAuthoringOrderIndex"
  ).value =
    question.order_index ||
    1;


  el(
    "questionAuthoringType"
  ).value =
    normalizeQuestionType(
      question.question_type
    );


  el(
    "questionAuthoringDifficulty"
  ).value =
    normalizeDifficulty(
      question.difficulty
    );


  el(
    "questionAuthoringTopic"
  ).value =
    question.topic ||
    "";


  el(
    "questionAuthoringScenario"
  ).value =
    question.scenario ||
    "";


  el(
    "questionAuthoringStem"
  ).value =
    question.stem ||
    question.question_text ||
    "";


  el(
    "questionAuthoringTimeLimit"
  ).value =
    numberValue(
      question.time_limit_seconds,
      60
    );


  el(
    "questionAuthoringStatusValue"
  ).value =
    normalizeStatus(
      question.status
    );


  el(
    "questionAuthoringExplanation"
  ).value =
    question.explanation ||
    "";


  el(
    "questionAuthoringExpertTip"
  ).value =
    question.expert_tip ||
    "";


  el(
    "questionAuthoringFlashcardType"
  ).value =
    question.flashcard_type ||
    "flashcard";


  el(
    "questionAuthoringFlashcardTitle"
  ).value =
    question.flashcard_title ||
    "";


  el(
    "questionAuthoringFlashcardContent"
  ).value =
    question.flashcard_content ||
    "";


  el(
    "questionAuthoringImageUrl"
  ).value =
    question.image_url ||
    "";


  el(
    "questionAuthoringReference"
  ).value =
    question.reference_text ||
    "";


  el(
    "questionAuthoringAllowConfidence"
  ).checked =
    question.allow_confidence !==
    false;


  el(
    "questionAuthoringAllowFlashcard"
  ).checked =
    question.allow_flashcard !==
    false;


  el(
    "questionAuthoringActive"
  ).checked =
    question.is_active !==
    false;


  for (
    const key of
    [
      "A",
      "B",
      "C",
      "D"
    ]
  ) {
    const option =
      question.question_options?.find(
        (item) =>
          String(
            item.option_key
          ).toUpperCase() ===
          key
      );


    optionInput(
      key
    ).value =
      option?.option_text ||
      "";


    const correctInput =
      document.querySelector(
        `input[name="questionAuthoringCorrectOption"][value="${key}"]`
      );


    if (correctInput) {
      correctInput.checked =
        Boolean(
          option?.is_correct
        );
    }
  }


  renderImagePreview();


  updateFormHeading(
    question
  );


  updateActionButtons();


  renderQuestionList();
}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function renderImagePreview() {
  const preview =
    el(
      "questionAuthoringImagePreview"
    );


  const imageUrl =
    String(
      el(
        "questionAuthoringImageUrl"
      )?.value ||
      ""
    ).trim();


  if (!preview) {
    return;
  }


  if (!imageUrl) {
    preview.textContent =
      "Image preview will appear here.";


    return;
  }


  try {
    const url =
      new URL(
        imageUrl,
        window.location.href
      );


    if (
      ![
        "http:",
        "https:"
      ].includes(
        url.protocol
      )
    ) {
      throw new Error(
        "Unsupported image protocol."
      );
    }


    preview.innerHTML = `
      <img
        src="${escapeHtml(
          url.href
        )}"
        alt="Question image preview"
        loading="lazy"
      >
    `;
  } catch {
    preview.textContent =
      "Enter a valid image URL.";
  }
}


/* =========================================================
   VALIDATION
========================================================= */

function validateForm() {
  const moduleId =
    el(
      "questionAuthoringModuleId"
    ).value;


  const quizId =
    el(
      "questionAuthoringQuizId"
    ).value;


  const stem =
    el(
      "questionAuthoringStem"
    ).value.trim();


  const questionType =
    normalizeQuestionType(
      el(
        "questionAuthoringType"
      ).value
    );


  if (!moduleId) {
    throw new Error(
      "Select a module."
    );
  }


  if (!quizId) {
    throw new Error(
      "Select a quiz."
    );
  }


  if (!stem) {
    throw new Error(
      "Enter the question stem."
    );
  }


  const options =
    collectOptions();


  const nonEmptyOptions =
    options.filter(
      (option) =>
        option.option_text
    );


  if (
    questionType ===
      "true_false"
  ) {
    if (
      nonEmptyOptions.length <
      2
    ) {
      throw new Error(
        "True or false questions require at least two options."
      );
    }
  } else if (
    nonEmptyOptions.length <
    4
  ) {
    throw new Error(
      "Enter all four answer options."
    );
  }


  const correctOptions =
    options.filter(
      (option) =>
        option.is_correct
    );


  if (!correctOptions.length) {
    throw new Error(
      "Mark the correct answer."
    );
  }


  if (
    questionType ===
      "single_best_answer" &&
    correctOptions.length !==
      1
  ) {
    throw new Error(
      "Single best answer questions must have exactly one correct option."
    );
  }


  const flashcardType =
    el(
      "questionAuthoringFlashcardType"
    ).value;


  const allowFlashcard =
    el(
      "questionAuthoringAllowFlashcard"
    ).checked;


  if (
    allowFlashcard &&
    flashcardType !==
      "none"
  ) {
    const flashcardTitle =
      el(
        "questionAuthoringFlashcardTitle"
      ).value.trim();


    const flashcardContent =
      el(
        "questionAuthoringFlashcardContent"
      ).value.trim();


    if (!flashcardTitle) {
      throw new Error(
        "Enter the flashcard title or disable the flashcard."
      );
    }


    if (!flashcardContent) {
      throw new Error(
        "Enter the flashcard content or disable the flashcard."
      );
    }
  }


  return true;
}


/* =========================================================
   COLLECT DATA
========================================================= */

function collectQuestionPayload(
  forcedStatus = null
) {
  const status =
    normalizeStatus(
      forcedStatus ||
      el(
        "questionAuthoringStatusValue"
      ).value
    );


  const stem =
    el(
      "questionAuthoringStem"
    ).value.trim();


  const flashcardType =
    el(
      "questionAuthoringAllowFlashcard"
    ).checked
      ? el(
          "questionAuthoringFlashcardType"
        ).value
      : "none";


  return {
    quiz_id:
      el(
        "questionAuthoringQuizId"
      ).value,

    module_id:
      el(
        "questionAuthoringModuleId"
      ).value,

    order_index:
      Math.max(
        1,
        numberValue(
          el(
            "questionAuthoringOrderIndex"
          ).value,
          1
        )
      ),

    question_type:
      normalizeQuestionType(
        el(
          "questionAuthoringType"
        ).value
      ),

    difficulty:
      normalizeDifficulty(
        el(
          "questionAuthoringDifficulty"
        ).value
      ),

    topic:
      el(
        "questionAuthoringTopic"
      ).value.trim() ||
      null,

    scenario:
      el(
        "questionAuthoringScenario"
      ).value.trim() ||
      null,

    stem,

    question_text:
      stem,

    time_limit_seconds:
      Math.max(
        0,
        numberValue(
          el(
            "questionAuthoringTimeLimit"
          ).value,
          0
        )
      ),

    status,

    explanation:
      el(
        "questionAuthoringExplanation"
      ).value.trim() ||
      null,

    expert_tip:
      el(
        "questionAuthoringExpertTip"
      ).value.trim() ||
      null,

    flashcard_type:
      flashcardType,

    flashcard_title:
      flashcardType ===
        "none"
        ? null
        : el(
            "questionAuthoringFlashcardTitle"
          ).value.trim() ||
          null,

    flashcard_content:
      flashcardType ===
        "none"
        ? null
        : el(
            "questionAuthoringFlashcardContent"
          ).value.trim() ||
          null,

    image_url:
      el(
        "questionAuthoringImageUrl"
      ).value.trim() ||
      null,

    reference_text:
      el(
        "questionAuthoringReference"
      ).value.trim() ||
      null,

    allow_confidence:
      el(
        "questionAuthoringAllowConfidence"
      ).checked,

    allow_flashcard:
      el(
        "questionAuthoringAllowFlashcard"
      ).checked,

    is_active:
      el(
        "questionAuthoringActive"
      ).checked
  };
}


function collectOptions() {
  return [
    "A",
    "B",
    "C",
    "D"
  ].map(
    (
      key,
      index
    ) => {
      const correctInput =
        document.querySelector(
          `input[name="questionAuthoringCorrectOption"][value="${key}"]`
        );


      return {
        option_key:
          key,

        option_text:
          optionInput(
            key
          ).value.trim(),

        display_order:
          index +
          1,

        is_correct:
          Boolean(
            correctInput?.checked
          )
      };
    }
  );
}


/* =========================================================
   SAVE OPTIONS
========================================================= */

async function replaceQuestionOptions(
  questionId,
  options
) {
  const {
    error: deleteError
  } =
    await supabaseClient
      .from(
        "question_options"
      )
      .delete()
      .eq(
        "question_id",
        questionId
      );


  if (deleteError) {
    throw deleteError;
  }


  const rows =
    options
      .filter(
        (option) =>
          option.option_text
      )
      .map(
        (option) => ({
          question_id:
            questionId,

          option_key:
            option.option_key,

          option_text:
            option.option_text,

          display_order:
            option.display_order,

          is_correct:
            option.is_correct,

          feedback:
            null
        })
      );


  if (!rows.length) {
    return;
  }


  const {
    error: insertError
  } =
    await supabaseClient
      .from(
        "question_options"
      )
      .insert(
        rows
      );


  if (insertError) {
    throw insertError;
  }
}


/* =========================================================
   SAVE QUESTION
========================================================= */

async function saveQuestion(
  forcedStatus = null
) {
  if (state.isSaving) {
    return;
  }


  validateForm();


  state.isSaving =
    true;


  setStatus(
    forcedStatus ===
      "published"
      ? "Publishing question…"
      : "Saving question…"
  );


  setButtonBusy(
    saveDraftButton,
    true,
    "Saving…",
    "Save draft"
  );


  setButtonBusy(
    publishButton,
    true,
    "Publishing…",
    "Save and publish"
  );


  try {
    const payload =
      collectQuestionPayload(
        forcedStatus
      );


    const options =
      collectOptions();


    let questionId =
      state.selectedQuestionId;


    if (questionId) {
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
            questionId
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


    await replaceQuestionOptions(
      questionId,
      options
    );


    state.selectedQuestionId =
      questionId;


    moduleFilter.value =
      payload.module_id;


    await loadQuizzes(
      payload.module_id
    );


    quizFilter.value =
      payload.quiz_id;


    await loadQuestions();


    const savedQuestion =
      state.questions.find(
        (question) =>
          String(
            question.id
          ) ===
          String(
            questionId
          )
      );


    if (savedQuestion) {
      populateForm(
        savedQuestion
      );
    }


    setStatus(
      forcedStatus ===
        "published"
        ? "Question published successfully."
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


    throw error;
  } finally {
    state.isSaving =
      false;


    setButtonBusy(
      saveDraftButton,
      false,
      "Saving…",
      "Save draft"
    );


    setButtonBusy(
      publishButton,
      false,
      "Publishing…",
      "Save and publish"
    );


    updateActionButtons();
  }
}


/* =========================================================
   DELETE QUESTION
========================================================= */

async function deleteQuestion() {
  const question =
    selectedQuestion();


  if (!question) {
    return;
  }


  const confirmed =
    window.confirm(
      "Delete this question permanently? This action cannot be undone."
    );


  if (!confirmed) {
    return;
  }


  setButtonBusy(
    deleteButton,
    true,
    "Deleting…",
    "Delete question"
  );


  setStatus(
    "Deleting question…"
  );


  try {
    const {
      error: optionsError
    } =
      await supabaseClient
        .from(
          "question_options"
        )
        .delete()
        .eq(
          "question_id",
          question.id
        );


    if (optionsError) {
      throw optionsError;
    }


    const {
      error: questionError
    } =
      await supabaseClient
        .from(
          "questions"
        )
        .delete()
        .eq(
          "id",
          question.id
        );


    if (questionError) {
      throw questionError;
    }


    state.selectedQuestionId =
      null;


    await loadQuestions();


    resetForm();


    setStatus(
      "Question deleted.",
      "success"
    );
  } catch (error) {
    console.error(
      "QUESTION DELETE ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The question could not be deleted.",
      "error"
    );
  } finally {
    setButtonBusy(
      deleteButton,
      false,
      "Deleting…",
      "Delete question"
    );


    updateActionButtons();
  }
}


/* =========================================================
   DUPLICATE QUESTION
========================================================= */

async function duplicateQuestion() {
  const question =
    selectedQuestion();


  if (!question) {
    return;
  }


  populateForm(
    question
  );


  state.selectedQuestionId =
    null;


  el(
    "questionAuthoringQuestionId"
  ).value =
    "";


  el(
    "questionAuthoringOrderIndex"
  ).value =
    String(
      state.questions.length +
      1
    );


  el(
    "questionAuthoringStatusValue"
  ).value =
    "draft";


  updateFormHeading(
    null
  );


  updateActionButtons();


  renderQuestionList();


  setStatus(
    "Question duplicated in the form. Review it, then save.",
    "warning"
  );
}


/* =========================================================
   ACTION BUTTONS
========================================================= */

function updateActionButtons() {
  const hasSelectedQuestion =
    Boolean(
      state.selectedQuestionId
    );


  if (deleteButton) {
    deleteButton.disabled =
      !hasSelectedQuestion ||
      state.isSaving;
  }


  if (duplicateButton) {
    duplicateButton.disabled =
      !hasSelectedQuestion ||
      state.isSaving;
  }
}


/* =========================================================
   MODULE SELECTION
========================================================= */

async function handleModuleChange(
  moduleId,
  source
) {
  try {
    setStatus(
      "Loading quizzes…"
    );


    await loadQuizzes(
      moduleId
    );


    if (
      source ===
      "filter"
    ) {
      el(
        "questionAuthoringModuleId"
      ).value =
        moduleId;


      quizFilter.value =
        "";


      el(
        "questionAuthoringQuizId"
      ).value =
        "";


      state.questions =
        [];


      state.selectedQuestionId =
        null;


      renderQuestionList();
      resetForm();
      updateListDescription();
    } else {
      moduleFilter.value =
        moduleId;


      quizFilter.value =
        "";


      el(
        "questionAuthoringQuizId"
      ).value =
        "";


      state.questions =
        [];


      state.selectedQuestionId =
        null;


      renderQuestionList();
      updateListDescription();
    }


    setStatus(
      ""
    );
  } catch (error) {
    console.error(
      "QUIZ LOAD ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Quizzes could not be loaded.",
      "error"
    );
  }
}


/* =========================================================
   REFRESH
========================================================= */

async function refreshAuthoring() {
  setButtonBusy(
    refreshButton,
    true,
    "Refreshing…",
    "Refresh"
  );


  setStatus(
    "Refreshing question authoring…"
  );


  const currentModule =
    selectedModuleId();


  const currentQuiz =
    selectedQuizId();


  try {
    await loadModules();


    if (
      currentModule &&
      state.modules.some(
        (module) =>
          String(
            module.id
          ) ===
          String(
            currentModule
          )
      )
    ) {
      moduleFilter.value =
        currentModule;


      el(
        "questionAuthoringModuleId"
      ).value =
        currentModule;


      await loadQuizzes(
        currentModule
      );


      if (
        currentQuiz &&
        state.quizzes.some(
          (quiz) =>
            String(
              quiz.id
            ) ===
            String(
              currentQuiz
            )
        )
      ) {
        quizFilter.value =
          currentQuiz;


        el(
          "questionAuthoringQuizId"
        ).value =
          currentQuiz;


        await loadQuestions();
      } else {
        state.questions =
          [];


        renderQuestionList();
        resetForm();
      }
    } else {
      state.questions =
        [];


      renderQuestionList();
      resetForm();
    }


    updateListDescription();


    setStatus(
      "Question authoring refreshed.",
      "success"
    );
  } catch (error) {
    console.error(
      "AUTHORING REFRESH ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Question authoring could not be refreshed.",
      "error"
    );
  } finally {
    setButtonBusy(
      refreshButton,
      false,
      "Refreshing…",
      "Refresh"
    );
  }
}


/* =========================================================
   QUESTION LIST CLICK
========================================================= */

questionList
  ?.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest(
          "[data-question-id]"
        );


      if (!button) {
        return;
      }


      const questionId =
        button.dataset
          .questionId;


      const question =
        state.questions.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              questionId
            )
        );


      if (!question) {
        return;
      }


      populateForm(
        question
      );


      window.scrollTo({
        top:
          form.getBoundingClientRect().top +
          window.scrollY -
          110,

        behavior:
          "smooth"
      });
    }
  );


/* =========================================================
   FORM EVENTS
========================================================= */

moduleFilter
  ?.addEventListener(
    "change",
    async () => {
      await handleModuleChange(
        moduleFilter.value,
        "filter"
      );
    }
  );


quizFilter
  ?.addEventListener(
    "change",
    async () => {
      el(
        "questionAuthoringQuizId"
      ).value =
        quizFilter.value;


      state.selectedQuestionId =
        null;


      try {
        await loadQuestions();
      } catch (error) {
        console.error(
          "QUESTION LOAD ERROR:",
          error
        );


        setStatus(
          error.message ||
          "Questions could not be loaded.",
          "error"
        );
      }
    }
  );


statusFilter
  ?.addEventListener(
    "change",
    renderQuestionList
  );


el(
  "questionAuthoringModuleId"
)
  ?.addEventListener(
    "change",
    async (event) => {
      await handleModuleChange(
        event.target.value,
        "form"
      );
    }
  );


el(
  "questionAuthoringQuizId"
)
  ?.addEventListener(
    "change",
    (event) => {
      quizFilter.value =
        event.target.value;
    }
  );


el(
  "questionAuthoringImageUrl"
)
  ?.addEventListener(
    "input",
    renderImagePreview
  );


el(
  "questionAuthoringStatusValue"
)
  ?.addEventListener(
    "change",
    (event) => {
      const currentState =
        el(
          "questionAuthoringCurrentState"
        );


      const status =
        normalizeStatus(
          event.target.value
        );


      if (currentState) {
        currentState.textContent =
          status;


        currentState.className =
          `authoring-question-state ${status}`;
      }
    }
  );


newQuestionButton
  ?.addEventListener(
    "click",
    () => {
      resetForm();


      setStatus(
        "New question form ready.",
        "success"
      );
    }
  );


resetButton
  ?.addEventListener(
    "click",
    () => {
      const question =
        selectedQuestion();


      if (question) {
        populateForm(
          question
        );


        setStatus(
          "Changes reset to the saved question.",
          "success"
        );
      } else {
        resetForm();


        setStatus(
          "Form reset.",
          "success"
        );
      }
    }
  );


saveDraftButton
  ?.addEventListener(
    "click",
    async () => {
      try {
        await saveQuestion(
          "draft"
        );
      } catch {
        // Error already displayed.
      }
    }
  );


form
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      try {
        await saveQuestion(
          "published"
        );
      } catch {
        // Error already displayed.
      }
    }
  );


deleteButton
  ?.addEventListener(
    "click",
    deleteQuestion
  );


duplicateButton
  ?.addEventListener(
    "click",
    duplicateQuestion
  );


refreshButton
  ?.addEventListener(
    "click",
    refreshAuthoring
  );


/* =========================================================
   START
========================================================= */

async function startQuestionAuthoringPage() {
  try {
    renderEdition();


    const profile =
      await protectAuthoringPage();


    if (!profile) {
      return;
    }


    await loadModules();


    resetForm();


    setStatus(
      "Select a module and quiz, or create a new question.",
      "success"
    );
  } catch (error) {
    console.error(
      "QUESTION AUTHORING INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "You are not authorized to access question authoring.",
      "error"
    );
  }
}


void startQuestionAuthoringPage();
