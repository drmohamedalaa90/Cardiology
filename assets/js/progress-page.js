import { listAttempts } from "./cloud-progress.js";
import { protectAndRender } from "./session-ui.js";

const byId = (id) => document.getElementById(id);
let attempts = [];
let questionCache = new Map();

function esc(value = "") { return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch])); }
function show(message, type = "success") { const box = byId("progressStatus"); box.textContent = message; box.className = `status-box show ${type}`; setTimeout(() => box.className = "status-box", 3500); }
function fmtDate(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString([], { dateStyle:"medium", timeStyle:"short" }); }
function fmtDuration(seconds, started, ended) {
  let total = Number(seconds);
  if (!Number.isFinite(total) && started) total = Math.max(0, Math.round((new Date(ended || Date.now()) - new Date(started)) / 1000));
  if (!Number.isFinite(total)) return "—";
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}
function pct(attempt) { return attempt.question_count ? Math.round((Number(attempt.score || 0) / attempt.question_count) * 100) : 0; }
function moduleUrl(id) { return id === "ppci-fundamentals" ? "modules/ppci/index.html" : "modules.html"; }

function updateStats() {
  const completed = attempts.filter(a => a.status === "completed");
  const open = attempts.filter(a => a.status === "in_progress");
  const totalQ = completed.reduce((s,a) => s + Number(a.question_count || 0), 0);
  const totalScore = completed.reduce((s,a) => s + Number(a.score || 0), 0);
  byId("completedCount").textContent = completed.length;
  byId("openCount").textContent = open.length;
  byId("overallAccuracy").textContent = totalQ ? `${Math.round(totalScore / totalQ * 100)}%` : "—";
  byId("totalCorrect").textContent = totalScore;
}
function renderOpen() {
  const open = attempts.filter(a => a.status === "in_progress");
  byId("openAttempts").innerHTML = open.length ? open.map(a => {
    const answered = Array.isArray(a.answers) ? a.answers.length : 0;
    const progress = a.question_count ? Math.min(100, Math.round(answered / a.question_count * 100)) : 0;
    return `<article class="card attempt-card open-attempt"><div class="attempt-top"><div><span class="attempt-status open">In progress</span><h3>${esc(a.module_title)}</h3></div><strong>${answered}/${a.question_count}</strong></div><div class="progress-track"><span style="width:${progress}%"></span></div><div class="attempt-meta"><span>Last saved: ${fmtDate(a.updated_at)}</span><span>Current score: ${esc(a.score)}/${a.question_count}</span></div><a class="primary-btn attempt-action" href="${moduleUrl(a.module_id)}">Continue attempt</a></article>`;
  }).join("") : `<div class="card empty-progress"><h3>No unfinished attempts</h3><p class="muted">Start a module and your progress will be saved here automatically.</p><a class="secondary-btn" href="modules.html">Browse modules</a></div>`;
}
function populateFilter() {
  const select = byId("moduleFilter"), current = select.value;
  const mods = [...new Map(attempts.filter(a=>a.status==="completed").map(a => [a.module_id, a.module_title])).entries()];
  select.innerHTML = `<option value="all">All modules</option>` + mods.map(([id,title]) => `<option value="${esc(id)}">${esc(title)}</option>`).join("");
  if ([...select.options].some(o => o.value === current)) select.value = current;
}
function renderCompleted() {
  const filter = byId("moduleFilter").value;
  const rows = attempts.filter(a => a.status === "completed" && (filter === "all" || a.module_id === filter));
  byId("completedAttempts").innerHTML = rows.length ? rows.map(a => `<article class="card completed-attempt"><div class="score-ring" style="--score:${pct(a)}"><span>${pct(a)}%</span></div><div class="completed-main"><div class="attempt-top"><div><span class="attempt-status completed">Completed</span><h3>${esc(a.module_title)}</h3></div><strong>${esc(a.score)} / ${a.question_count}</strong></div><div class="attempt-meta"><span>${fmtDate(a.completed_at || a.updated_at)}</span><span>${fmtDuration(a.duration_seconds, a.started_at, a.completed_at)}</span><span>${Array.isArray(a.answers) ? a.answers.length : 0} answered</span></div></div><button class="secondary-btn review-btn" data-id="${esc(a.id)}">Review</button></article>`).join("") : `<div class="card empty-progress"><h3>No completed attempts yet</h3><p class="muted">Finished quizzes will appear here with score, duration, and review details.</p></div>`;
}
async function getQuestionMap(moduleId) {
  if (questionCache.has(moduleId)) return questionCache.get(moduleId);
  let questions = [];
  if (moduleId === "ppci-fundamentals") ({ PPCI_QUESTIONS: questions } = await import("../../modules/ppci/questions.js"));
  const map = new Map((questions || []).map(q => [q.id, q])); questionCache.set(moduleId, map); return map;
}
async function openReview(attempt) {
  const map = await getQuestionMap(attempt.module_id);
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
  const rows = (attempt.question_ids || []).map((id, index) => {
    const q = map.get(id), ans = answers.find(a => a.questionId === id);
    const choice = q && ans ? q.options?.[Number(ans.choice)] : (ans ? `Choice ${Number(ans.choice)+1}` : "Not answered");
    const correctChoice = q ? q.options?.[Number(q.answer)] : "Unavailable";
    return `<div class="review-item ${ans?.correct ? "correct" : "incorrect"}"><div class="review-number">${index+1}</div><div><h4>${esc(q?.stem || `Question ${id}`)}</h4><p><b>Your answer:</b> ${esc(choice)}</p>${ans?.correct ? "" : `<p><b>Correct answer:</b> ${esc(correctChoice)}</p>`}${q?.explanation ? `<p class="muted">${esc(q.explanation)}</p>` : ""}</div><span class="review-mark">${ans?.correct ? "✓" : "×"}</span></div>`;
  }).join("");
  byId("reviewContent").innerHTML = `<h2>${esc(attempt.module_title)}</h2><p class="muted">Score ${esc(attempt.score)} / ${attempt.question_count} · ${pct(attempt)}% · ${fmtDuration(attempt.duration_seconds, attempt.started_at, attempt.completed_at)}</p><div class="review-list">${rows}</div>`;
  byId("reviewDialog").showModal();
}
async function load() { attempts = await listAttempts(); updateStats(); populateFilter(); renderOpen(); renderCompleted(); }
byId("moduleFilter").addEventListener("change", renderCompleted);
byId("refreshProgress").addEventListener("click", async () => { try { await load(); show("Progress refreshed."); } catch(e) { show(e.message || "Could not refresh progress.", "error"); } });
byId("completedAttempts").addEventListener("click", async e => { const b=e.target.closest("button[data-id]"); if(!b)return; const a=attempts.find(x=>x.id===b.dataset.id); if(a) await openReview(a); });
try { await protectAndRender("login.html"); await load(); } catch(e) { show(e.message || "Could not load your progress.", "error"); }
