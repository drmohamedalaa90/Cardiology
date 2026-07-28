import { supabaseClient } from "./supabase-client.js";
import { protectAndRender } from "./session-ui.js?v=2.8.0";


const grid =
  document.getElementById("modulesGrid");

const stateBox =
  document.getElementById("modulesStatus");

const summary =
  document.getElementById("catalogueSummary");


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
          module.launch_path
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
    module.launch_path ||
    ""
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
  if (
    !selectedChallengeModule
  ) {
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

  if (createButton) {
    createButton.disabled =
      true;

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
     * Find the published quiz from the module launch path.
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
 * Load all published questions belonging to this quiz.
 * The selected IDs will be saved permanently in the
 * challenge so every participant receives the same set.
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


/*
 * Preserve normal order unless this quiz is configured
 * to select questions randomly.
 */

const shouldRandomizeQuestions =
  Boolean(
    quizData
      .randomize_questions
  ) ||
  quizData
    .selection_mode ===
    "random";

const challengeQuestionPool =
  shouldRandomizeQuestions
    ? shuffleChallengeItems(
        questionRows
      )
    : [
        ...questionRows
      ];


const requestedQuestionCount =
  Math.max(
    1,
    Number(
      quizData
        .question_count ||
      challengeQuestionPool
        .length
    )
  );


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
     *
     * question_ids stays empty during this first stage.
     * We will populate the fixed challenge question set
     * when challenge.html is added.
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


    const challengeUrl =
      challengeLinkFor(
        challenge
          .challenge_code
      );

    const whatsappMessage =
      [
        "⚔️ ACL Expert Edition Challenge",
        "",
        `I challenge you to the ${selectedChallengeModule.title} module!`,
        "",
        "Highest confidence-adjusted score wins.",
        "Ties are decided by the shortest completion time.",
        "",
        challengeUrl
      ].join(
        "\n"
      );


    if (result) {
      result.hidden =
        false;

      result.innerHTML = `
        <div class="module-challenge-success">

          <span class="module-challenge-success-icon">
            ⚔️
          </span>

          <h3>
            Challenge created!
          </h3>

          <p>
  Share this private challenge link with your friend
  or group.
</p>

<div class="module-challenge-created-summary">

  <span>
    Questions
  </span>

  <strong>
    ${challengeQuestionIds.length}
  </strong>

  <small>
    The same question set will be used for all participants.
  </small>

</div>

          <div class="module-challenge-code">

            <span>
              Challenge code
            </span>

            <strong>
              ${escapeHtml(
                challenge.challenge_code
              )}
            </strong>

          </div>

          <label class="module-challenge-link-field">

            <span>
              Challenge link
            </span>

            <input
              id="createdChallengeLink"
              type="text"
              value="${escapeHtml(
                challengeUrl
              )}"
              readonly
            >

          </label>

          <div class="module-challenge-share-actions">

            <button
              id="copyCreatedChallenge"
              type="button"
              class="secondary-btn"
            >
              Copy challenge link
            </button>

            <a
              class="primary-btn"
              href="https://wa.me/?text=${encodeURIComponent(
                whatsappMessage
              )}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on WhatsApp
            </a>

          </div>

        </div>
      `;
    }

    const copyButton =
      challengeElement(
        "copyCreatedChallenge"
      );

    copyButton
      ?.addEventListener(
        "click",
        async () => {
          await copyChallengeLink(
            challengeUrl,
            copyButton
          );
        }
      );

    if (createButton) {
      createButton.hidden =
        true;
    }
  } catch (error) {
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
    if (createButton) {
      createButton.disabled =
        false;

      if (
        !createButton.hidden
      ) {
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


      setStatus("");

      return;
    }


    grid.innerHTML =
      modules
        .map(
          (module) =>
            moduleCard(
              module,

              accessDecision(
                module,
                assignedIds,
                totalScore
              ),

              progressMap
            )
        )
        .join("");


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
