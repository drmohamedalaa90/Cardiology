import {
  listAttempts
} from "./cloud-progress.js?v=2.1.0";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.8.0";


console.log(
  "ACL PROGRESS PAGE v2.2.0 LOADED"
);


/* =========================================================
   EDITION
========================================================= */

const selectedEdition =
  resolveAclEdition();


document.title =
  selectedEdition ===
    "basic"
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
  statusTimer: null
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


function formatDuration(
  seconds,
  started,
  ended
) {
  let total =
    Number(
      seconds
    );


  if (
    !Number.isFinite(
      total
    ) &&
    started
  ) {
    const startTime =
      new Date(
        started
      ).getTime();


    const endTime =
      new Date(
        ended ||
        Date.now()
      ).getTime();


    if (
      Number.isFinite(
        startTime
      ) &&
      Number.isFinite(
        endTime
      )
    ) {
      total =
        Math.max(
          0,
          Math.round(
            (
              endTime -
              startTime
            ) /
            1000
          )
        );
    }
  }


  if (
    !Number.isFinite(
      total
    )
  ) {
    return "—";
  }


  total =
    Math.max(
      0,
      Math.round(
        total
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


  const secondsRemaining =
    total %
    60;


  if (hours) {
    return `${hours}h ${minutes}m`;
  }


  if (minutes) {
    return `${minutes}m ${secondsRemaining}s`;
  }


  return `${secondsRemaining}s`;
}


/* =========================================================
   ATTEMPT HELPERS
========================================================= */

function attemptAnswers(
  attempt
) {
  return Array.isArray(
    attempt?.answers
  )
    ? attempt.answers
    : [];
}


function answeredCount(
  attempt
) {
  return attemptAnswers(
    attempt
  ).filter(
    (
      answer
    ) =>
      answer &&
      (
        answer.choice !==
          undefined ||
        answer.selected_option_id ||
        answer.selected_option_ids ||
        answer.selectedOptionId ||
        answer.selectedOptionIds
      )
  ).length;
}


function correctAnswerCount(
  attempt
) {
  const answers =
    attemptAnswers(
      attempt
    );


  const calculatedCorrect =
    answers.filter(
      (
        answer
      ) =>
        answer?.correct ===
          true ||
        answer?.is_correct ===
          true
    ).length;


  if (
    answers.length
  ) {
    return calculatedCorrect;
  }


  const storedCorrect =
    Number(
      attempt?.correct_count ??
      attempt?.correct_answers
    );


  return Number.isFinite(
    storedCorrect
  )
    ? storedCorrect
    : 0;
}


function accuracyPercentage(
  attempt
) {
  const questionCount =
    Number(
      attempt?.question_count ||
      0
    );


  if (
    questionCount <=
    0
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
    attempt?.modules?.edition ||
    ""
  )
    .trim()
    .toLowerCase();
}


function belongsToSelectedEdition(
  attempt
) {
  return (
    attemptEdition(
      attempt
    ) ===
    selectedEdition
  );
}


function attemptModuleTitle(
  attempt
) {
  return (
    attempt?.module_title ||
    attempt?.modules?.title ||
    attempt?.quiz_title ||
    "ACL Module"
  );
}


function moduleUrl(
  attempt
) {
  const storedLaunchPath =
    attempt?.launch_path ||
    attempt?.module_launch_path ||
    attempt?.modules?.launch_path ||
    "";


  if (storedLaunchPath) {
    return aclUrl(
      storedLaunchPath,
      selectedEdition
    );
  }


  const moduleId =
    String(
      attempt?.module_id ||
      ""
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
        Number(
          attempt.question_count ||
          0
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


  if (completedCount) {
    completedCount.textContent =
      String(
        completed.length
      );
  }


  if (openCount) {
    openCount.textContent =
      String(
        open.length
      );
  }


  if (overallAccuracy) {
    overallAccuracy.textContent =
      totalQuestions >
        0
        ? `${Math.round(
            (
              totalCorrect /
              totalQuestions
            ) *
            100
          )}%`
        : "—";
  }


  if (totalCorrectElement) {
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


  if (!openAttempts.length) {
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
            Number(
              attempt.question_count ||
              0
            );


          const progress =
            questionCount >
              0
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
          String(
            attempt.module_id ||
            ""
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
          String(
            attempt.module_id
          ) ===
            filter
        )
    );


  if (!rows.length) {
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
            Number(
              attempt.question_count ||
              0
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
                    ${formatDuration(
                      attempt.duration_seconds,
                      attempt.started_at,
                      attempt.completed_at
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
   QUESTION REVIEW
========================================================= */

async function getQuestionMap(
  moduleId
) {
  if (
    progressState
      .questionCache
      .has(
        moduleId
      )
  ) {
    return progressState
      .questionCache
      .get(
        moduleId
      );
  }


  let questions = [];


  if (
    moduleId ===
    "ppci-fundamentals"
  ) {
    const questionModule =
      await import(
        "../../modules/ppci/questions.js"
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
      moduleId,
      map
    );


  return map;
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
        answer.questionId ??
        answer.question_id
      ) ===
      String(
        questionId
      )
  );
}


function selectedAnswerText(
  question,
  answer
) {
  if (!answer) {
    return "Not answered";
  }


  const optionIndex =
    Number(
      answer.choice
    );


  if (
    question &&
    Number.isInteger(
      optionIndex
    ) &&
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
    answer.option_text ||
    (
      Number.isInteger(
        optionIndex
      )
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
  if (!question) {
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


async function openReview(
  attempt
) {
  if (
    progressState.reviewing
  ) {
    return;
  }


  const reviewDialog =
    byId(
      "reviewDialog"
    );


  const reviewContent =
    byId(
      "reviewContent"
    );


  if (
    !reviewDialog ||
    !reviewContent
  ) {
    return;
  }


  progressState.reviewing =
    true;


  reviewContent.innerHTML = `
    <h2>
      Loading attempt review…
    </h2>

    <p class="muted">
      Preparing your saved answers.
    </p>
  `;


  if (
    typeof reviewDialog
      .showModal ===
      "function" &&
    !reviewDialog.open
  ) {
    reviewDialog.showModal();
  }


  try {
    const map =
      await getQuestionMap(
        attempt.module_id
      );


    const answers =
      attemptAnswers(
        attempt
      );


    const questionIds =
      Array.isArray(
        attempt.question_ids
      ) &&
      attempt.question_ids.length
        ? attempt.question_ids
        : answers
            .map(
              (
                answer
              ) =>
                answer.questionId ??
                answer.question_id
            )
            .filter(
              Boolean
            );


    const reviewRows =
      questionIds
        .map(
          (
            questionId,
            index
          ) => {
            const question =
              map.get(
                String(
                  questionId
                )
              );


            const answer =
              findAttemptAnswer(
                answers,
                questionId
              );


            const isCorrect =
              answer?.correct ===
                true ||
              answer?.is_correct ===
                true;


            const selectedChoice =
              selectedAnswerText(
                question,
                answer
              );


            const correctChoice =
              correctAnswerText(
                question
              );


            return `
              <div
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


                <div>

                  <h4>
                    ${escapeHtml(
                      question?.stem ||
                      question?.question_text ||
                      `Question ${
                        index +
                        1
                      }`
                    )}
                  </h4>


                  <p>
                    <b>Your answer:</b>
                    ${escapeHtml(
                      selectedChoice
                    )}
                  </p>


                  ${
                    !isCorrect &&
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
                        <p class="muted">
                          ${escapeHtml(
                            question.explanation
                          )}
                        </p>
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

              </div>
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
        ${formatDuration(
          attempt.duration_seconds,
          attempt.started_at,
          attempt.completed_at
        )}
      </p>


      <div class="review-list">

        ${
          reviewRows ||
          `
            <div class="card muted">
              No saved question-level review is available for this attempt.
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


  if (openContainer) {
    openContainer.innerHTML = `
      <div class="card muted">
        Loading unfinished attempts…
      </div>
    `;
  }


  if (completedContainer) {
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
      const button =
        event.target.closest(
          "button[data-id]"
        );


      if (!button) {
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


      if (attempt) {
        void openReview(
          attempt
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


    if (!profile) {
      return;
    }


    renderEditionBadge();


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
