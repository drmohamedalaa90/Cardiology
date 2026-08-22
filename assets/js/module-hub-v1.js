import { supabaseClient } from "./supabase-client.js";

const $ = (id) => document.getElementById(id);
const esc = (v = "") =>
  String(v).replace(/[&<>'"]/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  }[c]));

const params = new URLSearchParams(location.search);
const moduleId = params.get("module");
const moduleSlug = params.get("slug");
const edition = String(params.get("edition") || "expert").toLowerCase() === "basic"
  ? "basic"
  : "expert";

let moduleRow = null;
let attempts = [];

function timeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    )
  ]);
}

function show(message = "", kind = "") {
  const el = $("moduleHubStatus");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message;
  el.className = `status-box ${kind}`.trim();
}

function answersOf(a) {
  return Array.isArray(a?.answers) ? a.answers : [];
}

function answerQuestionId(answer) {
  return answer?.question_id ?? answer?.questionId ?? answer?.id ?? null;
}

function dateOf(a) {
  return new Date(a?.completed_at || a?.updated_at || a?.started_at || 0);
}

function moduleAttempts() {
  return attempts
    .filter(a => String(a?.module_id) === String(moduleRow?.id))
    .sort((a,b) => dateOf(b) - dateOf(a));
}

function coveredQuestions(rows, bank) {
  const ids = new Set();
  let fallback = 0;

  rows.forEach(a => {
    const ans = answersOf(a);
    if (ans.length) {
      ans.forEach(x => {
        const id = answerQuestionId(x);
        if (id != null && id !== "") ids.add(String(id));
      });
      fallback = Math.max(fallback, ans.length);
    } else {
      fallback = Math.max(
        fallback,
        Number(a?.answered_count || a?.question_count || 0)
      );
    }
  });

  const n = ids.size || fallback;
  return bank ? Math.min(bank, n) : n;
}

function correctCount(a) {
  const ans = answersOf(a);
  if (ans.length) return ans.filter(x => x?.correct === true).length;
  return Number(a?.correct_count || 0);
}

function answeredCount(a) {
  const ans = answersOf(a);
  if (ans.length) return ans.length;
  return Number(a?.answered_count || a?.question_count || 0);
}

function successPct(a) {
  const answered = answeredCount(a);
  return answered ? Math.round(correctCount(a) / answered * 100) : null;
}

function uniqueMistakes(rows) {
  const ids = new Set();
  rows.flatMap(answersOf).forEach(a => {
    if (a?.correct === false) {
      const id = answerQuestionId(a);
      if (id != null && id !== "") ids.add(String(id));
    }
  });
  return ids.size;
}

function xpFor(rows) {
  let xp = 0;
  rows.filter(a => a?.status === "completed").forEach(a => {
    const ans = answersOf(a);
    if (ans.length) {
      xp += 25;
      ans.forEach(x => {
        if (x?.correct) xp += 10;
        if (x?.correct && x?.confidence === "high") xp += 3;
        if (!x?.correct && x?.confidence === "high") xp -= 2;
      });
    } else {
      const saved = Number(a?.score || 0);
      if (saved > 0) xp += saved;
    }
  });
  return Math.max(0, Math.round(xp));
}

function mastery(rows, bank, covered) {
  const completed = rows.filter(a => a?.status === "completed");
  if (!completed.length || !covered || !bank) return null;

  const recent = completed.slice(0, 3);
  const weighted = recent.reduce((acc, a, i) => {
    const pct = successPct(a);
    if (pct == null) return acc;
    const weight = recent.length - i;
    acc.sum += pct * weight;
    acc.weight += weight;
    return acc;
  }, {sum:0, weight:0});

  if (!weighted.weight) return null;

  const performance = weighted.sum / weighted.weight;
  const coverage = Math.min(1, covered / bank);
  const evidence = Math.min(1, Math.sqrt(coverage / 0.60));

  return Math.round(performance * evidence);
}

function launchUrl(extra = {}) {
  if (!moduleRow?.launch_path) return "#";

  try {
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

    Object.entries(extra).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        u.searchParams.delete(key);
      } else {
        u.searchParams.set(key, String(value));
      }
    });

    return u.origin === location.origin
      ? `${u.pathname}${u.search}${u.hash}`
      : u.toString();
  } catch {
    return "#";
  }
}

function hubUrl(m) {
  const p = new URLSearchParams({
    edition,
    module: m.id
  });
  if (m.slug) p.set("slug", m.slug);
  return `module-hub.html?${p}`;
}

function isEscGuideline(slug) {
  return new Set([
    "chronic-coronary-syndromes",
    "acute-coronary-syndromes",
    "heart-failure",
    "atrial-fibrillation",
    "valvular-heart-disease",
    "hypertension",
    "non-cardiac-surgery",
    "cvd-pregnancy",
    "infective-endocarditis",
    "myocarditis-pericarditis",
    "dyslipidaemia",
    "peripheral-arterial-aortic-diseases",
    "cardiomyopathies",
    "cvd-diabetes",
    "pulmonary-hypertension",
    "ventricular-arrhythmias-scd",
    "cardiac-pacing",
    "sports-cardiology-exercise"
  ]).has(String(slug || "").toLowerCase());
}

function render() {
  const rows = moduleAttempts();
  const bank = Number(moduleRow?.question_count || 0);
  const covered = coveredQuestions(rows, bank);
  const progress = bank ? Math.min(100, Math.round(covered / bank * 100)) : 0;
  const completed = rows.filter(a => a?.status === "completed");
  const latestCompleted = completed[0] || null;
  const success = latestCompleted ? successPct(latestCompleted) : null;
  const masteryPct = mastery(rows, bank, covered);
  const mistakes = uniqueMistakes(rows);
  const xp = xpFor(rows);
  const openAttempt = rows.find(a => a?.status === "in_progress") || null;

  $("moduleHubTitle").textContent = moduleRow.title || "ACL Module";
  $("moduleHubDescription").textContent =
    moduleRow.short_description ||
    moduleRow.description ||
    `${bank || ""}-question ACL ${edition === "expert" ? "Expert" : "Basic"} Edition module`;

  document.title = `${moduleRow.title || "Module"} | ACL`;

  const logo = $("moduleHubLogo");
  if (isEscGuideline(moduleRow.slug)) {
    logo.innerHTML = `<img src="assets/images/esc-guideline-mark.svg" alt="ESC">`;
    logo.classList.add("has-image");
  } else {
    logo.textContent = "ACL";
  }

  let state = "Not started";
  if (covered > 0 && progress < 10) state = "Early progress";
  else if (covered > 0 && progress < 40) state = "Building";
  else if (covered > 0 && progress < 60) state = "Developing";
  else if (masteryPct != null && masteryPct >= 80 && (success ?? 0) >= 80 && progress >= 60) {
    state = "Mastered";
  } else if (covered > 0) state = "In progress";

  $("moduleHubProgressLabel").textContent = state;
  $("moduleHubProgressPercent").textContent = `${progress}%`;
  $("moduleHubProgressFill").style.width = `${progress}%`;
  $("moduleHubCovered").textContent = `${covered} / ${bank}`;
  $("moduleHubSuccess").textContent = success == null ? "—" : `${success}%`;
  $("moduleHubMastery").textContent = masteryPct == null ? "—" : `${masteryPct}%`;
  $("moduleHubXp").textContent = xp.toLocaleString();
  $("moduleHubMistakes").textContent = mistakes;

  $("moduleHubStudyLink").href =
    `study.html?edition=${encodeURIComponent(edition)}&module=${encodeURIComponent(moduleRow.id)}`;

  $("moduleHubMistakesLink").href =
    `module-mistakes.html?edition=${encodeURIComponent(edition)}&module=${encodeURIComponent(moduleRow.id)}`;

  updateQuizLink();

  const continueLink = $("moduleHubContinueLink");
  if (openAttempt) {
    continueLink.hidden = false;
    continueLink.href = launchUrl({ new: null, count: null });
  } else {
    continueLink.hidden = true;
  }

  const recent = rows.slice(0, 5);
  $("moduleHubRecentList").innerHTML = recent.length
    ? recent.map(a => {
        const status = a?.status === "completed" ? "Completed" : "In progress";
        const score = successPct(a);
        const answered = answeredCount(a);
        return `
          <article class="module-hub-recent-row">
            <div>
              <strong>${esc(status)}</strong>
              <span>${esc(new Date(dateOf(a)).toLocaleDateString())}</span>
            </div>
            <div>
              <span>${answered} questions</span>
              <strong>${score == null ? "—" : `${score}%`}</strong>
            </div>
          </article>`;
      }).join("")
    : `<div class="muted">No attempts yet. Start with Review & Study or a new quiz.</div>`;
}

function updateQuizLink() {
  const p = new URLSearchParams({
    edition,
    module: String(moduleRow.id)
  });

  if (moduleRow.slug) {
    p.set("slug", String(moduleRow.slug));
  }

  const link = $("moduleHubQuizLink");
  link.href = `quiz-setup.html?${p.toString()}`;
  link.textContent = "Configure & start quiz";
}

async function load() {
  show("Loading module…");

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

  if (moduleId) query = query.eq("id", moduleId);
  else if (moduleSlug) query = query.eq("slug", moduleSlug);
  else throw new Error("No module was selected.");

  const moduleResult = await timeout(
    query.maybeSingle(),
    7000,
    "Module"
  );

  if (moduleResult.error) throw moduleResult.error;
  if (!moduleResult.data) throw new Error("Module not found.");

  moduleRow = moduleResult.data;

  const attemptsResult = await timeout(
    supabaseClient
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .eq("module_id", moduleRow.id)
      .order("updated_at", {ascending:false}),
    7000,
    "Progress"
  );

  if (!attemptsResult.error && Array.isArray(attemptsResult.data)) {
    attempts = attemptsResult.data;
  }

  render();
  show("");
}

try {
  await load();
} catch (error) {
  console.error("MODULE HUB ERROR", error);
  show(error.message || "Could not load module.", "error");
}
