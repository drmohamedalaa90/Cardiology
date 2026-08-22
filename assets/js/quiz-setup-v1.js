import { supabaseClient } from "./supabase-client.js";
import {
  getAclSettings,
  saveAclSettings,
  normalizeAclSettings
} from "./user-settings.js?v=20260822-quizsetup";

const $ = id => document.getElementById(id);

const params = new URLSearchParams(location.search);
const moduleId = params.get("module");
const moduleSlug = params.get("slug");
const edition =
  String(params.get("edition") || "expert").toLowerCase() === "basic"
    ? "basic"
    : "expert";

let moduleRow = null;
let count = 20;

function timeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      window.setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    )
  ]);
}

function show(message = "", kind = "") {
  const el = $("quizSetupStatus");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message;
  el.className = `status-box ${kind}`.trim();
}

function currentSettings() {
  return normalizeAclSettings({
    confidenceEnabled: $("confidenceEnabled").checked,
    lifelinesEnabled: $("lifelinesEnabled").checked,
    enabledLifelines: {
      expert: $("lifelineExpert").checked,
      filter: $("lifelineFilter").checked,
      guideline: $("lifelineGuideline").checked,
      vault: $("lifelineVault").checked
    }
  });
}

function enabledLifelineCount() {
  if (!$("lifelinesEnabled").checked) return 0;
  return [
    "lifelineExpert",
    "lifelineFilter",
    "lifelineGuideline",
    "lifelineVault"
  ].filter(id => $(id).checked).length;
}

function syncLifelineDisabledState() {
  const enabled = $("lifelinesEnabled").checked;
  $("lifelineChoices")?.classList.toggle("is-disabled", !enabled);

  [
    "lifelineExpert",
    "lifelineFilter",
    "lifelineGuideline",
    "lifelineVault"
  ].forEach(id => {
    $(id).disabled = !enabled;
  });
}

function renderSummary() {
  $("summaryCount").textContent = String(count);
  $("quizSetupSummaryTitle").textContent = `${count}-question quiz`;
  $("summaryConfidence").textContent =
    $("confidenceEnabled").checked ? "On" : "Off";

  const n = enabledLifelineCount();
  $("summaryLifelines").textContent = n ? `${n} enabled` : "Off";

  document.querySelectorAll("[data-count]").forEach(button => {
    button.classList.toggle(
      "is-selected",
      Number(button.dataset.count) === count
    );
  });
}

function launchPath() {
  if (!moduleRow?.launch_path) return null;

  const u = new URL(moduleRow.launch_path, location.href);

  if (
    edition === "expert" &&
    /learning(?:-expert)?\.html$/.test(u.pathname)
  ) {
    u.pathname = u.pathname.replace(
      /learning(?:-expert)?\.html$/,
      "learning-expert.html"
    );
  }

  u.searchParams.set("edition", edition);
  u.searchParams.set("module", moduleRow.id);

  // current focused-quiz support
  u.searchParams.set("count", String(count));

  // compatibility with older Learning Mode builds
  u.searchParams.set("question_count", String(count));

  // do not restore an old unfinished attempt when user chose New Quiz
  u.searchParams.set("new", "1");

  return u.origin === location.origin
    ? `${u.pathname}${u.search}${u.hash}`
    : u.toString();
}

async function load() {
  show("Loading quiz preferences…");

  const sessionResult = await timeout(
    supabaseClient.auth.getSession(),
    6000,
    "Session"
  );

  const user = sessionResult?.data?.session?.user;

  if (!user) {
    location.replace("login.html");
    return;
  }

  let query = supabaseClient
    .from("modules")
    .select("*")
    .eq("edition", edition);

  if (moduleId) {
    query = query.eq("id", moduleId);
  } else if (moduleSlug) {
    query = query.eq("slug", moduleSlug);
  } else {
    throw new Error("No module was selected.");
  }

  const moduleResult = await timeout(
    query.maybeSingle(),
    7000,
    "Module"
  );

  if (moduleResult.error) throw moduleResult.error;
  if (!moduleResult.data) throw new Error("Module not found.");

  moduleRow = moduleResult.data;

  $("quizSetupModuleTitle").textContent =
    moduleRow.title || "Prepare your quiz";

  document.title = `${moduleRow.title || "Quiz"} | ACL Quiz Setup`;

  $("quizSetupBack").href =
    `module-hub.html?edition=${encodeURIComponent(edition)}&module=${encodeURIComponent(moduleRow.id)}`;

  try {
    const saved = await timeout(
      getAclSettings(),
      6000,
      "Settings"
    );

    const normalized = normalizeAclSettings(saved);

    $("confidenceEnabled").checked = normalized.confidenceEnabled;
    $("lifelinesEnabled").checked = normalized.lifelinesEnabled;
    $("lifelineExpert").checked = normalized.enabledLifelines.expert;
    $("lifelineFilter").checked = normalized.enabledLifelines.filter;
    $("lifelineGuideline").checked = normalized.enabledLifelines.guideline;
    $("lifelineVault").checked = normalized.enabledLifelines.vault;
  } catch (error) {
    console.warn("QUIZ SETUP SETTINGS FALLBACK", error);
  }

  syncLifelineDisabledState();
  renderSummary();
  show("");
}

document.querySelectorAll("[data-count]").forEach(button => {
  button.addEventListener("click", () => {
    count = Number(button.dataset.count) || 20;
    renderSummary();
  });
});

[
  "confidenceEnabled",
  "lifelinesEnabled",
  "lifelineExpert",
  "lifelineFilter",
  "lifelineGuideline",
  "lifelineVault"
].forEach(id => {
  $(id)?.addEventListener("change", () => {
    if (id === "lifelinesEnabled") {
      syncLifelineDisabledState();
    }
    renderSummary();
  });
});

$("startConfiguredQuiz")?.addEventListener("click", async () => {
  const button = $("startConfiguredQuiz");

  try {
    button.disabled = true;
    button.textContent = "Preparing quiz…";
    show("Saving quiz preferences…");

    await timeout(
      saveAclSettings(currentSettings()),
      7000,
      "Saving settings"
    );

    const target = launchPath();

    if (!target) {
      throw new Error("This module has no Learning Mode launch path.");
    }

    location.href = target;
  } catch (error) {
    console.error("QUIZ SETUP START ERROR", error);

    show(
      error.message || "Could not start quiz.",
      "error"
    );

    button.disabled = false;
    button.textContent = "Start Quiz";
  }
});

try {
  await load();
} catch (error) {
  console.error("QUIZ SETUP ERROR", error);
  show(
    error.message || "Could not load quiz setup.",
    "error"
  );
}
