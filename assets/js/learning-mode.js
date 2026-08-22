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

  /*
   * Migrate old per-question saved attempts.
   * A lifeline is considered used for the whole quiz when it
   * had already been used on any question.
   */

  Object.entries(
    storedState
  ).forEach(
    (
      [
        questionId,
        questionState
      ]
    ) => {
      if (
        !questionState ||
        typeof questionState !==
          "object" ||
        Array.isArray(
          questionState
        )
      ) {
        return;
      }

      restored.expert =
        restored.expert ||
        Boolean(
          questionState.expert
        );

      restored.filter =
        restored.filter ||
        Boolean(
          questionState.filter
        );

      restored.guideline =
        restored.guideline ||
        Boolean(
          questionState.guideline
        );

      restored.vault =
        restored.vault ||
        Boolean(
          questionState.vault
        );

      if (
        Array.isArray(
          questionState
            .eliminatedOptionIds
        )
      ) {
        restored
          .eliminatedOptionIdsByQuestion[
            String(
              questionId
            )
          ] =
            questionState
              .eliminatedOptionIds
              .map(
                String
              );
      }
    }
  );

  lifelinesState =
    restored;
}


function resetAllLifelines() {
  lifelinesState =
    defaultQuizLifelines();
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
  message = "",
  expert =
    false
} = {}) {
  const response =
    lifelineResponseElement();

  if (!response) {
    return;
  }

   response.classList.toggle(
    "is-expert-response",
    expert
  );

  response.innerHTML = `
    ${
      expert
        ? `
          <div class="lifeline-expert-character">

            <img
              src="${esc(
                HAPPY_MASCOT
              )}"
              alt="Dr. Corazón"
            >

          </div>
        `
        : ""
    }

    <div class="lifeline-response-content">

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

    </div>
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
    const lifelineState =
    ensureLifelinesState();

  const usedOnQuestion =
    lifelineState
      .usedOnQuestion[
        definition.id
      ];

  const usageLabel =
    used
      ? (
          usedOnQuestion
            ? `Used on Question ${usedOnQuestion}`
            : "Already used in this attempt"
        )
      : definition.title;

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
        usageLabel
      )}"
      title="${esc(
        usageLabel
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
              class="compact-lifeline-used-copy"
            >
              ${
                usedOnQuestion
                  ? `Used on Q${usedOnQuestion}`
                  : "Used"
              }
            </span>

            <span
              class="compact-lifeline-used-mark"
              aria-hidden="true"
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
    const usedCount =
    lifelineUsedCount(
      question
    );

  const totalCount =
    enabledLifelineCount();

  const remainingCount =
    Math.max(
      totalCount -
      usedCount,
      0
    );

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

              <span
          class="
            compact-lifelines-counter
            ${
              remainingCount === 0
                ? "is-empty"
                : ""
            }
          "
        >
          ${remainingCount}
          remaining
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
    let responseConfig =
      null;

    let flashcardToOpen =
      null;

    if (
      lifeline ===
      LIFELINES.filter
    ) {
      await activateEvidenceFilter(
        question
      );

      responseConfig = {
        icon:
          "✂️",

        title:
          "Evidence Filter",

        message:
          "Two incorrect options have been removed. Reassess the remaining choices carefully."
      };
    }


    if (
      lifeline ===
      LIFELINES.expert
    ) {
            responseConfig = {
        icon:
          "🩺",

        title:
          "Dr. Corazón says",

        message:
          expertHintFor(
            question
          ),

        expert:
          true
      };
    }


    if (
      lifeline ===
      LIFELINES.guideline
    ) {
      responseConfig = {
        icon:
          "📘",

        title:
          "ESC Pocket Guideline",

        message:
          guidelineHintFor(
            question
          )
      };
    }


    if (
      lifeline ===
      LIFELINES.vault
    ) {
      flashcardToOpen =
        await loadFlashcard(
          question,
          null
        );

      if (!flashcardToOpen) {
        throw new Error(
          "A review flashcard has not yet been added for this question."
        );
      }
    }


    markLifelineUsed(
      question,
      lifeline
    );

    render();


    if (responseConfig) {
      showLifelineResponse(
        responseConfig
      );
    }


    if (flashcardToOpen) {
      openFlashcard(
        flashcardToOpen
      );
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

    if (button) {
      button.disabled =
        false;

      button.classList.remove(
        "is-loading"
      );
    }
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

  return `
    <section
      class="
        learning-confidence-panel
        contextual-confidence-card
      "
    >

      <div class="learning-confidence-heading">

        <span
          class="learning-confidence-icon"
          aria-hidden="true"
        >
          🎯
        </span>

        <h3>
          How confident are you?
        </h3>

      </div>

      <div
        class="
          learning-confidence-options
          compact-row
        "
      >

        <button
          type="button"
          class="
            learning-confidence-button
            is-high
            compact-confidence-choice
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
              Highly confident
            </strong>
          </span>

        </button>

        <button
          type="button"
          class="
            learning-confidence-button
            is-low
            compact-confidence-choice
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
          </span>

        </button>

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
function preQuizReviewHtml() {
  const points =
    normalizedPreQuizReviewPoints();

  return `
    <section class="pre-quiz-review">

      <div class="pre-quiz-review-hero">

        <div class="pre-quiz-review-mascot-stage">

          <div class="pre-quiz-review-mascot-glow"></div>

          <img
            class="pre-quiz-review-mascot"
            src="${esc(
              HAPPY_MASCOT
            )}"
            alt="Dr. Corazón"
          >

        </div>


        <div class="pre-quiz-review-heading">

          <span class="pre-quiz-review-kicker">
            Before you begin
          </span>

          <h2>
            ${esc(
              quiz.pre_quiz_review_title ||
              "Dr. Corazón recommends reviewing these points"
            )}
          </h2>

          <p>
            A quick high-yield briefing before starting the module.
            You may review it or proceed directly to the quiz.
          </p>

        </div>

      </div>


      <div class="pre-quiz-review-points">

        ${points
  .map(
    (
      point,
      pointIndex
    ) => `
      <button
        type="button"
        class="
          pre-quiz-review-point
          pre-quiz-review-point-button
          ${
            point.available
              ? "has-review-card"
              : "is-coming-soon"
          }
        "
        data-pre-quiz-review-point="${pointIndex}"
        aria-label="Open review card: ${esc(
          point.title
        )}"
      >

        <span
          class="pre-quiz-review-point-number"
          aria-hidden="true"
        >
          ${pointIndex + 1}
        </span>


        <span class="pre-quiz-review-point-copy">

          <strong>
            ${esc(
              point.summary
            )}
          </strong>

          <small>
            ${
              point.available
                ? "Open topic review"
                : "Review card coming soon"
            }
          </small>

        </span>


        <span
          class="pre-quiz-review-point-arrow"
          aria-hidden="true"
        >
          ›
        </span>

      </button>
    `
  )
  .join("")}
      </div>


      <div class="pre-quiz-review-actions">

        <button
          id="startQuizAfterReview"
          class="primary-btn pre-quiz-primary-action"
          type="button"
        >
          ✓ I’ve reviewed the points — start quiz
        </button>

        <button
          id="skipPreQuizReview"
          class="secondary-btn pre-quiz-skip-action"
          type="button"
        >
          No need for help — I can take the quiz directly
        </button>

      </div>

    </section>
  `;
}

function bindPreQuizReviewActions() {
  document
    .querySelectorAll(
      "[data-pre-quiz-review-point]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            openPreQuizReviewModal(
              button.dataset
                .preQuizReviewPoint
            );
          }
        );
      }
    );


  $("startQuizAfterReview")
    ?.addEventListener(
      "click",
      proceedFromPreQuizReview
    );


  $("skipPreQuizReview")
    ?.addEventListener(
      "click",
      proceedFromPreQuizReview
    );
}
function render() {
  document.body.classList.add(
    "acl-expert-learning-mode"
  );

  const quizArea =
    $("quizArea");

  const feedbackHost =
    $("answerFeedbackHost");

  const submitButton =
    $("submitAnswer");

  const nextButton =
    $("nextQuestion");

  if (
    shouldShowPreQuizReview()
  ) {
    if (quizArea) {
      quizArea.innerHTML =
        preQuizReviewHtml();
    }

    if (feedbackHost) {
      feedbackHost.innerHTML =
        "";
    }

    if (submitButton) {
      submitButton.hidden =
        true;
    }

    if (nextButton) {
      nextButton.hidden =
        true;
    }

    const progressFill =
      $("progressFill");

    const questionCount =
      $("questionCount");

    if (progressFill) {
      progressFill.style.width =
        "0%";
    }

    if (questionCount) {
      questionCount.textContent =
        "Pre-quiz briefing";
    }

    bindPreQuizReviewActions();

    return;
  }

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

  if (feedbackHost) {
    feedbackHost.innerHTML =
      answer
        ? feedbackHtml(
            answer
          )
        : "";
  }

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

    const isLastQuestion =
      index ===
      questions.length - 1;

    nextButton.textContent =
      isLastQuestion
        ? "Submit and view results"
        : "Next question";

    nextButton.classList.toggle(
      "is-final-question",
      isLastQuestion
    );
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

window.requestAnimationFrame(
  () => {
    const feedback =
      document.querySelector(
        ".learning-answer-feedback"
      );

    if (!feedback) {
      return;
    }

    feedback.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    feedback.classList.add(
      "is-revealing"
    );
  }
);
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

  const lifelineState =
  ensureLifelinesState();

const lifelinesUsed =
  [
    LIFELINES.expert,
    LIFELINES.filter,
    LIFELINES.guideline,
    LIFELINES.vault
  ].filter(
    (lifeline) =>
      Boolean(
        lifelineState[
          lifeline
        ]
      )
  ).length;
  
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
function resultLifelineHistoryHtml() {
  const state =
    ensureLifelinesState();

  const definitions =
    lifelineDefinitions();

  const usedCount =
    definitions.filter(
      (definition) =>
        Boolean(
          state[
            definition.id
          ]
        )
    ).length;

  const totalCount =
    definitions.length;

  const remainingCount =
    Math.max(
      totalCount -
      usedCount,
      0
    );

  return `
    <section class="result-expert-panel">

      <div class="result-expert-panel-summary">

        <div
          class="result-expert-panel-symbol"
          aria-hidden="true"
        >
          🛟
        </div>

        <div class="result-expert-panel-heading">

          <span>
            Expert Panel
          </span>

          <strong>
            ${usedCount}
            /
            ${totalCount}
            used
          </strong>

          <small>
            ${
              remainingCount === 0
                ? "No lifelines remaining"
                : `${remainingCount} ${
                    remainingCount === 1
                      ? "lifeline"
                      : "lifelines"
                  } remaining`
            }
          </small>

        </div>

      </div>


      <div class="result-lifeline-history">

        ${definitions
          .map(
            (definition) => {
              const used =
                Boolean(
                  state[
                    definition.id
                  ]
                );

              const questionNumber =
                state
                  .usedOnQuestion?.[
                    definition.id
                  ] ||
                null;

              return `
                <div
                  class="
                    result-lifeline-history-item
                    ${
                      used
                        ? "is-used"
                        : "is-unused"
                    }
                  "
                >

                  <div class="result-lifeline-history-icon">

                    ${
                      definition.image
                        ? `
                          <img
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

                  </div>


                  <div class="result-lifeline-history-copy">

                    <strong>
                      ${esc(
                        definition.title
                      )}
                    </strong>

                    <span>
                      ${
                        used
                          ? (
                              questionNumber
                                ? `Used on Question ${questionNumber}`
                                : "Used during this attempt"
                            )
                          : "Not used"
                      }
                    </span>

                  </div>


                  <span
                    class="
                      result-lifeline-history-status
                      ${
                        used
                          ? "is-used"
                          : "is-unused"
                      }
                    "
                    aria-label="${
                      used
                        ? "Used"
                        : "Not used"
                    }"
                  >
                    ${
                      used
                        ? "✓"
                        : "—"
                    }
                  </span>

                </div>
              `;
            }
          )
          .join("")}

      </div>

    </section>
  `;
}
function resultAnalyticsHtml(
  analytics
) {
  const correctPercentage =
    analytics.totalQuestions
      ? Math.round(
          (
            analytics.correctAnswers /
            analytics.totalQuestions
          ) *
          100
        )
      : 0;

  const incorrectPercentage =
    analytics.totalQuestions
      ? Math.round(
          (
            analytics.incorrectAnswers /
            analytics.totalQuestions
          ) *
          100
        )
      : 0;

  return `
    <section class="result-performance-panels">

      <article
        class="
          result-performance-card
          is-correct
        "
      >

        <div class="result-performance-header">

          <div
            class="result-performance-icon"
            aria-hidden="true"
          >
            ✓
          </div>

          <div class="result-performance-summary">

            <span class="result-performance-label">
              Correct Answers
            </span>

            <strong class="result-performance-total">
              ${analytics.correctAnswers}
            </strong>

            <small>
              of ${analytics.totalQuestions}
              questions
              ·
              ${correctPercentage}%
            </small>

          </div>

        </div>


        <div class="result-confidence-breakdown">

          <div class="result-confidence-card">

            <span
              class="result-confidence-symbol"
              aria-hidden="true"
            >
              🔥
            </span>

            <div>

              <span>
                High-confidence correct
              </span>

              <strong>
                ${analytics.highConfidenceCorrect}
              </strong>

            </div>

          </div>


          <div class="result-confidence-card">

            <span
              class="result-confidence-symbol"
              aria-hidden="true"
            >
              🤔
            </span>

            <div>

              <span>
                Low-confidence correct
              </span>

              <strong>
                ${analytics.lowConfidenceCorrect}
              </strong>

            </div>

          </div>

        </div>

      </article>


      <article
        class="
          result-performance-card
          is-incorrect
        "
      >

        <div class="result-performance-header">

          <div
            class="result-performance-icon"
            aria-hidden="true"
          >
            ×
          </div>

          <div class="result-performance-summary">

            <span class="result-performance-label">
              Incorrect Answers
            </span>

            <strong class="result-performance-total">
              ${analytics.incorrectAnswers}
            </strong>

            <small>
              of ${analytics.totalQuestions}
              questions
              ·
              ${incorrectPercentage}%
            </small>

          </div>

        </div>


        <div class="result-confidence-breakdown">

          <div class="result-confidence-card">

            <span
              class="result-confidence-symbol"
              aria-hidden="true"
            >
              🔥
            </span>

            <div>

              <span>
                High-confidence errors
              </span>

              <strong>
                ${analytics.highConfidenceIncorrect}
              </strong>

            </div>

          </div>


          <div class="result-confidence-card">

            <span
              class="result-confidence-symbol"
              aria-hidden="true"
            >
              🤔
            </span>

            <div>

              <span>
                Low-confidence incorrect
              </span>

              <strong>
                ${analytics.lowConfidenceIncorrect}
              </strong>

            </div>

          </div>

        </div>

      </article>

    </section>


    ${resultLifelineHistoryHtml()} 
    
    `;
}

function clinicalPerformanceHtml(
  percentage
) {
  const safePercentage =
    clampPercentage(
      percentage
    );

  const profile =
    performanceProfile(
      safePercentage
    );

  return `
    <section
      class="
        clinical-performance-panel
        ${esc(
          profile.className
        )}
      "
    >

      <div class="clinical-performance-heading">

        <span
          class="clinical-performance-heading-icon"
          aria-hidden="true"
        >
          🛡️
        </span>

        <div>

          <span>
            Clinical Performance
          </span>

          <strong>
            ${esc(
              profile.level
            )}
          </strong>

        </div>

      </div>


      <div class="clinical-performance-body">

        <div
          class="clinical-score-ring"
          style="
            --clinical-score:
            ${safePercentage};
          "
        >

          <div class="clinical-score-ring-inner">

            <strong>
              ${safePercentage}%
            </strong>

            <span>
              Score
            </span>

          </div>

        </div>


        <div class="clinical-performance-copy">

          <div class="clinical-performance-level">

            <span aria-hidden="true">
              ${esc(
                profile.icon
              )}
            </span>

            <strong>
              ${esc(
                profile.level
              )}
            </strong>

          </div>

          <p>
            ${esc(
              profile.message
            )}
          </p>


          <div class="clinical-performance-scale">

            <div
              class="
                clinical-performance-marker
                ${esc(
                  profile.className
                )}
              "
              style="
                left:
                ${safePercentage}%;
              "
            ></div>

            <div class="clinical-performance-scale-bar">

              <span class="is-review"></span>

              <span class="is-developing"></span>

              <span class="is-strong"></span>

              <span class="is-expert"></span>

            </div>

            <div class="clinical-performance-scale-labels">

              <span>
                &lt;60%
                <small>
                  Review
                </small>
              </span>

              <span>
                60–74%
                <small>
                  Developing
                </small>
              </span>

              <span>
                75–89%
                <small>
                  Strong
                </small>
              </span>

              <span>
                90–100%
                <small>
                  Expert
                </small>
              </span>

            </div>

          </div>

        </div>

      </div>

    </section>
  `;
}
function nextStepsHtml(
  analytics,
  percentage
) {
  const safePercentage =
    clampPercentage(
      percentage
    );

  const incorrectCount =
    analytics
      .incorrectAnswers;

  const overconfidentErrors =
    analytics
      .highConfidenceIncorrect;

  const uncertainCorrect =
    analytics
      .lowConfidenceCorrect;

  const profile =
    performanceProfile(
      safePercentage
    );

  return `
    <section class="result-next-steps">

      <div class="result-next-steps-heading">

        <span
          aria-hidden="true"
          class="result-next-steps-heading-icon"
        >
          🚀
        </span>

        <div>

          <h3>
            What’s next?
          </h3>

          <p>
            Personalized recommendations from this attempt
          </p>

        </div>

      </div>


      <div class="result-next-steps-grid">

        <button
          type="button"
          class="
            result-next-step-card
            is-review
          "
          data-result-action="review"
          ${
            incorrectCount === 0
              ? "disabled"
              : ""
          }
        >

          <span
            class="result-next-step-icon"
            aria-hidden="true"
          >
            🎯
          </span>

          <span class="result-next-step-copy">

            <strong>
              ${
                incorrectCount > 0
                  ? `Review ${incorrectCount} incorrect ${
                      incorrectCount === 1
                        ? "question"
                        : "questions"
                    }`
                  : "No incorrect questions"
              }
            </strong>

            <small>
              ${
                incorrectCount > 0
                  ? "Focus on the concepts you missed before retrying."
                  : "You answered every question correctly."
              }
            </small>

          </span>

          <span
            class="result-next-step-arrow"
            aria-hidden="true"
          >
            ›
          </span>

        </button>


        <button
          type="button"
          class="
            result-next-step-card
            is-flashcard
          "
          data-result-action="review"
        >

          <span
            class="result-next-step-icon"
            aria-hidden="true"
          >
            📚
          </span>

          <span class="result-next-step-copy">

            <strong>
              Study related flashcards
            </strong>

            <small>
              Review the high-yield notes linked to your answered questions.
            </small>

          </span>

          <span
            class="result-next-step-arrow"
            aria-hidden="true"
          >
            ›
          </span>

        </button>


        <button
          type="button"
          class="
            result-next-step-card
            is-confidence
          "
          data-result-action="review"
          ${
            overconfidentErrors === 0 &&
            uncertainCorrect === 0
              ? "disabled"
              : ""
          }
        >

          <span
            class="result-next-step-icon"
            aria-hidden="true"
          >
            🔥
          </span>

          <span class="result-next-step-copy">

            <strong>
              ${
                overconfidentErrors > 0
                  ? `Review ${overconfidentErrors} overconfident ${
                      overconfidentErrors === 1
                        ? "error"
                        : "errors"
                    }`
                  : uncertainCorrect > 0
                    ? "Build confidence in correct reasoning"
                    : "Confidence well aligned"
              }
            </strong>

            <small>
              ${
                overconfidentErrors > 0
                  ? "These mistakes deserve priority review."
                  : uncertainCorrect > 0
                    ? `You had ${uncertainCorrect} correct ${
                        uncertainCorrect === 1
                          ? "answer"
                          : "answers"
                      } with low confidence.`
                    : "Your confidence matched your answers well."
              }
            </small>

          </span>

          <span
            class="result-next-step-arrow"
            aria-hidden="true"
          >
            ›
          </span>

        </button>


        <button
          type="button"
          class="
            result-next-step-card
            is-retry
          "
          data-result-action="retry"
        >

          <span
            class="result-next-step-icon"
            aria-hidden="true"
          >
            🏆
          </span>

          <span class="result-next-step-copy">

            <strong>
              Retry the quiz
            </strong>

            <small>
              ${
                safePercentage >= 90
                  ? "Maintain your Expert performance."
                  : `Current level: ${esc(
                      profile.level
                    )}. Aim for Expert performance above 90%.`
              }
            </small>

          </span>

          <span
            class="result-next-step-arrow"
            aria-hidden="true"
          >
            ›
          </span>

        </button>

      </div>

    </section>
  `;
}

function clampPercentage(
  value
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        number
      )
    )
  );
}


function performanceProfile(
  percentage
) {
  const safePercentage =
    clampPercentage(
      percentage
    );

  if (
    safePercentage >= 90
  ) {
    return {
      level:
        "Expert",

      className:
        "is-expert",

      icon:
        "🏆",

      message:
        "Excellent mastery. Your knowledge and confidence are strongly aligned."
    };
  }

  if (
    safePercentage >= 75
  ) {
    return {
      level:
        "Strong",

      className:
        "is-strong",

      icon:
        "⭐",

      message:
        "Strong clinical understanding with only a few areas requiring reinforcement."
    };
  }

  if (
    safePercentage >= 60
  ) {
    return {
      level:
        "Developing",

      className:
        "is-developing",

      icon:
        "📈",

      message:
        "Good progress. Review incorrect and uncertain answers to strengthen mastery."
    };
  }

  return {
    level:
      "Needs Review",

    className:
      "is-review",

    icon:
      "📚",

    message:
      "Focused review is recommended before repeating the module."
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
async function saveChallengeResult() {
  if (
    !activeChallengeParticipant
  ) {
    return;
  }

  const score =
    appState().score;

  const correctAnswers =
    answers.filter(
      (answer) =>
        answer.correct
    ).length;

  const startedAt =
    challengeStartedAt
      ? new Date(
          challengeStartedAt
        ).getTime()
      : Date.now();

  const durationSeconds =
    Math.max(
      0,
      Math.round(
        (
          Date.now() -
          startedAt
        ) /
        1000
      )
    );

  const {
    error
  } =
    await supabaseClient
      .from(
        "module_challenge_participants"
      )
      .update({
        attempt_id:
          attempt?.id ||
          null,

        invitation_status:
          "completed",

        completed_at:
          new Date()
            .toISOString(),

        score,

        duration_seconds:
          durationSeconds,

        correct_answers:
          correctAnswers
      })
      .eq(
        "id",
        activeChallengeParticipant.id
      );

  if (error) {
    throw error;
  }

  activeChallengeParticipant =
    {
      ...activeChallengeParticipant,

      invitation_status:
        "completed",

      score,

      duration_seconds:
        durationSeconds,

      correct_answers:
        correctAnswers
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
if (
  challengeId &&
  activeChallenge &&
  activeChallengeParticipant &&
  !reviewMode &&
  activeChallengeParticipant
    .invitation_status !==
      "completed"
) {
  await saveChallengeResult();
}
  const score =
    appState().score;

  const maximum =
    maximumPossibleScore();

    const rawPercentage =
    maximum
      ? (
          score /
          maximum
        ) *
        100
      : 0;

  const percentage =
    clampPercentage(
      rawPercentage
    );

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

       ${resultAnalyticsHtml(
      analytics
    )}

    ${clinicalPerformanceHtml(
      percentage
    )}

    ${nextStepsHtml(
      analytics,
      percentage
    )}

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

     ${
  challengeId
    ? `
      <a
        class="primary-btn"
        href="challenge.html?code=${esc(
          activeChallenge
            ?.challenge_code ||
          ""
        )}"
      >
        View challenge
      </a>
    `
    : `
      <button
        id="retryAttempt"
        class="primary-btn"
        type="button"
      >
        Start a new attempt
      </button>
    `
}

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


  document
    .querySelectorAll(
      '[data-result-action="review"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
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
      }
    );


  document
    .querySelectorAll(
      '[data-result-action="retry"]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          startNewAttempt
        );
      }
    );


   finishing =
    false;

  window.requestAnimationFrame(
    () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

      quizArea
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }
  );
}


/* =========================================================
   NEW ATTEMPT
========================================================= */

  async function startNewAttempt() {
    try {
      setStatus(
        "Preparing new attempt…"
      );
  
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
  
      preQuizReviewSeen =
        false;
  
      resetAllLifelines();
  
      /*
       * Reload the briefing configuration so that every
       * completely new attempt begins with Dr. Corazón's
       * optional review screen.
       */
  
      await loadPreQuizReviewConfig();
  
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
  
      /*
       * Keep this false after creating the cloud attempt.
       * The candidate has not yet passed the briefing screen.
       */
  
      preQuizReviewSeen =
        false;
  
      setStatus(
        "New learning attempt saved"
      );
  
      render();
  
      window.requestAnimationFrame(
        () => {
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
  
          $("quizArea")
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
        }
      );
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

      const isLastQuestion =
        index ===
        questions.length - 1;

      if (
        isLastQuestion &&
        !reviewMode
      ) {
        await finish();

        return;
      }

      /*
       * During normal quiz mode, move to the next question.
       * During review mode, allow navigation until the final
       * reviewed question.
       */

      if (
        isLastQuestion &&
        reviewMode
      ) {
        await finish();

        return;
      }

      index +=
        1;

      if (!reviewMode) {
        await persist(
          false
        );
      }

      render();

      focusLearningContent(
        ".expert-question-layout"
      );
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
      closePreQuizReviewModal();
    }
  }
);



function learningWithTimeout(promise, ms, label) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error(`${label} timed out. Please retry.`)),
      ms
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

/* =========================================================
   INITIALISATION
========================================================= */

(async () => {
  const quizArea =
    $("quizArea");

  setStatus("Restoring session…");

  let profile = null;

  try {
    profile =
      await learningWithTimeout(
        protectAndRender("login.html"),
        9000,
        "Account restoration"
      );
  } catch (authError) {
    console.error("LEARNING AUTH ERROR:", authError);

    setStatus(
      authError.message || "Could not restore your account",
      true
    );

    if (quizArea) {
      quizArea.innerHTML = `
        <div class="empty-state">
          ${esc(authError.message || "Could not restore your account")}
          <br>
          <button
            type="button"
            class="primary-btn"
            onclick="location.reload()"
            style="margin-top:12px"
          >
            Retry
          </button>
        </div>
      `;
    }

    return;
  }

  if (!profile) {
    return;
  }

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
          await learningWithTimeout(
            getAclSettings(),
            7000,
            "Settings loading"
          )
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
      await learningWithTimeout(
        supabaseClient.rpc(
          "acl_get_learning_quiz",
          {
            p_quiz_slug:
              quizSlug,

            p_module_id:
              requestedModuleId ||
              null
          }
        ),
        15000,
        "Quiz loading"
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

await loadPreQuizReviewConfig();

if (challengeId) {
  await loadActiveChallenge();
}
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

   /*
 * Determine how many questions should be loaded.
 *
 * Normal attempt:
 * Use quiz.question_count.
 *
 * Challenge attempt:
 * Use the number received in the challenge URL.
 */

const requestedQuestionCount =
  isChallengeAttempt() &&
  challengeQuestionCount > 0
    ? challengeQuestionCount
    : Number(
        quiz.question_count ||
        pool.length
      );


questions =
  pool.slice(
    0,
    Math.min(
      requestedQuestionCount,
      pool.length
    )
  );


/*
 * When the challenge already contains fixed question IDs,
 * replace the randomized selection with those exact questions.
 */

if (challengeId) {
  applyChallengeQuestionSet();
}
    
    if (!questions.length) {
      throw new Error(
        "No questions are available in this quiz."
      );
    }

    attempt =
      await learningWithTimeout(
        getOpenAttempt(
          quiz.module_id,
          quiz.id
        ),
        9000,
        "Attempt restoration"
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
           preQuizReviewSeen =
  Boolean(
    attempt.preQuizReviewSeen ??
    attempt.pre_quiz_review_seen ??
    attempt.state
      ?.preQuizReviewSeen ??
    attempt.app_state
      ?.preQuizReviewSeen ??
    (
      answers.length > 0 ||
      index > 0
    )
  );
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
        await learningWithTimeout(
          createAttempt({
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
          }),
          9000,
          "Attempt creation"
        );

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
