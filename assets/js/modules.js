import { supabaseClient } from "./supabase-client.js";
import { protectAndRender } from "./session-ui.js?v=4.4.0";



const grid =
  document.getElementById("modules");

const stateBox =
  document.getElementById("modulesStatus");

const summary =
  document.getElementById("catalogueSummary");

/* =========================================================
   MODULE FILTER STATE
========================================================= */

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


let loadedModules =
  [];


let loadedAssignedIds =
  new Set();


let loadedTotalScore =
  0;


let loadedProgressMap =
  new Map();


/* =========================================================
   EDITION SELECTION
========================================================= */

const modulePageParameters =
  new URLSearchParams(
    window.location.search
  );


const validEditions =
  new Set([
    "basic",
    "expert"
  ]);


let selectedEdition =
  String(
    modulePageParameters.get(
      "edition"
    ) ||
    ""
  )
    .trim()
    .toLowerCase();


const savedEdition =
  String(
    localStorage.getItem(
      "aclSelectedEdition"
    ) ||
    ""
  )
    .trim()
    .toLowerCase();


if (
  !validEditions.has(
    selectedEdition
  )
) {
  selectedEdition =
    savedEdition;
}


if (
  !validEditions.has(
    selectedEdition
  )
) {
  window.location.replace(
    "pathways.html"
  );

  throw new Error(
    "No valid ACL edition selected."
  );
}


localStorage.setItem(
  "aclSelectedEdition",
  selectedEdition
);

document.body.classList.remove(
  "acl-theme-basic",
  "acl-theme-expert"
);


document.body.classList.add(
  selectedEdition === "basic"
    ? "acl-theme-basic"
    : "acl-theme-expert"
);
/*
 * Add the remembered edition to the URL without reloading.
 */

if (
  !modulePageParameters.get(
    "edition"
  )
) {
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


/*
 * Opening modules.html without an edition uses the last
 * selected ACL pathway. If none exists, the user returns
 * to the pathway-selection screen.
 */

if (
  !validEditions.has(
    selectedEdition
  )
) {
  window.location.replace(
    "pathways.html"
  );
}

/* =========================================================
   TEXT HELPERS
========================================================= */

function escapeHtml(value = "") {
  return String(value).replace(
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


function titleCase(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}


function setStatus(
  message,
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


/* =========================================================
   MODULE CATEGORY THEMES

   ECG / rhythm                 → Yellow
   Intervention / PCI           → Red
   Imaging / echo / CT / MRI    → Green
   All remaining modules        → Blue
========================================================= */

function getModuleTheme(module) {
  const searchableText = [
    module?.title,
    module?.name,
    module?.category,
    module?.short_description,
    module?.description,
    module?.slug
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();


  const isECG =
    searchableText.includes("ecg") ||
    searchableText.includes("electrocardiograph") ||
    searchableText.includes("rhythm") ||
    searchableText.includes("arrhythmia");


  const isImaging =
    searchableText.includes("imaging") ||
    searchableText.includes("echocardiograph") ||
    searchableText.includes("echocardiography") ||
    searchableText.includes("echo") ||
    searchableText.includes("cardiac ct") ||
    searchableText.includes("coronary ct") ||
    searchableText.includes("ct angiography") ||
    searchableText.includes("ccta") ||
    searchableText.includes("mri") ||
    searchableText.includes("cmr") ||
    searchableText.includes("nuclear imaging") ||
    searchableText.includes("nuclear cardiology") ||
    searchableText.includes("ivus") ||
    searchableText.includes("oct");


  const isIntervention =
    searchableText.includes("intervention") ||
    searchableText.includes("interventional") ||
    searchableText.includes("pci") ||
    searchableText.includes("angioplasty") ||
    searchableText.includes("stent") ||
    searchableText.includes("catheter") ||
    searchableText.includes("structural") ||
    searchableText.includes("tavi") ||
    searchableText.includes("tavr") ||
    searchableText.includes("mitraclip") ||
    searchableText.includes("teer") ||
    searchableText.includes("device closure") ||
    searchableText.includes("coronary intervention") ||
    searchableText.includes("bifurcation") ||
    searchableText.includes("left main") ||
    searchableText.includes("calcified lesion") ||
    searchableText.includes("rotablation") ||
    searchableText.includes("atherectomy") ||
    searchableText.includes("cto");


  if (isECG) {
    return {
      className: "module-ecg",
      categoryLabel: "Electrocardiography"
    };
  }


  if (isImaging) {
    return {
      className: "module-imaging",
      categoryLabel: "Imaging"
    };
  }


  if (isIntervention) {
    return {
      className: "module-intervention",
      categoryLabel: "Interventional Cardiology"
    };
  }


  return {
    className: "module-general",
    categoryLabel: "General Cardiology"
  };
}


/* =========================================================
   MODULE AVAILABILITY
========================================================= */

function withinSchedule(module) {
  const now =
    Date.now();


  if (
    module.opens_at &&
    now <
      new Date(
        module.opens_at
      ).getTime()
  ) {
    return false;
  }


  if (
    module.closes_at &&
    now >
      new Date(
        module.closes_at
      ).getTime()
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
  if (
    module.status ===
    "coming_soon"
  ) {
    return {
      state: "coming",
      label: "Coming soon",
      reason:
        "This module is currently being prepared."
    };
  }


  if (
    !withinSchedule(module)
  ) {
    const opensLater =
      module.opens_at &&
      Date.now() <
        new Date(
          module.opens_at
        ).getTime();


    if (opensLater) {
      return {
        state: "locked",
        label: "Scheduled",
        reason:
          `Opens ${new Date(
            module.opens_at
          ).toLocaleString()}`
      };
    }


    return {
      state: "locked",
      label: "Closed",
      reason:
        "The access window has closed."
    };
  }


  if (
    module.access_type ===
      "admin_assigned" &&
    !assignedIds.has(
      module.id
    )
  ) {
    return {
      state: "locked",
      label: "Assignment required",
      reason:
        "This module requires administrator assignment."
    };
  }


  if (
    module.access_type ===
      "minimum_score" &&
    totalScore <
      Number(
        module.minimum_score ||
        0
      )
  ) {
    return {
      state: "locked",

      label:
        `Requires ${module.minimum_score} points`,

      reason:
        `Your current accumulated score is ${totalScore} points.`
    };
  }


  if (
    module.access_type ===
    "passcode"
  ) {
    return {
      state: "locked",
      label: "Passcode required",
      reason:
        "This module requires an access passcode."
    };
  }


  if (
    !module.launch_path
  ) {
    return {
      state: "coming",
      label: "Coming soon",
      reason:
        "Educational content will be available soon."
    };
  }


  return {
    state: "open",
    label: "Open module",
    reason: ""
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

    /*
     * Keep internal links relative.
     */

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
  } catch (error) {
    console.warn(
      "INVALID MODULE LAUNCH PATH:",
      launchPath,
      error
    );

    return launchPath;
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


  const href =
  decision.state === "open"
    ? escapeHtml(
        launchPathWithEdition(
          module.launch_path
        )
      )
    : "#";


  const theme =
    getModuleTheme(module);


  const coverStyle =
    module.cover_image_url
      ? `
        style="
          background-image:
          linear-gradient(
            135deg,
            rgba(4, 26, 72, 0.65),
            rgba(0, 86, 128, 0.25)
          ),
          url('${escapeHtml(
            module.cover_image_url
          )}')
        "
      `
      : "";


  return `
    <article
      class="
        module-card
        ${theme.className}
        ${escapeHtml(decision.state)}
        ${
          module.is_featured
            ? "featured"
            : ""
        }
      "
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
              module.title
            )}
          </h2>


          ${
            module.difficulty
              ? `
                <span
                  class="
                    difficulty-pill
                    ${escapeHtml(
                      module.difficulty
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
            "ACL Expert Edition educational module"
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
                      : "Completed"
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
                "open"
                  ? "disabled"
                  : ""
              }
            "
            href="${href}"

            ${
              decision.state !==
              "open"
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
            "open"
              ? `
               <button
  type="button"
  class="module-challenge-button"
  data-challenge-module-id="${escapeHtml(
    module.id
  )}"
  data-challenge-module-title="${escapeHtml(
    module.title
  )}"
 data-challenge-launch-path="${escapeHtml(
  launchPathWithEdition(
    module.launch_path ||
    ""
  )
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
</button>              `
              : ""
          }

        </div>

      </div>

    </article>
  `;
}
/* =========================================================
   MODULE CHALLENGE
========================================================= */

let selectedChallengeModule =
  null;


function challengeElement(
  id
) {
  return document.getElementById(
    id
  );
}

function shuffleChallengeItems(
  items
) {
  const result =
    [
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
function randomChallengeCode() {
  const code =
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
      .toUpperCase();

  return `ACL-${code}`;
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

    return (
      url.searchParams.get(
        "quiz"
      ) ||
      ""
    );
  } catch (error) {
    console.warn(
      "INVALID MODULE LAUNCH PATH:",
      error
    );

    return "";
  }
}


function openModuleChallengeModal(
  button
) {
  const modal =
    challengeElement(
      "moduleChallengeModal"
    );

  if (!modal) {
    window.alert(
      "The challenge window has not yet been added to modules.html."
    );

    return;
  }

  selectedChallengeModule = {
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

  if (moduleName) {
    moduleName.textContent =
      selectedChallengeModule
        .title;
  }

  if (result) {
    result.hidden =
      true;

    result.innerHTML =
      "";
  }

  if (createButton) {
    createButton.hidden =
      false;

    createButton.disabled =
      false;

    createButton.textContent =
      "Create challenge";
  }

  modal.hidden =
    false;

  document.body.classList.add(
    "module-challenge-open"
  );
}


function closeModuleChallengeModal() {
  const modal =
    challengeElement(
      "moduleChallengeModal"
    );

  if (modal) {
    modal.hidden =
      true;
  }

  document.body.classList.remove(
    "module-challenge-open"
  );
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
  const inputValue =
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

  return Math.min(
    100,
    Math.max(
      2,
      inputValue
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
    value <= 0
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

  return url.toString();
}


async function copyChallengeLink(
  value,
  button
) {
  try {
    await navigator
      .clipboard
      .writeText(
        value
      );

    if (button) {
      button.textContent =
        "Copied ✓";
    }
  } catch (error) {
    console.warn(
      "CLIPBOARD ERROR:",
      error
    );

    const input =
      challengeElement(
        "createdChallengeLink"
      );

    if (input) {
      input.focus();
      input.select();

      document.execCommand(
        "copy"
      );

      if (button) {
        button.textContent =
          "Copied ✓";
      }
    }
  }
}

async function createModuleChallenge() {
  if (!selectedChallengeModule) {
    return;
  }

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
      selectedChallengeModule
        .launchPath
    );

  if (!quizSlug) {
    if (result) {
      result.hidden = false;

      result.innerHTML = `
        <div class="module-challenge-error">
          This module does not contain a valid learning quiz link.
        </div>
      `;
    }

    return;
  }

  if (createButton) {
    createButton.disabled = true;
    createButton.textContent =
      "Creating challenge…";
  }

  try {
    /*
     * Find the signed-in user.
     */

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


    /*
     * Find the published quiz linked to the module.
     */

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
          question_count
        `)
        .eq(
          "slug",
          quizSlug
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


    /*
     * Load the available questions.
     *
     * The selected question IDs are saved with the
     * challenge so every participant receives the
     * same questions in the same order.
     */

    const {
      data: questionRows,
      error: questionsError
    } =
      await supabaseClient
        .from(
          "questions"
        )
        .select(`
          id,
          order_index
        `)
        .eq(
          "quiz_id",
          quizData.id
        )
        .order(
          "order_index",
          {
            ascending: true
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


    /*
     * Randomize the available pool once.
     *
     * The generated order is then saved permanently
     * inside this challenge.
     */

    const challengeQuestionPool =
      typeof shuffleChallengeItems ===
      "function"
        ? shuffleChallengeItems(
            questionRows
          )
        : [
            ...questionRows
          ];


    /*
     * Determine how many questions belong to the
     * challenge.
     */

    const configuredQuestionCount =
      Number(
        quizData.question_count
      );

    const requestedQuestionCount =
      Number.isFinite(
        configuredQuestionCount
      ) &&
      configuredQuestionCount > 0
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
          (question) =>
            question.id
        );

    if (
      !challengeQuestionIds
        .length
    ) {
      throw new Error(
        "The challenge question set could not be prepared."
      );
    }


    /*
     * Read the challenge settings selected in the modal.
     */

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


    /*
     * Create the challenge.
     */

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
            selectedChallengeModule
              .id,

          quiz_id:
            quizData.id,

          creator_id:
            user.id,

          challenge_code:
            challengeCode,

          title:
            `${selectedChallengeModule.title} Challenge`,

          question_ids:
            challengeQuestionIds,

          maximum_participants:
            maximumParticipants,

          starts_at:
            startsAt
              .toISOString(),

          ends_at:
            endsAt
              .toISOString(),

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


    /*
     * Add the creator as the first participant.
     */

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


    /*
     * Build the invitation link and WhatsApp message.
     */

    const challengeUrl =
      challengeLinkFor(
        challenge
          .challenge_code
      );

    const whatsappMessage =
      encodeURIComponent(
        `⚔️ ACL Head-to-Head Challenge\n\n` +
        `${selectedChallengeModule.title}\n` +
        `Challenge code: ${challenge.challenge_code}\n\n` +
        `Highest confidence-adjusted score wins.\n` +
        `Ties are decided by the shortest completion time.\n\n` +
        `Join the challenge here:\n${challengeUrl}`
      );


    /*
     * Display the redesigned success card.
     */

    if (result) {
      result.hidden = false;

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
                  challenge
                    .challenge_code
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
            aria-live="polite"
          ></p>

        </section>
      `;
    }


    /*
     * Find the newly rendered controls.
     */

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


    /*
     * Copy text with a fallback for browsers where
     * navigator.clipboard is unavailable.
     */

    async function copyText(
      text,
      successMessage
    ) {
      try {
        if (
          navigator.clipboard &&
          window.isSecureContext
        ) {
          await navigator
            .clipboard
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
              "Copy command failed."
            );
          }
        }

        if (copyFeedback) {
          copyFeedback.textContent =
            successMessage;
        }
      } catch (copyError) {
        console.error(
          "COPY CHALLENGE TEXT ERROR:",
          copyError
        );

        if (challengeLinkInput) {
          challengeLinkInput.focus();
          challengeLinkInput.select();
        }

        if (copyFeedback) {
          copyFeedback.textContent =
            "Please copy the selected text manually.";
        }
      }

      window.setTimeout(
        () => {
          if (copyFeedback) {
            copyFeedback.textContent =
              "";
          }
        },
        2400
      );
    }


    /*
     * Copy challenge code.
     */

    copyCodeButton
      ?.addEventListener(
        "click",
        async () => {
          await copyText(
            challenge
              .challenge_code,
            "Challenge code copied."
          );
        }
      );


    /*
     * Copy challenge link from the small button.
     */

    copyLinkButton
      ?.addEventListener(
        "click",
        async () => {
          await copyText(
            challengeUrl,
            "Challenge link copied."
          );
        }
      );


    /*
     * Copy challenge link from the large button.
     */

    copyLargeButton
      ?.addEventListener(
        "click",
        async () => {
          await copyText(
            challengeUrl,
            "Challenge link copied."
          );
        }
      );


    /*
     * Select the invitation URL when the input is clicked.
     */

    challengeLinkInput
      ?.addEventListener(
        "click",
        () => {
          challengeLinkInput.select();
        }
      );


    /*
     * Hide the creation button after success.
     */

    if (createButton) {
      createButton.hidden = true;
    }
  } catch (error) {
    console.error(
      "CREATE MODULE CHALLENGE ERROR:",
      error
    );

    if (result) {
      result.hidden = false;

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
    if (createButton) {
      createButton.disabled =
        false;

      if (!createButton.hidden) {
        createButton.textContent =
          "Create challenge";
      }
    }
  }
}


/*
 * Delegated event listener because module cards
 * are generated dynamically after Supabase loads.
 */

document.addEventListener(
  "click",
  (event) => {
    const challengeButton =
      event.target.closest(
        "[data-challenge-module-id]"
      );

    if (
      challengeButton
    ) {
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
  (event) => {
    if (
      event.key ===
      "Escape"
    ) {
      closeModuleChallengeModal();
    }
  }
);
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
    .filter(Boolean)
    .join(" ")
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
      moduleSearchInput
        ?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const category =
    moduleCategoryFilter
      ?.value ||
    "all";


  const difficulty =
    moduleDifficultyFilter
      ?.value ||
    "all";


  const access =
    moduleAccessFilter
      ?.value ||
    "all";


  const filteredModules =
    loadedModules.filter(
      (module) => {
        const decision =
          accessDecision(
            module,
            loadedAssignedIds,
            loadedTotalScore
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


        const moduleDifficulty =
          String(
            module.difficulty ||
            ""
          )
            .trim()
            .toLowerCase();


        const matchesDifficulty =
          difficulty ===
            "all" ||
          moduleDifficulty ===
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


  if (
    !filteredModules.length
  ) {
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
          (module) =>
            moduleCard(
              module,

              accessDecision(
                module,
                loadedAssignedIds,
                loadedTotalScore
              ),

              loadedProgressMap
            )
        )
        .join("");
  }


  if (moduleSearchSummary) {
    moduleSearchSummary.textContent =
      `${filteredModules.length} of ${loadedModules.length} module${
        loadedModules.length === 1
          ? ""
          : "s"
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
}


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

/* =========================================================
   LOAD MODULE CATALOGUE
========================================================= */

async function loadCatalogue() {
  const profile =
    await protectAndRender(
      "login.html"
    );


  if (!profile) {
    return;
  }

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
  setStatus(
    "Loading your ACL catalogue…"
  );


  try {
    const [
      moduleResult,
      assignmentResult,
      attemptResult
    ] = await Promise.all([

    supabaseClient
  .from("modules")
  .select("*")
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
  ),


      supabaseClient
        .from("module_assignments")
        .select(
          "module_id, expires_at"
        )
        .eq(
          "user_id",
          profile.id
        ),


      supabaseClient
        .from("quiz_attempts")
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
            ascending: false
          }
        )

    ]);


    if (
      moduleResult.error
    ) {
      throw moduleResult.error;
    }


    if (
      assignmentResult.error
    ) {
      throw assignmentResult.error;
    }


    if (
      attemptResult.error
    ) {
      throw attemptResult.error;
    }


    const modules =
      moduleResult.data ||
      [];


    const assignments =
      assignmentResult.data ||
      [];


    const attempts =
      attemptResult.data ||
      [];


    const assignedIds =
      new Set(
        assignments
          .filter(
            (assignment) =>
              !assignment.expires_at ||
              new Date(
                assignment.expires_at
              ).getTime() >
                Date.now()
          )
          .map(
            (assignment) =>
              assignment.module_id
          )
      );


    const totalScore =
      attempts
        .filter(
          (attemptItem) =>
            attemptItem.status ===
            "completed"
        )
        .reduce(
          (
            total,
            attemptItem
          ) =>
            total +
            Number(
              attemptItem.score ||
              0
            ),
          0
        );


    const progressMap =
      new Map();


    for (
      const attemptItem of
      attempts
    ) {
      if (
        !progressMap.has(
          attemptItem.module_id
        )
      ) {
        progressMap.set(
          attemptItem.module_id,
          attemptItem
        );
      }
    }
    
loadedModules =
  modules;


loadedAssignedIds =
  assignedIds;


loadedTotalScore =
  totalScore;


loadedProgressMap =
  progressMap;

    if (
      !modules.length
    ) {
      grid.innerHTML = `
        <div class="empty-state">
          No modules are currently available.
        </div>
      `;


      if (summary) {
        summary.textContent =
          "0 modules";
      }

if (moduleSearchSummary) {
  moduleSearchSummary.textContent =
    "0 modules available";
}
      setStatus("");

      return;
    }

renderFilteredModules();


    if (summary) {
      summary.textContent =
        `${modules.length} module${
          modules.length === 1
            ? ""
            : "s"
        } · ${totalScore} accumulated quiz points`;
    }


    setStatus("");

  } catch (error) {
    console.error(
      "Module catalogue failed:",
      error
    );


    grid.innerHTML = `
      <div class="empty-state">
        The module catalogue could not be loaded.
      </div>
    `;


    setStatus(
      error.message ||
      "Could not load modules.",
      "error"
    );
  }
}


/* =========================================================
   START
========================================================= */

loadCatalogue();
