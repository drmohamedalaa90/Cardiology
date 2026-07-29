import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL ACHIEVEMENTS v1.0.0 LOADED"
);


/* =========================================================
   EDITION
========================================================= */

const selectedEdition =
  resolveAclEdition();


/* =========================================================
   PAGE STATE
========================================================= */

const state = {
  user: null,
  profile: null,

  modules: [],
  attempts: [],
  challengeStats: null,

  achievements: [],
  filteredAchievements: []
};


/* =========================================================
   ELEMENT HELPER
========================================================= */

const el =
  (id) =>
    document.getElementById(
      id
    );


/* =========================================================
   PAGE ELEMENTS
========================================================= */

const achievementsGrid =
  el(
    "achievementsGrid"
  );


const emptyState =
  el(
    "achievementsEmptyState"
  );


const statusBox =
  el(
    "achievementsStatus"
  );


const categoryFilter =
  el(
    "achievementsCategoryFilter"
  );


const stateFilter =
  el(
    "achievementsStateFilter"
  );


const refreshButton =
  el(
    "refreshAchievements"
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


function clamp(
  value,
  minimum,
  maximum
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}


function percentage(
  value,
  target
) {
  const safeTarget =
    numberValue(
      target
    );


  if (
    safeTarget <=
    0
  ) {
    return 0;
  }


  return clamp(
    Math.round(
      (
        numberValue(
          value
        ) /
        safeTarget
      ) *
      100
    ),
    0,
    100
  );
}


function formatDate(
  value
) {
  if (!value) {
    return "";
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
    return "";
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle:
        "medium"
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
  const confidence =
    String(
      value ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    confidence === "high" ||
    confidence === "high_confidence"
  ) {
    return "high";
  }


  if (
    confidence === "low" ||
    confidence === "low_confidence"
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


/* =========================================================
   STATUS
========================================================= */

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
    `achievements-status ${kind}`.trim();


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
      "achievementsEditionBadge"
    );


  if (badge) {
    badge.textContent =
      isBasic
        ? "BASIC EDITION"
        : "EXPERT EDITION";
  }


  const themeColor =
    el(
      "achievementsThemeColor"
    );


  if (themeColor) {
    themeColor.content =
      isBasic
        ? "#105541"
        : "#123f72";
  }


  const modulesLink =
    el(
      "achievementsModulesLink"
    );


  const progressLink =
    el(
      "achievementsProgressLink"
    );


  const leaderboardLink =
    el(
      "achievementsLeaderboardLink"
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


  if (leaderboardLink) {
    leaderboardLink.href =
      aclUrl(
        "leaderboard.html",
        selectedEdition
      );
  }


  document.title =
    `${
      isBasic
        ? "Basic"
        : "Expert"
    } Edition Achievements | ACL`;


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
      "Please sign in to view achievements."
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
        status
      `)
      .eq(
        "edition",
        selectedEdition
      );


  if (error) {
    throw error;
  }


  state.modules =
    data ||
    [];
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
      .eq(
        "user_id",
        state.user.id
      )
      .in(
        "module_id",
        moduleIds
      )
      .order(
        "updated_at",
        {
          ascending:
            false
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
   LOAD CHALLENGE STATISTICS
========================================================= */

async function loadChallengeStats() {
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
          completed_challenges,
          challenge_wins,
          total_challenge_score,
          average_duration_seconds
        `)
        .eq(
          "user_id",
          state.user.id
        )
        .maybeSingle();


    if (error) {
      throw error;
    }


    state.challengeStats =
      data ||
      {
        completed_challenges:
          0,

        challenge_wins:
          0,

        total_challenge_score:
          0,

        average_duration_seconds:
          0
      };
  } catch (error) {
    console.warn(
      "ACHIEVEMENT CHALLENGE STATS ERROR:",
      error
    );


    state.challengeStats = {
      completed_challenges:
        0,

      challenge_wins:
        0,

      total_challenge_score:
        0,

      average_duration_seconds:
        0
    };
  }
}


/* =========================================================
   LOAD ALL DATA
========================================================= */

async function loadAchievementData() {
  await loadModules();


  await Promise.all([
    loadAttempts(),
    loadChallengeStats()
  ]);
}


/* =========================================================
   LEARNING STATISTICS
========================================================= */

function completedAttempts() {
  return state.attempts.filter(
    (attempt) =>
      attempt.status ===
      "completed"
  );
}


function completedModuleCount() {
  return new Set(
    completedAttempts()
      .map(
        (attempt) =>
          attempt.module_id
      )
      .filter(
        Boolean
      )
  ).size;
}


function perfectScoreCount() {
  return completedAttempts().filter(
    (attempt) => {
      const score =
        numberValue(
          attempt.score
        );


      const questionCount =
        numberValue(
          attempt.question_count
        );


      return (
        questionCount >
          0 &&
        score >=
          questionCount
      );
    }
  ).length;
}


function totalCorrectAnswers() {
  return state.attempts.reduce(
    (
      total,
      attempt
    ) =>
      total +
      answersFromAttempt(
        attempt
      ).filter(
        answerIsCorrect
      ).length,
    0
  );
}


function totalAnsweredQuestions() {
  return state.attempts.reduce(
    (
      total,
      attempt
    ) =>
      total +
      answersFromAttempt(
        attempt
      ).length,
    0
  );
}


function overallAccuracy() {
  const answered =
    totalAnsweredQuestions();


  if (!answered) {
    return 0;
  }


  return Math.round(
    (
      totalCorrectAnswers() /
      answered
    ) *
    100
  );
}


function highConfidenceCorrectCount() {
  let count =
    0;


  for (
    const attempt of
    state.attempts
  ) {
    for (
      const answer of
      answersFromAttempt(
        attempt
      )
    ) {
      if (
        normalizeConfidence(
          answer?.confidence
        ) ===
          "high" &&
        answerIsCorrect(
          answer
        )
      ) {
        count +=
          1;
      }
    }
  }


  return count;
}


function lowConfidenceCorrectCount() {
  let count =
    0;


  for (
    const attempt of
    state.attempts
  ) {
    for (
      const answer of
      answersFromAttempt(
        attempt
      )
    ) {
      if (
        normalizeConfidence(
          answer?.confidence
        ) ===
          "low" &&
        answerIsCorrect(
          answer
        )
      ) {
        count +=
          1;
      }
    }
  }


  return count;
}


function totalScore() {
  return completedAttempts().reduce(
    (
      total,
      attempt
    ) =>
      total +
      numberValue(
        attempt.score
      ),
    0
  );
}


/* =========================================================
   STREAK CALCULATION
========================================================= */

function calculateStreaks() {
  const activityDays =
    [
      ...new Set(
        state.attempts
          .map(
            (attempt) =>
              dateKey(
                attemptTimestamp(
                  attempt
                )
              )
          )
          .filter(
            Boolean
          )
      )
    ].sort();


  if (!activityDays.length) {
    return {
      current:
        0,

      best:
        0
    };
  }


  let best =
    1;


  let running =
    1;


  for (
    let index =
      1;

    index <
      activityDays.length;

    index +=
      1
  ) {
    const previous =
      new Date(
        `${activityDays[
          index -
          1
        ]}T12:00:00`
      );


    const current =
      new Date(
        `${activityDays[
          index
        ]}T12:00:00`
      );


    const differenceDays =
      Math.round(
        (
          current -
          previous
        ) /
        86400000
      );


    if (
      differenceDays ===
      1
    ) {
      running +=
        1;
    } else {
      running =
        1;
    }


    best =
      Math.max(
        best,
        running
      );
  }


  const today =
    new Date();


  const todayKey =
    dateKey(
      today
    );


  const yesterday =
    new Date(
      today
    );


  yesterday.setDate(
    yesterday.getDate() -
    1
  );


  const yesterdayKey =
    dateKey(
      yesterday
    );


  const latest =
    activityDays[
      activityDays.length -
      1
    ];


  let current =
    0;


  if (
    latest ===
      todayKey ||
    latest ===
      yesterdayKey
  ) {
    current =
      1;


    for (
      let index =
        activityDays.length -
        1;

      index >
        0;

      index -=
        1
    ) {
      const later =
        new Date(
          `${activityDays[
            index
          ]}T12:00:00`
        );


      const earlier =
        new Date(
          `${activityDays[
            index -
            1
          ]}T12:00:00`
        );


      const differenceDays =
        Math.round(
          (
            later -
            earlier
          ) /
          86400000
        );


      if (
        differenceDays !==
        1
      ) {
        break;
      }


      current +=
        1;
    }
  }


  return {
    current,
    best
  };
}


/* =========================================================
   UNLOCK DATE HELPERS
========================================================= */

function sortedCompletedAttempts() {
  return [
    ...completedAttempts()
  ].sort(
    (
      first,
      second
    ) =>
      new Date(
        attemptTimestamp(
          first
        ) ||
        0
      ) -
      new Date(
        attemptTimestamp(
          second
        ) ||
        0
      )
  );
}


function attemptUnlockDate(
  targetCount
) {
  const attempts =
    sortedCompletedAttempts();


  if (
    attempts.length <
    targetCount
  ) {
    return "";
  }


  return attemptTimestamp(
    attempts[
      targetCount -
      1
    ]
  );
}


function perfectScoreUnlockDate(
  targetCount
) {
  const perfectAttempts =
    sortedCompletedAttempts().filter(
      (attempt) => {
        const score =
          numberValue(
            attempt.score
          );


        const questionCount =
          numberValue(
            attempt.question_count
          );


        return (
          questionCount >
            0 &&
          score >=
            questionCount
        );
      }
    );


  if (
    perfectAttempts.length <
    targetCount
  ) {
    return "";
  }


  return attemptTimestamp(
    perfectAttempts[
      targetCount -
      1
    ]
  );
}


/* =========================================================
   ACHIEVEMENT DEFINITIONS
========================================================= */

function achievementDefinitions() {
  const completed =
    completedAttempts().length;


  const completedModules =
    completedModuleCount();


  const perfectScores =
    perfectScoreCount();


  const accuracy =
    overallAccuracy();


  const highConfidenceCorrect =
    highConfidenceCorrectCount();


  const lowConfidenceCorrect =
    lowConfidenceCorrectCount();


  const score =
    totalScore();


  const streaks =
    calculateStreaks();


  const challengeWins =
    numberValue(
      state.challengeStats
        ?.challenge_wins
    );


  const completedChallenges =
    numberValue(
      state.challengeStats
        ?.completed_challenges
    );


  const editionName =
    selectedEdition ===
      "basic"
      ? "Basic"
      : "Expert";


  return [
    {
      id:
        "first-step",

      category:
        "learning",

      icon:
        "🚀",

      title:
        "First Step",

      description:
        "Complete your first ACL learning attempt.",

      value:
        completed,

      target:
        1,

      unlockedAt:
        attemptUnlockDate(
          1
        )
    },


    {
      id:
        "committed-learner",

      category:
        "learning",

      icon:
        "📚",

      title:
        "Committed Learner",

      description:
        "Complete five learning attempts.",

      value:
        completed,

      target:
        5,

      unlockedAt:
        attemptUnlockDate(
          5
        )
    },


    {
      id:
        "knowledge-marathon",

      category:
        "learning",

      icon:
        "🧠",

      title:
        "Knowledge Marathon",

      description:
        "Complete twenty learning attempts.",

      value:
        completed,

      target:
        20,

      unlockedAt:
        attemptUnlockDate(
          20
        )
    },


    {
      id:
        "module-explorer",

      category:
        "learning",

      icon:
        "🧭",

      title:
        "Module Explorer",

      description:
        "Complete at least three different modules.",

      value:
        completedModules,

      target:
        3,

      unlockedAt:
        ""
    },


    {
      id:
        "pathway-master",

      category:
        "edition",

      icon:
        "🏛️",

      title:
        `${editionName} Pathway Master`,

      description:
        `Complete every available ${editionName} Edition module.`,

      value:
        completedModules,

      target:
        Math.max(
          1,
          state.modules.length
        ),

      unlockedAt:
        ""
    },


    {
      id:
        "perfect-start",

      category:
        "accuracy",

      icon:
        "🎯",

      title:
        "Perfect Start",

      description:
        "Achieve your first perfect quiz score.",

      value:
        perfectScores,

      target:
        1,

      unlockedAt:
        perfectScoreUnlockDate(
          1
        )
    },


    {
      id:
        "perfectionist",

      category:
        "accuracy",

      icon:
        "💯",

      title:
        "Perfectionist",

      description:
        "Achieve five perfect quiz scores.",

      value:
        perfectScores,

      target:
        5,

      unlockedAt:
        perfectScoreUnlockDate(
          5
        )
    },


    {
      id:
        "accuracy-ace",

      category:
        "accuracy",

      icon:
        "🏹",

      title:
        "Accuracy Ace",

      description:
        "Reach at least 80% overall answer accuracy.",

      value:
        accuracy,

      target:
        80,

      unit:
        "%",

      unlockedAt:
        ""
    },


    {
      id:
        "clinical-sharpshooter",

      category:
        "accuracy",

      icon:
        "🔬",

      title:
        "Clinical Sharpshooter",

      description:
        "Reach at least 90% overall answer accuracy.",

      value:
        accuracy,

      target:
        90,

      unit:
        "%",

      unlockedAt:
        ""
    },


    {
      id:
        "confident-and-correct",

      category:
        "confidence",

      icon:
        "⚡",

      title:
        "Confident and Correct",

      description:
        "Answer ten questions correctly with high confidence.",

      value:
        highConfidenceCorrect,

      target:
        10,

      unlockedAt:
        ""
    },


    {
      id:
        "confidence-master",

      category:
        "confidence",

      icon:
        "🧩",

      title:
        "Confidence Master",

      description:
        "Answer fifty questions correctly with high confidence.",

      value:
        highConfidenceCorrect,

      target:
        50,

      unlockedAt:
        ""
    },


    {
      id:
        "thoughtful-learner",

      category:
        "confidence",

      icon:
        "🤔",

      title:
        "Thoughtful Learner",

      description:
        "Answer ten questions correctly after choosing low confidence.",

      value:
        lowConfidenceCorrect,

      target:
        10,

      unlockedAt:
        ""
    },


    {
      id:
        "three-day-streak",

      category:
        "streak",

      icon:
        "🔥",

      title:
        "Three-Day Streak",

      description:
        "Learn on three consecutive days.",

      value:
        streaks.best,

      target:
        3,

      unit:
        " days",

      unlockedAt:
        ""
    },


    {
      id:
        "weekly-streak",

      category:
        "streak",

      icon:
        "📆",

      title:
        "Weekly Streak",

      description:
        "Learn on seven consecutive days.",

      value:
        streaks.best,

      target:
        7,

      unit:
        " days",

      unlockedAt:
        ""
    },


    {
      id:
        "unstoppable",

      category:
        "streak",

      icon:
        "🌟",

      title:
        "Unstoppable",

      description:
        "Learn on thirty consecutive days.",

      value:
        streaks.best,

      target:
        30,

      unit:
        " days",

      unlockedAt:
        ""
    },


    {
      id:
        "first-challenge",

      category:
        "challenge",

      icon:
        "⚔️",

      title:
        "First Challenge",

      description:
        "Complete your first head-to-head challenge.",

      value:
        completedChallenges,

      target:
        1,

      unlockedAt:
        ""
    },


    {
      id:
        "challenge-winner",

      category:
        "challenge",

      icon:
        "🏆",

      title:
        "Challenge Winner",

      description:
        "Win your first ACL challenge.",

      value:
        challengeWins,

      target:
        1,

      unlockedAt:
        ""
    },


    {
      id:
        "challenge-champion",

      category:
        "challenge",

      icon:
        "👑",

      title:
        "Challenge Champion",

      description:
        "Win ten ACL challenges.",

      value:
        challengeWins,

      target:
        10,

      unlockedAt:
        ""
    },


    {
      id:
        "point-collector",

      category:
        "learning",

      icon:
        "💎",

      title:
        "Point Collector",

      description:
        "Accumulate fifty ACL quiz points.",

      value:
        score,

      target:
        50,

      unlockedAt:
        ""
    },


    {
      id:
        "century-club",

      category:
        "learning",

      icon:
        "🏅",

      title:
        "Century Club",

      description:
        "Accumulate one hundred ACL quiz points.",

      value:
        score,

      target:
        100,

      unlockedAt:
        ""
    }
  ].map(
    (achievement) => {
      const unlocked =
        achievement.value >=
        achievement.target;


      const progress =
        percentage(
          achievement.value,
          achievement.target
        );


      const stateName =
        unlocked
          ? "unlocked"
          : achievement.value >
              0
            ? "in_progress"
            : "locked";


      return {
        ...achievement,

        unlocked,
        progress,
        state:
          stateName
      };
    }
  );
}


/* =========================================================
   FILTER ACHIEVEMENTS
========================================================= */

function applyFilters() {
  const selectedCategory =
    categoryFilter
      ?.value ||
    "all";


  const selectedState =
    stateFilter
      ?.value ||
    "all";


  state.filteredAchievements =
    state.achievements.filter(
      (achievement) => {
        const matchesCategory =
          selectedCategory ===
            "all" ||
          achievement.category ===
            selectedCategory;


        const matchesState =
          selectedState ===
            "all" ||
          achievement.state ===
            selectedState;


        return (
          matchesCategory &&
          matchesState
        );
      }
    );


  renderAchievementGrid();
}


/* =========================================================
   SUMMARY
========================================================= */

function setSummaryValue(
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


function renderSummary() {
  const unlocked =
    state.achievements.filter(
      (achievement) =>
        achievement.unlocked
    ).length;


  const total =
    state.achievements.length;


  const completion =
    percentage(
      unlocked,
      total
    );


  const streaks =
    calculateStreaks();


  setSummaryValue(
    "achievementsUnlockedCount",
    unlocked
  );


  setSummaryValue(
    "achievementsTotalCount",
    total
  );


  setSummaryValue(
    "achievementsCompletionPercentage",
    `${completion}%`
  );


  setSummaryValue(
    "achievementsCurrentStreak",
    `${streaks.current} day${
      streaks.current ===
        1
        ? ""
        : "s"
    }`
  );


  const ring =
    el(
      "achievementsProgressRing"
    );


  const ringValue =
    el(
      "achievementsProgressRingValue"
    );


  if (ring) {
    ring.style.background = `
      conic-gradient(
        var(--achievements-secondary)
        ${completion * 3.6}deg,
        #e8eef4
        ${completion * 3.6}deg
      )
    `;
  }


  if (ringValue) {
    ringValue.textContent =
      `${completion}%`;
  }
}


/* =========================================================
   NEXT GOALS
========================================================= */

function renderNextGoals() {
  const container =
    el(
      "achievementsNextGoals"
    );


  if (!container) {
    return;
  }


  const nextGoals =
    state.achievements
      .filter(
        (achievement) =>
          !achievement.unlocked
      )
      .sort(
        (
          first,
          second
        ) =>
          second.progress -
          first.progress
      )
      .slice(
        0,
        3
      );


  if (!nextGoals.length) {
    container.innerHTML = `
      <div class="achievements-next-goal-item">

        <strong>
          All achievements unlocked
        </strong>

        <span>
          Outstanding work — you have completed every available milestone.
        </span>

      </div>
    `;


    return;
  }


  container.innerHTML =
    nextGoals.map(
      (achievement) => `
        <div class="achievements-next-goal-item">

          <strong>
            ${escapeHtml(
              achievement.icon
            )}
            ${escapeHtml(
              achievement.title
            )}
          </strong>

          <span>
            ${escapeHtml(
              achievement.value
            )}${escapeHtml(
              achievement.unit ||
              ""
            )}
            of
            ${escapeHtml(
              achievement.target
            )}${escapeHtml(
              achievement.unit ||
              ""
            )}
            ·
            ${achievement.progress}% complete
          </span>

        </div>
      `
    ).join(
      ""
    );
}


/* =========================================================
   ACHIEVEMENT CARD HTML
========================================================= */

function achievementCardHtml(
  achievement
) {
  const stateLabel =
    achievement.unlocked
      ? "Unlocked"
      : achievement.state ===
          "in_progress"
        ? "In progress"
        : "Locked";


  const unlockedDate =
    achievement.unlockedAt
      ? formatDate(
          achievement.unlockedAt
        )
      : "";


  return `
    <article
      class="
        achievement-card
        ${escapeHtml(
          achievement.state
        )}
      "
    >

      <div
        class="achievement-icon"
        aria-hidden="true"
      >
        ${escapeHtml(
          achievement.icon
        )}
      </div>


      <span class="achievement-state-badge">
        ${escapeHtml(
          stateLabel
        )}
      </span>


      <h2>
        ${escapeHtml(
          achievement.title
        )}
      </h2>


      <p>
        ${escapeHtml(
          achievement.description
        )}
      </p>


      <div class="achievement-progress">

        <div class="achievement-progress-heading">

          <span>
            Progress
          </span>

          <strong>
            ${escapeHtml(
              achievement.value
            )}${escapeHtml(
              achievement.unit ||
              ""
            )}
            /
            ${escapeHtml(
              achievement.target
            )}${escapeHtml(
              achievement.unit ||
              ""
            )}
          </strong>

        </div>


        <div class="achievement-progress-track">

          <div
            class="achievement-progress-fill"
            style="
              width:
              ${achievement.progress}%;
            "
          ></div>

        </div>

      </div>


      ${
        achievement.unlocked
          ? `
            <span class="achievement-unlocked-date">
              ${
                unlockedDate
                  ? `Unlocked ${escapeHtml(
                      unlockedDate
                    )}`
                  : "Achievement unlocked"
              }
            </span>
          `
          : ""
      }

    </article>
  `;
}


/* =========================================================
   RENDER GRID
========================================================= */

function renderAchievementGrid() {
  if (
    !achievementsGrid ||
    !emptyState
  ) {
    return;
  }


  if (
    !state.filteredAchievements.length
  ) {
    achievementsGrid.innerHTML =
      "";


    emptyState.hidden =
      false;


    return;
  }


  emptyState.hidden =
    true;


  achievementsGrid.innerHTML =
    state.filteredAchievements
      .map(
        achievementCardHtml
      )
      .join(
        ""
      );
}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAchievements() {
  state.achievements =
    achievementDefinitions();


  renderSummary();
  renderNextGoals();
  applyFilters();


  setStatus(
    `Updated ${new Date().toLocaleString()}`,
    "success"
  );
}


/* =========================================================
   REFRESH
========================================================= */

async function refreshAchievements() {
  if (refreshButton) {
    refreshButton.disabled =
      true;


    refreshButton.textContent =
      "Refreshing…";
  }


  setStatus(
    "Loading achievements…"
  );


  try {
    await loadAchievementData();


    renderAchievements();
  } catch (error) {
    console.error(
      "ACHIEVEMENTS LOAD ERROR:",
      error
    );


    state.achievements =
      [];


    state.filteredAchievements =
      [];


    renderAchievementGrid();


    setStatus(
      error.message ||
      "Achievements could not be loaded.",
      "error"
    );
  } finally {
    if (refreshButton) {
      refreshButton.disabled =
        false;


      refreshButton.textContent =
        "Refresh achievements";
    }
  }
}


/* =========================================================
   EVENTS
========================================================= */

categoryFilter
  ?.addEventListener(
    "change",
    applyFilters
  );


stateFilter
  ?.addEventListener(
    "change",
    applyFilters
  );


refreshButton
  ?.addEventListener(
    "click",
    refreshAchievements
  );


/* =========================================================
   START
========================================================= */

async function startAchievementsPage() {
  try {
    renderEdition();


    const authenticated =
      await authenticateUser();


    if (!authenticated) {
      return;
    }


    await refreshAchievements();
  } catch (error) {
    console.error(
      "ACHIEVEMENTS INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Achievements could not be initialized.",
      "error"
    );
  }
}


void startAchievementsPage();
