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
   CHALLENGE MODE URL PARAMETERS
========================================================= */

const challengeId =
  params.get("challenge");


const challengeRole =
  params.get("challenge_role");


const challengeQuestionCount =
  Number(
    params.get("question_count") ||
    0
  );


function isChallengeAttempt() {
  return Boolean(
    challengeId &&
    (
      challengeRole ===
        "challenger" ||
      challengeRole ===
        "opponent"
    )
  );
}

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
let preQuizReviewSeen =
  false;
let activeChallenge =
  null;

let activeChallengeParticipant =
  null;

let challengeStartedAt =
  null;
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

function focusLearningContent(
  selector,
  behavior = "smooth"
) {
  window.requestAnimationFrame(
    () => {
      window.requestAnimationFrame(
        () => {
          const target =
            document.querySelector(
              selector
            );

          if (!target) {
            return;
          }

          const headerOffset =
            24;

          const targetTop =
            target
              .getBoundingClientRect()
              .top +
            window.scrollY -
            headerOffset;

          window.scrollTo({
            top:
              Math.max(
                targetTop,
                0
              ),

            behavior
          });
        }
      );
    }
  );
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
async function loadPreQuizReviewConfig() {
  if (!quiz?.id) {
    return;
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "quizzes"
        )
        .select(`
          pre_quiz_review_enabled,
          pre_quiz_review_title,
          pre_quiz_review_points
        `)
        .eq(
          "id",
          quiz.id
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return;
    }

    quiz.pre_quiz_review_enabled =
      Boolean(
        data.pre_quiz_review_enabled
      );

    quiz.pre_quiz_review_title =
      data.pre_quiz_review_title ||
      "Dr. Corazón recommends reviewing these points";

    quiz.pre_quiz_review_points =
      Array.isArray(
        data.pre_quiz_review_points
      )
        ? data.pre_quiz_review_points
        : [];
  } catch (error) {
    console.warn(
      "PRE-QUIZ REVIEW CONFIG ERROR:",
      error
    );

    quiz.pre_quiz_review_enabled =
      false;

    quiz.pre_quiz_review_points =
      [];
  }
}


function shouldShowPreQuizReview() {
  return Boolean(
    quiz?.pre_quiz_review_enabled &&
    Array.isArray(
      quiz?.pre_quiz_review_points
    ) &&
    quiz.pre_quiz_review_points.length &&
    !preQuizReviewSeen &&
    !reviewMode &&
    answers.length === 0 &&
    index === 0
  );
}

async function loadActiveChallenge() {
  if (!challengeId) {
    return;
  }

  const {
    data: challenge,
    error: challengeError
  } =
    await supabaseClient
      .from(
        "module_challenges"
      )
      .select(`
        id,
        module_id,
        quiz_id,
        creator_id,
        challenge_code,
        title,
        question_ids,
        maximum_participants,
        starts_at,
        ends_at,
        status
      `)
      .eq(
        "id",
        challengeId
      )
      .maybeSingle();

  if (challengeError) {
    throw challengeError;
  }

  if (!challenge) {
    throw new Error(
      "Challenge not found."
    );
  }

  if (
    challenge.status !==
    "open"
  ) {
    throw new Error(
      "This challenge is no longer open."
    );
  }

  if (
    new Date(
      challenge.ends_at
    ).getTime() <=
    Date.now()
  ) {
    throw new Error(
      "This challenge has expired."
    );
  }

  if (
    String(
      challenge.module_id
    ) !==
    String(
      quiz.module_id
    )
  ) {
    throw new Error(
      "This challenge does not belong to this module."
    );
  }

  if (
    String(
      challenge.quiz_id
    ) !==
    String(
      quiz.id
    )
  ) {
    throw new Error(
      "This challenge does not belong to this quiz."
    );
  }

  activeChallenge =
    challenge;


  const {
    data: userData,
    error: userError
  } =
    await supabaseClient
      .auth
      .getUser();

  if (userError) {
    throw userError;
  }

  const user =
    userData?.user;

  if (!user) {
    throw new Error(
      "Please sign in before starting this challenge."
    );
  }


  const {
    data: participant,
    error: participantError
  } =
    await supabaseClient
      .from(
        "module_challenge_participants"
      )
      .select(`
        id,
        challenge_id,
        user_id,
        attempt_id,
        invitation_status,
        joined_at,
        completed_at,
        score,
        duration_seconds,
        correct_answers
      `)
      .eq(
        "challenge_id",
        challenge.id
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

  if (participantError) {
    throw participantError;
  }

  if (!participant) {
    throw new Error(
      "Join this challenge before starting it."
    );
  }

  if (
    participant.invitation_status ===
    "completed"
  ) {
    throw new Error(
      "You have already completed your official challenge attempt."
    );
  }

  activeChallengeParticipant =
    participant;

  challengeStartedAt =
    participant.joined_at
      ? new Date(
          participant.joined_at
        )
      : new Date();
}


function applyChallengeQuestionSet() {
  if (
    !activeChallenge ||
    !Array.isArray(
      activeChallenge.question_ids
    ) ||
    !activeChallenge
      .question_ids
      .length
  ) {
    return;
  }

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

  const fixedQuestions =
    activeChallenge
      .question_ids
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
    fixedQuestions.length
  ) {
    questions =
      fixedQuestions;
  }
}

function normalizePreQuizReviewPoint(
  point,
  pointIndex
) {
  /*
   * Backward compatibility:
   *
   * Old format:
   * "Review the definition of heart failure."
   *
   * New format:
   * {
   *   title: "Definition and classification",
   *   summary: "Review the definition...",
   *   content: [...]
   * }
   */

  if (
    typeof point ===
    "string"
  ) {
    return {
      title:
        point,

      summary:
        point,

      content:
        [],

      available:
        false,

      pointIndex
    };
  }

  if (
    point &&
    typeof point ===
      "object" &&
    !Array.isArray(
      point
    )
  ) {
    const content =
      point.content ??
      point.points ??
      point.bullets ??
      point.lines ??
      [];

    const normalizedContent =
      Array.isArray(
        content
      )
        ? content.filter(
            Boolean
          )
        : (
            typeof content ===
              "string" &&
            content.trim()
              ? [
                  content.trim()
                ]
              : []
          );

    return {
      title:
        point.title ||
        point.topic ||
        point.heading ||
        point.summary ||
        `Review topic ${pointIndex + 1}`,

      summary:
        point.summary ||
        point.subtitle ||
        point.description ||
        point.title ||
        point.topic ||
        point.heading ||
        `Review topic ${pointIndex + 1}`,

      content:
        normalizedContent,

      available:
        normalizedContent.length >
        0,

      pointIndex
    };
  }

  return {
    title:
      `Review topic ${pointIndex + 1}`,

    summary:
      `Review topic ${pointIndex + 1}`,

    content:
      [],

    available:
      false,

    pointIndex
  };
}


function normalizedPreQuizReviewPoints() {
  const points =
    Array.isArray(
      quiz?.pre_quiz_review_points
    )
      ? quiz.pre_quiz_review_points
      : [];

  return points.map(
    (
      point,
      pointIndex
    ) =>
      normalizePreQuizReviewPoint(
        point,
        pointIndex
      )
  );
}


function ensurePreQuizReviewModal() {
  let modal =
    $("preQuizReviewModal");

  if (modal) {
    return modal;
  }

  modal =
    document.createElement(
      "div"
    );

  modal.id =
    "preQuizReviewModal";

  modal.className =
    "pre-quiz-topic-modal";

  modal.hidden =
    true;

  modal.innerHTML = `
    <div
      id="preQuizReviewModalBackdrop"
      class="pre-quiz-topic-modal-backdrop"
    ></div>

    <section
      class="pre-quiz-topic-modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preQuizReviewModalTitle"
    >

      <div class="pre-quiz-topic-modal-header">

        <div class="pre-quiz-topic-modal-doctor">

          <img
            src="${esc(
              HAPPY_MASCOT
            )}"
            alt="Dr. Corazón"
          >

        </div>


        <div class="pre-quiz-topic-modal-heading">

          <span>
            Dr. Corazón’s review card
          </span>

          <h2 id="preQuizReviewModalTitle">
            Topic review
          </h2>

        </div>


        <button
          id="closePreQuizReviewModal"
          class="pre-quiz-topic-modal-close"
          type="button"
          aria-label="Close review card"
        >
          ×
        </button>

      </div>


      <div
        id="preQuizReviewModalContent"
        class="pre-quiz-topic-modal-content"
      ></div>


      <div class="pre-quiz-topic-modal-actions">

        <button
          id="returnToPreQuizPoints"
          class="secondary-btn pre-quiz-topic-return"
          type="button"
        >
          Back to the review points
        </button>

        <button
          id="startQuizFromReviewModal"
          class="primary-btn pre-quiz-topic-start"
          type="button"
        >
          ✓ I have reviewed — take me to the quiz now!
        </button>

      </div>

    </section>
  `;

  document.body.appendChild(
    modal
  );

  $("closePreQuizReviewModal")
    ?.addEventListener(
      "click",
      closePreQuizReviewModal
    );

  $("preQuizReviewModalBackdrop")
    ?.addEventListener(
      "click",
      closePreQuizReviewModal
    );

  $("returnToPreQuizPoints")
    ?.addEventListener(
      "click",
      closePreQuizReviewModal
    );

  $("startQuizFromReviewModal")
    ?.addEventListener(
      "click",
      proceedFromPreQuizReview
    );

  return modal;
}


function preQuizReviewModalContentHtml(
  reviewPoint
) {
  if (
    !reviewPoint.available
  ) {
    return `
      <div class="pre-quiz-topic-unavailable">

        <span
          class="pre-quiz-topic-unavailable-icon"
          aria-hidden="true"
        >
          📚
        </span>

        <h3>
          Review card coming soon
        </h3>

        <p>
          The review card will be available for this topic soon.
        </p>

        <small>
          You may return to the review points or proceed directly
          to the quiz.
        </small>

      </div>
    `;
  }

  return `
    <div class="pre-quiz-topic-review-card">

      <div class="pre-quiz-topic-review-intro">

        <span>
          High-yield review
        </span>

        <p>
          Review these essential points before starting the quiz.
        </p>

      </div>


      <ul class="pre-quiz-topic-review-list">

        ${reviewPoint.content
          .map(
            (line) => `
              <li>
                <span
                  class="pre-quiz-topic-review-check"
                  aria-hidden="true"
                >
                  ✓
                </span>

                <span>
                  ${esc(
                    line
                  )}
                </span>
              </li>
            `
          )
          .join("")}

      </ul>

    </div>
  `;
}


function openPreQuizReviewModal(
  pointIndex
) {
  const points =
    normalizedPreQuizReviewPoints();

  const reviewPoint =
    points[
      Number(
        pointIndex
      )
    ];

  if (!reviewPoint) {
    return;
  }

  const modal =
    ensurePreQuizReviewModal();

  const title =
    $("preQuizReviewModalTitle");

  const content =
    $("preQuizReviewModalContent");

  if (title) {
    title.textContent =
      reviewPoint.title;
  }

  if (content) {
    content.innerHTML =
      preQuizReviewModalContentHtml(
        reviewPoint
      );
  }

  modal.hidden =
    false;

  document.body.classList.add(
    "pre-quiz-modal-open"
  );

  window.requestAnimationFrame(
    () => {
      $("closePreQuizReviewModal")
        ?.focus();
    }
  );
}


function closePreQuizReviewModal() {
  const modal =
    $("preQuizReviewModal");

  if (modal) {
    modal.hidden =
      true;
  }

  document.body.classList.remove(
    "pre-quiz-modal-open"
  );
}


async function proceedFromPreQuizReview() {
  preQuizReviewSeen =
    true;

  closePreQuizReviewModal();

  await persist(
    false
  );

  render();

  focusLearningContent(
    ".expert-question-layout"
  );
}

function resetPreQuizReviewForNewAttempt() {
  preQuizReviewSeen =
    false;

  if (
    quiz?.pre_quiz_review_enabled &&
    !Array.isArray(
      quiz.pre_quiz_review_points
    )
  ) {
    quiz.pre_quiz_review_points =
      [];
  }
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

    preQuizReviewSeen,

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
   QUIZ-WIDE LIFELINE STATE
========================================================= */

function defaultQuizLifelines() {
    return {
    expert:
      false,

    filter:
      false,

    guideline:
      false,

    vault:
      false,

    usedOnQuestion:
      {
        expert:
          null,

        filter:
          null,

        guideline:
          null,

        vault:
          null
      },
eliminatedOptionIdsByQuestion:
      {}
  };
}

function ensureLifelinesState() {
  if (
    !lifelinesState ||
    typeof lifelinesState !==
      "object" ||
    Array.isArray(
      lifelinesState
    )
  ) {
    lifelinesState =
      defaultQuizLifelines();
  }

  [
    LIFELINES.expert,
    LIFELINES.filter,
    LIFELINES.guideline,
    LIFELINES.vault
  ].forEach(
    (lifeline) => {
      lifelinesState[
        lifeline
      ] =
        Boolean(
          lifelinesState[
            lifeline
          ]
        );
    }
  );
  if (
    !lifelinesState
      .usedOnQuestion ||
    typeof lifelinesState
      .usedOnQuestion !==
      "object" ||
    Array.isArray(
      lifelinesState
        .usedOnQuestion
    )
  ) {
    lifelinesState
      .usedOnQuestion =
        {
          expert:
            null,

          filter:
            null,

          guideline:
            null,

          vault:
            null
        };
  }

  [
    LIFELINES.expert,
    LIFELINES.filter,
    LIFELINES.guideline,
    LIFELINES.vault
  ].forEach(
    (lifeline) => {
      const questionNumber =
        Number(
          lifelinesState
            .usedOnQuestion[
              lifeline
            ]
        );

      lifelinesState
        .usedOnQuestion[
          lifeline
        ] =
          Number.isFinite(
            questionNumber
          ) &&
          questionNumber >
            0
            ? questionNumber
            : null;
    }
  );
  if (
    !lifelinesState
      .eliminatedOptionIdsByQuestion ||
    typeof lifelinesState
      .eliminatedOptionIdsByQuestion !==
      "object" ||
    Array.isArray(
      lifelinesState
        .eliminatedOptionIdsByQuestion
    )
  ) {
    lifelinesState
      .eliminatedOptionIdsByQuestion =
        {};
  }

  return lifelinesState;
}


function lifelinesForQuestion(
  question
) {
  const state =
    ensureLifelinesState();

  const questionId =
    question
      ? String(
          question.id
        )
      : "";

  const eliminatedOptionIds =
    questionId &&
    Array.isArray(
      state
        .eliminatedOptionIdsByQuestion[
          questionId
        ]
    )
      ? state
          .eliminatedOptionIdsByQuestion[
            questionId
          ]
      : [];

  return {
    expert:
      state.expert,

    filter:
      state.filter,

    guideline:
      state.guideline,

    vault:
      state.vault,

    eliminatedOptionIds:
      eliminatedOptionIds.map(
        String
      )
  };
}


function updateQuestionLifelines(
  question,
  changes = {}
) {
  const state =
    ensureLifelinesState();

  [
    LIFELINES.expert,
    LIFELINES.filter,
    LIFELINES.guideline,
    LIFELINES.vault
  ].forEach(
    (lifeline) => {
      if (
        Object.prototype
          .hasOwnProperty.call(
            changes,
            lifeline
          )
      ) {
        state[
          lifeline
        ] =
          Boolean(
            changes[
              lifeline
            ]
          );
      }
    }
  );

  if (
    question &&
    Object.prototype
      .hasOwnProperty.call(
        changes,
        "eliminatedOptionIds"
      )
  ) {
    const questionId =
      String(
        question.id
      );

    state
      .eliminatedOptionIdsByQuestion[
        questionId
      ] =
        Array.isArray(
          changes
            .eliminatedOptionIds
        )
          ? changes
              .eliminatedOptionIds
              .map(
                String
              )
          : [];
  }

  lifelinesState =
    state;
}


function lifelineIsUsed(
  question,
  lifeline
) {
  void question;

  return Boolean(
    ensureLifelinesState()[
      lifeline
    ]
  );
}


function markLifelineUsed(
  question,
  lifeline
) {
  const state =
    ensureLifelinesState();

  state[
    lifeline
  ] =
    true;

  state
    .usedOnQuestion[
      lifeline
    ] =
      index + 1;

  lifelinesState =
    state;
}

function lifelineUsedCount(
  question
) {
  void question;

  const state =
    ensureLifelinesState();

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
  if (!question) {
    return [];
  }

  const state =
    ensureLifelinesState();

  const questionId =
    String(
      question.id
    );

  const eliminated =
    state
      .eliminatedOptionIdsByQuestion[
        questionId
      ];

  return Array.isArray(
    eliminated
  )
    ? eliminated.map(
        String
      )
    : [];
}


function setEliminatedOptions(
  question,
  optionIds
) {
  if (!question) {
    return;
  }

  const state =
    ensureLifelinesState();

  const questionId =
    String(
      question.id
    );

  state
    .eliminatedOptionIdsByQuestion[
      questionId
    ] =
      Array.isArray(
        optionIds
      )
        ? optionIds.map(
            String
          )
        : [];

  lifelinesState =
    state;
}


function restoreLifelinesState(
  storedState
) {
  const restored =
    defaultQuizLifelines();

  if (
    !storedState ||
    typeof storedState !==
      "object" ||
    Array.isArray(
      storedState
    )
  ) {
    lifelinesState =
      restored;

    return;
  }

  /*
   * Restore the new quiz-wide format.
   */

  const newFormatDetected =
    Object.prototype
      .hasOwnProperty.call(
        storedState,
        "expert"
      ) ||
    Object.prototype
      .hasOwnProperty.call(
        storedState,
        "filter"
      ) ||
    Object.prototype
      .hasOwnProperty.call(
        storedState,
        "guideline"
      ) ||
    Object.prototype
      .hasOwnProperty.call(
        storedState,
        "vault"
      ) ||
    Object.prototype
      .hasOwnProperty.call(
        storedState,
        "eliminatedOptionIdsByQuestion"
      );

  if (
    newFormatDetected
  ) {
    restored.expert =
      Boolean(
        storedState.expert
      );

    restored.filter =
      Boolean(
        storedState.filter
      );

    restored.guideline =
      Boolean(
        storedState.guideline
      );

    restored.vault =
      Boolean(
        storedState.vault
      );
        const storedUsage =
      storedState
        .usedOnQuestion;

    if (
      storedUsage &&
      typeof storedUsage ===
        "object" &&
      !Array.isArray(
        storedUsage
      )
    ) {
      [
        LIFELINES.expert,
        LIFELINES.filter,
        LIFELINES.guideline,
        LIFELINES.vault
      ].forEach(
        (lifeline) => {
          const questionNumber =
            Number(
              storedUsage[
                lifeline
              ]
            );

          restored
            .usedOnQuestion[
              lifeline
            ] =
              Number.isFinite(
                questionNumber
              ) &&
              questionNumber >
                0
                ? questionNumber
                : null;
        }
      );
    }

    const eliminatedMap =
      storedState
        .eliminatedOptionIdsByQuestion;

    if (
      eliminatedMap &&
      typeof eliminatedMap ===
        "object" &&
      !Array.isArray(
        eliminatedMap
      )
    ) {
      Object.entries(
        eliminatedMap
      ).forEach(
        (
          [
            questionId,
            optionIds
          ]
        ) => {
          restored
            .eliminatedOptionIdsByQuestion[
              String(
                questionId
              )
            ] =
              Array.isArray(
                optionIds
              )
                ? optionIds.map(
                    String
                  )
                : [];
        }
      );
    }

    lifelinesState =
      restored;

    return;
  }

  Object.entries(
    storedState
  ).forEach(
    ([questionId,questionState]) => {
      if (!questionState || typeof questionState !== "object" || Array.isArray(questionState)) return;
      restored.expert = restored.expert || Boolean(questionState.expert);
      restored.filter = restored.filter || Boolean(questionState.filter);
      restored.guideline = restored.guideline || Boolean(questionState.guideline);
      restored.vault = restored.vault || Boolean(questionState.vault);
      if (Array.isArray(questionState.eliminatedOptionIds)) restored.eliminatedOptionIdsByQuestion[String(questionId)] = questionState.eliminatedOptionIds.map(String);
    }
  );
  lifelinesState = restored;
}
function resetAllLifelines(){lifelinesState=defaultQuizLifelines();}
function lifelineResponseElement(){return $("scientificLifelineResponse");}
function showLifelineResponse({icon="🩺",title="Scientific Lifeline",message="",expert=false}={}){const response=lifelineResponseElement();if(!response)return;response.classList.toggle("is-expert-response",expert);response.innerHTML=`${expert?`<div class="lifeline-expert-character"><img src="${esc(HAPPY_MASCOT)}" alt="Dr. Corazón"></div>`:""}<div class="lifeline-response-content"><div class="scientific-lifeline-response-head"><span class="scientific-lifeline-response-icon" aria-hidden="true">${esc(icon)}</span><h4>${esc(title)}</h4></div><p>${esc(message)}</p></div>`;response.hidden=false;response.scrollIntoView({behavior:"smooth",block:"nearest"});}
function expertHintFor(question){return question.expert_hint||question.expertHint||question.dr_corazon_hint||question.drCorazonHint||question.hint||"Focus on the central clinical decision. Identify the decisive clinical detail and compare each option with the relevant evidence or guideline principle.";}
function guidelineHintFor(question){return question.guideline_hint||question.guidelineHint||question.guideline_clue||question.guidelineClue||question.reference_text||question.referenceText||"Recall the main guideline recommendation, including its indication, threshold, timing, contraindication or treatment priority.";}
function lifelineDefinitions(){return[{id:LIFELINES.expert,icon:"",image:HAPPY_MASCOT,title:"Ask Dr. Corazón",shortTitle:"Dr. Corazón"},{id:LIFELINES.filter,icon:"✂️",image:"",title:"Evidence Filter",shortTitle:"Evidence Filter"},{id:LIFELINES.guideline,icon:"📘",image:"",title:"ESC Pocket Guideline",shortTitle:"ESC Guideline"},{id:LIFELINES.vault,icon:"🧠",image:"",title:"Knowledge Vault",shortTitle:"Knowledge Vault"}].filter(d=>enabledLifeline(d.id));}
function compactLifelineButtonHtml(question,definition){const used=lifelineIsUsed(question,definition.id),state=ensureLifelinesState(),usedOnQuestion=state.usedOnQuestion[definition.id],usageLabel=used?(usedOnQuestion?`Used on Question ${usedOnQuestion}`:"Already used in this attempt"):definition.title;return`<button type="button" class="compact-lifeline-button ${used?"is-used":""}" data-lifeline="${esc(definition.id)}" aria-label="${esc(usageLabel)}" title="${esc(usageLabel)}" ${used?"disabled":""}><span class="compact-lifeline-icon">${definition.image?`<img class="dr-corazon-lifeline-avatar" src="${esc(definition.image)}" alt="" aria-hidden="true">`:`<span aria-hidden="true">${esc(definition.icon)}</span>`}</span><span class="compact-lifeline-name">${esc(definition.shortTitle)}</span>${used?`<span class="compact-lifeline-used-copy">${usedOnQuestion?`Used on Q${usedOnQuestion}`:"Used"}</span><span class="compact-lifeline-used-mark" aria-hidden="true">✓</span>`:""}</button>`;}
function scientificLifelinesToolbarHtml(question,answer){if(!question||answer||reviewMode||!lifelinesEnabled())return"";const definitions=lifelineDefinitions(),usedCount=lifelineUsedCount(question),totalCount=enabledLifelineCount(),remainingCount=Math.max(totalCount-usedCount,0);if(!definitions.length)return"";return`<div class="question-topic-tools"><div class="compact-lifelines-toolbar" aria-label="Scientific Lifelines — The Expert Panel"><span class="compact-lifelines-label">Expert Panel</span><div class="compact-lifelines-buttons">${definitions.map(d=>compactLifelineButtonHtml(question,d)).join("")}</div><span class="compact-lifelines-counter ${remainingCount===0?"is-empty":""}">${remainingCount} remaining</span></div></div><div id="scientificLifelineResponse" class="scientific-lifeline-response compact" aria-live="polite" hidden></div>`;}
function explicitCorrectOptionIds(question){const direct=question.correct_option_ids||question.correctOptionIds||[];if(Array.isArray(direct)&&direct.length)return direct.map(String);return optionsFor(question).filter(o=>o.is_correct===true||o.correct===true).map(o=>String(o.id));}
async function secureCorrectOptionIds(question){const explicit=explicitCorrectOptionIds(question);if(explicit.length)return explicit;const allOptionIds=optionsFor(question).map(o=>String(o.id));const{data,error}=await supabaseClient.rpc("acl_check_learning_answer",{p_quiz_id:quiz.id,p_question_id:question.id,p_option_ids:allOptionIds});if(error)throw error;const correctIds=data?.correct_option_ids||data?.correctOptionIds||[];if(!Array.isArray(correctIds)||!correctIds.length)throw new Error("The Evidence Filter could not identify the incorrect options.");return correctIds.map(String);}
async function activateEvidenceFilter(question){const correctIds=await secureCorrectOptionIds(question),correctSet=new Set(correctIds),incorrectOptions=optionsFor(question).filter(o=>!correctSet.has(String(o.id))),removableCount=Math.min(2,Math.max(incorrectOptions.length-1,1)),removed=randomItems(incorrectOptions,removableCount).map(o=>String(o.id));setEliminatedOptions(question,removed);pendingSelectedIds=pendingSelectedIds.filter(id=>!removed.includes(String(id)));}
async function activateLifeline(question,lifeline){if(!question||!enabledLifeline(lifeline)||lifelineIsUsed(question,lifeline))return;const button=document.querySelector(`[data-lifeline="${lifeline}"]`);if(button){button.disabled=true;button.classList.add("is-loading");}try{let responseConfig=null,flashcardToOpen=null;if(lifeline===LIFELINES.filter){await activateEvidenceFilter(question);responseConfig={icon:"✂️",title:"Evidence Filter",message:"Two incorrect options have been removed. Reassess the remaining choices carefully."};}if(lifeline===LIFELINES.expert)responseConfig={icon:"🩺",title:"Dr. Corazón says",message:expertHintFor(question),expert:true};if(lifeline===LIFELINES.guideline)responseConfig={icon:"📘",title:"ESC Pocket Guideline",message:guidelineHintFor(question)};if(lifeline===LIFELINES.vault){flashcardToOpen=await loadFlashcard(question,null);if(!flashcardToOpen)throw new Error("A review flashcard has not yet been added for this question.");}markLifelineUsed(question,lifeline);render();if(responseConfig)showLifelineResponse(responseConfig);if(flashcardToOpen)openFlashcard(flashcardToOpen);await persist(false);}catch(error){console.error("LIFELINE ERROR:",error);showLifelineResponse({icon:"⚠️",title:"Lifeline unavailable",message:error.message||"This lifeline could not be used."});if(button){button.disabled=false;button.classList.remove("is-loading");}}}
function bindCompactLifelines(question){document.querySelectorAll(".compact-lifeline-button").forEach(button=>button.addEventListener("click",async()=>{const lifeline=button.dataset.lifeline;if(lifeline)await activateLifeline(question,lifeline);}));}
function applyEliminatedOptionStyles(question){if(!question)return;const eliminatedIds=new Set(eliminatedOptionsFor(question));document.querySelectorAll('.learning-option input[name="answer"]').forEach(input=>{const label=input.closest(".learning-option");if(!label)return;const eliminated=eliminatedIds.has(String(input.value));label.classList.toggle("is-eliminated",eliminated);if(eliminated){input.checked=false;input.disabled=true;}});}
function normaliseFlashcard(...sources){for(const source of sources){if(!source||typeof source!=="object")continue;const nested=source.flashcard&&typeof source.flashcard==="object"?source.flashcard:null,title=nested?.title||source.flashcard_title||source.flashcardTitle,rawType=nested?.type||source.flashcard_type||source.flashcardType||"FLASHCARD";let content=nested?.content||source.flashcard_content||source.flashcardContent;if(!content&&Array.isArray(nested?.sections))content=Object.fromEntries(nested.sections.map(s=>[s.heading||"Review",s.bullets||s.lines||[]]));if(title&&content)return{title,content,type:String(rawType).toUpperCase()==="TRIAL FLASHCARD"?"TRIAL FLASHCARD":"FLASHCARD"};}return null;}
async function loadFlashcard(question,rpcData){const embedded=normaliseFlashcard(rpcData,question);if(embedded)return embedded;try{const{data,error}=await supabaseClient.from("questions").select(`flashcard_title,flashcard_type,flashcard_content`).eq("id",question.id).maybeSingle();if(error)return null;return normaliseFlashcard(data);}catch{return null;}}
function flashcardSections(content){if(!content)return[];if(Array.isArray(content))return[{heading:"High-yield review",lines:content}];if(typeof content==="string")return[{heading:"High-yield review",lines:[content]}];if(typeof content==="object")return Object.entries(content).map(([heading,value])=>({heading,lines:Array.isArray(value)?value:[String(value||"")]}));return[];}
function openFlashcard(flashcard){if(!flashcard){window.alert("A flashcard has not yet been added for this question.");return;}const modal=$("learningFlashcardModal"),type=$("learningFlashcardType"),title=$("learningFlashcardTitle"),content=$("learningFlashcardContent");if(!modal||!type||!title||!content)return;type.textContent=flashcard.type||"FLASHCARD";type.classList.toggle("trial",flashcard.type==="TRIAL FLASHCARD");title.textContent=flashcard.title||"Topic review";const sections=flashcardSections(flashcard.content);content.innerHTML=sections.map(s=>`<section class="learning-flashcard-section"><h3>${esc(s.heading)}</h3><ul>${s.lines.filter(Boolean).map(line=>`<li>${esc(line)}</li>`).join("")}</ul></section>`).join("");modal.hidden=false;document.body.classList.add("learning-modal-open");}
function closeFlashcard(){const modal=$("learningFlashcardModal");if(modal)modal.hidden=true;document.body.classList.remove("learning-modal-open");}
function confidencePanelHtml(question,answer){if(answer||reviewMode||!confidenceEnabled()||!pendingSelectedIds.length)return"";return`<section class="learning-confidence-panel contextual-confidence-card"><div class="learning-confidence-heading"><span class="learning-confidence-icon" aria-hidden="true">🎯</span><h3>How confident are you?</h3></div><div class="learning-confidence-options compact-row"><button type="button" class="learning-confidence-button is-high compact-confidence-choice" data-confidence="high"><span class="learning-confidence-symbol">🔥</span><span class="confidence-choice-copy"><strong>Highly confident</strong></span></button><button type="button" class="learning-confidence-button is-low compact-confidence-choice" data-confidence="low"><span class="learning-confidence-symbol">🤔</span><span class="confidence-choice-copy"><strong>Low confidence</strong></span></button></div></section>`;}
function bindAnswerInputs(question){document.querySelectorAll('input[name="answer"]').forEach(input=>input.addEventListener("change",()=>{pendingSelectedIds=question.question_type==="multiple_response"?[...document.querySelectorAll('input[name="answer"]:checked')].map(x=>String(x.value)):input.checked?[String(input.value)]:[];render();}));}
function bindConfidenceButtons(){document.querySelectorAll("[data-confidence]").forEach(button=>button.addEventListener("click",async()=>{const confidence=button.dataset.confidence;document.querySelectorAll("[data-confidence]").forEach(x=>x.disabled=true);await submit(confidence);}));}
function feedbackHtml(answer){const correct=Boolean(answer.correct),points=Number(answer.points||0),mascot=correct?GOOD_JOB_MASCOT:SAD_MASCOT;return`<section class="learning-answer-feedback ${correct?"is-correct":"is-incorrect"}"><div class="dr-corazon-stage"><img class="dr-corazon-image" src="${esc(mascot)}" alt="Dr. Corazón"></div><div class="learning-feedback-copy"><span class="learning-feedback-kicker">${correct?"Correct answer":"Learning opportunity"}</span><h3>${correct?"Excellent — correct!":"Not quite — review this point"}</h3><span class="learning-feedback-score">${points>=0?"+":""}${points} points</span>${answer.explanation?`<div class="learning-explanation-card"><h3>Explanation</h3><p>${esc(answer.explanation)}</p></div>`:""}${answer.flashcard?`<button id="reviewCurrentFlashcard" type="button" class="review-flashcard-btn">Review the flashcard</button>`:""}</div></section>`;}
function bindFeedback(answer){$("reviewCurrentFlashcard")?.addEventListener("click",()=>openFlashcard(answer.flashcard));}
function preQuizReviewHtml(){const points=normalizedPreQuizReviewPoints();return`<section class="pre-quiz-review"><div class="pre-quiz-review-hero"><div class="pre-quiz-review-mascot-stage"><img class="pre-quiz-review-mascot" src="${esc(HAPPY_MASCOT)}" alt="Dr. Corazón"></div><div class="pre-quiz-review-heading"><span class="pre-quiz-review-kicker">Before you begin</span><h2>${esc(quiz.pre_quiz_review_title||"Dr. Corazón recommends reviewing these points")}</h2></div></div><div class="pre-quiz-review-points">${points.map((p,i)=>`<button type="button" class="pre-quiz-review-point pre-quiz-review-point-button" data-pre-quiz-review-point="${i}"><span class="pre-quiz-review-point-number">${i+1}</span><span class="pre-quiz-review-point-copy"><strong>${esc(p.summary)}</strong></span></button>`).join("")}</div><div class="pre-quiz-review-actions"><button id="startQuizAfterReview" class="primary-btn" type="button">✓ I’ve reviewed the points — start quiz</button><button id="skipPreQuizReview" class="secondary-btn" type="button">Take the quiz directly</button></div></section>`;}
function bindPreQuizReviewActions(){document.querySelectorAll("[data-pre-quiz-review-point]").forEach(b=>b.addEventListener("click",()=>openPreQuizReviewModal(b.dataset.preQuizReviewPoint)));$("startQuizAfterReview")?.addEventListener("click",proceedFromPreQuizReview);$("skipPreQuizReview")?.addEventListener("click",proceedFromPreQuizReview);}
function render(){document.body.classList.add("acl-expert-learning-mode");const quizArea=$("quizArea"),feedbackHost=$("answerFeedbackHost"),submitButton=$("submitAnswer"),nextButton=$("nextQuestion");if(shouldShowPreQuizReview()){quizArea.innerHTML=preQuizReviewHtml();if(feedbackHost)feedbackHost.innerHTML="";if(submitButton)submitButton.hidden=true;if(nextButton)nextButton.hidden=true;bindPreQuizReviewActions();return;}const question=currentQuestion();if(!question){void finish();return;}const answer=answerFor(question),multipleResponse=question.question_type==="multiple_response";if(answer)pendingSelectedIds=[];const progress=questions.length?Math.round((index+1)/questions.length*100):0;if($("progressFill"))$("progressFill").style.width=`${progress}%`;if($("questionCount"))$("questionCount").textContent=`Question ${index+1} of ${questions.length}`;const eliminatedIds=new Set(eliminatedOptionsFor(question));quizArea.innerHTML=`<article class="expert-question-layout"><div class="question-topic-row"><span class="learning-topic">${esc(question.topic||"Clinical question")}</span>${scientificLifelinesToolbarHtml(question,answer)}</div>${question.clinical_scenario?`<div class="clinical-scenario">${esc(question.clinical_scenario)}</div>`:""}<h2>${esc(question.stem)}</h2><div class="learning-options">${optionsFor(question).map(option=>{const id=String(option.id),selectedIds=answer?(answer.selectedIds||[]).map(String):pendingSelectedIds,correctIds=(answer?.correctOptionIds||[]).map(String),selected=selectedIds.includes(id),correct=correctIds.includes(id),incorrect=Boolean(answer&&!answer.correct&&selected),eliminated=!answer&&eliminatedIds.has(id),showConfidenceHere=!answer&&!reviewMode&&confidenceEnabled()&&pendingSelectedIds.length>0&&id===pendingSelectedIds.at(-1);return`<div class="learning-option-context-row ${showConfidenceHere?"has-confidence-card":""}"><label class="learning-option ${selected?"selected":""} ${correct?"correct is-correct":""} ${incorrect?"incorrect is-incorrect":""} ${eliminated?"is-eliminated":""}"><input type="${multipleResponse?"checkbox":"radio"}" name="answer" value="${esc(id)}" ${selected?"checked":""} ${answer||eliminated?"disabled":""}><span class="option-key">${esc(option.key)}</span><span>${esc(option.text)}</span></label>${showConfidenceHere?confidencePanelHtml(question,answer):""}</div>`;}).join("")}</div></article>`;if(feedbackHost)feedbackHost.innerHTML=answer?feedbackHtml(answer):"";if(submitButton){submitButton.hidden=Boolean(answer)||(confidenceEnabled()&&!reviewMode);submitButton.disabled=false;}if(nextButton){nextButton.hidden=!answer;nextButton.textContent=index===questions.length-1?"Submit and view results":"Next question";}if(answer)bindFeedback(answer);else{applyEliminatedOptionStyles(question);bindCompactLifelines(question);bindAnswerInputs(question);bindConfidenceButtons();}}
async function submit(confidence=null){const question=currentQuestion();if(!question)return;let selectedIds=pendingSelectedIds.length?[...pendingSelectedIds]:[...document.querySelectorAll('input[name="answer"]:checked')].map(x=>String(x.value));selectedIds=selectedIds.filter(id=>!eliminatedOptionsFor(question).includes(String(id)));if(!selectedIds.length)return;const normalizedConfidence=normalizeConfidence(confidence);if(confidenceEnabled()&&!normalizedConfidence)return;try{const{data,error}=await supabaseClient.rpc("acl_check_learning_answer",{p_quiz_id:quiz.id,p_question_id:question.id,p_option_ids:selectedIds});if(error)throw error;const correct=Boolean(data.correct??data.is_correct),points=confidencePoints({correct,confidence:normalizedConfidence}),flashcard=await loadFlashcard(question,data);setAnswer({questionId:question.id,selectedIds,correct,points,confidence:confidenceEnabled()?normalizedConfidence:null,confidenceEnabled:confidenceEnabled(),correctOptionIds:data.correct_option_ids||data.correctOptionIds||[],explanation:data.explanation||question.explanation||"",referenceText:data.reference_text||data.referenceText||"",referenceUrl:data.reference_url||data.referenceUrl||"",flashcard,answeredAt:new Date().toISOString()});pendingSelectedIds=[];await persist(false);render();}catch(error){console.error("ANSWER CHECK ERROR:",error);}}
function learningAnalytics(){const totalQuestions=answers.length,correctAnswers=answers.filter(a=>a.correct).length;return{totalQuestions,correctAnswers,incorrectAnswers:totalQuestions-correctAnswers,highConfidenceCorrect:answers.filter(a=>a.correct&&a.confidence==="high").length,highConfidenceIncorrect:answers.filter(a=>!a.correct&&a.confidence==="high").length,lowConfidenceCorrect:answers.filter(a=>a.correct&&a.confidence==="low").length,lowConfidenceIncorrect:answers.filter(a=>!a.correct&&a.confidence==="low").length,lifelinesUsed:[LIFELINES.expert,LIFELINES.filter,LIFELINES.guideline,LIFELINES.vault].filter(l=>Boolean(ensureLifelinesState()[l])).length};}
function clampPercentage(value){const n=Number(value);return Number.isFinite(n)?Math.min(100,Math.max(0,Math.round(n))):0;}
async function saveChallengeResult(){if(!activeChallengeParticipant)return;const score=appState().score,correctAnswers=answers.filter(a=>a.correct).length,startedAt=challengeStartedAt?new Date(challengeStartedAt).getTime():Date.now(),durationSeconds=Math.max(0,Math.round((Date.now()-startedAt)/1000));const{error}=await supabaseClient.from("module_challenge_participants").update({attempt_id:attempt?.id||null,invitation_status:"completed",completed_at:new Date().toISOString(),score,duration_seconds:durationSeconds,correct_answers:correctAnswers}).eq("id",activeChallengeParticipant.id);if(error)throw error;}
async function finish(){if(finishing)return;finishing=true;if(!reviewMode)await persist(true);if(challengeId&&activeChallenge&&activeChallengeParticipant&&!reviewMode)await saveChallengeResult();const analytics=learningAnalytics(),percentage=analytics.totalQuestions?Math.round(analytics.correctAnswers/analytics.totalQuestions*100):0,score=appState().score,maximum=maximumPossibleScore();$("quizArea").innerHTML=`<div class="learning-result premium"><div class="learning-result-hero"><div class="learning-result-summary"><span class="learning-result-kicker">Module completed</span><h2>${percentage>=90?"Expert performance":percentage>=75?"Strong performance":percentage>=60?"Developing mastery":"Review recommended"}</h2><div class="result-score">${score} / ${maximum} points · ${percentage}% correct</div></div><div class="learning-result-character"><img class="learning-result-mascot" src="${esc(percentage>=75?GOOD_JOB_MASCOT:HAPPY_MASCOT)}" alt="Dr. Corazón"></div></div><div class="result-performance-panels"><article class="result-performance-card is-correct"><strong>${analytics.correctAnswers}</strong> correct · ${analytics.highConfidenceCorrect} high-confidence correct</article><article class="result-performance-card is-incorrect"><strong>${analytics.incorrectAnswers}</strong> incorrect · ${analytics.highConfidenceIncorrect} high-confidence errors</article></div><div class="result-actions"><button id="retryAttempt" class="primary-btn" type="button">Start a new attempt</button><a class="secondary-btn" href="progress.html?edition=expert">View My Progress</a><a class="secondary-btn" href="modules.html?edition=expert">Back to modules</a></div></div>`;$("submitAnswer").hidden=true;$("nextQuestion").hidden=true;$("retryAttempt")?.addEventListener("click",startNewAttempt);finishing=false;}
async function startNewAttempt(){answers=[];index=0;reviewMode=false;finishing=false;pendingSelectedIds=[];preQuizReviewSeen=false;resetAllLifelines();await loadPreQuizReviewConfig();attempt=await createAttempt({moduleId:quiz.module_id,moduleTitle:quiz.module_title,quizId:quiz.id,quizTitle:quiz.title,mode:quiz.mode,questionIds:questions.map(q=>q.id),lifelines:lifelinesState});render();}
$("submitAnswer")?.addEventListener("click",async()=>await submit(null));$("nextQuestion")?.addEventListener("click",async()=>{pendingSelectedIds=[];if(index===questions.length-1){await finish();return;}index++;if(!reviewMode)await persist(false);render();focusLearningContent(".expert-question-layout");});$("closeLearningFlashcard")?.addEventListener("click",closeFlashcard);$("closeLearningFlashcardBottom")?.addEventListener("click",closeFlashcard);$("learningFlashcardBackdrop")?.addEventListener("click",closeFlashcard);
(async()=>{const profile=await protectAndRender("login.html");if(!profile)return;const quizArea=$("quizArea");if(!quizSlug){if(quizArea)quizArea.innerHTML="<p>No quiz was selected.</p>";return;}try{try{aclSettings=normalizeAclSettings(await getAclSettings());}catch{aclSettings=normalizeAclSettings(DEFAULT_ACL_SETTINGS);}const{data,error}=await supabaseClient.rpc("acl_get_learning_quiz",{p_quiz_slug:quizSlug,p_module_id:requestedModuleId||null});if(error)throw error;if(!data)throw new Error("Quiz data was not returned.");quiz=data;await loadPreQuizReviewConfig();if(challengeId)await loadActiveChallenge();if($("moduleTitle"))$("moduleTitle").textContent=quiz.module_title||"Learning module";if($("quizTitle"))$("quizTitle").textContent=quiz.title||"Learning quiz";if($("quizDescription"))$("quizDescription").textContent=quiz.description||"Immediate feedback, Scientific Lifelines, explanations and flashcards.";let pool=quiz.questions||[];if(quiz.randomize_questions||quiz.selection_mode==="random")pool=shuffle(pool);const requestedQuestionCount=isChallengeAttempt()&&challengeQuestionCount>0?challengeQuestionCount:Number(quiz.question_count||pool.length);questions=pool.slice(0,Math.min(requestedQuestionCount,pool.length));if(challengeId)applyChallengeQuestionSet();if(!questions.length)throw new Error("No questions are available in this quiz.");attempt=await getOpenAttempt(quiz.module_id,quiz.id);if(attempt){const questionMap=new Map(questions.map(q=>[String(q.id),q])),savedQuestionIds=attempt.question_ids||attempt.questionIds||[],restoredQuestions=savedQuestionIds.map(id=>questionMap.get(String(id))).filter(Boolean);if(restoredQuestions.length)questions=restoredQuestions;index=Number(attempt.current_question_index??attempt.currentIndex??0);if(index<0||index>=questions.length)index=0;answers=Array.isArray(attempt.answers)?attempt.answers:[];preQuizReviewSeen=Boolean(answers.length>0||index>0);restoreLifelinesState(attempt.lifelines||attempt.lifelines_state||attempt.lifelinesState||{});}else{resetAllLifelines();attempt=await createAttempt({moduleId:quiz.module_id,moduleTitle:quiz.module_title,quizId:quiz.id,quizTitle:quiz.title,mode:quiz.mode,questionIds:questions.map(q=>q.id),lifelines:lifelinesState});}render();}catch(error){console.error("LEARNING MODE ERROR:",error);setStatus(error.message||"Could not open learning mode",true);if(quizArea)quizArea.innerHTML=`<div class="empty-state">${esc(error.message||"Quiz unavailable")}</div>`;}})();