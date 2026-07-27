import { supabaseClient } from "./supabase-client.js";
import { protectAndRender } from "./session-ui.js?v=2.8.0";

import {
  getOpenAttempt,
  createAttempt,
  saveAttempt,
  completeAttempt
} from "./cloud-progress.js";


const $ = (id) => document.getElementById(id);

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


const params = new URLSearchParams(
  window.location.search
);

const quizSlug = params.get("quiz");
const moduleId = params.get("module");


const HAPPY_MASCOT =
  "assets/images/dr-corazon-happy.webp";

const GOOD_JOB_MASCOT =
  "assets/images/dr-corazon-good-job.webp";

const SAD_MASCOT =
  "assets/images/dr-corazon-sad.webp";

const ANGRY_MASCOT =
  "assets/images/dr-corazon-angry.webp";


const MASCOT_IMAGES = [
  HAPPY_MASCOT,
  GOOD_JOB_MASCOT,
  SAD_MASCOT,
  ANGRY_MASCOT
];


function preloadMascotImages() {
  MASCOT_IMAGES.forEach((source) => {
    const image = new Image();

    image.decoding = "async";
    image.src = source;
  });
}


preloadMascotImages();


let quiz = null;
let questions = [];
let index = 0;
let answers = [];
let attempt = null;
let saving = false;
let reviewMode = false;


/* =========================================================
   SCIENTIFIC LIFELINES / THE EXPERT PANEL
========================================================= */

const LIFELINES = {
  expert: "expert",
  filter: "filter",
  guideline: "guideline",
  vault: "vault"
};

let lifelinesState = {};
let expandedLifeline = null;


/* =========================================================
   GENERAL HELPERS
========================================================= */

function setStatus(
  text,
  error = false
) {
  const element = $("saveStatus");

  if (!element) {
    return;
  }

  element.textContent = text;

  element.classList.toggle(
    "error",
    error
  );

  element.classList.toggle(
    "success",
    !error
  );
}


function shuffle(items) {
  const result = [...items];

  for (
    let currentIndex = result.length - 1;
    currentIndex > 0;
    currentIndex -= 1
  ) {
    const randomIndex = Math.floor(
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


function appState() {
  return {
    questionIds: questions.map(
      (question) => question.id
    ),

    currentIndex: index,

    answers,

    lifelinesState,

    score: answers.reduce(
      (total, answer) =>
        total +
        Number(
          answer.points || 0
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

  saving = true;

  setStatus("Saving…");

  try {
    attempt = done
      ? await completeAttempt(
          attempt.id,
          appState()
        )
      : await saveAttempt(
          attempt.id,
          appState()
        );

    setStatus(
      done
        ? "Completed and saved"
        : "Saved to cloud"
    );
  } catch (error) {
    console.error(error);

    setStatus(
      "Save failed — check connection",
      true
    );
  } finally {
    saving = false;
  }
}


function currentQuestion() {
  return questions[index] || null;
}


function answerFor(question) {
  if (!question) {
    return null;
  }

  return answers.find(
    (answer) =>
      String(answer.questionId) ===
      String(question.id)
  ) || null;
}


function setAnswer(answer) {
  const answerIndex =
    answers.findIndex(
      (item) =>
        String(item.questionId) ===
        String(answer.questionId)
    );

  if (answerIndex >= 0) {
    answers[answerIndex] = answer;
  } else {
    answers.push(answer);
  }
}


function optionsFor(question) {
  if (!question._options) {
    question._options = [
      ...(question.options || [])
    ].sort(
      (first, second) => {
        const orderDifference =
          Number(
            first.display_order ?? 999
          ) -
          Number(
            second.display_order ?? 999
          );

        return (
          orderDifference ||
          String(
            first.key || ""
          ).localeCompare(
            String(
              second.key || ""
            )
          )
        );
      }
    );
  }

  return question._options;
}


/* =========================================================
   SCIENTIFIC LIFELINES STATE HELPERS
========================================================= */

function defaultQuestionLifelines() {
  return {
    expert: false,
    filter: false,
    guideline: false,
    vault: false,
    eliminatedOptionIds: []
  };
}


function lifelinesForQuestion(question) {
  if (!question) {
    return defaultQuestionLifelines();
  }

  const questionId = String(
    question.id
  );

  if (!lifelinesState[questionId]) {
    lifelinesState[questionId] =
      defaultQuestionLifelines();
  }

  return lifelinesState[questionId];
}


function updateQuestionLifelines(
  question,
  changes = {}
) {
  if (!question) {
    return;
  }

  const questionId = String(
    question.id
  );

  const current =
    lifelinesForQuestion(
      question
    );

  lifelinesState[questionId] = {
    ...current,
    ...changes
  };
}


function lifelineUsedCount(question) {
  const state =
    lifelinesForQuestion(
      question
    );

  return [
    state.expert,
    state.filter,
    state.guideline,
    state.vault
  ].filter(Boolean).length;
}


function lifelineIsUsed(
  question,
  lifeline
) {
  const state =
    lifelinesForQuestion(
      question
    );

  return Boolean(
    state[lifeline]
  );
}


function markLifelineUsed(
  question,
  lifeline
) {
  if (
    !question ||
    !lifeline
  ) {
    return;
  }

  updateQuestionLifelines(
    question,
    {
      [lifeline]: true
    }
  );
}


function lifelineResponseElement() {
  return $(
    "scientificLifelineResponse"
  );
}


function hideLifelineResponse() {
  const response =
    lifelineResponseElement();

  if (!response) {
    return;
  }

  response.hidden = true;
  response.innerHTML = "";
}


function showLifelineResponse({
  icon = "🩺",
  title = "Scientific Lifeline",
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

  response.hidden = false;

  response.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


function expertHintFor(question) {
  return (
    question.expert_hint ||
    question.expertHint ||
    question.dr_corazon_hint ||
    question.drCorazonHint ||
    question.hint ||
    "Focus on the central clinical decision in the question. Identify the most important finding, then compare each option with the relevant guideline principle."
  );
}


function guidelineHintFor(question) {
  return (
    question.guideline_hint ||
    question.guidelineHint ||
    question.guideline_clue ||
    question.guidelineClue ||
    question.reference_text ||
    question.referenceText ||
    "Recall the principal guideline recommendation, including the relevant indication, threshold, timing, contraindication, or treatment priority."
  );
}


function randomItems(
  items,
  count
) {
  const pool = [...items];
  const selected = [];

  while (
    pool.length &&
    selected.length < count
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


function eligibleIncorrectOptions(
  question,
  correctOptionIds = []
) {
  const correctIds =
    new Set(
      correctOptionIds.map(
        String
      )
    );

  return optionsFor(
    question
  ).filter(
    (option) =>
      !correctIds.has(
        String(option.id)
      )
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
        (optionIds || []).map(
          String
        )
    }
  );
}


function eliminatedOptionsFor(
  question
) {
  return (
    lifelinesForQuestion(
      question
    ).eliminatedOptionIds ||
    []
  ).map(String);
}


function resetAllLifelines() {
  lifelinesState = {};
}


function restoreLifelinesState(
  storedState
) {
  if (
    storedState &&
    typeof storedState === "object" &&
    !Array.isArray(storedState)
  ) {
    lifelinesState =
      storedState;
  } else {
    lifelinesState = {};
  }
}

/* =========================================================
   SCIENTIFIC LIFELINES — COMPACT TOOLBAR
========================================================= */

function lifelineDefinitions() {
  return [
    {
      id: LIFELINES.expert,
      icon: "",
      image: HAPPY_MASCOT,
      title: "Ask Dr. Corazón",
      shortTitle: "Dr. Corazón"
    },

    {
      id: LIFELINES.filter,
      icon: "✂️",
      image: "",
      title: "Evidence Filter",
      shortTitle: "Evidence Filter"
    },

    {
      id: LIFELINES.guideline,
      icon: "📘",
      image: "",
      title: "ESC Pocket Guideline",
      shortTitle: "ESC Guideline"
    },

    {
      id: LIFELINES.vault,
      icon: "🧠",
      image: "",
      title: "Knowledge Vault",
      shortTitle: "Knowledge Vault"
    }
  ];
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

  const expanded =
    expandedLifeline ===
    definition.id;

  return `
    <button
      type="button"
      class="
        compact-lifeline-button
        ${expanded ? "is-expanded" : ""}
        ${used ? "is-used" : ""}
      "
      data-lifeline="${esc(
        definition.id
      )}"
      aria-label="${esc(
        definition.title
      )}"
      aria-expanded="${
        expanded
          ? "true"
          : "false"
      }"
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
    reviewMode
  ) {
    return "";
  }

  const definitions =
    lifelineDefinitions();

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
          ${lifelineUsedCount(question)}/4
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
        const optionLabel =
          input.closest(
            ".learning-option"
          );

        if (!optionLabel) {
          return;
        }

        const eliminated =
          eliminatedIds.has(
            String(input.value)
          );

        optionLabel.classList.toggle(
          "is-eliminated",
          eliminated
        );

        if (eliminated) {
          input.checked = false;
          input.disabled = true;
        }
      }
    );
}


function refreshCompactLifelines(
  question
) {
  if (!question) {
    return;
  }

  render();
}


function setLifelineButtonLoading(
  lifeline,
  loading = true
) {
  const button =
    document.querySelector(
      `[data-lifeline="${lifeline}"]`
    );

  if (!button) {
    return;
  }

  button.classList.toggle(
    "is-loading",
    loading
  );

  button.disabled = loading;
}


function questionFlashcard(question) {
  return normaliseFlashcard(
    question
  );
}


async function activateLifeline(
  question,
  lifeline
) {
  if (
    !question ||
    lifelineIsUsed(
      question,
      lifeline
    )
  ) {
    return;
  }

  markLifelineUsed(
    question,
    lifeline
  );

  expandedLifeline = null;

  if (
    lifeline ===
    LIFELINES.expert
  ) {
    render();

    showLifelineResponse({
      icon: "🩺",
      title: "Dr. Corazón says",
      message:
        expertHintFor(
          question
        )
    });

    await persist(false);

    return;
  }


  if (
    lifeline ===
    LIFELINES.guideline
  ) {
    render();

    showLifelineResponse({
      icon: "📘",
      title: "ESC Pocket Guideline",
      message:
        guidelineHintFor(
          question
        )
    });

    await persist(false);

    return;
  }


  if (
    lifeline ===
    LIFELINES.vault
  ) {
    const flashcard =
      questionFlashcard(
        question
      );

    render();

    if (flashcard) {
      openFlashcard(
        flashcard
      );
    } else {
      showLifelineResponse({
        icon: "🧠",
        title: "Knowledge Vault",
        message:
          "A review flashcard has not yet been added for this question."
      });
    }

    await persist(false);

    return;
  }


  if (
    lifeline ===
    LIFELINES.filter
  ) {
    render();

    showLifelineResponse({
      icon: "✂️",
      title: "Evidence Filter",
      message:
        "The secure option-elimination service will be connected in the next update."
    });

    await persist(false);
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

            if (
              !lifeline ||
              lifelineIsUsed(
                question,
                lifeline
              )
            ) {
              return;
            }

            if (
              expandedLifeline !==
              lifeline
            ) {
              expandedLifeline =
                lifeline;

              render();

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
   FLASHCARD DATA
========================================================= */

function normaliseFlashcard(
  ...sources
) {
  for (const source of sources) {
    if (
      !source ||
      typeof source !== "object"
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

    const content =
      nested?.content ||
      source.flashcard_content ||
      source.flashcardContent;

    const rawType =
      nested?.type ||
      source.flashcard_type ||
      source.flashcardType ||
      "FLASHCARD";

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
    } = await supabaseClient
      .from("questions")
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


function flashcardSections(content) {
  if (!content) {
    return [];
  }

  if (Array.isArray(content)) {
    return [
      {
        heading:
          "High-yield review",

        lines: content
      }
    ];
  }

  if (
    typeof content === "string"
  ) {
    return [
      {
        heading:
          "High-yield review",

        lines: [content]
      }
    ];
  }

  if (
    typeof content === "object"
  ) {
    return Object.entries(
      content
    ).map(
      ([heading, value]) => ({
        heading,

        lines:
          Array.isArray(value)
            ? value
            : [
                String(
                  value || ""
                )
              ]
      })
    );
  }

  return [];
}


function openFlashcard(flashcard) {
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
    console.error(
      "Flashcard elements are missing from learning.html."
    );

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
                    .filter(Boolean)
                    .map(
                      (line) => `
                        <li>
                          ${esc(line)}
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

  modal.hidden = false;

  document.body.classList.add(
    "learning-modal-open"
  );
}


function closeFlashcard() {
  const modal =
    $("learningFlashcardModal");

  if (modal) {
    modal.hidden = true;
  }

  document.body.classList.remove(
    "learning-modal-open"
  );
}


/* =========================================================
   DR. CORAZÓN FEEDBACK
========================================================= */

function feedbackHtml(answer) {
  const correct =
    Boolean(answer.correct);

  const points =
    Number(
      answer.points || 0
    );

  const pointText =
    `${
      points >= 0 ? "+" : ""
    }${points} point${
      Math.abs(points) === 1
        ? ""
        : "s"
    }`;

  const mascot =
    correct
      ? GOOD_JOB_MASCOT
      : SAD_MASCOT;

  const mascotAlt =
    correct
      ? "Dr. Corazón celebrating a correct answer"
      : "Dr. Corazón looking thoughtful after an incorrect answer";

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
          src="${esc(mascot)}"
          alt="${esc(mascotAlt)}"
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

        ${
          correct
            ? `
              <div
                class="dr-corazon-confetti"
                aria-hidden="true"
              >
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            `
            : `
              <span
                class="dr-corazon-tear"
                aria-hidden="true"
              ></span>
            `
        }

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
          ${pointText}
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


function bindFeedback(answer) {
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
      image.hidden = true;

      if (fallback) {
        fallback.hidden = false;
      }
    },
    {
      once: true
    }
  );

  $("reviewCurrentFlashcard")
    ?.addEventListener(
      "click",
      () =>
        openFlashcard(
          answer.flashcard
        )
    );

  $("answerFeedbackHost")
    ?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
}


/* =========================================================
   QUESTION RENDERING
========================================================= */
function render() {
  closeFlashcard();

  document.body.classList.add(
    "acl-expert-learning-mode"
  );

  expandedLifeline =
    expandedLifeline || null;
  const question =
    currentQuestion();

  if (!question) {
    finish();

    return;
  }

  const answer =
    answerFor(question);

  const multipleResponse =
    question.question_type ===
    "multiple_response";

  const progress =
    questions.length
      ? Math.round(
          (
            (index + 1) /
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

quizArea.innerHTML = `
    <article class="expert-question-layout">

      <div class="question-topic-row">
      ${
        question.topic
          ? `
            <span class="learning-topic">
              ${esc(question.topic)}
            </span>
          `
          : `
            <span class="learning-topic">
              Clinical question
            </span>
          `
      }

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
      ${esc(question.stem)}
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

      ${optionsFor(question)
        .map(
          (option) => {
            const selectedIds =
              (answer?.selectedIds || [])
                .map(String);

            const correctIds =
              (
                answer?.correctOptionIds ||
                []
              ).map(String);

            const selected =
              selectedIds.includes(
                String(option.id)
              );

            const correct =
              correctIds.includes(
                String(option.id)
              );

            const incorrect =
              Boolean(
                answer &&
                !answer.correct &&
                selected
              );

            return `
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
                "
              >

                <input
                  type="${
                    multipleResponse
                      ? "checkbox"
                      : "radio"
                  }"
                  name="answer"
                  value="${esc(option.id)}"
                  ${
                    selected
                      ? "checked"
                      : ""
                  }
                  ${
                    answer
                      ? "disabled"
                      : ""
                  }
                >

                <span class="option-key">
                  ${esc(option.key)}
                </span>

                <span>
                  ${esc(option.text)}
                </span>

              </label>
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
        ? feedbackHtml(answer)
        : "";
  }

   const submitButton =
    $("submitAnswer");

  const nextButton =
    $("nextQuestion");

  if (submitButton) {
    submitButton.hidden =
      Boolean(answer);

    submitButton.disabled =
      false;
  }

  if (nextButton) {
    nextButton.hidden =
      !answer;
  }

  if (answer) {
    bindFeedback(answer);
  } else {
    applyEliminatedOptionStyles(
      question
    );

    bindCompactLifelines(
      question
    );
  }
}


/* =========================================================
   ANSWER CHECKING
========================================================= */

async function submit() {
  const question =
    currentQuestion();

  if (!question) {
    return;
  }

  const selectedIds = [
    ...document.querySelectorAll(
      'input[name="answer"]:checked'
    )
  ].map(
    (input) =>
      input.value
  );

  if (!selectedIds.length) {
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

  const submitButton =
    $("submitAnswer");

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const {
      data,
      error
    } = await supabaseClient.rpc(
      "acl_check_learning_answer",
      {
        p_quiz_id: quiz.id,
        p_question_id:
          question.id,
        p_option_ids:
          selectedIds
      }
    );

    if (error) {
      throw error;
    }

    const flashcard =
      await loadFlashcard(
        question,
        data
      );

    const answer = {
      questionId:
        question.id,

      selectedIds,

      correct:
        Boolean(
          data.correct ??
          data.is_correct
        ),

      points:
        Number(
          data.points ??
          data.points_awarded ??
          0
        ),

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
        new Date().toISOString()
    };

    setAnswer(answer);

    await persist(false);

    render();
  } catch (error) {
    console.error(error);

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
      submitButton.disabled = false;
    }
  }
}


/* =========================================================
   COMPLETION AND REVIEW
========================================================= */

async function finish() {
  if (!reviewMode) {
    await persist(true);
  }

  const score =
    appState().score;

  const maximum =
    questions.reduce(
      (total, question) =>
        total +
        Number(
          question.points || 1
        ),
      0
    );

  const percentage =
    maximum
      ? Math.round(
          (score / maximum) *
          100
        )
      : 0;

  const passed =
    percentage >=
    Number(
      quiz.passing_percentage ||
      0
    );

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
    feedbackHost.innerHTML = "";
  }

  const lifelinesPanel =
    $("scientificLifelinesPanel");

  if (lifelinesPanel) {
    lifelinesPanel.hidden = true;
  }

  hideLifelineResponse();

  if (!quizArea) {
    return;
  }

  quizArea.innerHTML = `
    <div class="learning-result">

      <span class="result-icon">
        ${passed ? "✓" : "↻"}
      </span>

      <h2>
        ${
          passed
            ? "Module completed"
            : "Learning attempt completed"
        }
      </h2>

      <div class="result-score">
        ${score} / ${maximum} points · ${percentage}%
      </div>

      <p>
        ${
          passed
            ? `You reached the ${quiz.passing_percentage}% pass mark.`
            : `The pass mark is ${quiz.passing_percentage}%. Review the explanations and try again.`
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
    submitButton.hidden = true;
  }

  if (nextButton) {
    nextButton.hidden = true;
  }

  $("reviewAttempt")
    ?.addEventListener(
      "click",
      () => {
        reviewMode = true;
        index = 0;

        render();
      }
    );

  $("retryAttempt")
    ?.addEventListener(
      "click",
      startNewAttempt
    );
}


async function startNewAttempt() {
  try {
    answers = [];
    index = 0;
    reviewMode = false;
    expandedLifeline = null;

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
          )
      });

    setStatus(
      "New learning attempt saved"
    );

    render();
  } catch (error) {
    console.error(error);

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
    submit
  );


$("nextQuestion")
  ?.addEventListener(
    "click",
    async () => {
      expandedLifeline = null;

      index += 1;

      if (!reviewMode) {
        await persist(false);
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
    if (event.key === "Escape") {
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
      "Loading learning mode…"
    );

    const {
      data,
      error
    } = await supabaseClient.rpc(
      "acl_get_learning_quiz",
      {
        p_quiz_slug:
          quizSlug,

        p_module_id:
          moduleId || null
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

    quiz = data;

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
        "Immediate feedback, Dr. Corazón reactions, explanations and flashcards after every answer.";
    }

    let pool =
      quiz.questions || [];

    if (
      quiz.randomize_questions ||
      quiz.selection_mode ===
        "random"
    ) {
      pool = shuffle(pool);
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
              String(question.id),
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
            (id) =>
              questionMap.get(
                String(id)
              )
          )
          .filter(Boolean);

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
        index >= questions.length
      ) {
        index = 0;
      }

      answers =
        Array.isArray(
          attempt.answers
        )
          ? attempt.answers
          : [];

      restoreLifelinesState(
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
            )
        });

      setStatus(
        "New learning attempt saved"
      );
    }

    render();
  } catch (error) {
    console.error(error);

    setStatus(
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
