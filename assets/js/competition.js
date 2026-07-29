import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL COMPETITION ENGINE v3.0.0 LOADED"
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


let profile =
  null;


let competition =
  null;


let questions =
  [];


let currentQuestionIndex =
  0;


let attempt =
  null;


let answers =
  {};


let timerInterval =
  null;


let isSubmitting =
  false;


let antiCheatActive =
  false;


let visibilityEventLocked =
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


function shuffle(
  items
) {
  const result =
    [
      ...items
    ];


  for (
    let index =
      result.length -
      1;
    index >
      0;
    index -=
      1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
        (
          index +
          1
        )
      );


    [
      result[
        index
      ],
      result[
        randomIndex
      ]
    ] = [
      result[
        randomIndex
      ],
      result[
        index
      ]
    ];
  }


  return result;
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


function formatTimer(
  seconds
) {
  const safeSeconds =
    Math.max(
      0,
      Math.floor(
        numberValue(
          seconds
        )
      )
    );


  const hours =
    Math.floor(
      safeSeconds /
      3600
    );


  const minutes =
    Math.floor(
      (
        safeSeconds %
        3600
      ) /
      60
    );


  const remainingSeconds =
    safeSeconds %
    60;


  if (hours > 0) {
    return [
      hours,
      String(
        minutes
      ).padStart(
        2,
        "0"
      ),
      String(
        remainingSeconds
      ).padStart(
        2,
        "0"
      )
    ].join(
      ":"
    );
  }


  return [
    minutes,
    String(
      remainingSeconds
    ).padStart(
      2,
      "0"
    )
  ].join(
    ":"
  );
}


function competitionIdFromUrl() {
  return new URLSearchParams(
    window.location.search
  ).get(
    "id"
  );
}


function leaderboardUrl() {
  return aclUrl(
    `competition-dashboard.html?id=${encodeURIComponent(
      competition.id
    )}`,
    selectedEdition
  );
}


function selectedAnswerIds() {
  return [
    ...document.querySelectorAll(
      'input[name="answer"]:checked'
    )
  ].map(
    (input) =>
      input.value
  );
}


function selectedConfidence() {
  return (
    document.querySelector(
      'input[name="confidence"]:checked'
    )?.value ||
    null
  );
}


function answeredQuestionCount() {
  return Object.values(
    answers
  ).filter(
    (answer) =>
      Array.isArray(
        answer?.selected
      ) &&
      answer.selected.length >
        0
  ).length;
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
      "competitionEditionBadge"
    );


  const themeColor =
    byId(
      "competitionThemeColor"
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
   LOAD COMPETITION
========================================================= */

async function loadCompetition() {
  const competitionId =
    competitionIdFromUrl();


  if (!competitionId) {
    throw new Error(
      "Competition ID is missing from the page URL."
    );
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
      .eq(
        "id",
        competitionId
      )
      .single();


  if (error) {
    throw error;
  }


  if (!data) {
    throw new Error(
      "Competition not found."
    );
  }


  competition =
    data;


  const currentTime =
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
    competition.status !==
    "published"
  ) {
    throw new Error(
      "This competition is not currently published."
    );
  }


  if (
    Number.isFinite(
      opensAt
    ) &&
    currentTime <
      opensAt
  ) {
    throw new Error(
      "This competition has not opened yet."
    );
  }


  if (
    Number.isFinite(
      closesAt
    ) &&
    currentTime >
      closesAt
  ) {
    window.location.replace(
      leaderboardUrl()
    );


    return false;
  }


  byId(
    "competitionTitle"
  ).textContent =
    competition.title ||
    "ACL Competition";


  byId(
    "competitionDescription"
  ).textContent =
    competition.description ||
    "Official Alexandria Cardiology League competition.";


  document.title =
    `${competition.title || "ACL Competition"} | ACL`;


  return true;
}


/* =========================================================
   ATTEMPT
========================================================= */

async function loadOrCreateAttempt() {
  const {
    data: existingAttempts,
    error: existingError
  } =
    await supabaseClient
      .from(
        "competition_attempts"
      )
      .select(
        "*"
      )
      .eq(
        "competition_id",
        competition.id
      )
      .eq(
        "user_id",
        profile.id
      )
      .order(
        "started_at",
        {
          ascending:
            false
        }
      )
      .limit(
        1
      );


  if (existingError) {
    throw existingError;
  }


  const existingAttempt =
    existingAttempts?.[
      0
    ] ||
    null;


  if (
    existingAttempt?.status ===
    "submitted" ||
    existingAttempt?.status ===
    "terminated"
  ) {
    window.location.replace(
      leaderboardUrl()
    );


    return false;
  }


  if (existingAttempt) {
    attempt =
      existingAttempt;


    if (
      Date.now() >=
      new Date(
        attempt.expires_at
      ).getTime()
    ) {
      await submitCompetition({
        force:
          true,

        skipConfirmation:
          true
      });


      return false;
    }


    return true;
  }


  const competitionCloseTime =
    new Date(
      competition.closes_at
    ).getTime();


  const durationEndTime =
    Date.now() +
    numberValue(
      competition.duration_seconds,
      1200
    ) *
    1000;


  const expiresAt =
    new Date(
      Math.min(
        durationEndTime,
        competitionCloseTime
      )
    ).toISOString();


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "competition_attempts"
      )
      .insert({
        competition_id:
          competition.id,

        user_id:
          profile.id,

        expires_at:
          expiresAt
      })
      .select()
      .single();


  if (error) {
    throw error;
  }


  attempt =
    data;


  return true;
}


/* =========================================================
   QUESTIONS
========================================================= */

async function loadQuestions() {
  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "quiz_questions"
      )
      .select(`
        display_order,
        questions (
          id,
          stem,
          scenario,
          question_type,
          option_randomization,
          question_options (
            id,
            option_text,
            display_order
          )
        )
      `)
      .eq(
        "quiz_id",
        competition.quiz_id
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
    (
      data ||
      []
    )
      .map(
        (row) =>
          row.questions
      )
      .filter(
        Boolean
      );


  if (
    competition.randomize_questions
  ) {
    questions =
      shuffle(
        questions
      );
  }


  if (!questions.length) {
    throw new Error(
      "No questions are assigned to this competition."
    );
  }
}


/* =========================================================
   RESTORE SAVED ANSWERS
========================================================= */

async function loadSavedAnswers() {
  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "competition_answers"
      )
      .select(`
        question_id,
        selected_option_ids,
        confidence
      `)
      .eq(
        "attempt_id",
        attempt.id
      );


  if (error) {
    throw error;
  }


  answers =
    {};


  for (
    const row of
    data ||
    []
  ) {
    answers[
      row.question_id
    ] = {
      selected:
        Array.isArray(
          row.selected_option_ids
        )
          ? row.selected_option_ids
          : [],

      confidence:
        row.confidence ||
        null
    };
  }
}


/* =========================================================
   SAVE CURRENT ANSWER LOCALLY
========================================================= */

function saveCurrentAnswerLocally() {
  const question =
    questions[
      currentQuestionIndex
    ];


  if (!question) {
    return;
  }


  answers[
    question.id
  ] = {
    selected:
      selectedAnswerIds(),

    confidence:
      selectedConfidence()
  };


  updateProgress();
}


/* =========================================================
   RENDER QUESTION
========================================================= */

function renderQuestion() {
  const question =
    questions[
      currentQuestionIndex
    ];


  if (!question) {
    return;
  }


  let options =
    [
      ...(
        question.question_options ||
        []
      )
    ].sort(
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
    );


  if (
    competition.randomize_options ||
    question.option_randomization
  ) {
    options =
      shuffle(
        options
      );
  }


  const savedAnswer =
    answers[
      question.id
    ] ||
    {
      selected:
        [],

      confidence:
        null
    };


  const inputType =
    question.question_type ===
    "multiple_response"
      ? "checkbox"
      : "radio";


  byId(
    "questionArea"
  ).innerHTML = `
    <p class="question-position">
      Question ${
        currentQuestionIndex +
        1
      } of ${questions.length}
    </p>


    ${
      question.scenario
        ? `
          <div class="scenario-box">
            ${escapeHtml(
              question.scenario
            )}
          </div>
        `
        : ""
    }


    <h2 class="competition-question-title">
      ${escapeHtml(
        question.stem ||
        "Question"
      )}
    </h2>


    <div class="answer-list">

      ${options
        .map(
          (
            option,
            optionIndex
          ) => `
            <label class="answer-option">

              <input
                type="${inputType}"
                name="answer"
                value="${escapeHtml(
                  option.id
                )}"
                ${
                  savedAnswer.selected.includes(
                    option.id
                  )
                    ? "checked"
                    : ""
                }
              >


              <span class="option-key">
                ${String.fromCharCode(
                  65 +
                  optionIndex
                )}
              </span>


              <span class="answer-option-text">
                ${escapeHtml(
                  option.option_text
                )}
              </span>

            </label>
          `
        )
        .join(
          ""
        )}

    </div>


    ${
      competition.confidence_scoring
        ? `
          <div class="confidence-box">

            <strong>
              How confident are you in this answer?
            </strong>


            <div class="confidence-options">

              <label class="confidence-option">

                <input
                  type="radio"
                  name="confidence"
                  value="low"
                  ${
                    savedAnswer.confidence ===
                    "low"
                      ? "checked"
                      : ""
                  }
                >

                Low confidence

              </label>


              <label class="confidence-option">

                <input
                  type="radio"
                  name="confidence"
                  value="high"
                  ${
                    savedAnswer.confidence ===
                    "high"
                      ? "checked"
                      : ""
                  }
                >

                High confidence

              </label>

            </div>

          </div>
        `
        : ""
    }
  `;


  byId(
    "previous"
  ).disabled =
    currentQuestionIndex ===
    0;


  byId(
    "next"
  ).hidden =
    currentQuestionIndex ===
    questions.length -
    1;


  byId(
    "submit"
  ).hidden =
    currentQuestionIndex !==
    questions.length -
    1;


  updateProgress();
}


/* =========================================================
   PROGRESS
========================================================= */

function updateProgress() {
  const current =
    currentQuestionIndex +
    1;


  const answered =
    answeredQuestionCount();


  const percentage =
    questions.length
      ? Math.round(
          (
            current /
            questions.length
          ) *
          100
        )
      : 0;


  byId(
    "competitionQuestionSummary"
  ).textContent =
    `Question ${current} of ${questions.length}`;


  byId(
    "competitionAnsweredSummary"
  ).textContent =
    `${answered} answered`;


  byId(
    "competitionProgressFill"
  ).style.width =
    `${percentage}%`;
}


/* =========================================================
   ANSWER VALIDATION
========================================================= */

function validateCurrentQuestion() {
  const question =
    questions[
      currentQuestionIndex
    ];


  const answer =
    answers[
      question.id
    ];


  if (
    competition.confidence_scoring &&
    answer?.selected?.length &&
    !answer.confidence
  ) {
    throw new Error(
      "Choose your confidence level before continuing."
    );
  }


  return true;
}


/* =========================================================
   NAVIGATION
========================================================= */

function goToPreviousQuestion() {
  saveCurrentAnswerLocally();


  if (
    currentQuestionIndex >
    0
  ) {
    currentQuestionIndex -=
      1;


    renderQuestion();
  }
}


function goToNextQuestion() {
  try {
    saveCurrentAnswerLocally();
    validateCurrentQuestion();


    if (
      currentQuestionIndex <
      questions.length -
      1
    ) {
      currentQuestionIndex +=
        1;


      renderQuestion();


      setStatus(
        ""
      );
    }
  } catch (error) {
    setStatus(
      error.message,
      "warning"
    );
  }
}


/* =========================================================
   SCORE
========================================================= */

async function calculateAndSaveAnswers() {
  let totalScore =
    0;


  let correctCount =
    0;


  let answeredCount =
    0;


  for (
    const question of
    questions
  ) {
    const answer =
      answers[
        question.id
      ] ||
      {
        selected:
          [],

        confidence:
          null
      };


    if (
      answer.selected.length
    ) {
      answeredCount +=
        1;
    }


    const {
      data,
      error
    } =
      await supabaseClient.rpc(
        "acl_check_question_answer",
        {
          p_question_id:
            question.id,

          p_selected_option_ids:
            answer.selected
        }
      );


    if (error) {
      throw error;
    }


    const isCorrect =
      Boolean(
        data
      );


    let points =
      0;


    if (isCorrect) {
      points =
        competition.confidence_scoring
          ? answer.confidence ===
            "high"
            ? 2
            : 1
          : 1;
    } else if (
      !answer.selected.length
    ) {
      points =
        -1;
    } else if (
      competition.confidence_scoring &&
      answer.confidence ===
      "high"
    ) {
      points =
        -1;
    }


    totalScore +=
      points;


    if (isCorrect) {
      correctCount +=
        1;
    }


    const {
      error: answerSaveError
    } =
      await supabaseClient
        .from(
          "competition_answers"
        )
        .upsert({
          attempt_id:
            attempt.id,

          question_id:
            question.id,

          selected_option_ids:
            answer.selected,

          confidence:
            answer.confidence,

          is_correct:
            isCorrect,

          points_awarded:
            points
        }, {
          onConflict:
            "attempt_id,question_id"
        });


    if (answerSaveError) {
      throw answerSaveError;
    }
  }


  return {
    totalScore,
    correctCount,
    answeredCount
  };
}


/* =========================================================
   SUBMIT
========================================================= */

async function submitCompetition({
  force = false,
  skipConfirmation = false
} = {}) {
  if (
    isSubmitting ||
    !attempt ||
    !competition
  ) {
    return;
  }


  saveCurrentAnswerLocally();


  if (
    !force &&
    competition.confidence_scoring
  ) {
    const answeredWithoutConfidence =
      questions.some(
        (question) => {
          const answer =
            answers[
              question.id
            ];


          return (
            answer?.selected?.length &&
            !answer.confidence
          );
        }
      );


    if (answeredWithoutConfidence) {
      setStatus(
        "Every answered question must have a confidence level.",
        "warning"
      );


      return;
    }
  }


  if (
    !skipConfirmation &&
    !window.confirm(
      "Submit your official competition attempt? You cannot change it afterwards."
    )
  ) {
    return;
  }


  isSubmitting =
    true;


  setButtonBusy(
    byId(
      "submit"
    ),
    true,
    "Submitting…",
    "Submit Competition"
  );


  byId(
    "previous"
  ).disabled =
    true;


  byId(
    "next"
  ).disabled =
    true;


  setStatus(
    force
      ? "Time is over. Submitting your attempt…"
      : "Submitting your competition attempt…"
  );


  if (timerInterval) {
    window.clearInterval(
      timerInterval
    );


    timerInterval =
      null;
  }


  try {
    const {
      totalScore,
      correctCount,
      answeredCount
    } =
      await calculateAndSaveAnswers();


    const durationSeconds =
      Math.max(
        0,
        Math.round(
          (
            Date.now() -
            new Date(
              attempt.started_at
            ).getTime()
          ) /
          1000
        )
      );


    const accuracy =
      questions.length
        ? (
            correctCount /
            questions.length
          ) *
          100
        : 0;


    const {
      error
    } =
      await supabaseClient
        .from(
          "competition_attempts"
        )
        .update({
          status:
            "submitted",

          submitted_at:
            new Date().toISOString(),

          score:
            totalScore,

          correct_count:
            correctCount,

          answered_count:
            answeredCount,

          accuracy,

          duration_seconds:
            durationSeconds
        })
        .eq(
          "id",
          attempt.id
        );


    if (error) {
      throw error;
    }


    antiCheatActive =
      false;


    window.location.replace(
      leaderboardUrl()
    );
  } catch (error) {
    console.error(
      "COMPETITION SUBMISSION ERROR:",
      error
    );


    isSubmitting =
      false;


    setButtonBusy(
      byId(
        "submit"
      ),
      false,
      "Submitting…",
      "Submit Competition"
    );


    byId(
      "previous"
    ).disabled =
      currentQuestionIndex ===
      0;


    byId(
      "next"
    ).disabled =
      false;


    setStatus(
      error.message ||
      "The competition could not be submitted.",
      "error"
    );


    startTimer();
  }
}


/* =========================================================
   TIMER
========================================================= */

function updateTimer() {
  if (
    !attempt ||
    isSubmitting
  ) {
    return;
  }


  const secondsLeft =
    Math.max(
      0,
      Math.floor(
        (
          new Date(
            attempt.expires_at
          ).getTime() -
          Date.now()
        ) /
        1000
      )
    );


  const timer =
    byId(
      "timer"
    );


  timer.textContent =
    formatTimer(
      secondsLeft
    );


  timer.classList.toggle(
    "warning",
    secondsLeft <=
      60
  );


  if (
    secondsLeft <=
    0
  ) {
    if (timerInterval) {
      window.clearInterval(
        timerInterval
      );


      timerInterval =
        null;
    }


    void submitCompetition({
      force:
        true,

      skipConfirmation:
        true
    });
  }
}


function startTimer() {
  if (timerInterval) {
    window.clearInterval(
      timerInterval
    );
  }


  updateTimer();


  timerInterval =
    window.setInterval(
      updateTimer,
      1000
    );
}


/* =========================================================
   ANTI-CHEAT
========================================================= */

async function recordVisibilityViolation() {
  if (
    visibilityEventLocked ||
    isSubmitting ||
    !antiCheatActive
  ) {
    return;
  }


  visibilityEventLocked =
    true;


  try {
    attempt.warning_count =
      numberValue(
        attempt.warning_count
      ) +
      1;


    const eventResult =
      await supabaseClient
        .from(
          "competition_events"
        )
        .insert({
          attempt_id:
            attempt.id,

          user_id:
            profile.id,

          event_type:
            "visibility_hidden"
        });


    if (eventResult.error) {
      console.warn(
        "COMPETITION EVENT ERROR:",
        eventResult.error
      );
    }


    const {
      error
    } =
      await supabaseClient
        .from(
          "competition_attempts"
        )
        .update({
          warning_count:
            attempt.warning_count
        })
        .eq(
          "id",
          attempt.id
        );


    if (error) {
      console.warn(
        "WARNING COUNT UPDATE ERROR:",
        error
      );
    }


    const allowedWarnings =
      numberValue(
        competition.warnings_allowed,
        2
      );


    if (
      attempt.warning_count >
      allowedWarnings
    ) {
      antiCheatActive =
        false;


      await supabaseClient
        .from(
          "competition_attempts"
        )
        .update({
          status:
            "terminated",

          submitted_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          attempt.id
        );


      window.alert(
        "Your competition attempt has been terminated because the allowed anti-cheat warnings were exceeded."
      );


      window.location.replace(
        leaderboardUrl()
      );


      return;
    }


    window.alert(
      `Anti-cheat warning ${attempt.warning_count} of ${allowedWarnings}. Leaving the competition page again may terminate your attempt.`
    );
  } finally {
    window.setTimeout(
      () => {
        visibilityEventLocked =
          false;
      },
      800
    );
  }
}


function enableAntiCheat() {
  if (
    !competition.anti_cheat_enabled
  ) {
    return;
  }


  antiCheatActive =
    true;


  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.hidden
      ) {
        void recordVisibilityViolation();
      }
    }
  );
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  byId(
    "previous"
  )?.addEventListener(
    "click",
    goToPreviousQuestion
  );


  byId(
    "next"
  )?.addEventListener(
    "click",
    goToNextQuestion
  );


  byId(
    "submit"
  )?.addEventListener(
    "click",
    () => {
      void submitCompetition();
    }
  );


  byId(
    "questionArea"
  )?.addEventListener(
    "change",
    () => {
      saveCurrentAnswerLocally();
    }
  );


  window.addEventListener(
    "beforeunload",
    () => {
      saveCurrentAnswerLocally();


      if (timerInterval) {
        window.clearInterval(
          timerInterval
        );
      }
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeCompetition() {
  applyEditionContext();


  try {
    profile =
      await protectAndRender(
        "login.html"
      );


    if (!profile) {
      return;
    }


    setStatus(
      "Preparing your official competition attempt…"
    );


    const canContinue =
      await loadCompetition();


    if (!canContinue) {
      return;
    }


    const attemptReady =
      await loadOrCreateAttempt();


    if (!attemptReady) {
      return;
    }


    await loadQuestions();
    await loadSavedAnswers();


    bindEvents();
    renderQuestion();
    startTimer();
    enableAntiCheat();


    setStatus(
      ""
    );
  } catch (error) {
    console.error(
      "COMPETITION INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The competition could not be loaded.",
      "error"
    );


    byId(
      "arena"
    ).hidden =
      true;
  }
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeCompetition,
    {
      once:
        true
    }
  );
} else {
  void initializeCompetition();
}
