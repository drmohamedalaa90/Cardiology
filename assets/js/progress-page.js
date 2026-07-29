import {
  listAttempts
} from "./cloud-progress.js?v=2.0.0";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


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
   STATE
========================================================= */

const byId =
  (id) =>
    document.getElementById(
      id
    );


let attempts =
  [];


let questionCache =
  new Map();


/* =========================================================
   TEXT HELPERS
========================================================= */

function esc(
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
      })[character]
  );
}


function show(
  message,
  type = "success"
) {
  const box =
    byId(
      "progressStatus"
    );


  if (!box) {
    return;
  }


  box.textContent =
    message;


  box.className =
    `status-box show ${type}`;


  window.setTimeout(
    () => {
      box.className =
        "status-box";
    },
    3500
  );
}


function fmtDate(
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


function fmtDuration(
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
    total =
      Math.max(
        0,
        Math.round(
          (
            new Date(
              ended ||
              Date.now()
            ) -
            new Date(
              started
            )
          ) /
          1000
        )
      );
  }


  if (
    !Number.isFinite(
      total
    )
  ) {
    return "—";
  }


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


function pct(
  attempt
) {
  const questionCount =
    Number(
      attempt.question_count ||
      0
    );


  if (!questionCount) {
    return 0;
  }


  return Math.round(
    (
      Number(
        attempt.score ||
        0
      ) /
      questionCount
    ) *
    100
  );
}


/* =========================================================
   EDITION HELPERS
========================================================= */

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
  const edition =
    attemptEdition(
      attempt
    );


  /*
   * Show only attempts with a confirmed edition.
   * Unmatched legacy attempts are hidden.
   */

  return (
    edition ===
    selectedEdition
  );
}


function moduleUrl(
  id
) {
  const path =
    id ===
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


  if (badge) {
    badge.textContent =
      selectedEdition ===
        "basic"
        ? "BASIC EDITION PROGRESS"
        : "EXPERT EDITION PROGRESS";
  }
}


/* =========================================================
   STATISTICS
========================================================= */

function updateStats() {
  const completed =
    attempts.filter(
      (attempt) =>
        attempt.status ===
        "completed"
    );


  const open =
    attempts.filter(
      (attempt) =>
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


  const totalScore =
    completed.reduce(
      (
        total,
        attempt
      ) =>
        total +
        Number(
          attempt.score ||
          0
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


  const totalCorrect =
    byId(
      "totalCorrect"
    );


  if (completedCount) {
    completedCount.textContent =
      completed.length;
  }


  if (openCount) {
    openCount.textContent =
      open.length;
  }


  if (overallAccuracy) {
    overallAccuracy.textContent =
      totalQuestions
        ? `${Math.round(
            (
              totalScore /
              totalQuestions
            ) *
            100
          )}%`
        : "—";
  }


  if (totalCorrect) {
    totalCorrect.textContent =
      totalScore;
  }
}


/* =========================================================
   OPEN ATTEMPTS
========================================================= */

function renderOpen() {
  const container =
    byId(
      "openAttempts"
    );


  if (!container) {
    return;
  }


  const open =
    attempts.filter(
      (attempt) =>
        attempt.status ===
        "in_progress"
    );


  if (!open.length) {
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
          href="${esc(
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
    open
      .map(
        (attempt) => {
          const answered =
            Array.isArray(
              attempt.answers
            )
              ? attempt.answers
                  .length
              : 0;


          const questionCount =
            Number(
              attempt.question_count ||
              0
            );


          const progress =
            questionCount
              ? Math.min(
                  100,
                  Math.round(
                    (
                      answered /
                      questionCount
                    ) *
                    100
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
                    ${esc(
                      attempt.module_title ||
                      "ACL Module"
                    )}
                  </h3>

                </div>

                <strong>
                  ${answered}/${questionCount}
                </strong>

              </div>


              <div class="progress-track">

                <span
                  style="width:${progress}%"
                ></span>

              </div>


              <div class="attempt-meta">

                <span>
                  Last saved:
                  ${fmtDate(
                    attempt.updated_at
                  )}
                </span>

                <span>
                  Current score:
                  ${esc(
                    attempt.score ||
                    0
                  )}/${questionCount}
                </span>

              </div>


              <a
                class="primary-btn attempt-action"
                href="${esc(
                  moduleUrl(
                    attempt.module_id
                  )
                )}"
              >
                Continue attempt
              </a>

            </article>
          `;
        }
      )
      .join("");
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


  const current =
    select.value;


  const modules =
    [
      ...new Map(
        attempts
          .filter(
            (attempt) =>
              attempt.status ===
              "completed"
          )
          .map(
            (attempt) => [
              attempt.module_id,
              attempt.module_title
            ]
          )
      ).entries()
    ];


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
          <option value="${esc(id)}">
            ${esc(
              title ||
              "ACL Module"
            )}
          </option>
        `
      )
      .join("");


  if (
    [
      ...select.options
    ].some(
      (option) =>
        option.value ===
        current
    )
  ) {
    select.value =
      current;
  }
}


/* =========================================================
   COMPLETED ATTEMPTS
========================================================= */

function renderCompleted() {
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
    attempts.filter(
      (attempt) =>
        attempt.status ===
          "completed" &&
        (
          filter ===
            "all" ||
          attempt.module_id ===
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
          Finished quizzes will appear here with score, duration, and review details.
        </p>

      </div>
    `;

    return;
  }


  container.innerHTML =
    rows
      .map(
        (attempt) => `
          <article class="card completed-attempt">

            <div
              class="score-ring"
              style="--score:${pct(
                attempt
              )}"
            >
              <span>
                ${pct(
                  attempt
                )}%
              </span>
            </div>


            <div class="completed-main">

              <div class="attempt-top">

                <div>

                  <span class="attempt-status completed">
                    Completed
                  </span>

                  <h3>
                    ${esc(
                      attempt.module_title ||
                      "ACL Module"
                    )}
                  </h3>

                </div>

                <strong>
                  ${esc(
                    attempt.score ||
                    0
                  )}
                  /
                  ${Number(
                    attempt.question_count ||
                    0
                  )}
                </strong>

              </div>


              <div class="attempt-meta">

                <span>
                  ${fmtDate(
                    attempt.completed_at ||
                    attempt.updated_at
                  )}
                </span>

                <span>
                  ${fmtDuration(
                    attempt.duration_seconds,
                    attempt.started_at,
                    attempt.completed_at
                  )}
                </span>

                <span>
                  ${
                    Array.isArray(
                      attempt.answers
                    )
                      ? attempt.answers
                          .length
                      : 0
                  }
                  answered
                </span>

              </div>

            </div>


            <button
              class="secondary-btn review-btn"
              type="button"
              data-id="${esc(
                attempt.id
              )}"
            >
              Review
            </button>

          </article>
        `
      )
      .join("");
}


/* =========================================================
   QUESTION REVIEW
========================================================= */

async function getQuestionMap(
  moduleId
) {
  if (
    questionCache.has(
      moduleId
    )
  ) {
    return questionCache.get(
      moduleId
    );
  }


  let questions =
    [];


  if (
    moduleId ===
    "ppci-fundamentals"
  ) {
    ({
      PPCI_QUESTIONS:
        questions
    } =
      await import(
        "../../modules/ppci/questions.js"
      ));
  }


  const map =
    new Map(
      (
        questions ||
        []
      ).map(
        (question) => [
          question.id,
          question
        ]
      )
    );


  questionCache.set(
    moduleId,
    map
  );


  return map;
}


async function openReview(
  attempt
) {
  const map =
    await getQuestionMap(
      attempt.module_id
    );


  const answers =
    Array.isArray(
      attempt.answers
    )
      ? attempt.answers
      : [];


  const rows =
    (
      attempt.question_ids ||
      []
    )
      .map(
        (
          id,
          index
        ) => {
          const question =
            map.get(
              id
            );


          const answer =
            answers.find(
              (item) =>
                item.questionId ===
                id
            );


          const selectedChoice =
            question &&
            answer
              ? question.options?.[
                  Number(
                    answer.choice
                  )
                ]
              : answer
                ? `Choice ${
                    Number(
                      answer.choice
                    ) +
                    1
                  }`
                : "Not answered";


          const correctChoice =
            question
              ? question.options?.[
                  Number(
                    question.answer
                  )
                ]
              : "Unavailable";


          return `
            <div
              class="
                review-item
                ${
                  answer?.correct
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
                  ${esc(
                    question?.stem ||
                    `Question ${id}`
                  )}
                </h4>

                <p>
                  <b>Your answer:</b>
                  ${esc(
                    selectedChoice
                  )}
                </p>

                ${
                  answer?.correct
                    ? ""
                    : `
                      <p>
                        <b>Correct answer:</b>
                        ${esc(
                          correctChoice
                        )}
                      </p>
                    `
                }

                ${
                  question
                    ?.explanation
                    ? `
                      <p class="muted">
                        ${esc(
                          question.explanation
                        )}
                      </p>
                    `
                    : ""
                }

              </div>


              <span class="review-mark">
                ${
                  answer?.correct
                    ? "✓"
                    : "×"
                }
              </span>

            </div>
          `;
        }
      )
      .join("");


  const reviewContent =
    byId(
      "reviewContent"
    );


  if (reviewContent) {
    reviewContent.innerHTML = `
      <h2>
        ${esc(
          attempt.module_title ||
          "ACL Module"
        )}
      </h2>

      <p class="muted">
        Score
        ${esc(
          attempt.score ||
          0
        )}
        /
        ${Number(
          attempt.question_count ||
          0
        )}
        ·
        ${pct(
          attempt
        )}%
        ·
        ${fmtDuration(
          attempt.duration_seconds,
          attempt.started_at,
          attempt.completed_at
        )}
      </p>

      <div class="review-list">
        ${rows}
      </div>
    `;
  }


  const reviewDialog =
    byId(
      "reviewDialog"
    );


  if (
    reviewDialog &&
    typeof reviewDialog
      .showModal ===
      "function"
  ) {
    reviewDialog.showModal();
  }
}


/* =========================================================
   LOAD
========================================================= */

async function load() {
  const loadedAttempts =
    await listAttempts();


  attempts =
    (
      Array.isArray(
        loadedAttempts
      )
        ? loadedAttempts
        : []
    ).filter(
      belongsToSelectedEdition
    );


  updateStats();
  populateFilter();
  renderOpen();
  renderCompleted();
}


/* =========================================================
   EVENTS
========================================================= */

byId(
  "moduleFilter"
)
  ?.addEventListener(
    "change",
    renderCompleted
  );


byId(
  "refreshProgress"
)
  ?.addEventListener(
    "click",
    async () => {
      try {
        await load();

        show(
          "Progress refreshed."
        );
      } catch (error) {
        show(
          error.message ||
          "Could not refresh progress.",
          "error"
        );
      }
    }
  );


byId(
  "completedAttempts"
)
  ?.addEventListener(
    "click",
    async (event) => {
      const button =
        event.target.closest(
          "button[data-id]"
        );


      if (!button) {
        return;
      }


      const attempt =
        attempts.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              button.dataset.id
            )
        );


      if (attempt) {
        await openReview(
          attempt
        );
      }
    }
  );


/* =========================================================
   START
========================================================= */

try {
  await protectAndRender(
    "login.html"
  );


  renderEditionBadge();


  await load();
} catch (error) {
  console.error(
    "PROGRESS PAGE ERROR:",
    error
  );


  show(
    error.message ||
    "Could not load your progress.",
    "error"
  );
}
