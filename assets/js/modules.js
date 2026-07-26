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
            decision.state !== "open"
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

      </div>

    </article>
  `;
}


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
