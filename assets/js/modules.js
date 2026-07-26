import { supabaseClient } from "./supabase-client.js";
import { protectAndRender } from "./session-ui.js";

const grid = document.getElementById("modulesGrid");
const stateBox = document.getElementById("modulesStatus");
const summary = document.getElementById("catalogueSummary");

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
const titleCase = value => String(value || "").replaceAll("_", " ").replace(/\b\w/g, x => x.toUpperCase());
function getModuleTheme(module) {
  const searchableText = [
    module.title,
    module.name,
    module.description,
    module.category,
    module.topic
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const imagingWords = [
    "imaging",
    "echocardiography",
    "echocardiogram",
    "echo",
    "ultrasound",
    "cardiac ct",
    "ct coronary",
    "cardiac mri",
    "cmr",
    "ivus",
    "oct",
    "intravascular imaging",
    "nuclear cardiology"
  ];

  const interventionWords = [
    "intervention",
    "interventional",
    "pci",
    "primary pci",
    "ppci",
    "coronary intervention",
    "cath lab",
    "catheterization",
    "bifurcation",
    "left main",
    "cto",
    "calcified",
    "stent",
    "tavi",
    "tavr",
    "structural",
    "device closure",
    "mitral intervention",
    "aortic intervention"
  ];

  const ecgWords = [
    "ecg",
    "electrocardiogram",
    "electrocardiography",
    "rhythm",
    "arrhythmia",
    "st segment",
    "heart block"
  ];

  const guidelineWords = [
    "guideline",
    "guidelines",
    "esc",
    "acc",
    "aha",
    "eacts",
    "consensus",
    "recommendation"
  ];

  if (
    imagingWords.some((word) =>
      searchableText.includes(word)
    )
  ) {
    return "module-imaging";
  }

  if (
    interventionWords.some((word) =>
      searchableText.includes(word)
    )
  ) {
    return "module-intervention";
  }

  if (
    ecgWords.some((word) =>
      searchableText.includes(word)
    )
  ) {
    return "module-ecg";
  }

  if (
    guidelineWords.some((word) =>
      searchableText.includes(word)
    )
  ) {
    return "module-guideline";
  }

  return "module-general";
}
function setStatus(message, kind = "") {
  if (!stateBox) return;
  stateBox.textContent = message;
  stateBox.className = `status-box ${kind}`.trim();
  stateBox.hidden = !message;
}

function withinSchedule(module) {
  const now = Date.now();
  if (module.opens_at && now < new Date(module.opens_at).getTime()) return false;
  if (module.closes_at && now > new Date(module.closes_at).getTime()) return false;
  return true;
}

function accessDecision(module, assignedIds, totalScore) {
  if (module.status === "coming_soon") return { state: "coming", label: "Coming soon", reason: "This module is being prepared." };
  if (!withinSchedule(module)) {
    if (module.opens_at && Date.now() < new Date(module.opens_at).getTime()) return { state: "locked", label: "Scheduled", reason: `Opens ${new Date(module.opens_at).toLocaleString()}` };
    return { state: "locked", label: "Closed", reason: "The access window has closed." };
  }
  if (module.access_type === "admin_assigned" && !assignedIds.has(module.id)) return { state: "locked", label: "Admin assignment", reason: "Ask the ACL administrator to unlock this module." };
  if (module.access_type === "minimum_score" && totalScore < Number(module.minimum_score || 0)) return { state: "locked", label: `Requires ${module.minimum_score} points`, reason: `Your current completed-quiz score is ${totalScore}.` };
  if (module.access_type === "passcode") return { state: "locked", label: "Passcode required", reason: "Passcode entry will be activated with the Phase 2 quiz builder." };
  if (!module.launch_path) return { state: "coming", label: "Content pending", reason: "The catalogue entry is published; learning content will follow." };
  return { state: "open", label: "Open module", reason: "" };
}

function moduleCard(module, decision, progressMap) {
  const progress = progressMap.get(module.id);
  const completed = progress?.status === "completed";
  const inProgress = progress?.status === "in_progress";
  const actionLabel = inProgress ? "Continue module" : completed ? "Review / retry" : decision.label;
  const href = decision.state === "open" ? escapeHtml(module.launch_path) : "#";
  const coverStyle = module.cover_image_url ? `style="background-image:linear-gradient(135deg,rgba(4,26,72,.65),rgba(0,86,128,.25)),url('${escapeHtml(module.cover_image_url)}')"` : "";
  return `<article class="module-card ${getModuleTheme(module)} ${decision.state} ${module.is_featured ? "featured" : ""}">`
    <div class="module-cover" ${coverStyle}>
      <span class="module-category">${escapeHtml(module.category)}</span>
      ${module.is_featured ? '<span class="featured-badge">Featured</span>' : ""}
    </div>
    <div class="module-card-body">
      <div class="module-card-heading"><h2>${escapeHtml(module.title)}</h2><span class="difficulty-pill ${escapeHtml(module.difficulty)}">${escapeHtml(titleCase(module.difficulty))}</span></div>
      <p>${escapeHtml(module.short_description || module.description || "ACL Expert Edition module")}</p>
      <div class="module-meta"><span>⏱ ${Number(module.estimated_minutes || 0)} min</span><span>❓ ${Number(module.question_count || 0)} questions</span></div>
      <div class="mode-pills">${module.learning_mode_enabled ? '<span>Learning</span>' : ''}${module.competition_mode_enabled ? '<span>Competition</span>' : ''}</div>
      ${progress ? `<div class="module-progress-line"><span>${inProgress ? "In progress" : "Completed"}</span><strong>${progress.score ?? 0} pts</strong></div>` : ""}
      ${decision.reason ? `<p class="module-lock-reason">${escapeHtml(decision.reason)}</p>` : ""}
      <a class="module-action ${decision.state !== "open" ? "disabled" : ""}" href="${href}" ${decision.state !== "open" ? 'aria-disabled="true" tabindex="-1"' : ""}>${escapeHtml(actionLabel)}</a>
    </div>
  </article>`;
}

async function loadCatalogue() {
  const profile = await protectAndRender("login.html");
  if (!profile) return;
  setStatus("Loading your ACL catalogue…");
  try {
    const [{ data: modules, error: moduleError }, { data: assignments, error: assignmentError }, { data: attempts, error: attemptsError }] = await Promise.all([
      supabaseClient.from("modules").select("*").order("display_order", { ascending: true }).order("title", { ascending: true }),
      supabaseClient.from("module_assignments").select("module_id,expires_at").eq("user_id", profile.id),
      supabaseClient.from("quiz_attempts").select("module_id,status,score,updated_at").eq("user_id", profile.id).order("updated_at", { ascending: false })
    ]);
    if (moduleError) throw moduleError;
    if (assignmentError) throw assignmentError;
    if (attemptsError) throw attemptsError;

    const assignedIds = new Set((assignments || []).filter(x => !x.expires_at || new Date(x.expires_at).getTime() > Date.now()).map(x => x.module_id));
    const totalScore = (attempts || []).filter(x => x.status === "completed").reduce((sum, x) => sum + Number(x.score || 0), 0);
    const progressMap = new Map();
    for (const attempt of attempts || []) if (!progressMap.has(attempt.module_id)) progressMap.set(attempt.module_id, attempt);

    if (!modules?.length) {
      grid.innerHTML = '<div class="empty-state">No published modules are available yet.</div>';
      summary.textContent = "0 modules";
      setStatus("");
      return;
    }
    grid.innerHTML = modules.map(module => moduleCard(module, accessDecision(module, assignedIds, totalScore), progressMap)).join("");
    summary.textContent = `${modules.length} module${modules.length === 1 ? "" : "s"} · ${totalScore} accumulated quiz points`;
    setStatus("");
  } catch (error) {
    console.error("Module catalogue failed", error);
    grid.innerHTML = '<div class="empty-state">The module catalogue could not be loaded.</div>';
    setStatus(error.message || "Could not load modules.", "error");
  }
}

loadCatalogue();
