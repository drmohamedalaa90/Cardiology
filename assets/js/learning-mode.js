import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender
} from "./session-ui.js?v=5.3.0";


import {
  getOpenAttempt,
  createAttempt,
  saveAttempt,
  completeAttempt
} from "./cloud-progress.js?v=5.3.0";


import {
  DEFAULT_ACL_SETTINGS,
  getAclSettings,
  normalizeAclSettings
} from "./user-settings.js?v=5.3.0";


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (id) =>
  document.getElementById(id);


const esc = (value = "") =>
  String(value).replace(
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


/* =========================================================
   URL PARAMETERS
========================================================= */

const params =
  new URLSearchParams(
    window.location.search
  );


const quizSlug =
  params.get("quiz");


const requestedModuleId =
  params.get("module");


/* =========================================================
   MASCOT ASSETS
========================================================= */

const HAPPY_MASCOT =
  "assets/images/dr-corazon-happy.webp";


const GOOD_JOB_MASCOT =
  "assets/images/dr-corazon-good-job.webp";


const SAD_MASCOT =
  "assets/images/dr-corazon-sad.webp";


const ANGRY_MASCOT =
  "assets/images/dr-corazon-angry.webp";


[
  HAPPY_MASCOT,
  GOOD_JOB_MASCOT,
  SAD_MASCOT,
  ANGRY_MASCOT
].forEach(
  (source) => {
    const image =
      new Image();

    image.decoding =
      "async";

    image.src =
      source;
  }
);


/* =========================================================
   APPLICATION STATE
========================================================= */

let quiz =
  null;


let questions =
  [];


let index =
  0;


let answers =
  [];


let attempt =
  null;


let saving =
  false;


let finishing =
  false;


let reviewMode =
  false;


let lifelinesState =
  {};


let pendingSelectedIds =
  [];


let aclSettings =
  normalizeAclSettings(
    DEFAULT_ACL_SETTINGS
  );


/* =========================================================
   SCIENTIFIC LIFELINES
========================================================= */

const LIFELINES = {
  expert: "expert",
  filter: "filter",
  guideline: "guideline",
  vault: "vault"
};


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  text,
  error = false
) {
  const element =
    $("saveStatus");

  if (!element) {
    return;
  }

  element.textContent =
    text;

  element.classList.toggle(
    "error",
    error
  );

  element.classList.toggle(
    "success",
    !error
  );
}


/* =========================================================
   GENERAL HELPERS
========================================================= */

function shuffle(items) {
  const result =
    [...items];

  for (
    let currentIndex =
      result.length - 1;

    currentIndex > 0;

    currentIndex -= 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
        (currentIndex + 1)
      );

    [
      result[currentIndex],
      result[randomIndex]
    ] = [
      result[randomIndex],
      result[currentIndex]
    ];
  }

  return result;
}


function currentQuestion() {
  return (
    questions[index] ||
    null
  );
}


function answerFor(question) {
  if (!question) {
    return null;
  }

  return (
    answers.find(
      (answer) =>
        String(
          answer.questionId
        ) ===
        String(
          question.id
        )
    ) ||
    null
  );
}


function setAnswer(answer) {
  const answerIndex =
    answers.findIndex(
      (item) =>
        String(
          item.questionId
        ) ===
        String(
          answer.questionId
        )
    );

  if (
    answerIndex >= 0
  ) {
    answers[
      answerIndex
    ] =
      answer;
  } else {
    answers.push(
      answer
    );
  }
}


function optionsFor(question) {
  if (
    !Array.isArray(
      question?._options
    )
  ) {
    question._options =
      [
        ...(
          question?.options ||
          []
        )
      ].sort(
        (
          first,
          second
        ) => {
          const orderDifference =
            Number(
              first.display_order ??
              999
            ) -
            Number(
              second.display_order ??
              999
            );

          return (
            orderDifference ||
            String(
              first.key ||
              ""
            ).localeCompare(
              String(
                second.key ||
                ""
              )
            )
          );
        }
      );
  }

  return question._options;
}


function randomItems(
  items,
  count
) {
  const pool =
    [...items];

  const selected =
    [];

  while (
    pool.length &&
    selected.length <
      count
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
        pool.length
      );

    selected.push(
      pool.splice(
        randomIndex,
        1
      )[0]
    );
  }

  return selected;
}


/* =========================================================
   CONFIDENCE SCORING
========================================================= */

function confidenceEnabled() {
  return Boolean(
    aclSettings
      .confidenceEnabled
  );
}


function normalizeConfidence(
  confidence
) {
  const value =
    String(
      confidence ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    value === "high"
  ) {
    return "high";
  }

  if (
    value === "low"
  ) {
    return "low";
  }

  return null;
}


function confidencePoints({
  correct,
  confidence
}) {
  /*
   * Confidence scoring:
   *
   * Correct + High = +2
   * Correct + Low  = +1
   * Wrong + Low    =  0
   * Wrong + High   = -1
   */

  if (
    !confidenceEnabled()
  ) {
    return correct
      ? 1
      : 0;
  }

  const normalized =
    normalizeConfidence(
      confidence
    );

  if (
    correct &&
    normalized ===
      "high"
  ) {
    return 2;
  }

  if (
    correct &&
    normalized ===
      "low"
  ) {
    return 1;
  }

  if (
    !correct &&
    normalized ===
      "low"
  ) {
    return 0;
  }

  if (
    !correct &&
    normalized ===
      "high"
  ) {
    return -1;
  }

  return correct
    ? 1
    : 0;
}


function maximumPossibleScore() {
  return (
    questions.length *
    (
      confidenceEnabled()
        ? 2
        : 1
    )
  );
}


/* =========================================================
   APPLICATION STATE AND CLOUD SAVE
========================================================= */

function appState() {
  return {
    questionIds:
      questions.map(
        (question) =>
          question.id
      ),

    currentIndex:
      index,

    answers,

    lifelinesState,

    confidenceEnabled:
      confidenceEnabled(),

    score:
      answers.reduce(
        (
          total,
          answer
        ) =>
          total +
          Number(
            answer.points ||
            0
          ),
        0
      )
  };
}


async function persist(
  done = false
) {
  if (
    !attempt ||
    saving ||
    reviewMode
  ) {
    return;
  }

  saving =
    true;

  setStatus(
    "Saving…"
  );

  try {
    const state =
      appState();

    attempt =
      done
        ? await completeAttempt(
            attempt.id,
            state,
            lifelinesState
          )
        : await saveAttempt(
            attempt.id,
            state,
            lifelinesState
          );

    setStatus(
      done
        ? "Completed and saved"
        : "Saved to cloud"
    );
  } catch (error) {
    console.error(
      "LEARNING SAVE ERROR:",
      error
    );

    setStatus(
      error.message ||
      "Save failed — check connection",
      true
    );
  } finally {
    saving =
      false;
  }
}


/* =========================================================
   LIFELINE SETTINGS
========================================================= */

function lifelinesEnabled() {
  return Boolean(
    aclSettings
      .lifelinesEnabled
  );
}


function enabledLifeline(
  lifeline
) {
  return (
    lifelinesEnabled() &&
    aclSettings
      .enabledLifelines[
        lifeline
      ] !== false
  );
}


/* =========================================================
   LIFELINE STATE
========================================================= */

function defaultQuestionLifelines() {
  return {
    expert: false,
    filter: false,
    guideline: false,
    vault: false,

    eliminatedOptionIds:
      []
  };
}


function lifelinesForQuestion(
  question
) {
  if (!question) {
    return (
      defaultQuestionLifelines()
    );
  }

  const questionId =
    String(
      question.id
    );

  if (
    !lifelinesState[
      questionId
    ]
  ) {
    lifelinesState[
      questionId
    ] =
      defaultQuestionLifelines();
  }

  const state =
    lifelinesState[
      questionId
    ];

  if (
    !Array.isArray(
      state
        .eliminatedOptionIds
    )
  ) {
    state.eliminatedOptionIds =
      [];
  }

  return state;
}


function updateQuestionLifelines(
  question,
  changes = {}
) {
  if (!question) {
    return;
  }

  const questionId =
    String(
      question.id
    );

  lifelinesState[
    questionId
  ] = {
    ...lifelinesForQuestion(
      question
    ),

    ...changes
  };
}


function lifelineIsUsed(
  question,
  lifeline
) {
  return Boolean(
    lifelinesForQuestion(
      question
    )[
      lifeline
    ]
  );
}


function markLifelineUsed(
  question,
  lifeline
) {
  updateQuestionLifelines(
    question,
    {
      [lifeline]:
        true
    }
  );
}


function lifelineUsedCount(
  question
) {
  const state =
    lifelinesForQuestion(
      question
    );

  return [
    LIFELINES.expert,
    LIFELINES.filter,
    LIFELINES.guideline,
    LIFELINES.vault
  ]
    .filter(
      (lifeline) =>
        enabledLifeline(
          lifeline
        )
    )
    .filter(
      (lifeline) =>
        Boolean(
          state[
            lifeline
          ]
        )
    )
    .length;
}


function enabledLifelineCount() {
  return [
    LIFELINES.expert,
    LIFELINES.filter,
    LIFELINES.guideline,
    LIFELINES.vault
  ].filter(
    (lifeline) =>
      enabledLifeline(
        lifeline
      )
  ).length;
}


function eliminatedOptionsFor(
  question
) {
  return (
    lifelinesForQuestion(
      question
    )
      .eliminatedOptionIds ||
    []
  ).map(
    String
  );
}


function setEliminatedOptions(
  question,
  optionIds
) {
  updateQuestionLifelines(
    question,
    {
      eliminatedOptionIds:
        (
          optionIds ||
          []
        ).map(
          String
        )
    }
  );
}


function restoreLifelinesState(
  storedState
) {
  if (
    storedState &&
    typeof storedState ===
      "object" &&
    !Array.isArray(
      storedState
    )
  ) {
    lifelinesState =
      storedState;

    return;
  }

  lifelinesState =
    {};
}


function resetAllLifelines() {
  lifelinesState =
    {};
}


/* =========================================================
   LIFELINE RESPONSE
========================================================= */

function lifelineResponseElement() {
  return $(
    "scientificLifelineResponse"
  );
}


function showLifelineResponse({
  icon = "🩺",
  title =
    "Scientific Lifeline",
  message = ""
} = {}) {
  const response =
    lifelineResponseElement();

  if (!response) {
    return;
  }

  response.innerHTML = `
    <div class="scientific-lifeline-response-head">

      <span
        class="scientific-lifeline-response-icon"
        aria-hidden="true"
      >
        ${esc(icon)}
      </span>

      <h4>
        ${esc(title)}
      </h4>

    </div>

    <p>
      ${esc(message)}
    </p>
  `;

  response.hidden =
    false;

  response.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


/* =========================================================
   LIFELINE CONTENT
========================================================= */

function expertHintFor(
  question
) {
  return (
    question.expert_hint ||
    question.expertHint ||
    question.dr_corazon_hint ||
    question.drCorazonHint ||
    question.hint ||
    "Focus on the central clinical decision. Identify the decisive clinical detail and compare each option with the relevant evidence or guideline principle."
  );
}


function guidelineHintFor(
  question
) {
  return (
    question.guideline_hint ||
    question.guidelineHint ||
    question.guideline_clue ||
    question.guidelineClue ||
    question.reference_text ||
    question.referenceText ||
    "Recall the main guideline recommendation, including its indication, threshold, timing, contraindication or treatment priority."
  );
}


/* =========================================================
   LIFELINE TOOLBAR
========================================================= */

function lifelineDefinitions() {
  const definitions = [
    {
      id:
        LIFELINES.expert,

      icon:
        "",

      image:
        HAPPY_MASCOT,

      title:
        "Ask Dr. Corazón",

      shortTitle:
        "Dr. Corazón"
    },

    {
      id:
        LIFELINES.filter,

      icon:
        "✂️",

      image:
        "",

      title:
        "Evidence Filter",

      shortTitle:
        "Evidence Filter"
    },

    {
      id:
        LIFELINES.guideline,

      icon:
        "📘",

      image:
        "",

      title:
        "ESC Pocket Guideline",

      shortTitle:
        "ESC Guideline"
    },

    {
      id:
        LIFELINES.vault,

      icon:
        "🧠",

      image:
        "",

      title:
        "Knowledge Vault",

      shortTitle:
        "Knowledge Vault"
    }
  ];

  return definitions.filter(
    (definition) =>
      enabledLifeline(
        definition.id
      )
  );
}


function compactLifelineButtonHtml(
  question,
  definition
) {
  const used =
    lifelineIsUsed(
      question,
      definition.id
    );

  return `
    <button
      type="button"
      class="
        compact-lifeline-button
        ${used ? "is-used" : ""}
      "
      data-lifeline="${esc(
        definition.id
      )}"
      aria-label="${esc(
        definition.title
      )}"
      ${used ? "disabled" : ""}
    >

      <span class="compact-lifeline-icon">

        ${
          definition.image
            ? `
              <img
                class="dr-corazon-lifeline-avatar"
                src="${esc(
                  definition.image
                )}"
                alt=""
                aria-hidden="true"
              >
            `
            : `
              <span aria-hidden="true">
                ${esc(
                  definition.icon
                )}
              </span>
            `
        }

      </span>

      <span class="compact-lifeline-name">
        ${esc(
          definition.shortTitle
        )}
      </span>

      ${
        used
          ? `
            <span
              class="compact-lifeline-used-mark"
              aria-label="Used"
            >
              ✓
            </span>
          `
          : ""
      }

    </button>
  `;
}


function scientificLifelinesToolbarHtml(
  question,
  answer
) {
  if (
    !question ||
    answer ||
    reviewMode ||
    !lifelinesEnabled()
  ) {
    return "";
  }

  const definitions =
    lifelineDefinitions();

  if (
    !definitions.length
  ) {
    return "";
  }

  return `
    <div class="question-topic-tools">

      <div
        class="compact-lifelines-toolbar"
        aria-label="Scientific Lifelines — The Expert Panel"
      >

        <span class="compact-lifelines-label">
          Expert Panel
        </span>

        <div class="compact-lifelines-buttons">

          ${definitions
            .map(
              (definition) =>
                compactLifelineButtonHtml(
                  question,
                  definition
                )
            )
            .join("")}

        </div>

        <span class="compact-lifelines-counter">
          ${lifelineUsedCount(
            question
          )}/${enabledLifelineCount()}
        </span>

      </div>

    </div>

    <div
      id="scientificLifelineResponse"
      class="scientific-lifeline-response compact"
      aria-live="polite"
      hidden
    ></div>
  `;
}


/* =========================================================
   EVIDENCE FILTER
========================================================= */

function explicitCorrectOptionIds(
  question
) {
  const direct =
    question.correct_option_ids ||
    question.correctOptionIds ||
    [];

  if (
    Array.isArray(
      direct
    ) &&
    direct.length
  ) {
    return direct.map(
      String
    );
  }

  return optionsFor(
    question
  )
    .filter(
      (option) =>
        option.is_correct ===
          true ||
        option.correct ===
          true
    )
    .map(
      (option) =>
        String(
          option.id
        )
    );
}


async function secureCorrectOptionIds(
  question
) {
  const explicit =
    explicitCorrectOptionIds(
      question
    );

  if (
    explicit.length
  ) {
    return explicit;
  }

  /*
   * Use the existing secure answer-check RPC with all options
   * to retrieve the correct option IDs without storing an answer.
   */

  const allOptionIds =
    optionsFor(
      question
    ).map(
      (option) =>
        String(
          option.id
        )
    );

  const {
    data,
    error
  } =
    await supabaseClient.rpc(
      "acl_check_learning_answer",
      {
        p_quiz_id:
          quiz.id,

        p_question_id:
          question.id,

        p_option_ids:
          allOptionIds
      }
    );

  if (error) {
    throw error;
  }

  const correctIds =
    data?.correct_option_ids ||
    data?.correctOptionIds ||
    [];

  if (
    !Array.isArray(
      correctIds
    ) ||
    !correctIds.length
  ) {
    throw new Error(
      "The Evidence Filter could not identify the incorrect options."
    );
  }

  return correctIds.map(
    String
  );
}


async function activateEvidenceFilter(
  question
) {
  const correctIds =
    await secureCorrectOptionIds(
      question
    );

  const correctSet =
    new Set(
      correctIds
    );

  const incorrectOptions =
    optionsFor(
      question
    ).filter(
      (option) =>
        !correctSet.has(
          String(
            option.id
          )
        )
    );

  const removableCount =
    Math.min(
      2,
      Math.max(
        incorrectOptions.length -
        1,
        1
      )
    );

  const removed =
    randomItems(
      incorrectOptions,
      removableCount
    ).map(
      (option) =>
        String(
          option.id
        )
    );

  setEliminatedOptions(
    question,
    removed
  );

  pendingSelectedIds =
    pendingSelectedIds.filter(
      (optionId) =>
        !removed.includes(
          String(
            optionId
          )
        )
    );
}


/* =========================================================
   LIFELINE ACTIVATION
========================================================= */

async function activateLifeline(
  question,
  lifeline
) {
  if (
    !question ||
    !enabledLifeline(
      lifeline
    ) ||
    lifelineIsUsed(
      question,
      lifeline
    )
  ) {
    return;
  }

  const button =
    document.querySelector(
      `[data-lifeline="${lifeline}"]`
    );

  if (button) {
    button.disabled =
      true;

    button.classList.add(
      "is-loading"
    );
  }

  try {
    if (
      lifeline ===
      LIFELINES.filter
    ) {
      await activateEvidenceFilter(
        question
      );
    }

    markLifelineUsed(
      question,
      lifeline
    );

    render();

    if (
      lifeline ===
      LIFELINES.expert
    ) {
      showLifelineResponse({
        icon:
          "🩺",

        title:
          "Dr. Corazón says",

        message:
          expertHintFor(
            question
          )
      });
    }


    if (
      lifeline ===
      LIFELINES.guideline
    ) {
      showLifelineResponse({
        icon:
          "📘",

        title:
          "ESC Pocket Guideline",

        message:
          guidelineHintFor(
            question
          )
      });
    }


    if (
      lifeline ===
      LIFELINES.filter
    ) {
      showLifelineResponse({
        icon:
          "✂️",

        title:
          "Evidence Filter",

        message:
          "Two incorrect options have been removed. Reassess the remaining choices carefully."
      });
    }


    if (
      lifeline ===
      LIFELINES.vault
    ) {
      const flashcard =
        await loadFlashcard(
          question,
          null
        );

      if (flashcard) {
        openFlashcard(
          flashcard
        );
      } else {
        showLifelineResponse({
          icon:
            "🧠",

          title:
            "Knowledge Vault",

          message:
            "A review flashcard has not yet been added for this question."
        });
      }
    }

    await persist(
      false
    );
  } catch (error) {
    console.error(
      "LIFELINE ERROR:",
      error
    );

    showLifelineResponse({
      icon:
        "⚠️",

      title:
        "Lifeline unavailable",

      message:
        error.message ||
        "This lifeline could not be used."
    });

    render();
  }
}


function bindCompactLifelines(
  question
) {
  document
    .querySelectorAll(
      ".compact-lifeline-button"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          async () => {
            const lifeline =
              button.dataset
                .lifeline;

            if (!lifeline) {
              return;
            }

            await activateLifeline(
              question,
              lifeline
            );
          }
        );
      }
    );
}


/* =========================================================
   ELIMINATED OPTIONS
========================================================= */

function applyEliminatedOptionStyles(
  question
) {
  if (!question) {
    return;
  }

  const eliminatedIds =
    new Set(
      eliminatedOptionsFor(
        question
      )
    );

  document
    .querySelectorAll(
      '.learning-option input[name="answer"]'
    )
    .forEach(
      (input) => {
        const label =
          input.closest(
            ".learning-option"
          );

        if (!label) {
          return;
        }

        const eliminated =
          eliminatedIds.has(
            String(
              input.value
            )
          );

        label.classList.toggle(
          "is-eliminated",
          eliminated
        );

        if (eliminated) {
          input.checked =
            false;

          input.disabled =
            true;
        }
      }
    );
}


/* =========================================================
   FLASHCARDS
========================================================= */

function normaliseFlashcard(
  ...sources
) {
  for (
    const source
    of sources
  ) {
    if (
      !source ||
      typeof source !==
        "object"
    ) {
      continue;
    }

    const nested =
      source.flashcard &&
      typeof source.flashcard ===
        "object"
        ? source.flashcard
        : null;

    const title =
      nested?.title ||
      source.flashcard_title ||
      source.flashcardTitle;

    const rawType =
      nested?.type ||
      source.flashcard_type ||
      source.flashcardType ||
      "FLASHCARD";

    let content =
      nested?.content ||
      source.flashcard_content ||
      source.flashcardContent;

    /*
     * Also support the structured sections format.
     */

    if (
      !content &&
      Array.isArray(
        nested?.sections
      )
    ) {
      content =
        Object.fromEntries(
          nested.sections.map(
            (section) => [
              section.heading ||
              "Review",

              section.bullets ||
              section.lines ||
              []
            ]
          )
        );
    }

    if (
      title &&
      content
    ) {
      return {
        title,

        content,

        type:
          String(
            rawType
          ).toUpperCase() ===
          "TRIAL FLASHCARD"
            ? "TRIAL FLASHCARD"
            : "FLASHCARD"
      };
    }
  }

  return null;
}


async function loadFlashcard(
  question,
  rpcData
) {
  const embedded =
    normaliseFlashcard(
      rpcData,
      question
    );

  if (embedded) {
    return embedded;
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "questions"
        )
        .select(`
          flashcard_title,
          flashcard_type,
          flashcard_content
        `)
        .eq(
          "id",
          question.id
        )
        .maybeSingle();

    if (error) {
      console.info(
        "Flashcard fallback query unavailable:",
        error.message
      );

      return null;
    }

    return normaliseFlashcard(
      data
    );
  } catch (error) {
    console.info(
      "Flashcard could not be loaded:",
      error
    );

    return null;
  }
}


function flashcardSections(
  content
) {
  if (!content) {
    return [];
  }

  if (
    Array.isArray(
      content
    )
  ) {
    return [
      {
        heading:
          "High-yield review",

        lines:
          content
      }
    ];
  }

  if (
    typeof content ===
    "string"
  ) {
    return [
      {
        heading:
          "High-yield review",

        lines:
          [content]
      }
    ];
  }

  if (
    typeof content ===
    "object"
  ) {
    return Object.entries(
      content
    ).map(
      (
        [
          heading,
          value
        ]
      ) => ({
        heading,

        lines:
          Array.isArray(
            value
          )
            ? value
            : [
                String(
                  value ||
                  ""
                )
              ]
      })
    );
  }

  return [];
}


function openFlashcard(
  flashcard
) {
  if (!flashcard) {
    window.alert(
      "A flashcard has not yet been added for this question."
    );

    return;
  }

  const modal =
    $("learningFlashcardModal");

  const type =
    $("learningFlashcardType");

  const title =
    $("learningFlashcardTitle");

  const content =
    $("learningFlashcardContent");

  if (
    !modal ||
    !type ||
    !title ||
    !content
  ) {
    return;
  }

  type.textContent =
    flashcard.type ||
    "FLASHCARD";

  type.classList.toggle(
    "trial",
    flashcard.type ===
      "TRIAL FLASHCARD"
  );

  title.textContent =
    flashcard.title ||
    "Topic review";

  const sections =
    flashcardSections(
      flashcard.content
    );

  content.innerHTML =
    sections.length
      ? sections
          .map(
            (section) => `
              <section class="learning-flashcard-section">

                <h3>
                  ${esc(
                    section.heading
                  )}
                </h3>

                <ul>

                  ${section.lines
                    .filter(
                      Boolean
                    )
                    .map(
                      (line) => `
                        <li>
                          ${esc(
                            line
                          )}
                        </li>
                      `
                    )
                    .join("")}

                </ul>

              </section>
            `
          )
          .join("")
      : `
        <section class="learning-flashcard-section">

          <p>
            No flashcard content has been added yet.
          </p>

        </section>
      `;

  modal.hidden =
    false;

  document.body.classList.add(
    "learning-modal-open"
  );
}


function closeFlashcard() {
  const modal =
    $("learningFlashcardModal");

  if (modal) {
    modal.hidden =
      true;
  }

  document.body.classList.remove(
    "learning-modal-open"
  );
}


/* =========================================================
   CONFIDENCE INTERFACE
========================================================= */

function confidencePanelHtml(
  question,
  answer
) {
  if (
    answer ||
    reviewMode ||
    !confidenceEnabled() ||
    !pendingSelectedIds.length
  ) {
    return "";
  }

  const selectedLabels =
    optionsFor(
      question
    )
      .filter(
        (option) =>
          pendingSelectedIds.includes(
            String(
              option.id
            )
          )
      )
      .map(
        (option) =>
          `${option.key}. ${option.text}`
      );

  return `
<section class="learning-confidence-panel contextual-confidence-card">

    <div class="learning-confidence-heading">

      <span
        class="learning-confidence-icon"
        aria-hidden="true"
      >
        🎯
      </span>

     <div>

  <h3>
    How confident are you?
  </h3>

</div>
    </div>


    <div class="learning-confidence-options">

      <button
        type="button"
        class="
          learning-confidence-button
          is-high
        "
        data-confidence="high"
      >

        <span
          class="learning-confidence-symbol"
          aria-hidden="true"
        >
          🔥
        </span>

        <span class="confidence-choice-copy">

          <strong>
            High confidence
          </strong>

          <small>
            I am confident in this answer
          </small>

        </span>

        <span
          class="learning-confidence-points"
        >
          Up to +2
        </span>

      </button>


      <button
        type="button"
        class="
          learning-confidence-button
          is-low
        "
        data-confidence="low"
      >

        <span
          class="learning-confidence-symbol"
          aria-hidden="true"
        >
          🤔
        </span>

        <span class="confidence-choice-copy">

          <strong>
            Low confidence
          </strong>

          <small>
            I am not completely certain
          </small>

        </span>

        <span
          class="learning-confidence-points"
        >
          Safer choice
        </span>

      </button>

    </div>


    <div class="learning-selected-answer">

      <span class="learning-selected-answer-label">
        Selected answer
      </span>

      <strong>
        ${esc(
          selectedLabels.join(
            " · "
          )
        )}
      </strong>

    </div>

  </section>
`;
  }
function bindAnswerInputs(
  question
) {
  document
    .querySelectorAll(
      'input[name="answer"]'
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          () => {
            const multipleResponse =
              question.question_type ===
              "multiple_response";

            if (
              multipleResponse
            ) {
              pendingSelectedIds =
                [
                  ...document.querySelectorAll(
                    'input[name="answer"]:checked'
                  )
                ].map(
                  (selectedInput) =>
                    String(
                      selectedInput.value
                    )
                );
            } else {
              pendingSelectedIds =
                input.checked
                  ? [
                      String(
                        input.value
                      )
                    ]
                  : [];
            }

            render();
          }
        );
      }
    );
}

function bindConfidenceButtons() {
  document
    .querySelectorAll(
      "[data-confidence]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          async () => {
            const confidence =
              button.dataset.confidence;

            const allButtons =
              document.querySelectorAll(
                "[data-confidence]"
              );

            allButtons.forEach(
              (item) => {
                item.classList.remove(
                  "is-selected"
                );

                item.disabled = true;
              }
            );

            button.classList.add(
              "is-selected"
            );

            button.innerHTML = `
              <span
                class="confidence-choice-check"
                aria-hidden="true"
              >
                ✓
              </span>

              <span class="confidence-choice-copy">

                <strong>
                  ${
                    confidence === "high"
                      ? "High confidence"
                      : "Low confidence"
                  }
                </strong>

                <small>
                  ${
                    confidence === "high"
                      ? "I am confident in this answer"
                      : "I am not completely certain"
                  }
                </small>

              </span>
            `;

            await new Promise(
              (resolve) =>
                window.setTimeout(
                  resolve,
                  220
                )
            );

            await submit(
              confidence
            );
          }
        );
      }
    );
}


/* =========================================================
   FEEDBACK
========================================================= */

function feedbackHtml(
  answer
) {
  const correct =
    Boolean(
      answer.correct
    );

  const points =
    Number(
      answer.points ||
      0
    );

  const pointText =
    `${
      points >= 0
        ? "+"
        : ""
    }${points} point${
      Math.abs(
        points
      ) === 1
        ? ""
        : "s"
    }`;

  const mascot =
    correct
      ? GOOD_JOB_MASCOT
      : SAD_MASCOT;

  const explanation =
    quiz.show_explanations &&
    answer.explanation
      ? `
        <div class="learning-explanation-card">

          <h3>
            Explanation
          </h3>

          <p>
            ${esc(
              answer.explanation
            )}
          </p>

          ${
            answer.referenceText
              ? `
                <p class="learning-reference">

                  <strong>
                    Reference:
                  </strong>

                  ${esc(
                    answer.referenceText
                  )}

                  ${
                    answer.referenceUrl
                      ? `
                        ·

                        <a
                          href="${esc(
                            answer.referenceUrl
                          )}"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open source
                        </a>
                      `
                      : ""
                  }

                </p>
              `
              : ""
          }

        </div>
      `
      : "";

  return `
    <section
      class="
        learning-answer-feedback
        ${
          correct
            ? "is-correct"
            : "is-incorrect"
        }
      "
    >

      <div class="dr-corazon-stage">

        <img
          class="dr-corazon-image"
          src="${esc(
            mascot
          )}"
          alt="${
            correct
              ? "Dr. Corazón celebrating a correct answer"
              : "Dr. Corazón encouraging review"
          }"
        >

        <div
          class="dr-corazon-fallback"
          hidden
          aria-hidden="true"
        >
          ${
            correct
              ? "😄🫀"
              : "🥺🫀"
          }
        </div>

      </div>


      <div class="learning-feedback-copy">

        <span class="learning-feedback-kicker">
          ${
            correct
              ? "Correct answer"
              : "Learning opportunity"
          }
        </span>

        <h3 class="learning-feedback-title">
          ${
            correct
              ? "Excellent — correct!"
              : "Not quite — review this point"
          }
        </h3>

        <p class="learning-feedback-message">
          ${
            correct
              ? "Dr. Corazón is delighted. Reinforce the concept before moving forward."
              : "Dr. Corazón wants you to review the explanation and strengthen this concept."
          }
        </p>

       <span class="learning-feedback-score">
  ${esc(pointText)}
</span>

        ${explanation}

        ${
          answer.flashcard
            ? `
              <div class="learning-feedback-actions">

                <button
                  id="reviewCurrentFlashcard"
                  type="button"
                  class="review-flashcard-btn"
                >
                  Review the flashcard
                </button>

              </div>
            `
            : ""
        }

      </div>

    </section>
  `;
}


function bindFeedback(
  answer
) {
  const image =
    document.querySelector(
      ".dr-corazon-image"
    );

  const fallback =
    document.querySelector(
      ".dr-corazon-fallback"
    );

  image?.addEventListener(
    "error",
    () => {
      image.hidden =
        true;

      if (fallback) {
        fallback.hidden =
          false;
      }
    },
    {
      once: true
    }
  );

  $("reviewCurrentFlashcard")
    ?.addEventListener(
      "click",
      () => {
        openFlashcard(
          answer.flashcard
        );
      }
    );
}


/* =========================================================
   QUESTION RENDERING
========================================================= */

function render() {
  document.body.classList.add(
    "acl-expert-learning-mode"
  );

  const question =
    currentQuestion();

  if (!question) {
    void finish();

    return;
  }

  const answer =
    answerFor(
      question
    );

  const multipleResponse =
    question.question_type ===
    "multiple_response";

  if (answer) {
    pendingSelectedIds =
      [];
  }

  const progress =
    questions.length
      ? Math.round(
          (
            (
              index + 1
            ) /
            questions.length
          ) *
          100
        )
      : 0;

  const progressFill =
    $("progressFill");

  const questionCount =
    $("questionCount");

  const quizArea =
    $("quizArea");

  if (progressFill) {
    progressFill.style.width =
      `${progress}%`;
  }

  if (questionCount) {
    questionCount.textContent =
      `Question ${index + 1} of ${questions.length}`;
  }

  if (!quizArea) {
    return;
  }

  const eliminatedIds =
    new Set(
      eliminatedOptionsFor(
        question
      )
    );

  quizArea.innerHTML = `
  <article
  class="
    expert-question-layout
    ${
      answer
        ? (
            answer.correct
              ? "question-result-correct"
              : "question-result-incorrect"
          )
        : ""
    }
  "
>

      <div class="question-topic-row">

        <span class="learning-topic">
          ${esc(
            question.topic ||
            "Clinical question"
          )}
        </span>

        ${scientificLifelinesToolbarHtml(
          question,
          answer
        )}

      </div>


      ${
        question.clinical_scenario
          ? `
            <div class="clinical-scenario">
              ${esc(
                question.clinical_scenario
              )}
            </div>
          `
          : ""
      }


      <h2>
        ${esc(
          question.stem
        )}
      </h2>


      ${
        question.image_url
          ? `
            <img
              class="question-image"
              src="${esc(
                question.image_url
              )}"
              alt="${esc(
                question.image_alt ||
                "Question image"
              )}"
            >
          `
          : ""
      }


      <div class="learning-options">

        ${optionsFor(
          question
        )
          .map(
            (option) => {
              const optionId =
                String(
                  option.id
                );

              const selectedIds =
                answer
                  ? (
                      answer.selectedIds ||
                      []
                    ).map(
                      String
                    )
                  : pendingSelectedIds;

              const correctIds =
                (
                  answer?.correctOptionIds ||
                  []
                ).map(
                  String
                );

              const selected =
                selectedIds.includes(
                  optionId
                );

              const correct =
                correctIds.includes(
                  optionId
                );

              const incorrect =
                Boolean(
                  answer &&
                  !answer.correct &&
                  selected
                );

              const eliminated =
  !answer &&
  eliminatedIds.has(
    optionId
  );

const showConfidenceHere =
  !answer &&
  !reviewMode &&
  confidenceEnabled() &&
  pendingSelectedIds.length > 0 &&
  optionId ===
    pendingSelectedIds[
      pendingSelectedIds.length - 1
    ];

return `
  <div
    class="
      learning-option-context-row
      ${
        showConfidenceHere
          ? "has-confidence-card"
          : ""
      }
    "
  >

    <label
                  class="
                    learning-option
                    ${
                      selected
                        ? "selected"
                        : ""
                    }
                    ${
                      correct
                        ? "correct is-correct"
                        : ""
                    }
                    ${
                      incorrect
                        ? "incorrect is-incorrect"
                        : ""
                    }
                    ${
                      eliminated
                        ? "is-eliminated"
                        : ""
                    }
                  "
                >

                  <input
                    type="${
                      multipleResponse
                        ? "checkbox"
                        : "radio"
                    }"
                    name="answer"
                    value="${esc(
                      optionId
                    )}"
                    ${
                      selected
                        ? "checked"
                        : ""
                    }
                    ${
                      answer ||
                      eliminated
                        ? "disabled"
                        : ""
                    }
                  >

                  <span class="option-key">
                    ${esc(
                      option.key
                    )}
                  </span>

                  <span>
                    ${esc(
                      option.text
                    )}
                  </span>

                   </label>

    ${
      showConfidenceHere
        ? confidencePanelHtml(
            question,
            answer
          )
        : ""
    }

  </div>
`;
            }
          )
          .join("")}

      </div>


      ${
        multipleResponse &&
        !answer
          ? `
            <p class="muted">
              Select all answers that apply.
            </p>
          `
          : ""
      }

    </article>
  `;

  const feedbackHost =
    $("answerFeedbackHost");

  if (feedbackHost) {
    feedbackHost.innerHTML =
      answer
        ? feedbackHtml(
            answer
          )
        : "";
  }

  const submitButton =
    $("submitAnswer");

  const nextButton =
    $("nextQuestion");

  if (submitButton) {
    submitButton.hidden =
      Boolean(
        answer
      ) ||
      (
        confidenceEnabled() &&
        !reviewMode
      );

    submitButton.disabled =
      false;
  }

  if (nextButton) {
    nextButton.hidden =
      !answer;
  }

  if (answer) {
    bindFeedback(
      answer
    );
  } else {
    applyEliminatedOptionStyles(
      question
    );

    bindCompactLifelines(
      question
    );

    bindAnswerInputs(
      question
    );

    bindConfidenceButtons();
  }
}


/* =========================================================
   ANSWER SUBMISSION
========================================================= */

async function submit(
  confidence = null
) {
  const question =
    currentQuestion();

  if (!question) {
    return;
  }

  let selectedIds =
    pendingSelectedIds.length
      ? [
          ...pendingSelectedIds
        ]
      : [
          ...document.querySelectorAll(
            'input[name="answer"]:checked'
          )
        ].map(
          (input) =>
            String(
              input.value
            )
        );

  selectedIds =
    selectedIds.filter(
      (optionId) =>
        !eliminatedOptionsFor(
          question
        ).includes(
          String(
            optionId
          )
        )
    );

  if (
    !selectedIds.length
  ) {
    const feedbackHost =
      $("answerFeedbackHost");

    if (feedbackHost) {
      feedbackHost.innerHTML = `
        <div class="answer-feedback warning">
          Choose an answer first.
        </div>
      `;
    }

    return;
  }

  const normalizedConfidence =
    normalizeConfidence(
      confidence
    );

  if (
    confidenceEnabled() &&
    !normalizedConfidence
  ) {
    const feedbackHost =
      $("answerFeedbackHost");

    if (feedbackHost) {
      feedbackHost.innerHTML = `
        <div class="answer-feedback warning">
          Select High confidence or Low confidence.
        </div>
      `;
    }

    return;
  }

  const submitButton =
    $("submitAnswer");

   if (submitButton) {
    submitButton.disabled =
      true;
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient.rpc(
        "acl_check_learning_answer",
        {
          p_quiz_id:
            quiz.id,

          p_question_id:
            question.id,

          p_option_ids:
            selectedIds
        }
      );

    if (error) {
      throw error;
    }

    const correct =
      Boolean(
        data.correct ??
        data.is_correct
      );
    const points =
      confidencePoints({
        correct,

        confidence:
          normalizedConfidence
      });

    const flashcard =
      await loadFlashcard(
        question,
        data
      );

    const answer = {
      questionId:
        question.id,

      selectedIds,

      correct,

      points,

      confidence:
        confidenceEnabled()
          ? normalizedConfidence
          : null,

      confidenceEnabled:
        confidenceEnabled(),

      correctOptionIds:
        data.correct_option_ids ||
        data.correctOptionIds ||
        [],

      explanation:
        data.explanation ||
        question.explanation ||
        "",

      referenceText:
        data.reference_text ||
        data.referenceText ||
        "",

      referenceUrl:
        data.reference_url ||
        data.referenceUrl ||
        "",

      flashcard,

      answeredAt:
        new Date()
          .toISOString()
    };

    setAnswer(
      answer
    );

    pendingSelectedIds =
      [];

    await persist(
      false
    );

    render();
  } catch (error) {
    console.error(
      "ANSWER CHECK ERROR:",
      error
    );

    const feedbackHost =
      $("answerFeedbackHost");

    if (feedbackHost) {
      feedbackHost.innerHTML = `
        <div class="answer-feedback incorrect">
          ${esc(
            error.message ||
            "Answer could not be checked."
          )}
        </div>
      `;
    }
  } finally {
    if (submitButton) {
      submitButton.disabled =
        false;
    }
  }
}


/* =========================================================
   COMPLETION
========================================================= */
function learningAnalytics() {
  const totalQuestions =
    answers.length;

  const correctAnswers =
    answers.filter(
      (answer) =>
        answer.correct
    ).length;

  const incorrectAnswers =
    totalQuestions -
    correctAnswers;

  const highConfidenceCorrect =
    answers.filter(
      (answer) =>
        answer.correct &&
        answer.confidence ===
          "high"
    ).length;

  const highConfidenceIncorrect =
    answers.filter(
      (answer) =>
        !answer.correct &&
        answer.confidence ===
          "high"
    ).length;

  const lowConfidenceCorrect =
    answers.filter(
      (answer) =>
        answer.correct &&
        answer.confidence ===
          "low"
    ).length;

  const lowConfidenceIncorrect =
    answers.filter(
      (answer) =>
        !answer.correct &&
        answer.confidence ===
          "low"
    ).length;

  const lifelinesUsed =
    Object.values(
      lifelinesState
    ).reduce(
      (
        total,
        state
      ) => {
        if (
          !state ||
          typeof state !==
            "object"
        ) {
          return total;
        }

        return (
          total +
          [
            "expert",
            "filter",
            "guideline",
            "vault"
          ].filter(
            (lifeline) =>
              Boolean(
                state[
                  lifeline
                ]
              )
          ).length
        );
      },
      0
    );

  return {
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    highConfidenceCorrect,
    highConfidenceIncorrect,
    lowConfidenceCorrect,
    lowConfidenceIncorrect,
    lifelinesUsed
  };
}
function resultInsight(
  analytics,
  percentage
) {
  if (
    percentage === 100
  ) {
    return {
      icon:
        "🏆",

      title:
        "Complete mastery",

      message:
        "You answered every question correctly. Your knowledge and confidence were perfectly aligned."
    };
  }

  if (
    analytics
      .highConfidenceIncorrect >
    0
  ) {
    return {
      icon:
        "⚠️",

      title:
        "Review overconfident errors",

      message:
        `You made ${
          analytics
            .highConfidenceIncorrect
        } high-confidence ${
          analytics
            .highConfidenceIncorrect ===
          1
            ? "error"
            : "errors"
        }. Review these concepts carefully before relying on them clinically.`
    };
  }

  if (
    analytics
      .lowConfidenceCorrect >
    analytics
      .highConfidenceCorrect
  ) {
    return {
      icon:
        "🎯",

      title:
        "Trust your clinical reasoning",

      message:
        "You answered several questions correctly despite low confidence. Your knowledge may be stronger than you think."
    };
  }

  if (
    analytics.correctAnswers ===
    0
  ) {
    return {
      icon:
        "📚",

      title:
        "Start with focused review",

      message:
        "Review the explanations and flashcards, then repeat the module while concentrating on the decisive clinical clues."
    };
  }

  if (
    percentage < 60
  ) {
    return {
      icon:
        "🧠",

      title:
        "Reinforce the foundations",

      message:
        "You have identified important learning gaps. Review each incorrect answer before starting another attempt."
    };
  }

  if (
    percentage < 75
  ) {
    return {
      icon:
        "📈",

      title:
        "Developing mastery",

      message:
        "You are progressing well. Focus your review on incorrect answers and questions answered with uncertainty."
    };
  }

  if (
    analytics.lifelinesUsed >
    0
  ) {
    return {
      icon:
        "🩺",

      title:
        "Strategic learning",

      message:
        "You used the Expert Panel during this attempt. Revisit those concepts so you can answer independently next time."
    };
  }

  return {
    icon:
      "⭐",

    title:
      "Strong clinical understanding",

    message:
      "Your performance was strong. Review the few remaining weak points to consolidate mastery."
  };
}
async function finish() {
  if (
    finishing
  ) {
    return;
  }

  finishing =
    true;

  if (!reviewMode) {
    await persist(
      true
    );
  }

  const score =
    appState().score;

  const maximum =
    maximumPossibleScore();

  const percentage =
    maximum
      ? Math.round(
          (
            score /
            maximum
          ) *
          100
        )
      : 0;

  const passingPercentage =
    Number(
      quiz.passing_percentage ||
      0
    );

  const passed =
    percentage >=
    passingPercentage;
const analytics =
  learningAnalytics();
const insight =
  resultInsight(
    analytics,
    percentage
  );
let performanceLabel =
  "Review recommended";

let performanceMessage =
  "Revisit the explanations and flashcards before your next attempt.";

let resultMascot =
  SAD_MASCOT;

let resultMascotAlt =
  "Dr. Corazón encouraging further review";

if (
  percentage >= 90
) {
  performanceLabel =
    "Expert performance";

  performanceMessage =
    "Excellent mastery. Your knowledge and confidence were highly aligned.";

  resultMascot =
    GOOD_JOB_MASCOT;

  resultMascotAlt =
    "Dr. Corazón celebrating expert performance";
} else if (
  percentage >= 75
) {
  performanceLabel =
    "Strong performance";

  performanceMessage =
    "A strong result with only a few areas needing reinforcement.";

  resultMascot =
    HAPPY_MASCOT;

  resultMascotAlt =
    "Dr. Corazón congratulating a strong performance";
} else if (
  percentage >= 60
) {
  performanceLabel =
    "Developing mastery";

  performanceMessage =
    "Good progress. Review your incorrect and uncertain answers.";

  resultMascot =
    HAPPY_MASCOT;

  resultMascotAlt =
    "Dr. Corazón encouraging continued learning";
}
  const progressFill =
    $("progressFill");

  const feedbackHost =
    $("answerFeedbackHost");

  const quizArea =
    $("quizArea");

  if (progressFill) {
    progressFill.style.width =
      "100%";
  }

  if (feedbackHost) {
    feedbackHost.innerHTML =
      "";
  }

  if (!quizArea) {
    finishing =
      false;

    return;
  }

quizArea.innerHTML = `
  <div class="learning-result premium">

    <div class="learning-result-hero">

  <div class="learning-result-summary">

    <span class="learning-result-kicker">
      ${
        passed
          ? "Module completed"
          : "Attempt completed"
      }
    </span>

    <h2>
      ${esc(
        performanceLabel
      )}
    </h2>

    <p class="learning-result-message">
      ${esc(
        performanceMessage
      )}
    </p>

    <div class="result-score">
      ${score} / ${maximum} points
      ·
      ${percentage}%
    </div>

  </div>


  <div class="learning-result-character">

    <div class="learning-result-mascot-stage">

      <div class="learning-result-mascot-glow"></div>

      <img
        class="learning-result-mascot"
        src="${esc(
          resultMascot
        )}"
        alt="${esc(
          resultMascotAlt
        )}"
      >

    </div>

    <div class="learning-result-speech">

      <strong>
        Dr. Corazón
      </strong>

      <p>
        ${
          percentage >= 90
            ? "Outstanding work! Your confidence matched your knowledge."
            : percentage >= 75
              ? "Very good performance. Polish the remaining weak points."
              : percentage >= 60
                ? "You are progressing. Review the uncertain concepts carefully."
                : "Do not worry. Review the explanations and flashcards, then try again."
        }
      </p>

    </div>

  </div>

</div>

    <div class="learning-result-grid">

      <div class="learning-result-stat">
        <span>Correct</span>
        <strong>
          ${analytics.correctAnswers}
        </strong>
      </div>

      <div class="learning-result-stat">
        <span>Incorrect</span>
        <strong>
          ${analytics.incorrectAnswers}
        </strong>
      </div>

      <div class="learning-result-stat">
        <span>High-confidence correct</span>
        <strong>
          ${analytics.highConfidenceCorrect}
        </strong>
      </div>

      <div class="learning-result-stat">
        <span>High-confidence errors</span>
        <strong>
          ${analytics.highConfidenceIncorrect}
        </strong>
      </div>

      <div class="learning-result-stat">
        <span>Low-confidence correct</span>
        <strong>
          ${analytics.lowConfidenceCorrect}
        </strong>
      </div>
<div class="learning-result-stat">
  <span>Low-confidence incorrect</span>
  <strong>
    ${analytics.lowConfidenceIncorrect}
  </strong>
</div>
      <div class="learning-result-stat">
        <span>Lifelines used</span>
        <strong>
          ${analytics.lifelinesUsed}
        </strong>
      </div>

    </div>
<div class="learning-result-insight">

  <span
    class="learning-result-insight-icon"
    aria-hidden="true"
  >
    ${esc(
      insight.icon
    )}
  </span>

  <div>

    <strong>
      ${esc(
        insight.title
      )}
    </strong>

    <p>
      ${esc(
        insight.message
      )}
    </p>

  </div>

</div>

    <p class="learning-result-passmark">
      ${
        passed
          ? `You reached the ${passingPercentage}% pass mark.`
          : `The pass mark is ${passingPercentage}%.`
      }
    </p>

    <div class="result-actions">

      ${
        quiz.allow_review
          ? `
            <button
              id="reviewAttempt"
              class="secondary-btn"
              type="button"
            >
              Review answers
            </button>
          `
          : ""
      }

      <button
        id="retryAttempt"
        class="primary-btn"
        type="button"
      >
        Start a new attempt
      </button>

      <a
        class="secondary-btn"
        href="modules.html"
      >
        Back to modules
      </a>

    </div>

  </div>
`;

  const submitButton =
    $("submitAnswer");

  const nextButton =
    $("nextQuestion");

  if (submitButton) {
    submitButton.hidden =
      true;
  }

  if (nextButton) {
    nextButton.hidden =
      true;
  }

  $("reviewAttempt")
    ?.addEventListener(
      "click",
      () => {
        reviewMode =
          true;

        index =
          0;

        finishing =
          false;

        render();
      }
    );

  $("retryAttempt")
    ?.addEventListener(
      "click",
      startNewAttempt
    );

  finishing =
    false;
}


/* =========================================================
   NEW ATTEMPT
========================================================= */

async function startNewAttempt() {
  try {
    answers =
      [];

    index =
      0;

    reviewMode =
      false;

    finishing =
      false;

    pendingSelectedIds =
      [];

    resetAllLifelines();

    attempt =
      await createAttempt({
        moduleId:
          quiz.module_id,

        moduleTitle:
          quiz.module_title,

        quizId:
          quiz.id,

        quizTitle:
          quiz.title,

        mode:
          quiz.mode,

        questionIds:
          questions.map(
            (question) =>
              question.id
          ),

        lifelines:
          lifelinesState
      });

    setStatus(
      "New learning attempt saved"
    );

    render();
  } catch (error) {
    console.error(
      "NEW ATTEMPT ERROR:",
      error
    );

    setStatus(
      error.message ||
      "Could not create a new attempt.",
      true
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

$("submitAnswer")
  ?.addEventListener(
    "click",
    async () => {
      await submit(
        null
      );
    }
  );


$("nextQuestion")
  ?.addEventListener(
    "click",
    async () => {
      pendingSelectedIds =
        [];

      index +=
        1;

      if (!reviewMode) {
        await persist(
          false
        );
      }

      render();
    }
  );


$("closeLearningFlashcard")
  ?.addEventListener(
    "click",
    closeFlashcard
  );


$("closeLearningFlashcardBottom")
  ?.addEventListener(
    "click",
    closeFlashcard
  );


$("learningFlashcardBackdrop")
  ?.addEventListener(
    "click",
    closeFlashcard
  );


document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key ===
      "Escape"
    ) {
      closeFlashcard();
    }
  }
);


/* =========================================================
   INITIALISATION
========================================================= */

(async () => {
  const profile =
    await protectAndRender(
      "login.html"
    );

  if (!profile) {
    return;
  }

  const quizArea =
    $("quizArea");

  if (!quizSlug) {
    if (quizArea) {
      quizArea.innerHTML =
        "<p>No quiz was selected.</p>";
    }

    return;
  }

  try {
    setStatus(
      "Loading settings…"
    );

    try {
      aclSettings =
        normalizeAclSettings(
          await getAclSettings()
        );
    } catch (settingsError) {
      console.warn(
        "ACL settings could not be loaded:",
        settingsError
      );

      aclSettings =
        normalizeAclSettings(
          DEFAULT_ACL_SETTINGS
        );
    }

    setStatus(
      "Loading learning mode…"
    );

    const {
      data,
      error
    } =
      await supabaseClient.rpc(
        "acl_get_learning_quiz",
        {
          p_quiz_slug:
            quizSlug,

          p_module_id:
            requestedModuleId ||
            null
        }
      );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "Quiz data was not returned."
      );
    }

    quiz =
      data;

    const moduleTitle =
      $("moduleTitle");

    const quizTitle =
      $("quizTitle");

    const quizDescription =
      $("quizDescription");

    if (moduleTitle) {
      moduleTitle.textContent =
        quiz.module_title ||
        "Learning module";
    }

    if (quizTitle) {
      quizTitle.textContent =
        quiz.title ||
        "Learning quiz";
    }

    if (quizDescription) {
      quizDescription.textContent =
        quiz.description ||
        "Immediate feedback, Scientific Lifelines, explanations and flashcards.";
    }

    let pool =
      quiz.questions ||
      [];

    if (
      quiz.randomize_questions ||
      quiz.selection_mode ===
        "random"
    ) {
      pool =
        shuffle(
          pool
        );
    }

    questions =
      pool.slice(
        0,
        Math.min(
          Number(
            quiz.question_count ||
            pool.length
          ),
          pool.length
        )
      );

    if (!questions.length) {
      throw new Error(
        "No questions are available in this quiz."
      );
    }

    attempt =
      await getOpenAttempt(
        quiz.module_id,
        quiz.id
      );

    if (attempt) {
      const questionMap =
        new Map(
          questions.map(
            (question) => [
              String(
                question.id
              ),

              question
            ]
          )
        );

      const savedQuestionIds =
        attempt.question_ids ||
        attempt.questionIds ||
        [];

      const restoredQuestions =
        savedQuestionIds
          .map(
            (questionId) =>
              questionMap.get(
                String(
                  questionId
                )
              )
          )
          .filter(
            Boolean
          );

      if (
        restoredQuestions.length
      ) {
        questions =
          restoredQuestions;
      }

      index =
        Number(
          attempt.current_question_index ??
          attempt.currentIndex ??
          0
        );

      if (
        index < 0 ||
        index >=
          questions.length
      ) {
        index =
          0;
      }

      answers =
        Array.isArray(
          attempt.answers
        )
          ? attempt.answers
          : [];

      restoreLifelinesState(
        attempt.lifelines ||
        attempt.lifelines_state ||
        attempt.lifelinesState ||
        {}
      );

      setStatus(
        "Unfinished learning attempt restored"
      );
    } else {
      resetAllLifelines();

      attempt =
        await createAttempt({
          moduleId:
            quiz.module_id,

          moduleTitle:
            quiz.module_title,

          quizId:
            quiz.id,

          quizTitle:
            quiz.title,

          mode:
            quiz.mode,

          questionIds:
            questions.map(
              (question) =>
                question.id
            ),

          lifelines:
            lifelinesState
        });

      setStatus(
        "New learning attempt saved"
      );
    }

    render();
  } catch (error) {
    console.error(
      "LEARNING MODE ERROR:",
      error
    );

    setStatus(
      error.message ||
      "Could not open learning mode",
      true
    );

    if (quizArea) {
      quizArea.innerHTML = `
        <div class="empty-state">
          ${esc(
            error.message ||
            "Quiz unavailable"
          )}
        </div>
      `;
    }
  }
})();
