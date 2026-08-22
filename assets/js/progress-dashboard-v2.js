import { supabaseClient } from "./supabase-client.js";

/* =========================================================
   ACL PROGRESS DASHBOARD v2 — FREEZE-SAFE
   2026-08-22

   Why v1 could stall:
   - session-ui.js installed a whole-document MutationObserver.
   - listAttempts() fetched quiz_attempts with SELECT *.
   - SELECT * included every saved answer/explanation/question-id payload.
   - the page then rendered the entire history synchronously.

   v2:
   - restores auth directly with a timeout;
   - fetches only compact attempt metadata initially;
   - fetches confidence answer payloads in a small second request;
   - lazy-loads a single attempt's answers only when Review is clicked;
   - renders history in bounded batches.
========================================================= */

const $ = id => document.getElementById(id);

const EDITION = "expert";
const INITIAL_COMPLETED_LIMIT = 40;
const CONFIDENCE_SAMPLE_LIMIT = 30;

let attempts = [];
let moduleMap = new Map();
let confidenceAnswersByAttempt = new Map();
let currentUserId = null;
let loading = false;

function esc(value = "") {
  return String(value).replace(
    /[&<>'"]/g,
    char =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[char]
  );
}

function withTimeout(promise, ms, label) {
  let timer = null;

  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error(`${label} timed out`)),
      ms
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

function safeObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {}
  }

  return {};
}

function safeArray(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {}
  }

  return [];
}

function metadata(attempt) {
  const lifelines = safeObject(attempt?.lifelines);
  return safeObject(lifelines?._aclMeta);
}

function cleanLifelines(attempt) {
  const lifelines = { ...safeObject(attempt?.lifelines) };
  delete lifelines._aclMeta;
  return lifelines;
}

function dateOf(attempt) {
  const value =
    attempt?.completed_at ||
    attempt?.updated_at ||
    attempt?.created_at ||
    0;

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function answered(attempt) {
  const m = metadata(attempt);

  const explicit = Number(
    m.answeredCount ??
    m.answered_count ??
    attempt?.answered_count
  );

  if (Number.isFinite(explicit) && explicit >= 0) {
    return Math.floor(explicit);
  }

  if (attempt?.status === "completed") {
    const count = Number(attempt?.question_count || 0);
    return Number.isFinite(count) && count >= 0
      ? Math.floor(count)
      : 0;
  }

  const index = Number(attempt?.current_question_index);
  if (Number.isFinite(index) && index >= 0) {
    return Math.floor(index) + 1;
  }

  return 0;
}

function correct(attempt) {
  const m = metadata(attempt);

  const explicit = Number(
    m.correctCount ??
    m.correct_count ??
    attempt?.correct_count
  );

  if (Number.isFinite(explicit) && explicit >= 0) {
    return Math.floor(explicit);
  }

  /* Legacy rows sometimes stored a raw correct-count in score. */
  const score = Number(attempt?.score);
  const total = answered(attempt);

  if (
    Number.isFinite(score) &&
    score >= 0 &&
    score <= total
  ) {
    return Math.floor(score);
  }

  return 0;
}

function pct(attempt) {
  const total = answered(attempt);
  return total
    ? Math.round((correct(attempt) / total) * 100)
    : 0;
}

function confidenceEnabled(attempt) {
  const m = metadata(attempt);
  return Boolean(
    attempt?.confidence_enabled ??
    m.confidenceEnabled ??
    m.confidence_enabled
  );
}

function lifelinesUsed(attempt) {
  const state = cleanLifelines(attempt);

  if (Array.isArray(state.history)) {
    return state.history.length;
  }

  if (Array.isArray(state.uses)) {
    return state.uses.length;
  }

  if (Number.isFinite(Number(state.usedCount))) {
    return Math.max(0, Number(state.usedCount));
  }

  /* Legacy boolean state compatibility. */
  return [
    "expert",
    "flashcard",
    "time",
    "filter",
    "guideline",
    "vault"
  ].filter(key => Boolean(state[key])).length;
}

function moduleInfo(attempt) {
  return moduleMap.get(String(attempt?.module_id || "")) || null;
}

function moduleTitle(attempt) {
  return (
    attempt?.module_title ||
    moduleInfo(attempt)?.title ||
    "ACL Module"
  );
}

function moduleUrl(attempt) {
  const module = moduleInfo(attempt);

  if (module?.launch_path) {
    try {
      const u = new URL(module.launch_path, location.href);
      u.searchParams.set("edition", EDITION);
      return u.origin === location.origin
        ? `${u.pathname}${u.search}${u.hash}`
        : u.toString();
    } catch {}
  }

  if (module?.id) {
    const p = new URLSearchParams({
      edition: EDITION,
      module: String(module.id)
    });

    if (module.slug) {
      p.set("slug", String(module.slug));
    }

    return `module-hub.html?${p.toString()}`;
  }

  return `modules.html?edition=${EDITION}`;
}

function fmt(value) {
  if (!value) return "—";
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString();
}

function clamp(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function show(message = "", type = "success", persist = false) {
  const box = $("progressStatus");
  if (!box) return;

  if (!message) {
    box.textContent = "";
    box.className = "status-box";
    return;
  }

  box.textContent = message;
  box.className = `status-box show ${type}`;

  if (!persist) {
    window.setTimeout(() => {
      if (box.textContent === message) {
        box.className = "status-box";
      }
    }, 3200);
  }
}

async function restoreSession() {
  const result = await withTimeout(
    supabaseClient.auth.getSession(),
    6000,
    "Session restoration"
  );

  if (result?.error) {
    throw result.error;
  }

  const session = result?.data?.session;

  if (!session?.user) {
    location.replace("login.html");
    return null;
  }

  currentUserId = session.user.id;
  return session;
}

async function loadModuleMap() {
  const result = await withTimeout(
    supabaseClient
      .from("modules")
      .select("id,title,slug,edition,launch_path")
      .eq("edition", EDITION),
    7000,
    "Module catalogue"
  );

  if (result.error) {
    throw result.error;
  }

  moduleMap = new Map(
    (result.data || []).map(module => [
      String(module.id),
      module
    ])
  );
}

async function loadAttemptSummaries() {
  /*
   * IMPORTANT: do not SELECT * here.
   * The answers/question_ids fields are intentionally omitted.
   */
  const result = await withTimeout(
    supabaseClient
      .from("quiz_attempts")
      .select(`
        id,
        module_id,
        module_title,
        quiz_id,
        quiz_title,
        mode,
        question_count,
        current_question_index,
        score,
        lifelines,
        status,
        completed_at,
        created_at,
        updated_at
      `)
      .eq("user_id", currentUserId)
      .order("updated_at", { ascending: false }),
    9000,
    "Progress history"
  );

  if (result.error) {
    throw result.error;
  }

  attempts = (result.data || []).filter(attempt => {
    const module = moduleMap.get(String(attempt.module_id || ""));
    return !module || module.edition === EDITION;
  });
}

async function loadConfidenceSample() {
  const completedIds = attempts
    .filter(
      attempt =>
        attempt.status === "completed" &&
        confidenceEnabled(attempt)
    )
    .sort((a, b) => dateOf(b) - dateOf(a))
    .slice(0, CONFIDENCE_SAMPLE_LIMIT)
    .map(attempt => attempt.id);

  confidenceAnswersByAttempt = new Map();

  if (!completedIds.length) {
    return;
  }

  const result = await withTimeout(
    supabaseClient
      .from("quiz_attempts")
      .select("id,answers")
      .in("id", completedIds),
    8000,
    "Confidence history"
  );

  if (result.error) {
    console.warn("ACL confidence sample skipped", result.error);
    return;
  }

  (result.data || []).forEach(row => {
    confidenceAnswersByAttempt.set(
      String(row.id),
      safeArray(row.answers)
    );
  });
}

function confidenceStats() {
  const out = {
    hc: 0,
    hi: 0,
    lc: 0,
    li: 0,
    total: 0,
    calibrated: 0
  };

  confidenceAnswersByAttempt.forEach(answers => {
    answers.forEach(answer => {
      const confidence = String(answer?.confidence || "").toLowerCase();

      if (confidence !== "high" && confidence !== "low") {
        return;
      }

      out.total += 1;

      if (answer?.correct && confidence === "high") {
        out.hc += 1;
        out.calibrated += 1;
      } else if (!answer?.correct && confidence === "high") {
        out.hi += 1;
      } else if (answer?.correct) {
        out.lc += 1;
      } else {
        out.li += 1;
        out.calibrated += 1;
      }
    });
  });

  return out;
}

function mastery(rows) {
  const completed = rows
    .filter(attempt => attempt.status === "completed")
    .sort((a, b) => dateOf(a) - dateOf(b));

  if (!completed.length) return 0;

  let weightedScore = 0;
  let weight = 0;

  completed.slice(-3).forEach((attempt, index) => {
    const w = index + 1;
    const assistancePenalty = Math.max(
      0.76,
      1 - lifelinesUsed(attempt) * 0.04
    );

    weightedScore += pct(attempt) * w * assistancePenalty;
    weight += w;
  });

  return Math.round(
    clamp(
      weightedScore / Math.max(1, weight) +
      Math.min(6, Math.max(0, completed.length - 1) * 1.5)
    )
  );
}

function xp(rows) {
  let total = 0;

  rows
    .filter(attempt => attempt.status === "completed")
    .forEach(attempt => {
      total += 25;
      total += correct(attempt) * 10;
      total -= lifelinesUsed(attempt) * 3;
    });

  return Math.max(0, Math.round(total));
}

function groupedModules() {
  const groups = new Map();

  attempts.forEach(attempt => {
    const key = String(attempt.module_id || moduleTitle(attempt));

    if (!groups.has(key)) {
      groups.set(key, {
        id: attempt.module_id,
        title: moduleTitle(attempt),
        rows: []
      });
    }

    groups.get(key).rows.push(attempt);
  });

  return [...groups.values()]
    .map(group => {
      const completed = group.rows
        .filter(attempt => attempt.status === "completed")
        .sort((a, b) => dateOf(b) - dateOf(a));

      return {
        ...group,
        completed,
        open: group.rows.filter(attempt => attempt.status === "in_progress").length,
        success: completed[0] ? pct(completed[0]) : 0,
        mastery: mastery(group.rows),
        xp: xp(group.rows),
        questions: completed.reduce(
          (sum, attempt) => sum + answered(attempt),
          0
        )
      };
    })
    .sort((a, b) => b.mastery - a.mastery);
}

function learningStreak(rows) {
  const days = [
    ...new Set(
      rows
        .filter(attempt => attempt.status === "completed")
        .map(attempt => {
          const d = dateOf(attempt);
          return d.getTime() ? d.toISOString().slice(0, 10) : null;
        })
        .filter(Boolean)
    )
  ].sort().reverse();

  if (!days.length) return 0;

  let streak = 1;

  for (let index = 1; index < days.length; index += 1) {
    const difference = Math.round(
      (new Date(days[index - 1]) - new Date(days[index])) / 86400000
    );

    if (difference === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function renderTopMetrics() {
  const completed = attempts.filter(a => a.status === "completed");
  const open = attempts.filter(a => a.status === "in_progress");
  const modules = groupedModules();

  const questions = completed.reduce(
    (sum, attempt) => sum + answered(attempt),
    0
  );

  const correctTotal = completed.reduce(
    (sum, attempt) => sum + correct(attempt),
    0
  );

  const success = questions
    ? Math.round((correctTotal / questions) * 100)
    : 0;

  const overallMastery = modules.length
    ? Math.round(
        modules.reduce((sum, module) => sum + module.mastery, 0) /
        modules.length
      )
    : 0;

  const totalXp = xp(attempts);
  const streak = learningStreak(completed);
  const confidence = confidenceStats();

  const calibration = confidence.total
    ? Math.round(
        (confidence.calibrated / confidence.total) * 100
      )
    : null;

  const level = Math.max(
    1,
    Math.floor(Math.sqrt(totalXp / 250)) + 1
  );

  $("masteryPercent").textContent =
    completed.length ? `${overallMastery}%` : "—";

  $("overallAccuracy").textContent =
    questions ? `${success}%` : "—";

  $("aclXp").textContent =
    totalXp.toLocaleString();

  $("levelLabel").textContent =
    `Level ${level}`;

  $("learningStreak").textContent =
    streak ? `🔥 ${streak}d` : "0d";

  $("modulesMastered").textContent =
    `${modules.filter(module => module.mastery >= 80).length} / ${modules.length}`;

  $("modulesInProgress").textContent =
    open.length;

  $("questionsAnswered").textContent =
    questions.toLocaleString();

  $("totalCorrect").textContent =
    correctTotal.toLocaleString();

  $("confidenceCalibration").textContent =
    calibration === null ? "—" : `${calibration}%`;

  $("lifelinesUsed").textContent =
    completed
      .reduce(
        (sum, attempt) => sum + lifelinesUsed(attempt),
        0
      )
      .toLocaleString();

  return {
    completed,
    open,
    modules,
    questions,
    correctTotal,
    success,
    overallMastery,
    totalXp,
    streak,
    confidence
  };
}

function renderModuleMastery(modules) {
  const host = $("moduleMasteryGrid");

  if (!modules.length) {
    host.innerHTML =
      '<div class="card muted">Complete a quiz to build mastery.</div>';
    return;
  }

  host.innerHTML = modules
    .map(module => {
      const state =
        module.mastery >= 80
          ? ["mastered", "MASTERED"]
          : module.mastery >= 60
            ? ["developing", "DEVELOPING"]
            : ["review", "REVIEW"];

      const source =
        module.completed[0] ||
        module.rows[0];

      return `
        <article class="card mastery-module-card">
          <div class="mastery-module-head">
            <div>
              <span class="mastery-state ${state[0]}">
                ${state[1]}
              </span>
              <h3>${esc(module.title)}</h3>
            </div>
            <strong>${module.mastery}%</strong>
          </div>

          <div class="mastery-bar">
            <span style="width:${module.mastery}%"></span>
          </div>

          <div class="mastery-module-metrics">
            <span>Success <b>${module.success}%</b></span>
            <span>XP <b>${module.xp.toLocaleString()}</b></span>
            <span>Questions <b>${module.questions.toLocaleString()}</b></span>
            <span>Attempts <b>${module.completed.length}</b></span>
          </div>

          <a class="secondary-btn" href="${esc(moduleUrl(source))}">
            Improve mastery
          </a>
        </article>
      `;
    })
    .join("");
}

function renderConfidence(confidence) {
  const host = $("confidenceIntelligence");

  if (!confidence.total) {
    host.innerHTML =
      '<div class="card muted">Confidence data will appear after confidence-enabled answers.</div>';
    return;
  }

  host.innerHTML = `
    <article class="confidence-stat good">
      <span>Correct + confident</span>
      <strong>${confidence.hc}</strong>
      <small>Strong mastery evidence</small>
    </article>

    <article class="confidence-stat">
      <span>Correct + unsure</span>
      <strong>${confidence.lc}</strong>
      <small>Knowledge not secure</small>
    </article>

    <article class="confidence-stat">
      <span>Wrong + unsure</span>
      <strong>${confidence.li}</strong>
      <small>Learning gap</small>
    </article>

    <article class="confidence-stat danger">
      <span>Wrong + confident</span>
      <strong>${confidence.hi}</strong>
      <small>Priority misconception</small>
    </article>
  `;
}

function renderInsights(summary) {
  const { completed, modules, confidence } = summary;

  const strong =
    modules.find(module => module.completed.length) ||
    modules[0];

  const weak = [...modules]
    .filter(module => module.completed.length)
    .sort((a, b) => a.mastery - b.mastery)[0];

  if (strong) {
    $("strongestArea").textContent =
      strong.title;

    $("strongestAreaCopy").textContent =
      `${strong.mastery}% mastery · ${strong.success}% success`;
  }

  if (weak) {
    $("weakestArea").textContent =
      weak.title;

    $("weakestAreaCopy").textContent =
      `${weak.mastery}% mastery${
        confidence.hi
          ? ` · ${confidence.hi} confident error${confidence.hi === 1 ? "" : "s"} in the recent confidence sample`
          : ""
      }`;

    $("nextStep").textContent =
      `Review ${weak.title}`;

    $("nextStepCopy").textContent =
      "This is currently your highest-value mastery target.";
  }

  const recent = completed
    .slice()
    .sort((a, b) => dateOf(b) - dateOf(a))
    .slice(0, 6);

  if (!recent.length) return;

  const newest = recent.slice(0, 3);
  const older = recent.slice(3);

  const newestAverage = Math.round(
    newest.reduce((sum, attempt) => sum + pct(attempt), 0) /
    Math.max(1, newest.length)
  );

  const olderAverage = older.length
    ? Math.round(
        older.reduce((sum, attempt) => sum + pct(attempt), 0) /
        older.length
      )
    : null;

  if (olderAverage === null) {
    $("recentTrend").textContent =
      `${newestAverage}% recent success`;

    $("recentTrendCopy").textContent =
      "More attempts will establish your trend.";
  } else {
    $("recentTrend").textContent =
      `${newestAverage >= olderAverage ? "↑" : "↓"} ${Math.abs(newestAverage - olderAverage)} pts`;

    $("recentTrendCopy").textContent =
      `Recent ${newestAverage}% versus previous ${olderAverage}%.`;
  }
}

function renderAchievements(summary) {
  const {
    completed,
    overallMastery,
    success,
    streak,
    totalXp,
    confidence
  } = summary;

  const achievements = [
    ["✓", "First Finish", completed.length >= 1],
    ["◆", "Mastery 80", overallMastery >= 80],
    ["🎯", "Precision 90", success >= 90],
    ["🔥", "3-Day Streak", streak >= 3],
    ["★", "1K Club", totalXp >= 1000],
    ["🧠", "Calibrated", confidence.total >= 10 && confidence.hi === 0]
  ];

  $("achievementGrid").innerHTML =
    achievements
      .map(
        ([icon, title, earned]) => `
          <article class="achievement ${earned ? "earned" : "locked"}">
            <span>${icon}</span>
            <div>
              <strong>${title}</strong>
              <small>
                ${earned ? "Earned" : "Keep learning to unlock"}
              </small>
            </div>
          </article>
        `
      )
      .join("");
}

function renderOpen() {
  const rows = attempts.filter(
    attempt => attempt.status === "in_progress"
  );

  $("openAttempts").innerHTML = rows.length
    ? rows
        .map(attempt => {
          const done = answered(attempt);
          const total = Math.max(
            done,
            Number(attempt.question_count || 0)
          );

          return `
            <article class="card attempt-card">
              <div class="attempt-top">
                <div>
                  <span class="attempt-status open">In progress</span>
                  <h3>${esc(moduleTitle(attempt))}</h3>
                </div>
                <strong>${done}/${total || "—"}</strong>
              </div>

              <a
                class="primary-btn attempt-action"
                href="${esc(moduleUrl(attempt))}"
              >
                Continue attempt
              </a>
            </article>
          `;
        })
        .join("")
    : '<div class="card muted">No unfinished attempts.</div>';
}

function populateFilter() {
  const select = $("moduleFilter");
  const current = select.value;

  const modules = [
    ...new Map(
      attempts
        .filter(attempt => attempt.status === "completed")
        .map(attempt => [
          String(attempt.module_id),
          moduleTitle(attempt)
        ])
    ).entries()
  ];

  select.innerHTML =
    '<option value="all">All modules</option>' +
    modules
      .map(
        ([id, title]) =>
          `<option value="${esc(id)}">${esc(title)}</option>`
      )
      .join("");

  if (
    [...select.options].some(
      option => option.value === current
    )
  ) {
    select.value = current;
  }
}

function renderCompleted() {
  const filter = $("moduleFilter").value;

  const rows = attempts
    .filter(
      attempt =>
        attempt.status === "completed" &&
        (
          filter === "all" ||
          String(attempt.module_id) === filter
        )
    )
    .sort((a, b) => dateOf(b) - dateOf(a));

  const visible = rows.slice(0, INITIAL_COMPLETED_LIMIT);

  $("completedAttempts").innerHTML = visible.length
    ? visible
        .map(
          attempt => `
            <article class="card completed-attempt">
              <div class="score-ring">
                <span>${pct(attempt)}%</span>
              </div>

              <div class="completed-main">
                <h3>${esc(moduleTitle(attempt))}</h3>

                <div class="attempt-meta">
                  <span>${fmt(attempt.completed_at || attempt.updated_at)}</span>
                  <span>${correct(attempt)}/${answered(attempt)} correct</span>
                  <span>${lifelinesUsed(attempt)} Life Savers</span>
                </div>
              </div>

              <button
                class="secondary-btn review-btn"
                type="button"
                data-id="${esc(attempt.id)}"
              >
                Review
              </button>
            </article>
          `
        )
        .join("") +
      (
        rows.length > visible.length
          ? `<div class="card muted">Showing the most recent ${visible.length} of ${rows.length} attempts to keep this page fast.</div>`
          : ""
      )
    : '<div class="card muted">No completed attempts yet.</div>';
}

function renderEverything() {
  const summary = renderTopMetrics();

  renderModuleMastery(summary.modules);
  renderConfidence(summary.confidence);
  renderInsights(summary);
  renderAchievements(summary);
  renderOpen();
  populateFilter();
  renderCompleted();
}

async function loadProgress() {
  if (loading) return;

  loading = true;
  $("refreshProgress").disabled = true;
  show("Loading progress…", "success", true);

  try {
    await restoreSession();

    await Promise.all([
      loadModuleMap()
    ]);

    await loadAttemptSummaries();

    /* Paint the useful dashboard immediately before the optional
       confidence payload query. */
    confidenceAnswersByAttempt = new Map();
    renderEverything();
    show("");

    /* Yield one frame so the interface remains responsive. */
    await new Promise(resolve => requestAnimationFrame(resolve));

    await loadConfidenceSample();

    /* Only confidence-dependent areas and top calibration need updating. */
    renderEverything();
  } finally {
    loading = false;
    $("refreshProgress").disabled = false;
  }
}

async function reviewAttempt(attemptId) {
  const attempt = attempts.find(
    item => String(item.id) === String(attemptId)
  );

  if (!attempt) return;

  const dialog = $("reviewDialog");
  const content = $("reviewContent");

  content.innerHTML = `
    <h2>${esc(moduleTitle(attempt))}</h2>
    <p class="muted">Loading saved answers…</p>
  `;

  dialog.showModal();

  try {
    const result = await withTimeout(
      supabaseClient
        .from("quiz_attempts")
        .select("answers")
        .eq("id", attempt.id)
        .eq("user_id", currentUserId)
        .single(),
      7000,
      "Attempt review"
    );

    if (result.error) {
      throw result.error;
    }

    const answerRows = safeArray(result.data?.answers);

    content.innerHTML = `
      <h2>${esc(moduleTitle(attempt))}</h2>
      <p>
        ${pct(attempt)}% success ·
        ${correct(attempt)}/${answered(attempt)} correct
      </p>

      <div class="review-list">
        ${
          answerRows.length
            ? answerRows
                .map(
                  (answer, index) => `
                    <div class="review-item ${answer?.correct ? "correct" : "incorrect"}">
                      <div class="review-number">${index + 1}</div>
                      <div>
                        <b>${answer?.correct ? "Correct" : "Incorrect"}</b>
                        ${
                          answer?.confidence
                            ? ` · ${esc(answer.confidence)} confidence`
                            : ""
                        }
                        ${
                          answer?.explanation
                            ? `<p>${esc(answer.explanation)}</p>`
                            : ""
                        }
                      </div>
                    </div>
                  `
                )
                .join("")
            : '<div class="card muted">No detailed answer payload was saved for this legacy attempt.</div>'
        }
      </div>
    `;
  } catch (error) {
    content.innerHTML = `
      <h2>${esc(moduleTitle(attempt))}</h2>
      <div class="status-box show error">
        ${esc(error.message || "Could not load this attempt review.")}
      </div>
    `;
  }
}

$("moduleFilter")?.addEventListener(
  "change",
  renderCompleted
);

$("refreshProgress")?.addEventListener(
  "click",
  async () => {
    try {
      await loadProgress();
      show("Progress refreshed.");
    } catch (error) {
      show(
        error.message || "Could not refresh progress.",
        "error",
        true
      );
    }
  }
);

$("completedAttempts")?.addEventListener(
  "click",
  event => {
    const button = event.target.closest("button[data-id]");
    if (!button) return;
    reviewAttempt(button.dataset.id);
  }
);

try {
  await loadProgress();
} catch (error) {
  console.error("ACL PROGRESS LOAD ERROR", error);

  show(
    error.message || "Could not load progress.",
    "error",
    true
  );

  $("moduleMasteryGrid").innerHTML =
    '<div class="card muted">Progress data could not be loaded. Use Refresh to try again.</div>';

  $("openAttempts").innerHTML =
    '<div class="card muted">Unable to load unfinished attempts.</div>';

  $("completedAttempts").innerHTML =
    '<div class="card muted">Unable to load completed attempts.</div>';
}
