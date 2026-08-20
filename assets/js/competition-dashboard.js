import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL COMPETITION DASHBOARD v3.0.0 LOADED"
);


/* =========================================================
   EDITION
========================================================= */

const selectedEdition =
  resolveAclEdition();


/* =========================================================
   HELPERS
========================================================= */

const byId =
  (id) =>
    document.getElementById(
      id
    );


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


function formatDuration(
  seconds
) {
  if (
    seconds === null ||
    seconds === undefined ||
    seconds === ""
  ) {
    return "—";
  }


  const totalSeconds =
    Math.max(
      0,
      Math.round(
        numberValue(
          seconds
        )
      )
    );


  const hours =
    Math.floor(
      totalSeconds /
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


  const remainingSeconds =
    totalSeconds %
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
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  ).format(
    date
  );
}


function displayName(
  row
) {
  return (
    row.display_name ||
    row.full_name ||
    row.username ||
    row.participant_name ||
    "ACL Participant"
  );
}


function participantPosition(
  row
) {
  return (
    row.position ||
    row.academic_position ||
    row.level ||
    "—"
  );
}


function rankDisplay(
  rank
) {
  const value =
    numberValue(
      rank
    );


  if (value === 1) {
    return "🥇";
  }


  if (value === 2) {
    return "🥈";
  }


  if (value === 3) {
    return "🥉";
  }


  return value ||
    "—";
}


function setStatus(
  message = "",
  type = ""
) {
  const box =
    byId(
      "competitionDashboardStatus"
    );


  if (!box) {
    return;
  }


  box.textContent =
    message;


  box.className =
    `competition-dashboard-status ${type}`.trim();


  box.hidden =
    !message;
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
      "competitionDashboardEditionBadge"
    );


  const themeColor =
    byId(
      "competitionDashboardThemeColor"
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
    competitionDashboardCompetitionsLink:
      "competitions.html",

    competitionDashboardModulesLink:
      "modules.html"
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
   COMPETITION DETAILS
========================================================= */

async function loadCompetition(
  competitionId
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "competitions"
      )
      .select(`
        id,
        title,
        description,
        module_id,
        quiz_id,
        opens_at,
        closes_at,
        status,
        leaderboard_visible
      `)
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


  byId(
    "title"
  ).textContent =
    data.title ||
    "Competition Results";


  byId(
    "meta"
  ).textContent =
    `${formatDateTime(
      data.opens_at
    )} — ${formatDateTime(
      data.closes_at
    )}`;


  document.title =
    `${data.title || "Competition"} Leaderboard | ACL`;


  return data;
}


/* =========================================================
   LEADERBOARD
========================================================= */

async function loadLeaderboard(
  competitionId
) {
  const {
    data,
    error
  } =
    await supabaseClient.rpc(
      "acl_competition_leaderboard",
      {
        p_competition:
          competitionId
      }
    );


  if (error) {
    throw error;
  }


  return data ||
    [];
}


/* =========================================================
   PODIUM
========================================================= */

function renderPodium(
  rows
) {
  const podium =
    byId(
      "competitionPodium"
    );


  if (!podium) {
    return;
  }


  const topThree =
    rows.slice(
      0,
      3
    );


  if (!topThree.length) {
    podium.hidden =
      true;


    podium.innerHTML =
      "";


    return;
  }


  podium.hidden =
    false;


  podium.innerHTML =
    topThree
      .map(
        (
          row,
          index
        ) => {
          const medal = [
            "🥇",
            "🥈",
            "🥉"
          ][index];


          return `
            <article class="competition-podium-card">

              <span class="competition-podium-medal">
                ${medal}
              </span>


              <h2>
                ${escapeHtml(
                  displayName(
                    row
                  )
                )}
              </h2>


              <p>
                ${escapeHtml(
                  participantPosition(
                    row
                  )
                )}
              </p>


              <strong class="competition-podium-score">
                ${numberValue(
                  row.score
                )}
                points
              </strong>

            </article>
          `;
        }
      )
      .join(
        ""
      );
}


/* =========================================================
   TABLE
========================================================= */

function renderLeaderboard(
  rows
) {
  const body =
    byId(
      "leaderboard"
    );


  const count =
    byId(
      "competitionParticipantCount"
    );


  if (count) {
    count.textContent =
      `${rows.length} participant${
        rows.length === 1
          ? ""
          : "s"
      }`;
  }


  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td
          class="leaderboard-empty"
          colspan="6"
        >
          No submitted attempts yet.
        </td>
      </tr>
    `;


    renderPodium(
      []
    );


    return;
  }


  body.innerHTML =
    rows
      .map(
        (row) => `
          <tr>

            <td class="leaderboard-rank">
              ${escapeHtml(
                rankDisplay(
                  row.rank
                )
              )}
            </td>


            <td class="leaderboard-name">
              ${escapeHtml(
                displayName(
                  row
                )
              )}
            </td>


            <td>
              ${escapeHtml(
                participantPosition(
                  row
                )
              )}
            </td>


            <td class="leaderboard-score">
              ${numberValue(
                row.score
              )}
            </td>


            <td>
              ${numberValue(
                row.accuracy
              ).toFixed(
                1
              )}%
            </td>


            <td>
              ${escapeHtml(
                formatDuration(
                  row.duration_seconds
                )
              )}
            </td>

          </tr>
        `
      )
      .join(
        ""
      );


  renderPodium(
    rows
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeCompetitionDashboard() {
  applyEditionContext();


  try {
    const profile =
      await protectAndRender(
        "login.html"
      );


    if (!profile) {
      return;
    }


    const competitionId =
      new URLSearchParams(
        window.location.search
      ).get(
        "id"
      );


    if (!competitionId) {
      throw new Error(
        "Competition ID is missing from the page URL."
      );
    }


    setStatus(
      "Loading competition leaderboard…"
    );


    const competition =
      await loadCompetition(
        competitionId
      );


    if (
      competition.leaderboard_visible ===
      false
    ) {
      throw new Error(
        "The leaderboard is not currently visible."
      );
    }


    const rows =
      await loadLeaderboard(
        competitionId
      );


    renderLeaderboard(
      rows
    );


    setStatus(
      ""
    );
  } catch (error) {
    console.error(
      "COMPETITION DASHBOARD ERROR:",
      error
    );


    byId(
      "leaderboard"
    ).innerHTML = `
      <tr>

        <td
          class="leaderboard-empty"
          colspan="6"
        >
          ${escapeHtml(
            error.message ||
            "The leaderboard could not be loaded."
          )}
        </td>

      </tr>
    `;


    byId(
      "competitionParticipantCount"
    ).textContent =
      "0 participants";


    renderPodium(
      []
    );


    setStatus(
      error.message ||
      "The leaderboard could not be loaded.",
      "error"
    );
  }
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeCompetitionDashboard,
    {
      once:
        true
    }
  );
} else {
  void initializeCompetitionDashboard();
}
