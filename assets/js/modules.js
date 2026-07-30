import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender
} from "./session-ui.js?v=4.8.0";


console.log(
  "ACL MODULES v3.7.0 LOADED"
);


/* =========================================================
   PAGE ELEMENTS
========================================================= */

const grid =
  document.getElementById(
    "modules"
  );


const stateBox =
  document.getElementById(
    "modulesStatus"
  );


const catalogueSummary =
  document.getElementById(
    "catalogueSummary"
  );


const moduleSearchInput =
  document.getElementById(
    "moduleSearchInput"
  );


const moduleCategoryFilter =
  document.getElementById(
    "moduleCategoryFilter"
  );


const moduleDifficultyFilter =
  document.getElementById(
    "moduleDifficultyFilter"
  );


const moduleAccessFilter =
  document.getElementById(
    "moduleAccessFilter"
  );


const moduleSearchSummary =
  document.getElementById(
    "moduleSearchSummary"
  );


const clearModuleFiltersButton =
  document.getElementById(
    "clearModuleFilters"
  );


/* =========================================================
   PAGE STATE
========================================================= */

const pageState = {
  profile: null,
  modules: [],
  assignedModuleIds: new Set(),
  totalScore: 0,
  progressMap: new Map(),
  selectedChallengeModule: null,
  previousFocusedElement: null,
  loading: false,
  creatingChallenge: false
};


/* =========================================================
   EDITION SELECTION
========================================================= */

const VALID_EDITIONS =
  new Set([
    "basic",
    "expert"
  ]);


const EDITION_STORAGE_KEY =
  "aclSelectedEdition";


function normalizeEdition(
  value
) {
  const normalized =
    String(
      value ||
      ""
    )
      .trim()
      .toLowerCase();


  return VALID_EDITIONS.has(
    normalized
  )
    ? normalized
    : "";
}


function readSavedEdition() {
  try {
    return normalizeEdition(
      localStorage.getItem(
        EDITION_STORAGE_KEY
      )
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL EDITION READ ERROR:",
      error
    );


    return "";
  }
}


function saveEdition(
  edition
) {
  try {
    localStorage.setItem(
      EDITION_STORAGE_KEY,
      edition
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL EDITION SAVE ERROR:",
      error
    );
  }
}


const pageParameters =
  new URLSearchParams(
    window.location.search
  );


const requestedEdition =
  normalizeEdition(
    pageParameters.get(
      "edition"
    )
  );


const selectedEdition =
  requestedEdition ||
  readSavedEdition();


if (!selectedEdition) {
  window.location.replace(
    "pathways.html"
  );


  throw new Error(
    "No valid ACL edition was selected."
  );
}


saveEdition(
  selectedEdition
);


document.body.classList.remove(
  "acl-theme-basic",
  "acl-theme-expert"
);


document.body.classList.add(
  selectedEdition ===
    "basic"
    ? "acl-theme-basic"
    : "acl-theme-expert"
);


if (!requestedEdition) {
  const updatedUrl =
    new URL(
      window.location.href
    );


  updatedUrl.searchParams.set(
    "edition",
    selectedEdition
  );


  window.history.replaceState(
    {},
    "",
    updatedUrl
  );
}


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


function titleCase(
  value = ""
) {
  return String(
    value
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}


function setStatus(
  message = "",
  kind = ""
) {
  if (!stateBox) {
    return;
  }


  stateBox.textContent =
    message;


  stateBox.className =
    `status-box ${kind}`.trim();


  stateBox.hidden =
    !message;
}


function challengeElement(
  id
) {
  return document.getElementById(
    id
  );
}


function validDateTimestamp(
  value
) {
  if (!value) {
    return null;
  }


  const timestamp =
    new Date(
      value
    ).getTime();


  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;
}


function formatDateTime(
  value
) {
  const timestamp =
    validDateTimestamp(
      value
    );


  if (timestamp === null) {
    return "";
  }


  return new Date(
    timestamp
  ).toLocaleString();
}


/* =========================================================
   MODULE THEMES
========================================================= */

function getModuleTheme(
  module
) {
  const searchableText = [
    module?.title,
    module?.name,
    module?.category,
    module?.short_description,
    module?.description,
    module?.slug
  ]
    .filter(
      Boolean
    )
    .join(
      " "
    )
    .toLowerCase();


  const isECG =
    searchableText.includes(
      "ecg"
    ) ||
    searchableText.includes(
      "electrocardiograph"
    ) ||
    searchableText.includes(
      "rhythm"
    ) ||
    searchableText.includes(
      "arrhythmia"
    );


  const isImaging =
    searchableText.includes(
      "imaging"
    ) ||
    searchableText.includes(
      "echocardiograph"
    ) ||
    searchableText.includes(
      "echocardiography"
    ) ||
    searchableText.includes(
      "echo"
    ) ||
    searchableText.includes(
      "cardiac ct"
    ) ||
    searchableText.includes(
      "coronary ct"
    ) ||
    searchableText.includes(
      "ct angiography"
    ) ||
    searchableText.includes(
      "ccta"
    ) ||
    searchableText.includes(
      "mri"
    ) ||
    searchableText.includes(
      "cmr"
    ) ||
    searchableText.includes(
      "nuclear imaging"
    ) ||
    searchableText.includes(
      "nuclear cardiology"
    ) ||
    searchableText.includes(
      "ivus"
    ) ||
    searchableText.includes(
      "oct"
    );


  const isIntervention =
    searchableText.includes(
      "intervention"
    ) ||
    searchableText.includes(
      "interventional"
    ) ||
    searchableText.includes(
      "pci"
    ) ||
    searchableText.includes(
      "angioplasty"
    ) ||
    searchableText.includes(
      "stent"
    ) ||
    searchableText.includes(
      "catheter"
    ) ||
    searchableText.includes(
      "structural"
    ) ||
    searchableText.includes(
      "tavi"
    ) ||
    searchableText.includes(
      "tavr"
    ) ||
    searchableText.includes(
      "mitraclip"
    ) ||
    searchableText.includes(
      "teer"
    ) ||
    searchableText.includes(
      "device closure"
    ) ||
    searchableText.includes(
      "coronary intervention"
    ) ||
    searchableText.includes(
      "bifurcation"
    ) ||
    searchableText.includes(
      "left main"
    ) ||
    searchableText.includes(
      "calcified lesion"
    ) ||
    searchableText.includes(
      "rotablation"
    ) ||
    searchableText.includes(
      "atherectomy"
    ) ||
    searchableText.includes(
      "cto"
    );


  if (isECG) {
    return {
      className:
        "module-ecg",

      categoryLabel:
        "Electrocardiography"
    };
  }


  if (isImaging) {
    return {
      className:
        "module-imaging",

      categoryLabel:
        "Imaging"
    };
  }


  if (isIntervention) {
    return {
      className:
        "module-intervention",

      categoryLabel:
        "Interventional Cardiology"
    };
  }


  return {
    className:
      "module-general",

    categoryLabel:
      "General Cardiology"
  };
}


/* =========================================================
   MODULE ACCESS
========================================================= */

function withinSchedule(
  module
) {
  const now =
    Date.now();


  const opensAt =
    validDateTimestamp(
      module.opens_at
    );


  const closesAt =
    validDateTimestamp(
      module.closes_at
    );


  if (
    opensAt !== null &&
    now < opensAt
  ) {
    return false;
  }


  if (
    closesAt !== null &&
    now > closesAt
  ) {
    return false;
  }


  return true;
}


function accessDecision(
  module,
  assignedIds,
  totalScore
) {
  const moduleStatus =
    String(
      module.status ||
      ""
    )
      .trim()
      .toLowerCase();


  const accessType =
    String(
      module.access_type ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    moduleStatus ===
    "coming_soon"
  ) {
    return {
      state:
        "coming",

      label:
        "Coming soon",

      reason:
        "This module is currently being prepared."
    };
  }


  if (
    !withinSchedule(
      module
    )
  ) {
    const opensAt =
      validDateTimestamp(
        module.opens_at
      );


    if (
      opensAt !== null &&
      Date.now() < opensAt
    ) {
      return {
        state:
          "locked",

        label:
          "Scheduled",

        reason:
          `Opens ${formatDateTime(
            module.opens_at
          )}`
      };
    }


    return {
      state:
        "locked",

      label:
        "Closed",

      reason:
        "The access window has closed."
    };
  }


  if (
    accessType ===
      "admin_assigned" &&
    !assignedIds.has(
      module.id
    )
  ) {
    return {
      state:
        "locked",

      label:
        "Assignment required",

      reason:
        "This module requires administrator assignment."
    };
  }


  if (
    accessType ===
      "minimum_score" &&
    totalScore <
      Number(
        module.minimum_score ||
        0
      )
  ) {
    return {
      state:
        "locked",

      label:
        `Requires ${Number(
          module.minimum_score ||
          0
        )} points`,

      reason:
        `Your current accumulated score is ${totalScore} points.`
    };
  }


  if (
    accessType ===
    "passcode"
  ) {
    return {
      state:
        "locked",

      label:
        "Passcode requested",

      reason:
        "This module requires an access passcode."
    };
  }


  if (!module.launch_path) {
    return {
      state:
        "coming",

      label:
        "Coming soon",

      reason:
        "Educational content will be available soon."
    };
  }


  return {
    state:
      "open",

    label:
      "Open module",

    reason:
      ""
  };
}


function launchPathWithEdition(
  launchPath
) {
  if (!launchPath) {
    return "";
  }


  try {
    const url =
      new URL(
        launchPath,
        window.location.href
      );


    url.searchParams.set(
      "edition",
      selectedEdition
    );


    if (
      url.origin ===
      window.location.origin
    ) {
      return (
        `${url.pathname}` +
        `${url.search}` +
        `${url.hash}`
      );
    }


    return url.toString();
  } catch (
    error
  ) {
    console.warn(
      "INVALID MODULE LAUNCH PATH:",
      launchPath,
      error
    );


    return "";
  }
}


/* =========================================================
   MODULE CARD
========================================================= */

function moduleCard(
  module,
  decision,
  progressMap
) {
  const progress =
    progressMap.get(
      module.id
    );


  const completed =
    progress?.status ===
    "completed";


  const inProgress =
    progress?.status ===
    "in_progress";


  const actionLabel =
    inProgress
      ? "Continue module"
      : completed
        ? "Review / retry"
        : decision.label;


  const launchPath =
    decision.state ===
      "open"
      ? launchPathWithEdition(
          module.launch_path
        )
      : "";


  const href =
    launchPath
      ? escapeHtml(
          launchPath
        )
      : "#";


  const theme =
    getModuleTheme(
      module
    );


  const coverImageUrl =
    String(
      module.cover_image_url ||
      ""
    ).trim();


  const coverStyle =
    coverImageUrl
      ? `
        style="
          background-image:
          linear-gradient(
            135deg,
            rgba(4, 26, 72, 0.65),
            rgba(0, 86, 128, 0.25)
          ),
          url('${escapeHtml(
            coverImageUrl
          )}')
        "
      `
      : "";


  return `
    <article
      class="
        module-card
        ${theme.className}
        ${escapeHtml(
          decision.state
        )}
        ${
          module.is_featured
            ? "featured"
            : ""
        }
      "
      data-module-id="${escapeHtml(
        module.id
      )}"
    >

      <div
        class="module-cover"
        ${coverStyle}
      >

        <span class="module-category">
          ${escapeHtml(
            theme.categoryLabel
          )}
        </span>


        ${
          module.is_featured
            ? `
              <span class="featured-badge">
                Featured
              </span>
            `
            : ""
        }

      </div>


      <div class="module-card-body">

        <div class="module-card-heading">

          <h2>
            ${escapeHtml(
              module.title ||
              "Untitled module"
            )}
          </h2>


          ${
            module.difficulty
              ? `
                <span
                  class="
                    difficulty-pill
                    ${escapeHtml(
                      String(
                        module.difficulty
                      )
                        .trim()
                        .toLowerCase()
                    )}
                  "
                >
                  ${escapeHtml(
                    titleCase(
                      module.difficulty
                    )
                  )}
                </span>
              `
              : ""
          }

        </div>


        <p>
          ${escapeHtml(
            module.short_description ||
            module.description ||
            "ACL educational module"
          )}
        </p>


        <div class="module-meta">

          <span>
            ⏱
            ${Number(
              module.estimated_minutes ||
              0
            )}
            min
          </span>


          <span>
            ❓
            ${Number(
              module.question_count ||
              0
            )}
            questions
          </span>

        </div>


        <div class="mode-pills">

          ${
            module.learning_mode_enabled
              ? `
                <span>
                  Learning
                </span>
              `
              : ""
          }


          ${
            module.competition_mode_enabled
              ? `
                <span>
                  Competition
                </span>
              `
              : ""
          }

        </div>


        ${
          progress
            ? `
              <div class="module-progress-line">

                <span>
                  ${
                    inProgress
                      ? "In progress"
                      : completed
                        ? "Completed"
                        : escapeHtml(
                            titleCase(
                              progress.status ||
                              "Attempted"
                            )
                          )
                  }
                </span>


                <strong>
                  ${Number(
                    progress.score ||
                    0
                  )}
                  pts
                </strong>

              </div>
            `
            : ""
        }


        ${
          decision.reason
            ? `
              <p class="module-lock-reason">
                ${escapeHtml(
                  decision.reason
                )}
              </p>
            `
            : ""
        }


        <div class="module-card-actions">

          <a
            class="
              module-action
              ${
                decision.state !==
                  "open" ||
                !launchPath
                  ? "disabled"
                  : ""
              }
            "
            href="${href}"
            ${
              decision.state !==
                "open" ||
              !launchPath
                ? `
                  aria-disabled="true"
                  tabindex="-1"
                `
                : ""
            }
          >
            ${escapeHtml(
              actionLabel
            )}
          </a>


          ${
            decision.state ===
              "open" &&
            launchPath
              ? `
                <button
                  type="button"
                  class="module-challenge-button"
                  data-challenge-module-id="${escapeHtml(
                    module.id
                  )}"
                  data-challenge-module-title="${escapeHtml(
                    module.title ||
                    "Selected module"
                  )}"
                  data-challenge-launch-path="${escapeHtml(
                    launchPath
                  )}"
                >

                  <span
                    class="module-challenge-button-icon"
                    aria-hidden="true"
                  >
                    ⚔️
                  </span>


                  <span class="module-challenge-button-copy">

                    <strong>
                      Challenge a friend
                    </strong>


                    <small>
                      Same quiz · Head-to-head
                    </small>

                  </span>


                  <span
                    class="module-challenge-button-arrow"
                    aria-hidden="true"
                  >
                    ›
                  </span>

                </button>
              `
              : ""
          }

        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   MODULE SEARCH AND FILTERING
========================================================= */

function normalizedModuleText(
  module
) {
  return [
    module?.title,
    module?.name,
    module?.category,
    module?.short_description,
    module?.description,
    module?.slug,
    module?.difficulty
  ]
    .filter(
      Boolean
    )
    .join(
      " "
    )
    .toLowerCase();
}


function moduleCategoryKey(
  module
) {
  const theme =
    getModuleTheme(
      module
    );


  if (
    theme.className ===
    "module-ecg"
  ) {
    return "ecg";
  }


  if (
    theme.className ===
    "module-intervention"
  ) {
    return "intervention";
  }


  if (
    theme.className ===
    "module-imaging"
  ) {
    return "imaging";
  }


  return "general";
}


function renderFilteredModules() {
  if (!grid) {
    return;
  }


  const searchTerm =
    String(
      moduleSearchInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const category =
    moduleCategoryFilter?.value ||
    "all";


  const difficulty =
    moduleDifficultyFilter?.value ||
    "all";


  const access =
    moduleAccessFilter?.value ||
    "all";


  const filteredModules =
    pageState.modules.filter(
      (
        module
      ) => {
        const decision =
          accessDecision(
            module,
            pageState.assignedModuleIds,
            pageState.totalScore
          );


        const matchesSearch =
          !searchTerm ||
          normalizedModuleText(
            module
          ).includes(
            searchTerm
          );


        const matchesCategory =
          category ===
            "all" ||
          moduleCategoryKey(
            module
          ) ===
            category;


        const normalizedDifficulty =
          String(
            module.difficulty ||
            ""
          )
            .trim()
            .toLowerCase();


        const matchesDifficulty =
          difficulty ===
            "all" ||
          normalizedDifficulty ===
            difficulty;


        const matchesAccess =
          access ===
            "all" ||
          decision.state ===
            access;


        return (
          matchesSearch &&
          matchesCategory &&
          matchesDifficulty &&
          matchesAccess
        );
      }
    );


  if (!filteredModules.length) {
    grid.innerHTML = `
      <div class="module-filter-empty">

        <strong>
          No matching modules found
        </strong>


        <p>
          Try changing the search term or filters.
        </p>

      </div>
    `;
  } else {
    grid.innerHTML =
      filteredModules
        .map(
          (
            module
          ) =>
            moduleCard(
              module,
              accessDecision(
                module,
                pageState.assignedModuleIds,
                pageState.totalScore
              ),
              pageState.progressMap
            )
        )
        .join(
          ""
        );
  }


  if (moduleSearchSummary) {
    moduleSearchSummary.textContent =
      `${filteredModules.length} of ${pageState.modules.length} ${
        pageState.modules.length ===
          1
          ? "module"
          : "modules"
      } shown`;
  }
}


function clearModuleFilters() {
  if (moduleSearchInput) {
    moduleSearchInput.value =
      "";
  }


  if (moduleCategoryFilter) {
    moduleCategoryFilter.value =
      "all";
  }


  if (moduleDifficultyFilter) {
    moduleDifficultyFilter.value =
      "all";
  }


  if (moduleAccessFilter) {
    moduleAccessFilter.value =
      "all";
  }


  renderFilteredModules();


  moduleSearchInput
    ?.focus();
}


/* =========================================================
   CHALLENGE HELPERS
========================================================= */

function shuffleChallengeItems(
  items
) {
  const result = [
    ...items
  ];


  for (
    let currentIndex =
      result.length - 1;

    currentIndex > 0;

    currentIndex -= 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
        (
          currentIndex +
          1
        )
      );


    [
      result[
        currentIndex
      ],
      result[
        randomIndex
      ]
    ] = [
      result[
        randomIndex
      ],
      result[
        currentIndex
      ]
    ];
  }


  return result;
}


function randomHex(
  length
) {
  const bytes =
    new Uint8Array(
      Math.ceil(
        length /
        2
      )
    );


  crypto.getRandomValues(
    bytes
  );


  return Array.from(
    bytes,
    (
      byte
    ) =>
      byte
        .toString(
          16
        )
        .padStart(
          2,
          "0"
        )
  )
    .join(
      ""
    )
    .slice(
      0,
      length
    )
    .toUpperCase();
}


function randomChallengeCode() {
  try {
    if (
      typeof crypto.randomUUID ===
      "function"
    ) {
      return `ACL-${
        crypto
          .randomUUID()
          .replaceAll(
            "-",
            ""
          )
          .slice(
            0,
            10
          )
          .toUpperCase()
      }`;
    }


    return `ACL-${
      randomHex(
        10
      )
    }`;
  } catch (
    error
  ) {
    console.warn(
      "ACL CHALLENGE CODE FALLBACK:",
      error
    );


    return `ACL-${
      Date.now()
        .toString(
          36
        )
        .slice(
          -10
        )
        .toUpperCase()
    }`;
  }
}


function quizSlugFromLaunchPath(
  launchPath
) {
  if (!launchPath) {
    return "";
  }


  try {
    const url =
      new URL(
        launchPath,
        window.location.href
      );


    return String(
      url.searchParams.get(
        "quiz"
      ) ||
      ""
    ).trim();
  } catch (
    error
  ) {
    console.warn(
      "INVALID CHALLENGE LAUNCH PATH:",
      launchPath,
      error
    );


    return "";
  }
}


function selectedChallengeAudience() {
  return (
    document.querySelector(
      'input[name="challengeAudience"]:checked'
    )?.value ||
    "single"
  );
}


function challengeMaximumParticipants(
  audience
) {
  const requestedValue =
    Number(
      challengeElement(
        "moduleChallengeMaximumParticipants"
      )?.value ||
      2
    );


  if (
    audience ===
    "single"
  ) {
    return 2;
  }


  if (
    !Number.isFinite(
      requestedValue
    )
  ) {
    return 2;
  }


  return Math.min(
    100,
    Math.max(
      2,
      Math.round(
        requestedValue
      )
    )
  );
}


function challengeDurationHours() {
  const value =
    Number(
      challengeElement(
        "moduleChallengeDuration"
      )?.value ||
      24
    );


  if (
    !Number.isFinite(
      value
    ) ||
    value <=
      0
  ) {
    return 24;
  }


  return value;
}


function challengeLinkFor(
  challengeCode
) {
  const url =
    new URL(
      "challenge.html",
      window.location.href
    );


  url.searchParams.set(
    "code",
    challengeCode
  );


  url.searchParams.set(
    "edition",
    selectedEdition
  );


  return url.toString();
}


async function copyText(
  text,
  feedbackElement,
  successMessage,
  fallbackInput = null
) {
  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard
        .writeText(
          text
        );
    } else {
      const temporaryInput =
        document.createElement(
          "textarea"
        );


      temporaryInput.value =
        text;


      temporaryInput.setAttribute(
        "readonly",
        ""
      );


      temporaryInput.style.position =
        "fixed";


      temporaryInput.style.opacity =
        "0";


      document.body.appendChild(
        temporaryInput
      );


      temporaryInput.select();


      const copied =
        document.execCommand(
          "copy"
        );


      temporaryInput.remove();


      if (!copied) {
        throw new Error(
          "The browser copy command failed."
        );
      }
    }


    if (feedbackElement) {
      feedbackElement.textContent =
        successMessage;
    }
  } catch (
    error
  ) {
    console.error(
      "ACL COPY ERROR:",
      error
    );


    if (fallbackInput) {
      fallbackInput.focus();
      fallbackInput.select();
    }


    if (feedbackElement) {
      feedbackElement.textContent =
        "Please copy the selected text manually.";
    }
  }


  window.setTimeout(
    () => {
      if (feedbackElement) {
        feedbackElement.textContent =
          "";
      }
    },
    2400
  );
}


/* =========================================================
   CHALLENGE MODAL
========================================================= */

function openModuleChallengeModal(
  button
) {
  const modal =
    challengeElement(
      "moduleChallengeModal"
    );


  if (!modal) {
    console.error(
      "ACL challenge modal is missing from modules.html."
    );


    return;
  }


  pageState.selectedChallengeModule = {
    id:
      button.dataset
        .challengeModuleId ||
      "",

    title:
      button.dataset
        .challengeModuleTitle ||
      "Selected module",

    launchPath:
      button.dataset
        .challengeLaunchPath ||
      ""
  };


  pageState.previousFocusedElement =
    document.activeElement instanceof
      HTMLElement
      ? document.activeElement
      : null;


  const moduleName =
    challengeElement(
      "moduleChallengeModuleName"
    );


  const result =
    challengeElement(
      "moduleChallengeResult"
    );


  const createButton =
    challengeElement(
      "createModuleChallenge"
    );


  const maximumParticipantsInput =
    challengeElement(
      "moduleChallengeMaximumParticipants"
    );


  const singleAudience =
    document.querySelector(
      'input[name="challengeAudience"][value="single"]'
    );


  if (moduleName) {
    moduleName.textContent =
      pageState
        .selectedChallengeModule
        .title;
  }


  if (result) {
    result.hidden =
      true;


    result.innerHTML =
      "";
  }


  if (singleAudience) {
    singleAudience.checked =
      true;
  }


  if (maximumParticipantsInput) {
    maximumParticipantsInput.value =
      "2";


    maximumParticipantsInput.disabled =
      true;
  }


  if (createButton) {
    createButton.hidden =
      false;


    createButton.disabled =
      false;


    createButton.textContent =
      "⚔️ Create challenge";
  }


  modal.hidden =
    false;


  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.classList.add(
    "module-challenge-open"
  );


  window.setTimeout(
    () => {
      document.querySelector(
        'input[name="challengeAudience"]:checked'
      )
        ?.focus();
    },
    70
  );
}


function closeModuleChallengeModal() {
  if (
    pageState.creatingChallenge
  ) {
    return;
  }


  const modal =
    challengeElement(
      "moduleChallengeModal"
    );


  if (modal) {
    modal.hidden =
      true;


    modal.setAttribute(
      "aria-hidden",
      "true"
    );
  }


  document.body.classList.remove(
    "module-challenge-open"
  );


  pageState.selectedChallengeModule =
    null;


  pageState.previousFocusedElement
    ?.focus?.();


  pageState.previousFocusedElement =
    null;
}


function updateChallengeAudienceControls() {
  const audience =
    selectedChallengeAudience();


  const maximumParticipantsInput =
    challengeElement(
      "moduleChallengeMaximumParticipants"
    );


  if (!maximumParticipantsInput) {
    return;
  }


  if (
    audience ===
    "single"
  ) {
    maximumParticipantsInput.value =
      "2";


    maximumParticipantsInput.disabled =
      true;


    return;
  }


  maximumParticipantsInput.disabled =
    false;


  const currentValue =
    Number(
      maximumParticipantsInput.value ||
      2
    );


  if (
    !Number.isFinite(
      currentValue
    ) ||
    currentValue < 2
  ) {
    maximumParticipantsInput.value =
      "2";
  }
}


/* =========================================================
   CREATE CHALLENGE
========================================================= */

async function createModuleChallenge() {
  if (
    !pageState
      .selectedChallengeModule ||
    pageState.creatingChallenge
  ) {
    return;
  }


  const selectedModule =
    pageState
      .selectedChallengeModule;


  const result =
    challengeElement(
      "moduleChallengeResult"
    );


  const createButton =
    challengeElement(
      "createModuleChallenge"
    );


  const quizSlug =
    quizSlugFromLaunchPath(
      selectedModule.launchPath
    );


  if (!quizSlug) {
    if (result) {
      result.hidden =
        false;


      result.innerHTML = `
        <div class="module-challenge-error">
          This module does not contain a valid learning quiz link.
        </div>
      `;
    }


    return;
  }


  pageState.creatingChallenge =
    true;


  if (createButton) {
    createButton.disabled =
      true;


    createButton.textContent =
      "Creating challenge…";
  }


  try {
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
        "Please sign in before creating a challenge."
      );
    }


    const {
      data: quizData,
      error: quizError
    } =
      await supabaseClient
        .from(
          "quizzes"
        )
        .select(`
          id,
          slug,
          title,
          module_id,
          question_count,
          edition
        `)
        .eq(
          "slug",
          quizSlug
        )
        .eq(
          "edition",
          selectedEdition
        )
        .eq(
          "status",
          "published"
        )
        .maybeSingle();


    if (quizError) {
      throw quizError;
    }


    if (!quizData) {
      throw new Error(
        "The published quiz linked to this module could not be found."
      );
    }


    if (
      normalizeEdition(
        quizData.edition
      ) !==
      selectedEdition
    ) {
      throw new Error(
        "This quiz does not belong to the selected ACL edition."
      );
    }


    if (
      quizData.module_id &&
      selectedModule.id &&
      String(
        quizData.module_id
      ) !==
      String(
        selectedModule.id
      )
    ) {
      throw new Error(
        "The selected quiz is not linked to this module."
      );
    }


    const {
      data: questionRows,
      error: questionsError
    } =
      await supabaseClient
        .from(
          "questions"
        )
        .select(
          "id, order_index"
        )
        .eq(
          "quiz_id",
          quizData.id
        )
        .order(
          "order_index",
          {
            ascending:
              true
          }
        );


    if (questionsError) {
      throw questionsError;
    }


    if (
      !Array.isArray(
        questionRows
      ) ||
      !questionRows.length
    ) {
      throw new Error(
        "No questions are available for this challenge."
      );
    }


    const challengeQuestionPool =
      shuffleChallengeItems(
        questionRows
      );


    const configuredQuestionCount =
      Number(
        quizData.question_count
      );


    const requestedQuestionCount =
      Number.isFinite(
        configuredQuestionCount
      ) &&
      configuredQuestionCount >
        0
        ? configuredQuestionCount
        : challengeQuestionPool
            .length;


    const challengeQuestionIds =
      challengeQuestionPool
        .slice(
          0,
          Math.min(
            requestedQuestionCount,
            challengeQuestionPool
              .length
          )
        )
        .map(
          (
            question
          ) =>
            question.id
        );


    if (
      !challengeQuestionIds.length
    ) {
      throw new Error(
        "The challenge question set could not be prepared."
      );
    }


    const audience =
      selectedChallengeAudience();


    const durationHours =
      challengeDurationHours();


    const maximumParticipants =
      challengeMaximumParticipants(
        audience
      );


    const challengeCode =
      randomChallengeCode();


    const startsAt =
      new Date();


    const endsAt =
      new Date(
        startsAt.getTime() +
        (
          durationHours *
          60 *
          60 *
          1000
        )
      );


    const {
      data: challenge,
      error: challengeError
    } =
      await supabaseClient
        .from(
          "module_challenges"
        )
        .insert({
          module_id:
            selectedModule.id,

          quiz_id:
            quizData.id,

          creator_id:
            user.id,

          challenge_code:
            challengeCode,

          title:
            `${selectedModule.title} Challenge`,

          question_ids:
            challengeQuestionIds,

          maximum_participants:
            maximumParticipants,

          starts_at:
            startsAt.toISOString(),

          ends_at:
            endsAt.toISOString(),

          status:
            "open"
        })
        .select(`
          id,
          challenge_code,
          title,
          starts_at,
          ends_at,
          maximum_participants
        `)
        .single();


    if (challengeError) {
      throw challengeError;
    }


    const {
      error: participantError
    } =
      await supabaseClient
        .from(
          "module_challenge_participants"
        )
        .upsert(
          {
            challenge_id:
              challenge.id,

            user_id:
              user.id,

            invitation_status:
              "joined"
          },
          {
            onConflict:
              "challenge_id,user_id"
          }
        );


    if (participantError) {
      throw participantError;
    }


    const challengeUrl =
      challengeLinkFor(
        challenge.challenge_code
      );


    const whatsappMessage =
      encodeURIComponent(
        `⚔️ ACL Head-to-Head Challenge\n\n` +
        `${selectedModule.title}\n` +
        `Challenge code: ${challenge.challenge_code}\n\n` +
        `Highest confidence-adjusted score wins.\n` +
        `Ties are decided by the shortest completion time.\n\n` +
        `Join the challenge here:\n${challengeUrl}`
      );


    if (result) {
      result.hidden =
        false;


      result.innerHTML = `
        <section class="challenge-created-card">

          <div class="challenge-created-header">

            <div
              class="challenge-created-icon"
              aria-hidden="true"
            >
              ✓
            </div>


            <div>

              <span class="challenge-created-eyebrow">
                Challenge created
              </span>


              <h3>
                Ready for head-to-head competition
              </h3>

            </div>

          </div>


          <div class="module-challenge-created-summary">

            <span>
              Questions
            </span>


            <strong>
              ${challengeQuestionIds.length}
            </strong>


            <small>
              Every participant will receive the same question set.
            </small>

          </div>


          <div class="challenge-share-field">

            <div class="challenge-share-field-heading">

              <span>
                Challenge code
              </span>


              <button
                type="button"
                class="challenge-inline-copy"
                id="copyChallengeCode"
                aria-label="Copy challenge code"
              >
                Copy code
              </button>

            </div>


            <div class="challenge-code-display">

              <strong>
                ${escapeHtml(
                  challenge.challenge_code
                )}
              </strong>

            </div>

          </div>


          <div class="challenge-share-field">

            <div class="challenge-share-field-heading">

              <span>
                Private invitation link
              </span>

            </div>


            <div class="challenge-link-display">

              <input
                id="createdChallengeLink"
                type="text"
                value="${escapeHtml(
                  challengeUrl
                )}"
                readonly
                aria-label="Challenge invitation link"
              >


              <button
                type="button"
                class="challenge-link-copy-button"
                id="copyChallengeLink"
              >
                Copy
              </button>

            </div>

          </div>


          <div class="challenge-created-actions">

            <button
              type="button"
              class="challenge-created-copy-button"
              id="copyChallengeLinkLarge"
            >

              <span aria-hidden="true">
                🔗
              </span>

              Copy challenge link

            </button>


            <a
              class="challenge-created-whatsapp-button"
              href="https://wa.me/?text=${whatsappMessage}"
              target="_blank"
              rel="noopener noreferrer"
            >

              <span aria-hidden="true">
                💬
              </span>

              Share on WhatsApp

            </a>

          </div>


          <p
            class="challenge-copy-feedback"
            id="challengeCopyFeedback"
            role="status"
            aria-live="polite"
          ></p>

        </section>
      `;
    }


    const challengeLinkInput =
      challengeElement(
        "createdChallengeLink"
      );


    const copyCodeButton =
      challengeElement(
        "copyChallengeCode"
      );


    const copyLinkButton =
      challengeElement(
        "copyChallengeLink"
      );


    const copyLargeButton =
      challengeElement(
        "copyChallengeLinkLarge"
      );


    const copyFeedback =
      challengeElement(
        "challengeCopyFeedback"
      );


    copyCodeButton
      ?.addEventListener(
        "click",
        () =>
          copyText(
            challenge.challenge_code,
            copyFeedback,
            "Challenge code copied."
          )
      );


    copyLinkButton
      ?.addEventListener(
        "click",
        () =>
          copyText(
            challengeUrl,
            copyFeedback,
            "Challenge link copied.",
            challengeLinkInput
          )
      );


    copyLargeButton
      ?.addEventListener(
        "click",
        () =>
          copyText(
            challengeUrl,
            copyFeedback,
            "Challenge link copied.",
            challengeLinkInput
          )
      );


    challengeLinkInput
      ?.addEventListener(
        "click",
        () => {
          challengeLinkInput.select();
        }
      );


    if (createButton) {
      createButton.hidden =
        true;
    }
  } catch (
    error
  ) {
    console.error(
      "CREATE MODULE CHALLENGE ERROR:",
      error
    );


    if (result) {
      result.hidden =
        false;


      result.innerHTML = `
        <div class="module-challenge-error">

          <strong>
            Challenge could not be created
          </strong>


          <p>
            ${escapeHtml(
              error.message ||
              "Please try again."
            )}
          </p>

        </div>
      `;
    }
  } finally {
    pageState.creatingChallenge =
      false;


    if (createButton) {
      createButton.disabled =
        false;


      if (!createButton.hidden) {
        createButton.textContent =
          "⚔️ Create challenge";
      }
    }
  }
}


/* =========================================================
   LOAD MODULE CATALOGUE
========================================================= */

function updateEditionPageCopy() {
  const editionTitle =
    selectedEdition ===
      "basic"
      ? "THE BASIC EDITION"
      : "THE EXPERT EDITION";


  document.title =
    `${editionTitle} Modules | ACL`;


  const catalogueHeading =
    document.querySelector(
      ".catalogue-hero h1"
    );


  if (catalogueHeading) {
    catalogueHeading.textContent =
      selectedEdition ===
        "basic"
        ? "Build your cardiovascular foundations"
        : "Choose your next expert challenge";
  }
}


async function loadCatalogue() {
  if (
    pageState.loading
  ) {
    return;
  }


  pageState.loading =
    true;


  updateEditionPageCopy();


  setStatus(
    "Loading your ACL catalogue…"
  );


  try {
    const profile =
      await protectAndRender(
        "login.html"
      );


    if (!profile) {
      return;
    }


    pageState.profile =
      profile;


    const [
      moduleResult,
      assignmentResult,
      attemptResult
    ] =
      await Promise.all([
        supabaseClient
          .from(
            "modules"
          )
          .select(
            "*"
          )
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
          ),

        supabaseClient
          .from(
            "module_assignments"
          )
          .select(
            "module_id, expires_at"
          )
          .eq(
            "user_id",
            profile.id
          ),

        supabaseClient
          .from(
            "quiz_attempts"
          )
          .select(
            "module_id, status, score, updated_at"
          )
          .eq(
            "user_id",
            profile.id
          )
          .order(
            "updated_at",
            {
              ascending:
                false
            }
          )
      ]);


    if (moduleResult.error) {
      throw moduleResult.error;
    }


    if (assignmentResult.error) {
      throw assignmentResult.error;
    }


    if (attemptResult.error) {
      throw attemptResult.error;
    }


    const modules =
      Array.isArray(
        moduleResult.data
      )
        ? moduleResult.data
        : [];


    const assignments =
      Array.isArray(
        assignmentResult.data
      )
        ? assignmentResult.data
        : [];


    const attempts =
      Array.isArray(
        attemptResult.data
      )
        ? attemptResult.data
        : [];


    const assignedModuleIds =
      new Set(
        assignments
          .filter(
            (
              assignment
            ) => {
              const expiresAt =
                validDateTimestamp(
                  assignment.expires_at
                );


              return (
                expiresAt ===
                  null ||
                expiresAt >
                  Date.now()
              );
            }
          )
          .map(
            (
              assignment
            ) =>
              assignment.module_id
          )
      );


    const totalScore =
      attempts
        .filter(
          (
            attempt
          ) =>
            attempt.status ===
            "completed"
        )
        .reduce(
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


    const progressMap =
      new Map();


    for (
      const attempt of
      attempts
    ) {
      if (
        attempt.module_id &&
        !progressMap.has(
          attempt.module_id
        )
      ) {
        progressMap.set(
          attempt.module_id,
          attempt
        );
      }
    }


    pageState.modules =
      modules;


    pageState.assignedModuleIds =
      assignedModuleIds;


    pageState.totalScore =
      totalScore;


    pageState.progressMap =
      progressMap;


    if (!modules.length) {
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state">
            No modules are currently available in this edition.
          </div>
        `;
      }


      if (catalogueSummary) {
        catalogueSummary.textContent =
          "0 modules";
      }


      if (moduleSearchSummary) {
        moduleSearchSummary.textContent =
          "0 modules available";
      }


      setStatus(
        ""
      );


      return;
    }


    renderFilteredModules();


    if (catalogueSummary) {
      catalogueSummary.textContent =
        `${modules.length} ${
          modules.length ===
            1
            ? "module"
            : "modules"
        } · ${totalScore} accumulated quiz points`;
    }


    setStatus(
      ""
    );
  } catch (
    error
  ) {
    console.error(
      "ACL MODULE CATALOGUE ERROR:",
      error
    );


    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          The module catalogue could not be loaded.
        </div>
      `;
    }


    if (catalogueSummary) {
      catalogueSummary.textContent =
        "Catalogue unavailable";
    }


    if (moduleSearchSummary) {
      moduleSearchSummary.textContent =
        "Modules could not be loaded";
    }


    setStatus(
      error.message ||
      "Could not load modules.",
      "error"
    );
  } finally {
    pageState.loading =
      false;
  }
}


/* =========================================================
   EVENT BINDING
========================================================= */

moduleSearchInput
  ?.addEventListener(
    "input",
    renderFilteredModules
  );


moduleCategoryFilter
  ?.addEventListener(
    "change",
    renderFilteredModules
  );


moduleDifficultyFilter
  ?.addEventListener(
    "change",
    renderFilteredModules
  );


moduleAccessFilter
  ?.addEventListener(
    "change",
    renderFilteredModules
  );


clearModuleFiltersButton
  ?.addEventListener(
    "click",
    clearModuleFilters
  );


document.addEventListener(
  "change",
  (
    event
  ) => {
    if (
      event.target.matches(
        'input[name="challengeAudience"]'
      )
    ) {
      updateChallengeAudienceControls();
    }
  }
);


document.addEventListener(
  "click",
  (
    event
  ) => {
    const challengeButton =
      event.target.closest(
        "[data-challenge-module-id]"
      );


    if (challengeButton) {
      event.preventDefault();


      openModuleChallengeModal(
        challengeButton
      );


      return;
    }


    if (
      event.target.closest(
        "#closeModuleChallenge"
      ) ||
      event.target.closest(
        "#cancelModuleChallenge"
      ) ||
      event.target.closest(
        "#moduleChallengeBackdrop"
      )
    ) {
      closeModuleChallengeModal();


      return;
    }


    if (
      event.target.closest(
        "#createModuleChallenge"
      )
    ) {
      void createModuleChallenge();
    }
  }
);


document.addEventListener(
  "keydown",
  (
    event
  ) => {
    if (
      event.key !==
      "Escape"
    ) {
      return;
    }


    const modal =
      challengeElement(
        "moduleChallengeModal"
      );


    if (
      modal &&
      !modal.hidden
    ) {
      closeModuleChallengeModal();
    }
  }
);


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    loadCatalogue,
    {
      once:
        true
    }
  );
} else {
  void loadCatalogue();
}
