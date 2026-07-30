import {
  listAttempts
} from "./cloud-progress.js?v=2.1.0";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.8.0";


console.log(
  "ACL PROGRESS PAGE v2.3.0 LOADED"
);


/* =========================================================
   EDITION
========================================================= */

const selectedEdition =
  resolveAclEdition();


document.title =
  selectedEdition === "basic"
    ? "Basic Edition Progress | ACL"
    : "Expert Edition Progress | ACL";


/* =========================================================
   PAGE STATE
========================================================= */

const progressState = {
  attempts: [],
  questionCache: new Map(),
  loading: false,
  reviewing: false,
  statusTimer: null,
  lastReviewTrigger: null
};


/* =========================================================
   ELEMENT HELPERS
========================================================= */

function byId(
  id
) {
  return document.getElementById(
    id
  );
}


function setButtonState(
  button,
  {
    disabled,
    text
  }
) {
  if (!button) {
    return;
  }


  button.disabled =
    Boolean(
      disabled
    );


  button.textContent =
    text;
}


/* =========================================================
   TEXT HELPERS
========================================================= */

function escapeHtml(
  value = ""
) {
  return String(
    value
  ).replace(
    /[&<>'"]/g,
    (
      character
    ) =>
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


function showStatus(
  message = "",
  type = "",
  {
    autoHide = true
  } = {}
) {
  const box =
    byId(
      "progressStatus"
    );


  if (!box) {
    return;
  }


  if (
    progressState.statusTimer
  ) {
    window.clearTimeout(
      progressState.statusTimer
    );


    progressState.statusTimer =
      null;
  }


  box.textContent =
    message;


  box.className =
    `status-box ${
      message
        ? "show"
        : ""
    } ${type}`.trim();


  box.hidden =
    !message;


  if (
    message &&
    autoHide
  ) {
    progressState.statusTimer =
      window.setTimeout(
        () => {
          box.textContent =
            "";


          box.className =
            "status-box";


          box.hidden =
            true;


          progressState.statusTimer =
            null;
        },
        3500
      );
  }
}


function formatDate(
  value
) {
  if (!value) {
    return "—";
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
    return "—";
  }


  return date.toLocaleString(
    [],
    {
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  );
}


function formatSeconds(
  value
) {
  const numericValue =
    Number(
      value
    );


  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue < 0
  ) {
    return "—";
  }


  const total =
    Math.max(
      0,
      Math.round(
        numericValue
      )
    );


  const hours =
    Math.floor(
      total /
      3600
    );


  const minutes =
    Math.floor(
      (
        total %
        3600
      ) /
      60
    );


  const seconds =
    total %
    60;


  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }


  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }


  return `${seconds}s`;
}


function attemptDurationSeconds(
  attempt
) {
  const candidates = [
    attempt?.active_time_seconds,
    attempt?.activeTimeSeconds,
    attempt?.elapsed_active_seconds,
    attempt?.elapsedActiveSeconds,
    attempt?.duration_seconds,
    attempt?.durationSeconds
  ];


  for (
    const candidate of
    candidates
  ) {
    const numericValue =
      Number(
        candidate
      );


    if (
      Number.isFinite(
        numericValue
      ) &&
      numericValue >= 0
    ) {
      return numericValue;
    }
  }


  return null;
}


function formatAttemptDuration(
  attempt
) {
  const duration =
    attemptDurationSeconds(
      attempt
    );


  /*
   * Do not calculate duration using started_at → completed_at.
   * That would include periods when the module was closed,
   * left in the background, or resumed later.
   */

  return duration === null
    ? "Timing unavailable"
    : formatSeconds(
        duration
      );
}


/* =========================================================
   ARRAY AND JSON HELPERS
========================================================= */

function parseArrayValue(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value;
  }


  if (
    typeof value ===
      "string"
  ) {
    const trimmed =
      value.trim();


    if (!trimmed) {
      return [];
    }


    try {
      const parsed =
        JSON.parse(
          trimmed
        );


      return Array.isArray(
        parsed
      )
        ? parsed
        : [];
    } catch (
      error
    ) {
      console.warn(
        "ACL ARRAY PARSE FAILED:",
        error
      );


      return [];
    }
  }


  return [];
}


/* =========================================================
   ATTEMPT HELPERS
========================================================= */

function attemptAnswers(
  attempt
) {
  const candidates = [
    attempt?.answers,
    attempt?.attempt_answers,
    attempt?.attemptAnswers
  ];


  for (
    const candidate of
    candidates
  ) {
    const parsed =
      parseArrayValue(
        candidate
      );


    if (
      parsed.length
    ) {
      return parsed;
    }
  }


  return [];
}


function attemptQuestionIds(
  attempt
) {
  const candidates = [
    attempt?.question_ids,
    attempt?.questionIds,
    attempt?.questions_order,
    attempt?.questionOrder
  ];


  for (
    const candidate of
    candidates
  ) {
    const parsed =
      parseArrayValue(
        candidate
      )
        .map(
          (
            value
          ) =>
            String(
              value
            ).trim()
        )
        .filter(
          Boolean
        );


    if (
      parsed.length
    ) {
      return parsed;
    }
  }


  return attemptAnswers(
    attempt
  )
    .map(
      (
        answer
      ) =>
        answer?.questionId ??
        answer?.question_id ??
        answer?.id
    )
    .filter(
      (
        value
      ) =>
        value !==
          undefined &&
        value !==
          null &&
        String(
          value
        ).trim()
    )
    .map(
      (
        value
      ) =>
        String(
          value
        )
    );
}


function attemptQuestionCount(
  attempt
) {
  const storedCount =
    Number(
      attempt?.question_count ??
      attempt?.questionCount
    );


  if (
    Number.isFinite(
      storedCount
    ) &&
    storedCount > 0
  ) {
    return storedCount;
  }


  const questionIds =
    attemptQuestionIds(
      attempt
    );


  if (
    questionIds.length
  ) {
    return questionIds.length;
  }


  return attemptAnswers(
    attempt
  ).length;
}


function answerHasSelection(
  answer
) {
  if (!answer) {
    return false;
  }


  return (
    answer.choice !==
      undefined &&
    answer.choice !==
      null
  ) ||
  Boolean(
    answer.selected_option_id
  ) ||
  Boolean(
    answer.selected_option_ids
  ) ||
  Boolean(
    answer.selectedOptionId
  ) ||
  Boolean(
    answer.selectedOptionIds
  ) ||
  Boolean(
    answer.selected_option_text
  ) ||
  Boolean(
    answer.option_text
  );
}


function answeredCount(
  attempt
) {
  return attemptAnswers(
    attempt
  ).filter(
    answerHasSelection
  ).length;
}


function answerHasCorrectnessData(
  answer
) {
  return (
    answer?.correct ===
      true ||
    answer?.correct ===
      false ||
    answer?.is_correct ===
      true ||
    answer?.is_correct ===
      false
  );
}


function correctAnswerCount(
  attempt
) {
  const answers =
    attemptAnswers(
      attempt
    );


  const answersWithCorrectness =
    answers.filter(
      answerHasCorrectnessData
    );


  if (
    answersWithCorrectness.length
  ) {
    return answersWithCorrectness.filter(
      (
        answer
      ) =>
        answer.correct ===
          true ||
        answer.is_correct ===
          true
    ).length;
  }


  const storedCorrect =
    Number(
      attempt?.correct_count ??
      attempt?.correctCount ??
      attempt?.correct_answers ??
      attempt?.correctAnswers
    );


  return Number.isFinite(
    storedCorrect
  )
    ? Math.max(
        0,
        storedCorrect
      )
    : 0;
}


function accuracyPercentage(
  attempt
) {
  const questionCount =
    attemptQuestionCount(
      attempt
    );


  if (
    questionCount <= 0
  ) {
    return 0;
  }


  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (
          correctAnswerCount(
            attempt
          ) /
          questionCount
        ) *
        100
      )
    )
  );
}


function attemptEdition(
  attempt
) {
  return String(
    attempt?.edition ||
    attempt?.module_edition ||
    attempt?.moduleEdition ||
    attempt?.modules?.edition ||
    ""
  )
    .trim()
    .toLowerCase();
}


function belongsToSelectedEdition(
  attempt
) {
  const edition =
    attemptEdition(
      attempt
    );


  /*
   * Keep legacy attempts visible when they were created
   * before an edition value was stored.
   */

  return (
    !edition ||
    edition ===
      selectedEdition
  );
}


function attemptModuleTitle(
  attempt
) {
  return (
    attempt?.module_title ||
    attempt?.moduleTitle ||
    attempt?.modules?.title ||
    attempt?.quiz_title ||
    attempt?.quizTitle ||
    "ACL Module"
  );
}


function attemptModuleId(
  attempt
) {
  return String(
    attempt?.module_id ||
    attempt?.moduleId ||
    attempt?.modules?.id ||
    ""
  );
}


function moduleUrl(
  attempt
) {
  const storedLaunchPath =
    attempt?.launch_path ||
    attempt?.launchPath ||
    attempt?.module_launch_path ||
    attempt?.moduleLaunchPath ||
    attempt?.modules?.launch_path ||
    "";


  if (
    storedLaunchPath
  ) {
    return aclUrl(
      storedLaunchPath,
      selectedEdition
    );
  }


  const moduleId =
    attemptModuleId(
      attempt
    );


  const path =
    moduleId ===
      "ppci-fundamentals"
      ? "modules/ppci/index.html"
      : "modules.html";


  return aclUrl(
    path,
    selectedEdition
  );
}


/* =========================================================
   EDITION BADGE
========================================================= */

function renderEditionBadge() {
  const badge =
    byId(
      "progressEditionBadge"
    );


  if (!badge) {
    return;
  }


  badge.textContent =
    selectedEdition ===
      "basic"
      ? "BASIC EDITION PROGRESS"
      : "EXPERT EDITION PROGRESS";
}


/* =========================================================
   STATISTICS
========================================================= */

function updateStats() {
  const completed =
    progressState.attempts.filter(
      (
        attempt
      ) =>
        attempt.status ===
        "completed"
    );


  const open =
    progressState.attempts.filter(
      (
        attempt
      ) =>
        attempt.status ===
        "in_progress"
    );


  const totalQuestions =
    completed.reduce(
      (
        total,
        attempt
      ) =>
        total +
        attemptQuestionCount(
          attempt
        ),
      0
    );


  const totalCorrect =
    completed.reduce(
      (
        total,
        attempt
      ) =>
        total +
        correctAnswerCount(
          attempt
        ),
      0
    );


  const completedCount =
    byId(
      "completedCount"
    );


  const openCount =
    byId(
      "openCount"
    );


  const overallAccuracy =
    byId(
      "overallAccuracy"
    );


  const totalCorrectElement =
    byId(
      "totalCorrect"
    );


  if (
    completedCount
  ) {
    completedCount.textContent =
      String(
        completed.length
      );
  }


  if (
    openCount
  ) {
    openCount.textContent =
      String(
        open.length
      );
  }


  if (
    overallAccuracy
  ) {
    overallAccuracy.textContent =
      totalQuestions > 0
        ? `${Math.round(
            (
              totalCorrect /
              totalQuestions
            ) *
            100
          )}%`
        : "—";
  }


  if (
    totalCorrectElement
  ) {
    totalCorrectElement.textContent =
      String(
        totalCorrect
      );
  }
}


/* =========================================================
   OPEN ATTEMPTS
========================================================= */

function renderOpenAttempts() {
  const container =
    byId(
      "openAttempts"
    );


  if (!container) {
    return;
  }


  const openAttempts =
    progressState.attempts.filter(
      (
        attempt
      ) =>
        attempt.status ===
        "in_progress"
    );


  if (
    !openAttempts.length
  ) {
    container.innerHTML = `
      <div class="card empty-progress">

        <h3>
          No unfinished attempts
        </h3>

        <p class="muted">
          Start a module and your progress will be saved here automatically.
        </p>

        <a
          class="secondary-btn"
          href="${escapeHtml(
            aclUrl(
              "modules.html",
              selectedEdition
            )
          )}"
        >
          Browse modules
        </a>

      </div>
    `;


    return;
  }


  container.innerHTML =
    openAttempts
      .map(
        (
          attempt
        ) => {
          const answered =
            answeredCount(
              attempt
            );


          const questionCount =
            attemptQuestionCount(
              attempt
            );


          const progress =
            questionCount > 0
              ? Math.min(
                  100,
                  Math.max(
                    0,
                    Math.round(
                      (
                        answered /
                        questionCount
                      ) *
                      100
                    )
                  )
                )
              : 0;


          return `
            <article
              class="card attempt-card open-attempt"
            >

              <div class="attempt-top">

                <div>

                  <span class="attempt-status open">
                    In progress
                  </span>

                  <h3>
                    ${escapeHtml(
                      attemptModuleTitle(
                        attempt
                      )
                    )}
                  </h3>

                </div>

                <strong>
                  ${answered}/${questionCount}
                </strong>

              </div>

              <div
                class="progress-track"
                role="progressbar"
                aria-label="Attempt progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="${progress}"
              >
                <span
                  style="width: ${progress}%"
                ></span>
              </div>

              <div class="attempt-meta">

                <span>
                  Last saved:
                  ${formatDate(
                    attempt.updated_at
                  )}
                </span>

                <span>
                  Active time:
                  ${escapeHtml(
                    formatAttemptDuration(
                      attempt
                    )
                  )}
                </span>

                <span>
                  Current score:
                  ${escapeHtml(
                    attempt.score ??
                    0
                  )}
                </span>

              </div>

              <a
                class="primary-btn attempt-action"
                href="${escapeHtml(
                  moduleUrl(
                    attempt
                  )
                )}"
              >
                Continue attempt
              </a>

            </article>
          `;
        }
      )
      .join(
        ""
      );
}


/* =========================================================
   MODULE FILTER
========================================================= */

function populateFilter() {
  const select =
    byId(
      "moduleFilter"
    );


  if (!select) {
    return;
  }


  const currentValue =
    select.value;


  const moduleMap =
    new Map();


  progressState.attempts
    .filter(
      (
        attempt
      ) =>
        attempt.status ===
        "completed"
    )
    .forEach(
      (
        attempt
      ) => {
        const moduleId =
          attemptModuleId(
            attempt
          );


        if (
          !moduleId ||
          moduleMap.has(
            moduleId
          )
        ) {
          return;
        }


        moduleMap.set(
          moduleId,
          attemptModuleTitle(
            attempt
          )
        );
      }
    );


  const modules =
    [
      ...moduleMap.entries()
    ].sort(
      (
        first,
        second
      ) =>
        String(
          first[1]
        ).localeCompare(
          String(
            second[1]
          )
        )
    );


  select.innerHTML =
    `
      <option value="all">
        All modules
      </option>
    ` +
    modules
      .map(
        ([
          id,
          title
        ]) => `
          <option value="${escapeHtml(
            id
          )}">
            ${escapeHtml(
              title
            )}
          </option>
        `
      )
      .join(
        ""
      );


  if (
    [
      ...select.options
    ].some(
      (
        option
      ) =>
        option.value ===
        currentValue
    )
  ) {
    select.value =
      currentValue;
  }
}


/* =========================================================
   COMPLETED ATTEMPTS
========================================================= */

function renderCompletedAttempts() {
  const container =
    byId(
      "completedAttempts"
    );


  if (!container) {
    return;
  }


  const filter =
    byId(
      "moduleFilter"
    )?.value ||
    "all";


  const rows =
    progressState.attempts.filter(
      (
        attempt
      ) =>
        attempt.status ===
          "completed" &&
        (
          filter ===
            "all" ||
          attemptModuleId(
            attempt
          ) ===
            filter
        )
    );


  if (
    !rows.length
  ) {
    container.innerHTML = `
      <div class="card empty-progress">

        <h3>
          No completed attempts yet
        </h3>

        <p class="muted">
          Finished quizzes will appear here with score, duration,
          accuracy, and review details.
        </p>

      </div>
    `;


    return;
  }


  container.innerHTML =
    rows
      .map(
        (
          attempt
        ) => {
          const accuracy =
            accuracyPercentage(
              attempt
            );


          const correct =
            correctAnswerCount(
              attempt
            );


          const questionCount =
            attemptQuestionCount(
              attempt
            );


          return `
            <article class="card completed-attempt">

              <div
                class="score-ring"
                style="--score: ${accuracy}"
                aria-label="${accuracy}% accuracy"
              >
                <span>
                  ${accuracy}%
                </span>
              </div>

              <div class="completed-main">

                <div class="attempt-top">

                  <div>

                    <span class="attempt-status completed">
                      Completed
                    </span>

                    <h3>
                      ${escapeHtml(
                        attemptModuleTitle(
                          attempt
                        )
                      )}
                    </h3>

                  </div>

                  <strong>
                    ${escapeHtml(
                      attempt.score ??
                      0
                    )}
                    pts
                  </strong>

                </div>

                <div class="attempt-meta">

                  <span>
                    ${formatDate(
                      attempt.completed_at ||
                      attempt.updated_at
                    )}
                  </span>

                  <span>
                    Active time:
                    ${escapeHtml(
                      formatAttemptDuration(
                        attempt
                      )
                    )}
                  </span>

                  <span>
                    ${correct}/${questionCount}
                    correct
                  </span>

                </div>

              </div>

              <button
                class="secondary-btn review-btn"
                type="button"
                data-id="${escapeHtml(
                  attempt.id
                )}"
              >
                Review
              </button>

            </article>
          `;
        }
      )
      .join(
        ""
      );
}


/* =========================================================
   QUESTION REVIEW DATA
========================================================= */

async function getQuestionMap(
  moduleId
) {
  const normalizedModuleId =
    String(
      moduleId ||
      ""
    );


  if (
    progressState
      .questionCache
      .has(
        normalizedModuleId
      )
  ) {
    return progressState
      .questionCache
      .get(
        normalizedModuleId
      );
  }


  let questions = [];


  if (
    normalizedModuleId ===
    "ppci-fundamentals"
  ) {
    const questionModule =
      await import(
        "../../modules/ppci/questions.js?v=5.2.0"
      );


    questions =
      questionModule
        .PPCI_QUESTIONS ||
      [];
  }


  const map =
    new Map(
      questions.map(
        (
          question
        ) => [
          String(
            question.id
          ),
          question
        ]
      )
    );


  progressState
    .questionCache
    .set(
      normalizedModuleId,
      map
    );


  return map;
}


function answerQuestionId(
  answer
) {
  return (
    answer?.questionId ??
    answer?.question_id ??
    answer?.question ??
    null
  );
}


function findAttemptAnswer(
  answers,
  questionId
) {
  return answers.find(
    (
      answer
    ) =>
      String(
        answerQuestionId(
          answer
        )
      ) ===
      String(
        questionId
      )
  );
}


function answerChoiceIndex(
  answer
) {
  const candidates = [
    answer?.choice,
    answer?.selected_index,
    answer?.selectedIndex,
    answer?.option_index,
    answer?.optionIndex
  ];


  for (
    const candidate of
    candidates
  ) {
    const numericValue =
      Number(
        candidate
      );


    if (
      Number.isInteger(
        numericValue
      ) &&
      numericValue >= 0
    ) {
      return numericValue;
    }
  }


  return null;
}


function selectedAnswerText(
  question,
  answer
) {
  if (
    !answer
  ) {
    return "Not answered";
  }


  const optionIndex =
    answerChoiceIndex(
      answer
    );


  if (
    question &&
    optionIndex !==
      null &&
    Array.isArray(
      question.options
    )
  ) {
    return (
      question.options[
        optionIndex
      ] ||
      `Choice ${
        optionIndex +
        1
      }`
    );
  }


  return (
    answer.selected_option_text ||
    answer.selectedOptionText ||
    answer.option_text ||
    answer.optionText ||
    (
      optionIndex !==
        null
        ? `Choice ${
            optionIndex +
            1
          }`
        : "Answer recorded"
    )
  );
}


function correctAnswerText(
  question
) {
  if (
    !question
  ) {
    return "Unavailable";
  }


  const answerIndex =
    Number(
      question.answer
    );


  if (
    Number.isInteger(
      answerIndex
    ) &&
    Array.isArray(
      question.options
    )
  ) {
    return (
      question.options[
        answerIndex
      ] ||
      "Unavailable"
    );
  }


  return "Unavailable";
}


function answerIsCorrect(
  question,
  answer
) {
  if (
    answer?.correct ===
      true ||
    answer?.is_correct ===
      true
  ) {
    return true;
  }


  if (
    answer?.correct ===
      false ||
    answer?.is_correct ===
      false
  ) {
    return false;
  }


  const selectedIndex =
    answerChoiceIndex(
      answer
    );


  const correctIndex =
    Number(
      question?.answer
    );


  return (
    selectedIndex !==
      null &&
    Number.isInteger(
      correctIndex
    ) &&
    selectedIndex ===
      correctIndex
  );
}


/* =========================================================
   REVIEW DIALOG
========================================================= */

function getReviewDialog() {
  return byId(
    "reviewDialog"
  );
}


function closeReview() {
  const reviewDialog =
    getReviewDialog();


  if (
    !reviewDialog
  ) {
    return;
  }


  if (
    typeof reviewDialog
      .close ===
      "function" &&
    reviewDialog.open
  ) {
    reviewDialog.close();
  } else {
    reviewDialog.removeAttribute(
      "open"
    );


    reviewDialog.hidden =
      true;
  }


  document.body.classList.remove(
    "review-dialog-open"
  );


  if (
    progressState.lastReviewTrigger instanceof
    HTMLElement
  ) {
    progressState
      .lastReviewTrigger
      .focus();
  }


  progressState.lastReviewTrigger =
    null;
}


function showReviewDialog() {
  const reviewDialog =
    getReviewDialog();


  if (
    !reviewDialog
  ) {
    return;
  }


  reviewDialog.hidden =
    false;


  if (
    typeof reviewDialog
      .showModal ===
      "function"
  ) {
    if (
      !reviewDialog.open
    ) {
      reviewDialog.showModal();
    }
  } else {
    reviewDialog.setAttribute(
      "open",
      ""
    );
  }


  document.body.classList.add(
    "review-dialog-open"
  );
}


function bindReviewDialogEvents() {
  const reviewDialog =
    getReviewDialog();


  if (
    !reviewDialog ||
    reviewDialog.dataset
      .aclEventsBound ===
      "true"
  ) {
    return;
  }


  reviewDialog.dataset
    .aclEventsBound =
    "true";


  /*
   * Native dialog backdrop clicks are reported as clicks on
   * the dialog itself. Close only when the click is outside
   * the visible dialog content rectangle.
   */

  reviewDialog.addEventListener(
    "click",
    (
      event
    ) => {
      if (
        event.target !==
        reviewDialog
      ) {
        return;
      }


      const rectangle =
        reviewDialog
          .getBoundingClientRect();


      const clickedInside =
        event.clientX >=
          rectangle.left &&
        event.clientX <=
          rectangle.right &&
        event.clientY >=
          rectangle.top &&
        event.clientY <=
          rectangle.bottom;


      if (
        !clickedInside ||
        event.target ===
          reviewDialog
      ) {
        closeReview();
      }
    }
  );


  reviewDialog.addEventListener(
    "cancel",
    (
      event
    ) => {
      event.preventDefault();


      closeReview();
    }
  );


  reviewDialog.addEventListener(
    "close",
    () => {
      document.body.classList.remove(
        "review-dialog-open"
      );
    }
  );


  reviewDialog
    .querySelectorAll(
      [
        "[data-close-review]",
        "#closeReviewDialog",
        "#closeReview",
        ".review-dialog-close",
        ".review-close"
      ].join(
        ","
      )
    )
    .forEach(
      (
        button
      ) => {
        button.addEventListener(
          "click",
          closeReview
        );
      }
    );


  document.addEventListener(
    "keydown",
    (
      event
    ) => {
      if (
        event.key ===
          "Escape" &&
        reviewDialog.open
      ) {
        event.preventDefault();


        closeReview();
      }
    }
  );
}


async function openReview(
  attempt,
  trigger = null
) {
  if (
    progressState.reviewing
  ) {
    return;
  }


  const reviewDialog =
    getReviewDialog();


  const reviewContent =
    byId(
      "reviewContent"
    );


  if (
    !reviewDialog ||
    !reviewContent
  ) {
    showStatus(
      "The review window is unavailable.",
      "error",
      {
        autoHide:
          false
      }
    );


    return;
  }


  progressState.reviewing =
    true;


  progressState.lastReviewTrigger =
    trigger instanceof
    HTMLElement
      ? trigger
      : null;


  reviewContent.innerHTML = `
    <h2 id="reviewDialogTitle">
      Loading attempt review…
    </h2>

    <p class="muted">
      Preparing your saved questions and answers.
    </p>
  `;


  showReviewDialog();


  try {
    const moduleId =
      attemptModuleId(
        attempt
      );


    const map =
      await getQuestionMap(
        moduleId
      );


    const answers =
      attemptAnswers(
        attempt
      );


    const questionIds =
      attemptQuestionIds(
        attempt
      );


    const reviewRows =
      questionIds
        .map(
          (
            questionId,
            index
          ) => {
            const normalizedQuestionId =
              String(
                questionId
              );


            const question =
              map.get(
                normalizedQuestionId
              );


            const answer =
              findAttemptAnswer(
                answers,
                normalizedQuestionId
              );


            const isCorrect =
              answerIsCorrect(
                question,
                answer
              );


            const selectedChoice =
              selectedAnswerText(
                question,
                answer
              );


            const correctChoice =
              correctAnswerText(
                question
              );


            const questionTitle =
              question?.stem ||
              question?.question_text ||
              question?.questionText ||
              "";


            const questionUnavailable =
              !questionTitle;


            return `
              <article
                class="
                  review-item
                  ${
                    isCorrect
                      ? "correct"
                      : "incorrect"
                  }
                "
              >

                <div class="review-number">
                  ${index + 1}
                </div>

                <div class="review-question-content">

                  <h4>
                    ${escapeHtml(
                      questionTitle ||
                      `Question ${
                        index +
                        1
                      } details are unavailable`
                    )}
                  </h4>

                  ${
                    questionUnavailable
                      ? `
                        <p class="muted">
                          The saved question ID is
                          <code>${escapeHtml(
                            normalizedQuestionId
                          )}</code>,
                          but this question is no longer present in the current question bank.
                        </p>
                      `
                      : ""
                  }

                  <p>
                    <b>Your answer:</b>
                    ${escapeHtml(
                      selectedChoice
                    )}
                  </p>

                  ${
                    correctChoice !==
                      "Unavailable"
                      ? `
                        <p>
                          <b>Correct answer:</b>
                          ${escapeHtml(
                            correctChoice
                          )}
                        </p>
                      `
                      : ""
                  }

                  ${
                    question?.explanation
                      ? `
                        <div class="review-explanation">

                          <b>
                            Explanation
                          </b>

                          <p class="muted">
                            ${escapeHtml(
                              question.explanation
                            )}
                          </p>

                        </div>
                      `
                      : ""
                  }

                </div>

                <span
                  class="review-mark"
                  aria-label="${
                    isCorrect
                      ? "Correct"
                      : "Incorrect"
                  }"
                >
                  ${
                    isCorrect
                      ? "✓"
                      : "×"
                  }
                </span>

              </article>
            `;
          }
        )
        .join(
          ""
        );


    const accuracy =
      accuracyPercentage(
        attempt
      );


    const activeDuration =
      formatAttemptDuration(
        attempt
      );


    reviewContent.innerHTML = `
      <h2 id="reviewDialogTitle">
        ${escapeHtml(
          attemptModuleTitle(
            attempt
          )
        )}
      </h2>

      <p class="muted">
        Confidence-adjusted score:
        ${escapeHtml(
          attempt.score ??
          0
        )}
        points
        ·
        Accuracy:
        ${accuracy}%
        ·
        Active time:
        ${escapeHtml(
          activeDuration
        )}
      </p>

      <div class="review-list">

        ${
          reviewRows ||
          `
            <div class="card muted">

              <h3>
                No question-level review is available
              </h3>

              <p>
                This attempt does not contain saved question IDs or answers.
              </p>

            </div>
          `
        }

      </div>
    `;
  } catch (
    error
  ) {
    console.error(
      "ACL ATTEMPT REVIEW ERROR:",
      error
    );


    reviewContent.innerHTML = `
      <h2 id="reviewDialogTitle">
        Review unavailable
      </h2>

      <p class="muted">
        ${escapeHtml(
          error.message ||
          "This attempt could not be reviewed."
        )}
      </p>
    `;
  } finally {
    progressState.reviewing =
      false;
  }
}


/* =========================================================
   LOAD PROGRESS
========================================================= */

function renderLoadingState() {
  const openContainer =
    byId(
      "openAttempts"
    );


  const completedContainer =
    byId(
      "completedAttempts"
    );


  if (
    openContainer
  ) {
    openContainer.innerHTML = `
      <div class="card muted">
        Loading unfinished attempts…
      </div>
    `;
  }


  if (
    completedContainer
  ) {
    completedContainer.innerHTML = `
      <div class="card muted">
        Loading completed attempts…
      </div>
    `;
  }
}


async function loadProgress() {
  if (
    progressState.loading
  ) {
    return;
  }


  progressState.loading =
    true;


  renderLoadingState();


  try {
    const loadedAttempts =
      await listAttempts();


    progressState.attempts =
      (
        Array.isArray(
          loadedAttempts
        )
          ? loadedAttempts
          : []
      )
        .filter(
          belongsToSelectedEdition
        )
        .sort(
          (
            first,
            second
          ) =>
            new Date(
              second.updated_at ||
              second.completed_at ||
              0
            ).getTime() -
            new Date(
              first.updated_at ||
              first.completed_at ||
              0
            ).getTime()
        );


    updateStats();
    populateFilter();
    renderOpenAttempts();
    renderCompletedAttempts();
  } finally {
    progressState.loading =
      false;
  }
}


/* =========================================================
   EVENTS
========================================================= */

byId(
  "moduleFilter"
)
  ?.addEventListener(
    "change",
    renderCompletedAttempts
  );


byId(
  "refreshProgress"
)
  ?.addEventListener(
    "click",
    async (
      event
    ) => {
      const button =
        event.currentTarget;


      setButtonState(
        button,
        {
          disabled:
            true,

          text:
            "Refreshing…"
        }
      );


      try {
        await loadProgress();


        showStatus(
          "Progress refreshed.",
          "success"
        );
      } catch (
        error
      ) {
        console.error(
          "ACL PROGRESS REFRESH ERROR:",
          error
        );


        showStatus(
          error.message ||
          "Could not refresh progress.",
          "error",
          {
            autoHide:
              false
          }
        );
      } finally {
        setButtonState(
          button,
          {
            disabled:
              false,

            text:
              "Refresh"
          }
        );
      }
    }
  );


byId(
  "completedAttempts"
)
  ?.addEventListener(
    "click",
    (
      event
    ) => {
      const target =
        event.target instanceof
        Element
          ? event.target
          : null;


      const button =
        target?.closest(
          "button[data-id]"
        );


      if (
        !button
      ) {
        return;
      }


      const attempt =
        progressState.attempts.find(
          (
            item
          ) =>
            String(
              item.id
            ) ===
            String(
              button.dataset.id
            )
        );


      if (
        attempt
      ) {
        void openReview(
          attempt,
          button
        );
      }
    }
  );


/* =========================================================
   START
========================================================= */

async function startProgressPage() {
  try {
    const profile =
      await protectAndRender(
        "login.html"
      );


    if (
      !profile
    ) {
      return;
    }


    renderEditionBadge();


    bindReviewDialogEvents();


    await loadProgress();
  } catch (
    error
  ) {
    console.error(
      "ACL PROGRESS PAGE ERROR:",
      error
    );


    showStatus(
      error.message ||
      "Could not load your progress.",
      "error",
      {
        autoHide:
          false
      }
    );
  }
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void startProgressPage();
    },
    {
      once:
        true
    }
  );
} else {
  void startProgressPage();
}
