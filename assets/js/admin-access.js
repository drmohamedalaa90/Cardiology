import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL ADMIN ACCESS v3.0.0 LOADED"
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


let rules =
  [];


let adminProfile =
  null;


let isLoading =
  false;


let isSaving =
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


function titleCase(
  value
) {
  return String(
    value ||
    ""
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}


function numberValue(
  value,
  fallback = 0
) {
  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


function isAdminProfile(
  profile
) {
  const role =
    String(
      profile?.role ||
      ""
    )
      .trim()
      .toLowerCase();


  return Boolean(
    profile?.is_admin ||
    role === "admin" ||
    role === "administrator"
  );
}


function setStatus(
  message = "",
  type = ""
) {
  const statusBox =
    byId(
      "accessStatus"
    );


  if (!statusBox) {
    return;
  }


  statusBox.textContent =
    message;


  statusBox.className =
    `status-box ${type}`.trim();


  statusBox.hidden =
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
  id
) {
  return (
    modules.find(
      (module) =>
        String(
          module.id
        ) ===
        String(
          id
        )
    )?.title ||
    id ||
    "Unknown module"
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
      "adminAccessEditionBadge"
    );


  const themeColor =
    byId(
      "adminAccessThemeColor"
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
    adminAccessDashboardLink:
      "admin.html",

    adminAccessModulesLink:
      "admin-modules.html"
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
    `Access Engine | ACL ${
      isBasic
        ? "Basic Edition"
        : "Expert Edition"
    } Admin`;


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
   MODULES
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
        status,
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


  renderModuleOptions();
}


/* =========================================================
   MODULE OPTIONS
========================================================= */

function renderModuleOptions() {
  const moduleSelect =
    byId(
      "moduleId"
    );


  const prerequisiteSelect =
    byId(
      "prerequisiteId"
    );


  const options =
    modules
      .map(
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
      .join(
        ""
      );


  if (moduleSelect) {
    moduleSelect.innerHTML =
      options ||
      `
        <option value="">
          No modules available
        </option>
      `;
  }


  if (prerequisiteSelect) {
    prerequisiteSelect.innerHTML = `
      <option value="">
        None
      </option>

      ${options}
    `;
  }


  filterPrerequisiteOptions();
}


/* =========================================================
   FILTER PREREQUISITES
========================================================= */

function filterPrerequisiteOptions() {
  const moduleId =
    byId(
      "moduleId"
    )?.value ||
    "";


  const prerequisiteSelect =
    byId(
      "prerequisiteId"
    );


  if (!prerequisiteSelect) {
    return;
  }


  const previousValue =
    prerequisiteSelect.value;


  const options =
    modules
      .filter(
        (module) =>
          String(
            module.id
          ) !==
          String(
            moduleId
          )
      )
      .map(
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
      .join(
        ""
      );


  prerequisiteSelect.innerHTML = `
    <option value="">
      None
    </option>

    ${options}
  `;


  if (
    [
      ...prerequisiteSelect.options
    ].some(
      (option) =>
        option.value ===
        previousValue
    )
  ) {
    prerequisiteSelect.value =
      previousValue;
  }
}


/* =========================================================
   RULE FORM DISPLAY
========================================================= */

function updateRuleFields() {
  const ruleType =
    byId(
      "ruleType"
    ).value;


  byId(
    "prerequisiteField"
  ).hidden =
    ruleType !==
    "prerequisite_module";


  byId(
    "minimumScoreField"
  ).hidden =
    ruleType !==
    "minimum_total_score";


  byId(
    "positionsField"
  ).hidden =
    ruleType !==
    "academic_position";
}


/* =========================================================
   LOAD RULES
========================================================= */

async function loadRules() {
  if (isLoading) {
    return;
  }


  isLoading =
    true;


  const refreshButton =
    byId(
      "refreshRules"
    );


  setButtonBusy(
    refreshButton,
    true,
    "Refreshing…",
    "Refresh"
  );


  setStatus(
    "Loading access rules…"
  );


  byId(
    "rulesBody"
  ).innerHTML = `
    <tr>
      <td colspan="4">
        Loading rules…
      </td>
    </tr>
  `;


  try {
    const ids =
      moduleIds();


    if (!ids.length) {
      rules =
        [];


      renderRules();


      setStatus(
        "No modules are available in this edition.",
        "warning"
      );


      return;
    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "module_unlock_rules"
        )
        .select(
          "*"
        )
        .in(
          "module_id",
          ids
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );


    if (error) {
      throw error;
    }


    rules =
      data ||
      [];


    renderRules();


    setStatus(
      ""
    );
  } catch (error) {
    console.error(
      "ACCESS RULE LOAD ERROR:",
      error
    );


    rules =
      [];


    byId(
      "rulesBody"
    ).innerHTML = `
      <tr>
        <td colspan="4">
          Access rules could not be loaded.
        </td>
      </tr>
    `;


    setStatus(
      error.message ||
      "Access rules could not be loaded.",
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
   REQUIREMENT TEXT
========================================================= */

function requirementText(
  rule
) {
  switch (
    rule.rule_type
  ) {
    case "prerequisite_module":
      return rule.prerequisite_module_id
        ? moduleName(
            rule.prerequisite_module_id
          )
        : "No prerequisite selected";


    case "minimum_total_score":
      return `Minimum total score: ${numberValue(
        rule.minimum_value,
        0
      )}`;


    case "academic_position": {
      const positions =
        Array.isArray(
          rule.allowed_positions
        )
          ? rule.allowed_positions
          : [];


      return positions.length
        ? positions.join(", ")
        : "No positions specified";
    }


    case "manual_assignment":
      return "Requires manual assignment by an administrator";


    default:
      return "Required";
  }
}


/* =========================================================
   RENDER RULES
========================================================= */

function renderRules() {
  const body =
    byId(
      "rulesBody"
    );


  if (!body) {
    return;
  }


  if (!rules.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4">
          No access rules exist for this edition yet.
        </td>
      </tr>
    `;


    return;
  }


  body.innerHTML =
    rules
      .map(
        (rule) => `
          <tr data-rule-id="${escapeHtml(
            rule.id
          )}">

            <td>
              <strong>
                ${escapeHtml(
                  moduleName(
                    rule.module_id
                  )
                )}
              </strong>
            </td>


            <td>

              <span class="rule-type-badge">
                ${escapeHtml(
                  titleCase(
                    rule.rule_type
                  )
                )}
              </span>

            </td>


            <td>
              ${escapeHtml(
                requirementText(
                  rule
                )
              )}
            </td>


            <td>

              <button
                class="danger-btn delete-rule"
                type="button"
                data-delete="${escapeHtml(
                  rule.id
                )}"
              >
                Delete
              </button>

            </td>

          </tr>
        `
      )
      .join(
        ""
      );
}


/* =========================================================
   BUILD PAYLOAD
========================================================= */

function buildPayload() {
  const ruleType =
    byId(
      "ruleType"
    ).value;


  const positions =
    byId(
      "allowedPositions"
    )
      .value
      .split(
        ","
      )
      .map(
        (position) =>
          position.trim()
      )
      .filter(
        Boolean
      );


  return {
    module_id:
      byId(
        "moduleId"
      ).value,

    rule_type:
      ruleType,

    prerequisite_module_id:
      ruleType ===
        "prerequisite_module"
        ? byId(
            "prerequisiteId"
          ).value ||
          null
        : null,

    minimum_value:
      ruleType ===
        "minimum_total_score"
        ? Math.max(
            0,
            numberValue(
              byId(
                "minimumValue"
              ).value,
              0
            )
          )
        : null,

    allowed_positions:
      ruleType ===
        "academic_position"
        ? positions
        : null,

    is_active:
      true
  };
}


/* =========================================================
   VALIDATION
========================================================= */

function validatePayload(
  payload
) {
  if (!payload.module_id) {
    throw new Error(
      "Select a module."
    );
  }


  if (
    !moduleIds().includes(
      payload.module_id
    )
  ) {
    throw new Error(
      "The selected module does not belong to this edition."
    );
  }


  if (
    payload.rule_type ===
      "prerequisite_module" &&
    !payload.prerequisite_module_id
  ) {
    throw new Error(
      "Select a prerequisite module."
    );
  }


  if (
    payload.rule_type ===
      "prerequisite_module" &&
    payload.prerequisite_module_id ===
      payload.module_id
  ) {
    throw new Error(
      "A module cannot be its own prerequisite."
    );
  }


  if (
    payload.rule_type ===
      "academic_position" &&
    !payload.allowed_positions?.length
  ) {
    throw new Error(
      "Enter at least one allowed academic position."
    );
  }


  return true;
}


/* =========================================================
   SAVE RULE
========================================================= */

async function saveRule() {
  if (isSaving) {
    return;
  }


  const payload =
    buildPayload();


  validatePayload(
    payload
  );


  isSaving =
    true;


  const saveButton =
    byId(
      "saveRuleButton"
    );


  setButtonBusy(
    saveButton,
    true,
    "Saving…",
    "Save rule"
  );


  setStatus(
    "Saving access rule…"
  );


  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "module_unlock_rules"
        )
        .insert(
          payload
        );


    if (error) {
      throw error;
    }


    byId(
      "minimumValue"
    ).value =
      "0";


    byId(
      "allowedPositions"
    ).value =
      "";


    byId(
      "prerequisiteId"
    ).value =
      "";


    await loadRules();


    setStatus(
      "Access rule saved successfully.",
      "success"
    );
  } catch (error) {
    console.error(
      "ACCESS RULE SAVE ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The access rule could not be saved.",
      "error"
    );
  } finally {
    isSaving =
      false;


    setButtonBusy(
      saveButton,
      false,
      "Saving…",
      "Save rule"
    );
  }
}


/* =========================================================
   DELETE RULE
========================================================= */

async function deleteRule(
  id,
  button
) {
  const rule =
    rules.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          id
        )
    );


  if (!rule) {
    return;
  }


  const confirmed =
    window.confirm(
      `Delete the ${titleCase(
        rule.rule_type
      )} rule for ${moduleName(
        rule.module_id
      )}?`
    );


  if (!confirmed) {
    return;
  }


  setButtonBusy(
    button,
    true,
    "Deleting…",
    "Delete"
  );


  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "module_unlock_rules"
        )
        .delete()
        .eq(
          "id",
          id
        )
        .in(
          "module_id",
          moduleIds()
        );


    if (error) {
      throw error;
    }


    await loadRules();


    setStatus(
      "Access rule deleted.",
      "success"
    );
  } catch (error) {
    console.error(
      "ACCESS RULE DELETE ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The access rule could not be deleted.",
      "error"
    );
  } finally {
    setButtonBusy(
      button,
      false,
      "Deleting…",
      "Delete"
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  byId(
    "ruleForm"
  )?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      await saveRule();
    }
  );


  byId(
    "ruleType"
  )?.addEventListener(
    "change",
    updateRuleFields
  );


  byId(
    "moduleId"
  )?.addEventListener(
    "change",
    filterPrerequisiteOptions
  );


  byId(
    "refreshRules"
  )?.addEventListener(
    "click",
    loadRules
  );


  byId(
    "rulesBody"
  )?.addEventListener(
    "click",
    async (event) => {
      const button =
        event.target.closest(
          "[data-delete]"
        );


      if (!button) {
        return;
      }


      await deleteRule(
        button.dataset.delete,
        button
      );
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeAccessEngine() {
  try {
    applyEditionContext();


    adminProfile =
      await protectAndRender(
        "login.html"
      );


    if (!adminProfile) {
      return;
    }


    if (
      !isAdminProfile(
        adminProfile
      )
    ) {
      window.location.replace(
        aclUrl(
          "modules.html",
          selectedEdition
        )
      );


      return;
    }


    bindEvents();


    await loadModules();


    updateRuleFields();


    await loadRules();
  } catch (error) {
    console.error(
      "ACCESS ENGINE INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The access engine could not be initialized.",
      "error"
    );


    byId(
      "rulesBody"
    ).innerHTML = `
      <tr>
        <td colspan="4">
          Access management could not be loaded.
        </td>
      </tr>
    `;
  }
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAccessEngine,
    {
      once: true
    }
  );
} else {
  void initializeAccessEngine();
}
