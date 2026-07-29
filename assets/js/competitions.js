import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL PUBLIC COMPETITIONS v3.0.0 LOADED"
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


let modules =
  [];


let competitions =
  [];


let timerId =
  null;


let isLoading =
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


function formatDateTime(
  value
) {
  if (!value) {
    return "Not scheduled";
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
    return "Invalid date";
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  ).format(
    date
  );
}


function formatCountdown(
  milliseconds
) {
  const totalSeconds =
    Math.max(
      0,
      Math.floor(
        milliseconds /
        1000
      )
    );


  const days =
    Math.floor(
      totalSeconds /
      86400
    );


  const hours =
    Math.floor(
      (
        totalSeconds %
        86400
      ) /
      3600
    );


  const minutes =
    Math.floor(
      (
        totalSeconds %
        3600
      ) /
      60
    );


  const seconds =
    totalSeconds %
    60;


  const parts =
    [];


  if (days) {
    parts.push(
      `${days}d`
    );
  }


  parts.push(
    `${hours}h`,
    `${minutes}m`,
    `${seconds}s`
  );


  return parts.join(
    " "
  );
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


function moduleIds() {
  return modules
    .map(
      (module) =>
        module.id
    )
    .filter(
      Boolean
    );
}


function moduleName(
  moduleId
) {
  return (
    modules.find(
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


/* =========================================================
   EDITION CONTEXT
========================================================= */

function applyEditionContext() {
  const isBasic =
    selectedEdition ===
    "basic";


  const badge =
    byId(
      "competitionsEditionBadge"
    );


  const themeColor =
    byId(
      "competitionsThemeColor"
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


  const links = {
    competitionsModulesLink:
      "modules.html",

    competitionsProgressLink:
      "progress.html"
  };


  Object.entries(
    links
  ).forEach(
    (
      [
        id,
        path
      ]
    ) => {
      const link =
        byId(
          id
        );


      if (link) {
        link.href =
          aclUrl(
            path,
            selectedEdition
          );
      }
    }
  );


  document.title =
    `ACL ${
      isBasic
        ? "Basic Edition"
        : "Expert Edition"
    } Competitions`;


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
   COMPETITION STATE
========================================================= */

function competitionState(
  competition
) {
  const now =
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
    Number.isFinite(
      opensAt
    ) &&
    now <
      opensAt
  ) {
    return "upcoming";
  }


  if (
    Number.isFinite(
      closesAt
    ) &&
    now >
      closesAt
  ) {
    return "closed";
  }


  return "live";
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
          ascending:
            true
        }
      )
      .order(
        "title",
        {
          ascending:
            true
        }
      );


  if (error) {
    throw error;
  }


  modules =
    data ||
    [];


  byId(
    "competitionModuleFilter"
  ).innerHTML = [
    `
      <option value="all">
        All modules
      </option>
    `,

    ...modules.map(
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
   LOAD COMPETITIONS
========================================================= */

async function loadCompetitions() {
  if (isLoading) {
    return;
  }


  isLoading =
    true;


  const refreshButton =
    byId(
      "refreshCompetitions"
    );


  setButtonBusy(
    refreshButton,
    true,
    "Refreshing…",
    "Refresh"
  );


  setStatus(
    "Loading competitions…"
  );


  byId(
    "competitionList"
  ).innerHTML = `
    <div class="competition-empty">
      Loading competitions…
    </div>
  `;


  try {
    const ids =
      moduleIds();


    if (!ids.length) {
      competitions =
        [];


      renderCompetitions();


      setStatus(
        "No competition modules are available in this edition."
      );


      return;
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
          "status",
          "published"
        )
        .in(
          "module_id",
          ids
        )
        .order(
          "opens_at",
          {
            ascending:
              true
          }
        );


    if (error) {
      throw error;
    }


    competitions =
      data ||
      [];


    renderCompetitions();


    setStatus(
      ""
    );


    startCountdownTimer();
  } catch (error) {
    console.error(
      "PUBLIC COMPETITION LOAD ERROR:",
      error
    );


    competitions =
      [];


    byId(
      "competitionList"
    ).innerHTML = `
      <div class="competition-empty">
        Competitions could not be loaded.
      </div>
    `;


    setStatus(
      error.message ||
      "Competitions could not be loaded.",
      "error"
    );
  } finally {
    isLoading =
      false;


    setButtonBusy(
      refreshButton,
      false,
      "Refreshing…",
      "Refresh"
    );
  }
}


/* =========================================================
   FILTERING
========================================================= */

function filteredCompetitions() {
  const selectedState =
    byId(
      "competitionStateFilter"
    ).value;


  const selectedModule =
    byId(
      "competitionModuleFilter"
    ).value;


  return competitions.filter(
    (competition) => {
      const state =
        competitionState(
          competition
        );


      const matchesState =
        selectedState === "all" ||
        state ===
          selectedState;


      const matchesModule =
        selectedModule === "all" ||
        String(
          competition.module_id
        ) ===
        String(
          selectedModule
        );


      return (
        matchesState &&
        matchesModule
      );
    }
  );
}


/* =========================================================
   CARD URLS
========================================================= */

function competitionUrl(
  competition,
  state
) {
  const path =
    state === "live"
      ? `competition.html?id=${encodeURIComponent(
          competition.id
        )}`
      : `competition-dashboard.html?id=${encodeURIComponent(
          competition.id
        )}`;


  return aclUrl(
    path,
    selectedEdition
  );
}


function resultsUrl(
  competition
) {
  return aclUrl(
    `competition-dashboard.html?id=${encodeURIComponent(
      competition.id
    )}`,
    selectedEdition
  );
}


/* =========================================================
   CARD
========================================================= */

function competitionCardHtml(
  competition
) {
  const state =
    competitionState(
      competition
    );


  const durationMinutes =
    Math.max(
      1,
      Math.round(
        numberValue(
          competition.duration_seconds,
          1200
        ) /
        60
      )
    );


  const primaryLabel =
    state === "live"
      ? "Start Competition"
      : state === "closed"
        ? "View Results"
        : "View Countdown";


  const primaryUrl =
    competitionUrl(
      competition,
      state
    );


  let countdownText =
    "";


  if (state === "upcoming") {
    countdownText =
      `Starts in ${formatCountdown(
        new Date(
          competition.opens_at
        ).getTime() -
        Date.now()
      )}`;
  } else if (state === "live") {
    countdownText =
      `Closes in ${formatCountdown(
        new Date(
          competition.closes_at
        ).getTime() -
        Date.now()
      )}`;
  } else {
    countdownText =
      "Competition completed";
  }


  return `
    <article
      class="competition-card"
      data-competition-id="${escapeHtml(
        competition.id
      )}"
    >

      <div class="competition-card-top">

        <span
          class="
            status-pill
            ${escapeHtml(
              state
            )}
          "
        >
          ${escapeHtml(
            state === "closed"
              ? "Completed"
              : state
          )}
        </span>


        <span class="competition-module-badge">
          ${escapeHtml(
            moduleName(
              competition.module_id
            )
          )}
        </span>

      </div>


      <h2>
        ${escapeHtml(
          competition.title ||
          "ACL Competition"
        )}
      </h2>


      <p class="competition-card-description">
        ${escapeHtml(
          competition.description ||
          "Official Alexandria Cardiology League competition."
        )}
      </p>


      <div class="competition-meta">

        <span>
          <strong>
            Opens:
          </strong>
          ${escapeHtml(
            formatDateTime(
              competition.opens_at
            )
          )}
        </span>


        <span>
          <strong>
            Closes:
          </strong>
          ${escapeHtml(
            formatDateTime(
              competition.closes_at
            )
          )}
        </span>


        <span>
          <strong>
            Duration:
          </strong>
          ${durationMinutes}
          minutes
        </span>

      </div>


      <div
        class="competition-countdown"
        data-countdown-id="${escapeHtml(
          competition.id
        )}"
      >
        ${escapeHtml(
          countdownText
        )}
      </div>


      <div class="competition-card-actions">

        <a
          class="competition-primary-link"
          href="${escapeHtml(
            primaryUrl
          )}"
        >
          ${escapeHtml(
            primaryLabel
          )}
        </a>


        ${
          state === "live" &&
          competition.leaderboard_visible !==
            false
            ? `
              <a
                class="competition-secondary-link"
                href="${escapeHtml(
                  resultsUrl(
                    competition
                  )
                )}"
              >
                Leaderboard
              </a>
            `
            : ""
        }

      </div>

    </article>
  `;
}


/* =========================================================
   RENDER
========================================================= */

function renderCompetitions() {
  const rows =
    filteredCompetitions();


  byId(
    "competitionList"
  ).innerHTML =
    rows.length
      ? rows
          .map(
            competitionCardHtml
          )
          .join(
            ""
          )
      : `
        <div class="competition-empty">
          No competitions match the selected filters.
        </div>
      `;
}


/* =========================================================
   COUNTDOWN TIMER
========================================================= */

function updateCountdowns() {
  let stateChanged =
    false;


  for (
    const competition of
    competitions
  ) {
    const element =
      document.querySelector(
        `[data-countdown-id="${CSS.escape(
          String(
            competition.id
          )
        )}"]`
      );


    if (!element) {
      continue;
    }


    const state =
      competitionState(
        competition
      );


    if (state === "upcoming") {
      const remaining =
        new Date(
          competition.opens_at
        ).getTime() -
        Date.now();


      if (remaining <= 0) {
        stateChanged =
          true;


        break;
      }


      element.textContent =
        `Starts in ${formatCountdown(
          remaining
        )}`;
    } else if (state === "live") {
      const remaining =
        new Date(
          competition.closes_at
        ).getTime() -
        Date.now();


      if (remaining <= 0) {
        stateChanged =
          true;


        break;
      }


      element.textContent =
        `Closes in ${formatCountdown(
          remaining
        )}`;
    } else {
      element.textContent =
        "Competition completed";
    }
  }


  if (stateChanged) {
    renderCompetitions();
  }
}


function startCountdownTimer() {
  if (timerId) {
    window.clearInterval(
      timerId
    );
  }


  updateCountdowns();


  timerId =
    window.setInterval(
      updateCountdowns,
      1000
    );
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  byId(
    "refreshCompetitions"
  )?.addEventListener(
    "click",
    loadCompetitions
  );


  byId(
    "competitionStateFilter"
  )?.addEventListener(
    "change",
    renderCompetitions
  );


  byId(
    "competitionModuleFilter"
  )?.addEventListener(
    "change",
    renderCompetitions
  );


  window.addEventListener(
    "beforeunload",
    () => {
      if (timerId) {
        window.clearInterval(
          timerId
        );
      }
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeCompetitions() {
  try {
    applyEditionContext();


    const profile =
      await protectAndRender(
        "login.html"
      );


    if (!profile) {
      return;
    }


    bindEvents();


    await loadModules();
    await loadCompetitions();
  } catch (error) {
    console.error(
      "COMPETITIONS INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The competition page could not be initialized.",
      "error"
    );


    byId(
      "competitionList"
    ).innerHTML = `
      <div class="competition-empty">
        Competitions could not be loaded.
      </div>
    `;
  }
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeCompetitions,
    {
      once:
        true
    }
  );
} else {
  void initializeCompetitions();
}
