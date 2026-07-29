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
  "ACL ADMIN ANALYTICS v3.0.0 LOADED"
);


/* =========================================================
   PAGE STATE
========================================================= */

const selectedEdition =
  resolveAclEdition();


const state = {
  profile: null,
  modules: [],
  attempts: [],
  profiles: new Map(),
  challenges: [],
  challengeParticipants: [],
  filteredAttempts: [],
  totalRegisteredUsers: 0
};


const el =
  (id) =>
    document.getElementById(
      id
    );


/* =========================================================
   GENERAL HELPERS
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


function setStatus(
  message = "",
  kind = ""
) {
  const box =
    el(
      "analyticsStatus"
    );


  if (!box) {
    return;
  }


  box.textContent =
    message;


  box.className =
    `analytics-status ${kind}`.trim();


  box.hidden =
    !message;
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


function percentage(
  numerator,
  denominator
) {
  const safeDenominator =
    numberValue(
      denominator
    );


  if (
    safeDenominator <=
    0
  ) {
    return 0;
  }


  return Math.round(
    (
      numberValue(
        numerator
      ) /
      safeDenominator
    ) *
    100
  );
}


function formatPercentage(
  value
) {
  return `${Math.round(
    numberValue(
      value
    )
  )}%`;
}


function formatDateTime(
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


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(
    date
  );
}


function dateKey(
  value
) {
  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return [
    date.getFullYear(),

    String(
      date.getMonth() +
      1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    )
  ].join(
    "-"
  );
}


function attemptTimestamp(
  attempt
) {
  return (
    attempt.completed_at ||
    attempt.updated_at ||
    attempt.created_at ||
    null
  );
}


function normalizeConfidence(
  value
) {
  const normalized =
    String(
      value ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    normalized === "high" ||
    normalized === "high_confidence"
  ) {
    return "high";
  }


  if (
    normalized === "low" ||
    normalized === "low_confidence"
  ) {
    return "low";
  }


  return "";
}


function answerIsCorrect(
  answer
) {
  return Boolean(
    answer?.is_correct ??
    answer?.correct ??
    answer?.was_correct ??
    false
  );
}


function answersFromAttempt(
  attempt
) {
  return Array.isArray(
    attempt?.answers
  )
    ? attempt.answers
    : [];
}


function profileName(
  userId
) {
  const profile =
    state.profiles.get(
      userId
    );


  return (
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    profile?.email ||
    "ACL Learner"
  );
}


function moduleName(
  moduleId
) {
  return (
    state.modules.find(
      (module) =>
        String(
          module.id
        ) ===
        String(
          moduleId
        )
    )?.title ||
    "ACL Module"
  );
}


function selectedDateRange() {
  const fromValue =
    el(
      "analyticsDateFrom"
    )
      ?.value ||
    "";


  const toValue =
    el(
      "analyticsDateTo"
    )
      ?.value ||
    "";


  return {
    from:
      fromValue
        ? new Date(
            `${fromValue}T00:00:00`
          )
        : null,

    to:
      toValue
        ? new Date(
            `${toValue}T23:59:59.999`
          )
        : null
  };
}


function belongsToDateRange(
  value,
  range
) {
  if (!value) {
    return false;
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
    return false;
  }


  if (
    range.from &&
    date <
      range.from
  ) {
    return false;
  }


  if (
    range.to &&
    date >
      range.to
  ) {
    return false;
  }


  return true;
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
      "analyticsEditionBadge"
    );


  if (badge) {
    badge.textContent =
      isBasic
        ? "BASIC EDITION"
        : "EXPERT EDITION";
  }


  const themeColor =
    el(
      "analyticsThemeColor"
    );


  if (themeColor) {
    themeColor.content =
      isBasic
        ? "#105541"
        : "#123f72";
  }


  const modulesLink =
    el(
      "analyticsModulesLink"
    );


  if (modulesLink) {
    modulesLink.href =
      aclUrl(
        "modules.html",
        selectedEdition
      );
  }


  document.title =
    `${
      isBasic
        ? "Basic"
        : "Expert"
    } Edition Analytics | ACL`;


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

async function protectAnalyticsPage() {
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
        status,
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


  const filter =
    el(
      "analyticsModuleFilter"
    );


  if (!filter) {
    return;
  }


  filter.innerHTML = [
    `
      <option value="all">
        All modules
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
}


/* =========================================================
   LOAD ATTEMPTS
========================================================= */

async function loadAttempts() {
  const moduleIds =
    state.modules.map(
      (module) =>
        module.id
    );


  if (!moduleIds.length) {
    state.attempts =
      [];


    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "quiz_attempts"
      )
      .select(`
        id,
        user_id,
        module_id,
        module_title,
        quiz_id,
        quiz_title,
        status,
        score,
        question_count,
        answers,
        created_at,
        updated_at,
        completed_at
      `)
      .in(
        "module_id",
        moduleIds
      )
      .order(
        "updated_at",
        {
          ascending: false
        }
      );


  if (error) {
    throw error;
  }


  state.attempts =
    data ||
    [];
}


/* =========================================================
   LOAD PROFILES
========================================================= */

async function loadProfiles() {
  const {
    count,
    error: countError
  } =
    await supabaseClient
      .from(
        "profiles"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      );


  if (countError) {
    console.warn(
      "PROFILE COUNT ERROR:",
      countError
    );
  }


  state.totalRegisteredUsers =
    numberValue(
      count
    );


  const userIds =
    [
      ...new Set(
        state.attempts
          .map(
            (attempt) =>
              attempt.user_id
          )
          .filter(
            Boolean
          )
      )
    ];


  if (!userIds.length) {
    state.profiles =
      new Map();


    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "profiles"
      )
      .select(`
        id,
        display_name,
        full_name,
        username,
        email
      `)
      .in(
        "id",
        userIds
      );


  if (error) {
    throw error;
  }


  state.profiles =
    new Map(
      (
        data ||
        []
      ).map(
        (profile) => [
          profile.id,
          profile
        ]
      )
    );
}


/* =========================================================
   LOAD CHALLENGES
========================================================= */

async function loadChallenges() {
  const moduleIds =
    state.modules.map(
      (module) =>
        module.id
    );


  if (!moduleIds.length) {
    state.challenges =
      [];


    state.challengeParticipants =
      [];


    return;
  }


  const {
    data: challenges,
    error: challengeError
  } =
    await supabaseClient
      .from(
        "module_challenges"
      )
      .select(`
        id,
        module_id,
        creator_id,
        status,
        starts_at,
        ends_at,
        created_at
      `)
      .in(
        "module_id",
        moduleIds
      );


  if (challengeError) {
    console.warn(
      "CHALLENGE ANALYTICS ERROR:",
      challengeError
    );


    state.challenges =
      [];


    state.challengeParticipants =
      [];


    return;
  }


  state.challenges =
    challenges ||
    [];


  const challengeIds =
    state.challenges.map(
      (challenge) =>
        challenge.id
    );


  if (!challengeIds.length) {
    state.challengeParticipants =
      [];


    return;
  }


  const {
    data: participants,
    error: participantError
  } =
    await supabaseClient
      .from(
        "module_challenge_participants"
      )
      .select(`
        challenge_id,
        user_id,
        invitation_status,
        joined_at,
        completed_at
      `)
      .in(
        "challenge_id",
        challengeIds
      );


  if (participantError) {
    console.warn(
      "CHALLENGE PARTICIPANT ANALYTICS ERROR:",
      participantError
    );


    state.challengeParticipants =
      [];


    return;
  }


  state.challengeParticipants =
    participants ||
    [];
}


/* =========================================================
   LOAD ALL
========================================================= */

async function loadAllData() {
  await loadModules();


  await Promise.all([
    loadAttempts(),
    loadChallenges()
  ]);


  await loadProfiles();
}


/* =========================================================
   FILTERS
========================================================= */

function filteredAttempts() {
  const moduleFilter =
    el(
      "analyticsModuleFilter"
    )
      ?.value ||
    "all";


  const range =
    selectedDateRange();


  return state.attempts.filter(
    (attempt) => {
      const matchesModule =
        moduleFilter ===
          "all" ||
        String(
          attempt.module_id
        ) ===
          String(
            moduleFilter
          );


      const matchesDate =
        !range.from &&
        !range.to
          ? true
          : belongsToDateRange(
              attemptTimestamp(
                attempt
              ),
              range
            );


      return (
        matchesModule &&
        matchesDate
      );
    }
  );
}


function filteredChallenges() {
  const moduleFilter =
    el(
      "analyticsModuleFilter"
    )
      ?.value ||
    "all";


  const range =
    selectedDateRange();


  return state.challenges.filter(
    (challenge) => {
      const matchesModule =
        moduleFilter ===
          "all" ||
        String(
          challenge.module_id
        ) ===
          String(
            moduleFilter
          );


      const timestamp =
        challenge.created_at ||
        challenge.starts_at;


      const matchesDate =
        !range.from &&
        !range.to
          ? true
          : belongsToDateRange(
              timestamp,
              range
            );


      return (
        matchesModule &&
        matchesDate
      );
    }
  );
}


/* =========================================================
   METRICS
========================================================= */

function setMetric(
  id,
  value
) {
  const target =
    el(
      id
    );


  if (target) {
    target.textContent =
      String(
        value
      );
  }
}


function renderOverview() {
  const attempts =
    state.filteredAttempts;


  const completed =
    attempts.filter(
      (attempt) =>
        attempt.status ===
        "completed"
    );


  const activeLearners =
    new Set(
      attempts
        .map(
          (attempt) =>
            attempt.user_id
        )
        .filter(
          Boolean
        )
    ).size;


  const averageScore =
    completed.length
      ? (
          completed.reduce(
            (
              total,
              attempt
            ) =>
              total +
              numberValue(
                attempt.score
              ),
            0
          ) /
          completed.length
        ).toFixed(
          1
        )
      : "0.0";


  setMetric(
    "analyticsRegisteredUsers",
    state.totalRegisteredUsers
  );


  setMetric(
    "analyticsActiveLearners",
    activeLearners
  );


  setMetric(
    "analyticsCompletedAttempts",
    completed.length
  );


  setMetric(
    "analyticsAverageScore",
    averageScore
  );
}


/* =========================================================
   COMPLETION TREND
========================================================= */

function renderCompletionTrend() {
  const container =
    el(
      "analyticsCompletionChart"
    );


  if (!container) {
    return;
  }


  const completed =
    state.filteredAttempts.filter(
      (attempt) =>
        attempt.status ===
        "completed"
    );


  const counts =
    new Map();


  for (
    const attempt of
    completed
  ) {
    const key =
      dateKey(
        attemptTimestamp(
          attempt
        )
      );


    if (!key) {
      continue;
    }


    counts.set(
      key,
      (
        counts.get(
          key
        ) ||
        0
      ) +
      1
    );
  }


  const rows =
    [
      ...counts.entries()
    ]
      .sort(
        (
          first,
          second
        ) =>
          first[0].localeCompare(
            second[0]
          )
      )
      .slice(
        -14
      );


  if (!rows.length) {
    container.innerHTML = `
      <div>
        <strong>
          No completion data
        </strong>

        <span>
          No completed attempts match the selected filters.
        </span>
      </div>
    `;


    return;
  }


  const maximum =
    Math.max(
      ...rows.map(
        (
          [, count]
        ) =>
          count
      ),
      1
    );


  container.innerHTML = `
    <div
      style="
        width:100%;
        display:grid;
        gap:11px;
      "
    >
      ${rows.map(
        (
          [
            key,
            count
          ]
        ) => `
          <div
            style="
              display:grid;
              grid-template-columns:95px 1fr 38px;
              gap:10px;
              align-items:center;
            "
          >
            <span
              style="
                color:var(--analytics-muted);
                font-size:.78rem;
                font-weight:800;
              "
            >
              ${escapeHtml(
                key
              )}
            </span>

            <div
              style="
                height:12px;
                overflow:hidden;
                border-radius:999px;
                background:#e8eef4;
              "
            >
              <div
                style="
                  width:${Math.max(
                    5,
                    Math.round(
                      (
                        count /
                        maximum
                      ) *
                      100
                    )
                  )}%;
                  height:100%;
                  border-radius:inherit;
                  background:
                    linear-gradient(
                      90deg,
                      var(--analytics-primary),
                      var(--analytics-secondary)
                    );
                "
              ></div>
            </div>

            <strong
              style="
                color:var(--analytics-primary);
                text-align:right;
              "
            >
              ${count}
            </strong>
          </div>
        `
      ).join("")}
    </div>
  `;
}


/* =========================================================
   CONFIDENCE ANALYTICS
========================================================= */

function confidenceSummary() {
  const summary = {
    high: {
      total: 0,
      correct: 0
    },

    low: {
      total: 0,
      correct: 0
    }
  };


  for (
    const attempt of
    state.filteredAttempts
  ) {
    for (
      const answer of
      answersFromAttempt(
        attempt
      )
    ) {
      const confidence =
        normalizeConfidence(
          answer?.confidence
        );


      if (
        !summary[
          confidence
        ]
      ) {
        continue;
      }


      summary[
        confidence
      ].total +=
        1;


      if (
        answerIsCorrect(
          answer
        )
      ) {
        summary[
          confidence
        ].correct +=
          1;
      }
    }
  }


  return summary;
}


function renderConfidence() {
  const container =
    el(
      "analyticsConfidenceChart"
    );


  const summary =
    confidenceSummary();


  const total =
    summary.high.total +
    summary.low.total;


  const highShare =
    percentage(
      summary.high.total,
      total
    );


  const lowShare =
    percentage(
      summary.low.total,
      total
    );


  if (container) {
    if (!total) {
      container.innerHTML = `
        <div>
          <strong>
            No confidence data
          </strong>

          <span>
            No confidence-tagged responses match the filters.
          </span>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div
          style="
            width:100%;
            display:grid;
            gap:18px;
          "
        >
          <div>

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:12px;
                margin-bottom:7px;
              "
            >
              <strong
                style="
                  color:var(--analytics-primary);
                "
              >
                High confidence
              </strong>

              <span>
                ${highShare}%
              </span>
            </div>

            <div
              style="
                height:18px;
                overflow:hidden;
                border-radius:999px;
                background:#e8eef4;
              "
            >
              <div
                style="
                  width:${highShare}%;
                  height:100%;
                  border-radius:inherit;
                  background:var(--analytics-secondary);
                "
              ></div>
            </div>

          </div>


          <div>

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:12px;
                margin-bottom:7px;
              "
            >
              <strong
                style="
                  color:var(--analytics-primary);
                "
              >
                Low confidence
              </strong>

              <span>
                ${lowShare}%
              </span>
            </div>

            <div
              style="
                height:18px;
                overflow:hidden;
                border-radius:999px;
                background:#e8eef4;
              "
            >
              <div
                style="
                  width:${lowShare}%;
                  height:100%;
                  border-radius:inherit;
                  background:var(--analytics-accent);
                "
              ></div>
            </div>

          </div>


          <small
            style="
              color:var(--analytics-muted);
            "
          >
            ${total} confidence-tagged responses analyzed.
          </small>

        </div>
      `;
    }
  }


  const highAccuracy =
    percentage(
      summary.high.correct,
      summary.high.total
    );


  const lowAccuracy =
    percentage(
      summary.low.correct,
      summary.low.total
    );


  const highBar =
    el(
      "analyticsHighConfidenceBar"
    );


  const lowBar =
    el(
      "analyticsLowConfidenceBar"
    );


  if (highBar) {
    highBar.style.width =
      `${highAccuracy}%`;
  }


  if (lowBar) {
    lowBar.style.width =
      `${lowAccuracy}%`;
  }


  setMetric(
    "analyticsHighConfidenceAccuracy",
    formatPercentage(
      highAccuracy
    )
  );


  setMetric(
    "analyticsLowConfidenceAccuracy",
    formatPercentage(
      lowAccuracy
    )
  );
}


/* =========================================================
   MODULE PERFORMANCE
========================================================= */

function renderModuleTable() {
  const body =
    el(
      "analyticsModuleTableBody"
    );


  if (!body) {
    return;
  }


  const selectedModule =
    el(
      "analyticsModuleFilter"
    )
      ?.value ||
    "all";


  const modules =
    selectedModule ===
      "all"
      ? state.modules
      : state.modules.filter(
          (module) =>
            String(
              module.id
            ) ===
            String(
              selectedModule
            )
        );


  if (!modules.length) {
    body.innerHTML = `
      <tr>
        <td
          class="analytics-empty"
          colspan="6"
        >
          No modules belong to this edition.
        </td>
      </tr>
    `;


    return;
  }


  body.innerHTML =
    modules.map(
      (module) => {
        const attempts =
          state.filteredAttempts.filter(
            (attempt) =>
              String(
                attempt.module_id
              ) ===
              String(
                module.id
              )
          );


        const completed =
          attempts.filter(
            (attempt) =>
              attempt.status ===
              "completed"
          );


        const averageScore =
          completed.length
            ? (
                completed.reduce(
                  (
                    total,
                    attempt
                  ) =>
                    total +
                    numberValue(
                      attempt.score
                    ),
                  0
                ) /
                completed.length
              ).toFixed(
                1
              )
            : "0.0";


        const learners =
          new Set(
            attempts
              .map(
                (attempt) =>
                  attempt.user_id
              )
              .filter(
                Boolean
              )
          ).size;


        return `
          <tr>

            <td>
              <strong>
                ${escapeHtml(
                  module.title
                )}
              </strong>
            </td>

            <td>
              ${attempts.length}
            </td>

            <td>
              ${completed.length}
            </td>

            <td>
              ${percentage(
                completed.length,
                attempts.length
              )}%
            </td>

            <td>
              ${averageScore}
            </td>

            <td>
              ${learners}
            </td>

          </tr>
        `;
      }
    ).join(
      ""
    );
}


/* =========================================================
   CHALLENGE ANALYTICS
========================================================= */

function renderChallenges() {
  const challenges =
    filteredChallenges();


  const challengeIds =
    new Set(
      challenges.map(
        (challenge) =>
          challenge.id
      )
    );


  const participants =
    state.challengeParticipants.filter(
      (participant) =>
        challengeIds.has(
          participant.challenge_id
        )
    );


  const joined =
    participants.filter(
      (participant) =>
        participant.invitation_status ===
          "joined" ||
        participant.joined_at
    ).length;


  const completed =
    participants.filter(
      (participant) =>
        participant.completed_at ||
        participant.invitation_status ===
          "completed"
    ).length;


  setMetric(
    "analyticsChallengesCreated",
    challenges.length
  );


  setMetric(
    "analyticsChallengesJoined",
    joined
  );


  setMetric(
    "analyticsChallengesCompleted",
    completed
  );


  const maximum =
    Math.max(
      challenges.length,
      joined,
      completed,
      1
    );


  const values = [
    [
      "analyticsChallengesCreatedBar",
      challenges.length
    ],

    [
      "analyticsChallengesJoinedBar",
      joined
    ],

    [
      "analyticsChallengesCompletedBar",
      completed
    ]
  ];


  for (
    const [
      id,
      value
    ] of
    values
  ) {
    const bar =
      el(
        id
      );


    if (bar) {
      bar.style.width =
        `${Math.round(
          (
            value /
            maximum
          ) *
          100
        )}%`;
    }
  }
}


/* =========================================================
   RECENT ACTIVITY
========================================================= */

function renderRecentActivity() {
  const body =
    el(
      "analyticsRecentActivityBody"
    );


  if (!body) {
    return;
  }


  const attempts =
    [
      ...state.filteredAttempts
    ]
      .sort(
        (
          first,
          second
        ) =>
          new Date(
            attemptTimestamp(
              second
            ) ||
            0
          ) -
          new Date(
            attemptTimestamp(
              first
            ) ||
            0
          )
      )
      .slice(
        0,
        20
      );


  if (!attempts.length) {
    body.innerHTML = `
      <tr>
        <td
          class="analytics-empty"
          colspan="5"
        >
          No learner activity matches the selected filters.
        </td>
      </tr>
    `;


    return;
  }


  body.innerHTML =
    attempts.map(
      (attempt) => `
        <tr>

          <td>
            ${escapeHtml(
              profileName(
                attempt.user_id
              )
            )}
          </td>

          <td>
            ${escapeHtml(
              attempt.module_title ||
              moduleName(
                attempt.module_id
              )
            )}
          </td>

          <td>
            ${escapeHtml(
              String(
                attempt.status ||
                "unknown"
              ).replaceAll(
                "_",
                " "
              )
            )}
          </td>

          <td>
            ${numberValue(
              attempt.score
            )}
          </td>

          <td>
            ${escapeHtml(
              formatDateTime(
                attemptTimestamp(
                  attempt
                )
              )
            )}
          </td>

        </tr>
      `
    ).join(
      ""
    );
}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAllAnalytics() {
  state.filteredAttempts =
    filteredAttempts();


  renderOverview();
  renderCompletionTrend();
  renderConfidence();
  renderModuleTable();
  renderChallenges();
  renderRecentActivity();


  setStatus(
    `Updated ${new Date().toLocaleString()}`,
    "success"
  );
}


/* =========================================================
   REFRESH
========================================================= */

async function refreshAnalytics() {
  const button =
    el(
      "refreshAnalytics"
    );


  if (button) {
    button.disabled =
      true;


    button.textContent =
      "Refreshing…";
  }


  setStatus(
    "Loading analytics…"
  );


  try {
    await loadAllData();


    renderAllAnalytics();
  } catch (error) {
    console.error(
      "ADMIN ANALYTICS ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Analytics could not be loaded.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled =
        false;


      button.textContent =
        "Refresh analytics";
    }
  }
}


/* =========================================================
   EVENTS
========================================================= */

el(
  "refreshAnalytics"
)
  ?.addEventListener(
    "click",
    refreshAnalytics
  );


el(
  "analyticsModuleFilter"
)
  ?.addEventListener(
    "change",
    renderAllAnalytics
  );


el(
  "analyticsDateFrom"
)
  ?.addEventListener(
    "change",
    renderAllAnalytics
  );


el(
  "analyticsDateTo"
)
  ?.addEventListener(
    "change",
    renderAllAnalytics
  );


/* =========================================================
   START
========================================================= */

async function startAnalyticsPage() {
  try {
    renderEdition();


    const profile =
      await protectAnalyticsPage();


    if (!profile) {
      return;
    }


    await refreshAnalytics();
  } catch (error) {
    console.error(
      "ANALYTICS INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "You are not authorized to view analytics.",
      "error"
    );
  }
}


void startAnalyticsPage();
