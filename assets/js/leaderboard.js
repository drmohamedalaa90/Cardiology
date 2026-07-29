import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL LEADERBOARD v1.0.0 LOADED"
);


/* =========================================================
   PAGE STATE
========================================================= */

const selectedEdition =
  resolveAclEdition();


const state = {
  user: null,
  profile: null,

  activeTab: "general",

  modules: [],
  attempts: [],
  profiles: new Map(),
  challengeRows: [],

  leaderboardRows: []
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
    "leaderboardModuleFilter"
  );


const limitFilter =
  el(
    "leaderboardLimit"
  );


const refreshButton =
  el(
    "refreshLeaderboard"
  );


const statusBox =
  el(
    "leaderboardStatus"
  );


const tableBody =
  el(
    "leaderboardTableBody"
  );


const podium =
  el(
    "leaderboardPodium"
  );


const currentUserCard =
  el(
    "currentUserLeaderboardCard"
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


function formatDuration(
  seconds
) {
  const safeSeconds =
    Math.max(
      0,
      Math.round(
        numberValue(
          seconds
        )
      )
    );


  if (!safeSeconds) {
    return "—";
  }


  const minutes =
    Math.floor(
      safeSeconds /
      60
    );


  const remainder =
    safeSeconds %
    60;


  return `${minutes}:${String(
    remainder
  ).padStart(
    2,
    "0"
  )}`;
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
    "ACL Competitor"
  );
}


function profileUsername(
  userId
) {
  const profile =
    state.profiles.get(
      userId
    );


  return (
    profile?.username ||
    ""
  );
}


function profileAvatar(
  userId
) {
  return (
    state.profiles.get(
      userId
    )?.avatar_url ||
    ""
  );
}


function initialsFromName(
  name
) {
  return (
    String(
      name ||
      "ACL"
    )
      .trim()
      .split(
        /\s+/
      )
      .slice(
        0,
        2
      )
      .map(
        (part) =>
          part
            .charAt(
              0
            )
            .toUpperCase()
      )
      .join(
        ""
      ) ||
    "ACL"
  );
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
    `leaderboard-status ${kind}`.trim();


  statusBox.hidden =
    !message;
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
      "leaderboardEditionBadge"
    );


  if (badge) {
    badge.textContent =
      isBasic
        ? "BASIC EDITION"
        : "EXPERT EDITION";
  }


  const themeColor =
    el(
      "leaderboardThemeColor"
    );


  if (themeColor) {
    themeColor.content =
      isBasic
        ? "#105541"
        : "#123f72";
  }


  const modulesLink =
    el(
      "leaderboardModulesLink"
    );


  const progressLink =
    el(
      "leaderboardProgressLink"
    );


  if (modulesLink) {
    modulesLink.href =
      aclUrl(
        "modules.html",
        selectedEdition
      );
  }


  if (progressLink) {
    progressLink.href =
      aclUrl(
        "progress.html",
        selectedEdition
      );
  }


  document.title =
    `${
      isBasic
        ? "Basic"
        : "Expert"
    } Edition Leaderboard | ACL`;


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
   AUTHENTICATION
========================================================= */

async function authenticateUser() {
  const profile =
    await protectAndRender(
      "login.html"
    );


  if (!profile) {
    return false;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .getUser();


  if (error) {
    throw error;
  }


  if (!data?.user) {
    throw new Error(
      "Please sign in to view the leaderboard."
    );
  }


  state.user =
    data.user;


  state.profile =
    profile;


  return true;
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


  if (!moduleFilter) {
    return;
  }


  moduleFilter.innerHTML = [
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
      .eq(
        "status",
        "completed"
      )
      .order(
        "completed_at",
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
        email,
        avatar_url
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
   LOAD CHALLENGE LEADERBOARD
========================================================= */

async function loadChallengeRows() {
  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "module_challenge_leaderboard"
        )
        .select(`
          user_id,
          participant_name,
          username,
          avatar_url,
          completed_challenges,
          challenge_wins,
          total_challenge_score,
          average_duration_seconds
        `)
        .order(
          "challenge_wins",
          {
            ascending: false
          }
        )
        .order(
          "total_challenge_score",
          {
            ascending: false
          }
        )
        .order(
          "average_duration_seconds",
          {
            ascending: true
          }
        );


    if (error) {
      throw error;
    }


    state.challengeRows =
      data ||
      [];
  } catch (error) {
    console.warn(
      "CHALLENGE LEADERBOARD LOAD ERROR:",
      error
    );


    state.challengeRows =
      [];
  }
}


/* =========================================================
   ANSWER ANALYTICS
========================================================= */

function answersFromAttempt(
  attempt
) {
  return Array.isArray(
    attempt?.answers
  )
    ? attempt.answers
    : [];
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


function attemptCorrectCount(
  attempt
) {
  const answers =
    answersFromAttempt(
      attempt
    );


  if (answers.length) {
    return answers.filter(
      answerIsCorrect
    ).length;
  }


  const score =
    numberValue(
      attempt.score
    );


  const questionCount =
    numberValue(
      attempt.question_count
    );


  return Math.min(
    questionCount,
    Math.max(
      0,
      score
    )
  );
}


function attemptDurationSeconds(
  attempt
) {
  if (
    Number.isFinite(
      Number(
        attempt.duration_seconds
      )
    )
  ) {
    return Number(
      attempt.duration_seconds
    );
  }


  if (
    attempt.created_at &&
    attempt.completed_at
  ) {
    const start =
      new Date(
        attempt.created_at
      );


    const end =
      new Date(
        attempt.completed_at
      );


    const seconds =
      Math.round(
        (
          end -
          start
        ) /
        1000
      );


    return Math.max(
      0,
      seconds
    );
  }


  return 0;
}


/* =========================================================
   BUILD GENERAL / MODULE LEADERBOARD
========================================================= */

function buildAttemptLeaderboard() {
  const selectedModule =
    moduleFilter
      ?.value ||
    "all";


  const relevantAttempts =
    state.attempts.filter(
      (attempt) =>
        selectedModule ===
          "all" ||
        String(
          attempt.module_id
        ) ===
          String(
            selectedModule
          )
    );


  const grouped =
    new Map();


  for (
    const attempt of
    relevantAttempts
  ) {
    if (!attempt.user_id) {
      continue;
    }


    if (
      !grouped.has(
        attempt.user_id
      )
    ) {
      grouped.set(
        attempt.user_id,
        {
          userId:
            attempt.user_id,

          completed:
            0,

          score:
            0,

          correct:
            0,

          questions:
            0,

          totalDuration:
            0,

          timedAttempts:
            0,

          challengeWins:
            0
        }
      );
    }


    const row =
      grouped.get(
        attempt.user_id
      );


    row.completed +=
      1;


    row.score +=
      numberValue(
        attempt.score
      );


    row.correct +=
      attemptCorrectCount(
        attempt
      );


    row.questions +=
      numberValue(
        attempt.question_count
      );


    const duration =
      attemptDurationSeconds(
        attempt
      );


    if (
      duration >
      0
    ) {
      row.totalDuration +=
        duration;


      row.timedAttempts +=
        1;
    }
  }


  const challengeWinsByUser =
    new Map();


  for (
    const challengeRow of
    state.challengeRows
  ) {
    if (
      challengeRow.user_id
    ) {
      challengeWinsByUser.set(
        challengeRow.user_id,
        numberValue(
          challengeRow.challenge_wins
        )
      );
    }
  }


  const rows =
    [
      ...grouped.values()
    ].map(
      (row) => {
        const averageDuration =
          row.timedAttempts
            ? Math.round(
                row.totalDuration /
                row.timedAttempts
              )
            : 0;


        return {
          ...row,

          name:
            profileName(
              row.userId
            ),

          username:
            profileUsername(
              row.userId
            ),

          avatarUrl:
            profileAvatar(
              row.userId
            ),

          accuracy:
            percentage(
              row.correct,
              row.questions
            ),

          averageDuration,

          challengeWins:
            challengeWinsByUser.get(
              row.userId
            ) ||
            0
        };
      }
    );


  rows.sort(
    (
      first,
      second
    ) => {
      if (
        second.score !==
        first.score
      ) {
        return (
          second.score -
          first.score
        );
      }


      if (
        second.accuracy !==
        first.accuracy
      ) {
        return (
          second.accuracy -
          first.accuracy
        );
      }


      const firstTime =
        first.averageDuration ||
        Number.MAX_SAFE_INTEGER;


      const secondTime =
        second.averageDuration ||
        Number.MAX_SAFE_INTEGER;


      if (
        firstTime !==
        secondTime
      ) {
        return (
          firstTime -
          secondTime
        );
      }


      return first.name.localeCompare(
        second.name
      );
    }
  );


  return rows.map(
    (
      row,
      index
    ) => ({
      ...row,

      rank:
        index +
        1
    })
  );
}


/* =========================================================
   BUILD CHALLENGE LEADERBOARD
========================================================= */

function buildChallengeLeaderboard() {
  const rows =
    state.challengeRows.map(
      (row) => ({
        userId:
          row.user_id ||
          null,

        name:
          row.participant_name ||
          row.username ||
          "ACL Competitor",

        username:
          row.username ||
          "",

        avatarUrl:
          row.avatar_url ||
          "",

        completed:
          numberValue(
            row.completed_challenges
          ),

        score:
          numberValue(
            row.total_challenge_score
          ),

        accuracy:
          0,

        averageDuration:
          numberValue(
            row.average_duration_seconds
          ),

        challengeWins:
          numberValue(
            row.challenge_wins
          )
      })
    );


  rows.sort(
    (
      first,
      second
    ) => {
      if (
        second.challengeWins !==
        first.challengeWins
      ) {
        return (
          second.challengeWins -
          first.challengeWins
        );
      }


      if (
        second.score !==
        first.score
      ) {
        return (
          second.score -
          first.score
        );
      }


      const firstTime =
        first.averageDuration ||
        Number.MAX_SAFE_INTEGER;


      const secondTime =
        second.averageDuration ||
        Number.MAX_SAFE_INTEGER;


      return (
        firstTime -
        secondTime
      );
    }
  );


  return rows.map(
    (
      row,
      index
    ) => ({
      ...row,

      rank:
        index +
        1
    })
  );
}


/* =========================================================
   CURRENT TAB
========================================================= */

function leaderboardRowsForCurrentTab() {
  if (
    state.activeTab ===
    "challenge"
  ) {
    return buildChallengeLeaderboard();
  }


  return buildAttemptLeaderboard();
}


/* =========================================================
   TABLE COPY
========================================================= */

function renderTabCopy() {
  const title =
    el(
      "leaderboardTableTitle"
    );


  const description =
    el(
      "leaderboardTableDescription"
    );


  if (
    state.activeTab ===
    "general"
  ) {
    if (title) {
      title.textContent =
        "General leaderboard";
    }


    if (description) {
      description.textContent =
        "Ranked by accumulated score, accuracy, then shortest average completion time.";
    }


    if (moduleFilter) {
      moduleFilter.disabled =
        false;
    }


    return;
  }


  if (
    state.activeTab ===
    "module"
  ) {
    if (title) {
      title.textContent =
        "Module leaderboard";
    }


    if (description) {
      description.textContent =
        "Select a module to compare performance within that module.";
    }


    if (moduleFilter) {
      moduleFilter.disabled =
        false;


      if (
        moduleFilter.value ===
        "all" &&
        state.modules.length
      ) {
        moduleFilter.value =
          String(
            state.modules[0].id
          );
      }
    }


    return;
  }


  if (title) {
    title.textContent =
      "Challenge leaderboard";
  }


  if (description) {
    description.textContent =
      "Ranked by challenge wins, total challenge score, then shortest average time.";
  }


  if (moduleFilter) {
    moduleFilter.disabled =
      true;
  }
}


/* =========================================================
   PODIUM
========================================================= */

function setPodiumPosition(
  prefix,
  row,
  fallbackLabel
) {
  const avatar =
    el(
      `podium${prefix}Avatar`
    );


  const name =
    el(
      `podium${prefix}Name`
    );


  const subtitle =
    el(
      `podium${prefix}Subtitle`
    );


  const score =
    el(
      `podium${prefix}Score`
    );


  const time =
    el(
      `podium${prefix}Time`
    );


  if (!row) {
    if (avatar) {
      avatar.textContent =
        "—";
    }


    if (name) {
      name.textContent =
        "Waiting";
    }


    if (subtitle) {
      subtitle.textContent =
        fallbackLabel;
    }


    if (score) {
      score.textContent =
        "—";
    }


    if (time) {
      time.textContent =
        "—";
    }


    return;
  }


  if (avatar) {
    if (row.avatarUrl) {
      avatar.innerHTML = `
        <img
          src="${escapeHtml(
            row.avatarUrl
          )}"
          alt=""
          class="podium-avatar"
          style="
            width:100%;
            height:100%;
            margin:0;
          "
        >
      `;
    } else {
      avatar.textContent =
        initialsFromName(
          row.name
        );
    }
  }


  if (name) {
    name.textContent =
      row.name;
  }


  if (subtitle) {
    subtitle.textContent =
      row.username
        ? `@${row.username}`
        : fallbackLabel;
  }


  if (score) {
    score.textContent =
      state.activeTab ===
        "challenge"
        ? `${row.challengeWins} wins`
        : `${row.score} pts`;
  }


  if (time) {
    time.textContent =
      row.averageDuration
        ? `${formatDuration(
            row.averageDuration
          )} average`
        : "No time recorded";
  }
}


function renderPodium(
  rows
) {
  if (!podium) {
    return;
  }


  podium.hidden =
    rows.length ===
    0;


  setPodiumPosition(
    "First",
    rows[0],
    "First place"
  );


  setPodiumPosition(
    "Second",
    rows[1],
    "Second place"
  );


  setPodiumPosition(
    "Third",
    rows[2],
    "Third place"
  );
}


/* =========================================================
   CURRENT USER CARD
========================================================= */

function renderCurrentUser(
  rows
) {
  if (
    !currentUserCard ||
    !state.user
  ) {
    return;
  }


  const row =
    rows.find(
      (item) =>
        String(
          item.userId
        ) ===
        String(
          state.user.id
        )
    );


  if (!row) {
    currentUserCard.hidden =
      true;


    return;
  }


  currentUserCard.hidden =
    false;


  el(
    "currentUserLeaderboardRank"
  ).textContent =
    `#${row.rank}`;


  el(
    "currentUserLeaderboardName"
  ).textContent =
    row.name;


  el(
    "currentUserLeaderboardSubtitle"
  ).textContent =
    state.activeTab ===
      "challenge"
      ? "Your challenge ranking"
      : "Your current ACL ranking";


  el(
    "currentUserLeaderboardScore"
  ).textContent =
    state.activeTab ===
      "challenge"
      ? `${row.challengeWins} wins`
      : `${row.score} pts`;


  el(
    "currentUserLeaderboardAccuracy"
  ).textContent =
    state.activeTab ===
      "challenge"
      ? "—"
      : `${row.accuracy}%`;


  el(
    "currentUserLeaderboardTime"
  ).textContent =
    formatDuration(
      row.averageDuration
    );
}


/* =========================================================
   TABLE
========================================================= */

function renderTable(
  rows
) {
  if (!tableBody) {
    return;
  }


  const requestedLimit =
    Math.max(
      1,
      numberValue(
        limitFilter
          ?.value ||
        50,
        50
      )
    );


  const visibleRows =
    rows.slice(
      0,
      requestedLimit
    );


  const resultCount =
    el(
      "leaderboardResultCount"
    );


  if (resultCount) {
    resultCount.textContent =
      `${visibleRows.length} competitor${
        visibleRows.length ===
          1
          ? ""
          : "s"
      }`;
  }


  if (!visibleRows.length) {
    tableBody.innerHTML = `
      <tr>
        <td
          class="leaderboard-empty"
          colspan="7"
        >
          No leaderboard data is available for this selection.
        </td>
      </tr>
    `;


    return;
  }


  tableBody.innerHTML =
    visibleRows.map(
      (row) => {
        const isCurrentUser =
          state.user &&
          row.userId &&
          String(
            row.userId
          ) ===
          String(
            state.user.id
          );


        const medal =
          row.rank ===
            1
            ? "🥇"
            : row.rank ===
                2
              ? "🥈"
              : row.rank ===
                  3
                ? "🥉"
                : `#${row.rank}`;


        const avatarHtml =
          row.avatarUrl
            ? `
              <img
                src="${escapeHtml(
                  row.avatarUrl
                )}"
                alt=""
                class="leaderboard-avatar"
              >
            `
            : `
              <span
                class="leaderboard-avatar"
                aria-hidden="true"
              >
                ${escapeHtml(
                  initialsFromName(
                    row.name
                  )
                )}
              </span>
            `;


        return `
          <tr
            class="${
              isCurrentUser
                ? "current-user"
                : ""
            }"
          >

            <td class="leaderboard-rank-cell">
              ${medal}
            </td>


            <td>

              <div class="leaderboard-person">

                ${avatarHtml}

                <div>

                  <strong>
                    ${escapeHtml(
                      row.name
                    )}
                  </strong>

                  <small>
                    ${
                      row.username
                        ? `@${escapeHtml(
                            row.username
                          )}`
                        : isCurrentUser
                          ? "You"
                          : "ACL competitor"
                    }
                  </small>

                </div>

              </div>

            </td>


            <td>
              ${row.completed}
            </td>


            <td>
              ${row.score}
            </td>


            <td>
              ${
                state.activeTab ===
                  "challenge"
                  ? "—"
                  : `${row.accuracy}%`
              }
            </td>


            <td>
              ${formatDuration(
                row.averageDuration
              )}
            </td>


            <td>
              ${row.challengeWins}
            </td>

          </tr>
        `;
      }
    ).join(
      ""
    );
}


/* =========================================================
   RENDER ALL
========================================================= */

function renderLeaderboard() {
  renderTabCopy();


  const rows =
    leaderboardRowsForCurrentTab();


  state.leaderboardRows =
    rows;


  renderPodium(
    rows
  );


  renderCurrentUser(
    rows
  );


  renderTable(
    rows
  );


  setStatus(
    `Updated ${new Date().toLocaleString()}`,
    "success"
  );
}


/* =========================================================
   LOAD ALL DATA
========================================================= */

async function loadAllData() {
  await loadModules();


  await Promise.all([
    loadAttempts(),
    loadChallengeRows()
  ]);


  await loadProfiles();
}


/* =========================================================
   REFRESH
========================================================= */

async function refreshLeaderboard() {
  if (refreshButton) {
    refreshButton.disabled =
      true;


    refreshButton.textContent =
      "Refreshing…";
  }


  setStatus(
    "Loading leaderboard…"
  );


  try {
    await loadAllData();


    renderLeaderboard();
  } catch (error) {
    console.error(
      "LEADERBOARD LOAD ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The leaderboard could not be loaded.",
      "error"
    );


    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td
            class="leaderboard-empty"
            colspan="7"
          >
            The leaderboard could not be loaded.
          </td>
        </tr>
      `;
    }
  } finally {
    if (refreshButton) {
      refreshButton.disabled =
        false;


      refreshButton.textContent =
        "Refresh leaderboard";
    }
  }
}


/* =========================================================
   TAB EVENTS
========================================================= */

document.addEventListener(
  "click",
  (event) => {
    const tab =
      event.target.closest(
        "[data-leaderboard-tab]"
      );


    if (!tab) {
      return;
    }


    const nextTab =
      tab.dataset
        .leaderboardTab;


    if (
      ![
        "general",
        "module",
        "challenge"
      ].includes(
        nextTab
      )
    ) {
      return;
    }


    state.activeTab =
      nextTab;


    document
      .querySelectorAll(
        "[data-leaderboard-tab]"
      )
      .forEach(
        (button) => {
          button.classList.toggle(
            "active",
            button ===
              tab
          );
        }
      );


    renderLeaderboard();
  }
);


/* =========================================================
   FILTER EVENTS
========================================================= */

moduleFilter
  ?.addEventListener(
    "change",
    renderLeaderboard
  );


limitFilter
  ?.addEventListener(
    "change",
    renderLeaderboard
  );


refreshButton
  ?.addEventListener(
    "click",
    refreshLeaderboard
  );


/* =========================================================
   START PAGE
========================================================= */

async function startLeaderboardPage() {
  try {
    renderEdition();


    const authenticated =
      await authenticateUser();


    if (!authenticated) {
      return;
    }


    await refreshLeaderboard();
  } catch (error) {
    console.error(
      "LEADERBOARD INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The leaderboard could not be initialized.",
      "error"
    );
  }
}


void startLeaderboardPage();
