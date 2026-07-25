import { supabaseClient } from "./supabase-client.js";
import { protectAndRender } from "./session-ui.js";

const $ = id => document.getElementById(id);
const list = $("adminQuestionsList");
const dialog = $("questionDialog");
const form = $("questionForm");
let modules = [];
let questions = [];
let adminProfile = null;
let optionCounter = 0;

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
const titleCase = value => String(value || "").replaceAll("_", " ").replace(/\b\w/g, x => x.toUpperCase());
function setStatus(message, type = "") { const box = $("adminQuestionsStatus"); box.textContent = message; box.className = `status-box ${type}`.trim(); box.hidden = !message; }

function moduleOptions(selected = "") {
  return modules.map(m => `<option value="${escapeHtml(m.id)}" ${m.id === selected ? "selected" : ""}>${escapeHtml(m.title)}</option>`).join("");
}

function renderStats() {
  $("questionTotal").textContent = questions.length;
  $("questionPublished").textContent = questions.filter(q => q.status === "published").length;
  $("questionDraft").textContent = questions.filter(q => q.status === "draft").length;
  $("questionModules").textContent = new Set(questions.map(q => q.module_id)).size;
}

function questionCard(q) {
  const module = modules.find(m => m.id === q.module_id);
  const correct = (q.question_options || []).filter(o => o.is_correct).map(o => o.option_key).join(", ") || "Not set";
  return `<article class="question-admin-card" data-id="${q.id}">
    <div class="question-admin-head"><div><span class="status-pill ${escapeHtml(q.status)}">${escapeHtml(titleCase(q.status))}</span><span class="difficulty-pill ${escapeHtml(q.difficulty)}">${escapeHtml(titleCase(q.difficulty))}</span></div><span class="order-badge">#${Number(q.display_order || 0)}</span></div>
    <div class="question-module-label">${escapeHtml(module?.title || q.module_id)} · ${escapeHtml(titleCase(q.question_type))}</div>
    <h2>${escapeHtml(q.stem)}</h2>
    ${q.clinical_scenario ? `<p class="question-scenario-preview">${escapeHtml(q.clinical_scenario)}</p>` : ""}
    <div class="module-admin-meta"><span>${escapeHtml(q.topic || "No topic")}</span><span>${Number(q.default_seconds)} sec</span><span>${(q.question_options || []).length} options</span><span>Correct: ${escapeHtml(correct)}</span></div>
    <div class="admin-module-actions"><button class="secondary-btn edit-question" type="button">Edit</button><button class="secondary-btn duplicate-question-card" type="button">Duplicate</button><button class="secondary-btn quick-question-status" data-status="${q.status === "published" ? "draft" : "published"}" type="button">${q.status === "published" ? "Unpublish" : "Publish"}</button></div>
  </article>`;
}

function applyFilters() {
  const moduleId = $("questionModuleFilter").value;
  const status = $("questionStatusFilter").value;
  const q = $("questionSearch").value.trim().toLowerCase();
  const rows = questions.filter(row =>
    (moduleId === "all" || row.module_id === moduleId) &&
    (status === "all" || row.status === status) &&
    (!q || [row.stem,row.clinical_scenario,row.topic,row.subtopic,row.external_id,row.reference_text].some(v => String(v || "").toLowerCase().includes(q)))
  );
  list.innerHTML = rows.length ? rows.map(questionCard).join("") : '<div class="empty-state">No questions match these filters.</div>';
}

async function loadModules() {
  const { data, error } = await supabaseClient.from("modules").select("id,title,status,display_order").order("display_order");
  if (error) throw error;
  modules = data || [];
  $("questionModuleFilter").innerHTML = '<option value="all">All modules</option>' + moduleOptions();
  $("questionModule").innerHTML = moduleOptions();
}

async function loadQuestions() {
  setStatus("Loading question bank…");
  const { data, error } = await supabaseClient.from("questions").select("*, question_options(*)").order("display_order").order("created_at");
  if (error) { console.error(error); setStatus(error.message, "error"); return; }
  questions = (data || []).map(q => ({...q, question_options: (q.question_options || []).sort((a,b) => a.display_order - b.display_order)}));
  renderStats(); applyFilters(); setStatus("");
}

function updateOptionHelp() {
  const type = $("questionType").value;
  const multiple = type === "multiple_response";
  $("optionHelp").textContent = multiple ? "Choose every correct answer." : type === "short_answer" ? "Add one accepted answer; alternative accepted answers may be added as options." : "Choose one correct answer.";
  document.querySelectorAll(".option-correct").forEach(input => input.type = multiple ? "checkbox" : "radio");
}

function addOption(option = {}) {
  optionCounter += 1;
  const row = document.createElement("div");
  row.className = "option-row";
  row.dataset.optionId = option.id || "";
  row.innerHTML = `<span class="option-letter">${escapeHtml(option.option_key || String.fromCharCode(64 + optionCounter))}</span>
    <input class="option-key" type="hidden" value="${escapeHtml(option.option_key || String.fromCharCode(64 + optionCounter))}">
    <label class="correct-choice" title="Correct answer"><input class="option-correct" name="correctOption" ${$("questionType").value === "multiple_response" ? 'type="checkbox"' : 'type="radio"'} ${option.is_correct ? "checked" : ""}><span>Correct</span></label>
    <input class="option-text" required placeholder="Answer option" value="${escapeHtml(option.option_text || "")}">
    <input class="option-image" type="url" placeholder="Optional image URL" value="${escapeHtml(option.image_url || "")}">
    <button class="remove-option" type="button" aria-label="Remove option">×</button>`;
  $("optionRows").appendChild(row);
  renumberOptions();
}

function renumberOptions() {
  [...document.querySelectorAll(".option-row")].forEach((row, i) => {
    const key = String.fromCharCode(65 + i);
    row.querySelector(".option-letter").textContent = key;
    row.querySelector(".option-key").value = key;
  });
}

function clearOptions() { $("optionRows").innerHTML = ""; optionCounter = 0; }

function fillForm(question = null, duplicate = false) {
  form.reset(); clearOptions();
  const source = question || {};
  $("questionDialogTitle").textContent = duplicate ? "Duplicate question" : question ? "Edit question" : "Create question";
  $("questionId").value = duplicate ? "" : source.id || "";
  $("questionModule").value = source.module_id || modules[0]?.id || "";
  $("questionType").value = source.question_type || "single_best_answer";
  $("questionExternalId").value = duplicate ? "" : source.external_id || "";
  $("questionStatus").value = duplicate ? "draft" : source.status || "draft";
  $("questionScenario").value = source.clinical_scenario || "";
  $("questionStem").value = source.stem || "";
  $("questionTopic").value = source.topic || "";
  $("questionSubtopic").value = source.subtopic || "";
  $("questionDifficulty").value = source.difficulty || "intermediate";
  $("questionSeconds").value = source.default_seconds ?? 60;
  $("questionPoints").value = source.points ?? 1;
  $("questionNegativePoints").value = source.negative_points ?? 0;
  $("questionOrder").value = source.display_order ?? 100;
  $("questionImageUrl").value = source.image_url || "";
  $("questionImageAlt").value = source.image_alt || "";
  $("questionExplanation").value = source.explanation || "";
  $("questionReferenceText").value = source.reference_text || "";
  $("questionReferenceUrl").value = source.reference_url || "";
  $("questionConfidence").checked = source.confidence_enabled ?? false;
  $("questionRandomize").checked = source.randomize_options ?? true;
  const opts = source.question_options || [];
  if (opts.length) opts.forEach(addOption); else [1,2,3,4].forEach(() => addOption());
  updateOptionHelp();
  $("archiveQuestionButton").hidden = !question || duplicate;
  $("duplicateQuestionButton").hidden = !question || duplicate;
  dialog.showModal();
}

function questionPayload() {
  return {
    module_id: $("questionModule").value,
    external_id: $("questionExternalId").value.trim() || null,
    question_type: $("questionType").value,
    stem: $("questionStem").value.trim(),
    clinical_scenario: $("questionScenario").value.trim() || null,
    image_url: $("questionImageUrl").value.trim() || null,
    image_alt: $("questionImageAlt").value.trim() || null,
    explanation: $("questionExplanation").value.trim() || null,
    reference_text: $("questionReferenceText").value.trim() || null,
    reference_url: $("questionReferenceUrl").value.trim() || null,
    topic: $("questionTopic").value.trim() || null,
    subtopic: $("questionSubtopic").value.trim() || null,
    difficulty: $("questionDifficulty").value,
    default_seconds: Number($("questionSeconds").value || 60),
    points: Number($("questionPoints").value || 1),
    negative_points: Number($("questionNegativePoints").value || 0),
    confidence_enabled: $("questionConfidence").checked,
    randomize_options: $("questionRandomize").checked,
    display_order: Number($("questionOrder").value || 100),
    status: $("questionStatus").value,
    created_by: adminProfile.id
  };
}

function optionPayload(questionId) {
  return [...document.querySelectorAll(".option-row")].map((row, i) => ({
    id: row.dataset.optionId || undefined,
    question_id: questionId,
    option_key: row.querySelector(".option-key").value,
    option_text: row.querySelector(".option-text").value.trim(),
    image_url: row.querySelector(".option-image").value.trim() || null,
    is_correct: row.querySelector(".option-correct").checked,
    display_order: i + 1
  }));
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = questionPayload();
  if (!payload.module_id || !payload.stem) return setStatus("Module and question stem are required.", "error");
  const optionRows = [...document.querySelectorAll(".option-row")];
  if (!optionRows.length) return setStatus("Add at least one answer option.", "error");
  const correctCount = optionRows.filter(r => r.querySelector(".option-correct").checked).length;
  if (payload.question_type !== "short_answer" && correctCount === 0) return setStatus("Select at least one correct answer.", "error");
  if (payload.question_type !== "multiple_response" && correctCount > 1) return setStatus("This question type allows only one correct answer.", "error");
  setStatus("Saving question…");
  const id = $("questionId").value;
  let questionId = id;
  if (id) {
    const { error } = await supabaseClient.from("questions").update(payload).eq("id", id);
    if (error) return setStatus(error.message, "error");
  } else {
    const { data, error } = await supabaseClient.from("questions").insert(payload).select("id").single();
    if (error) return setStatus(error.message, "error");
    questionId = data.id;
  }
  const options = optionPayload(questionId);
  const keepIds = options.filter(o => o.id).map(o => o.id);
  let deleteQuery = supabaseClient.from("question_options").delete().eq("question_id", questionId);
  if (keepIds.length) deleteQuery = deleteQuery.not("id", "in", `(${keepIds.join(",")})`);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) return setStatus(deleteError.message, "error");
  const normalized = options.map(o => { const copy = {...o}; if (!copy.id) delete copy.id; return copy; });
  const { error: optionError } = await supabaseClient.from("question_options").upsert(normalized, { onConflict: "id" });
  if (optionError) return setStatus(optionError.message, "error");
  dialog.close(); setStatus("Question saved.", "success"); await loadQuestions();
});

$("newQuestionButton").addEventListener("click", () => fillForm());
$("closeQuestionDialog").addEventListener("click", () => dialog.close());
$("cancelQuestionButton").addEventListener("click", () => dialog.close());
$("addOptionButton").addEventListener("click", () => addOption());
$("questionType").addEventListener("change", updateOptionHelp);
$("refreshQuestions").addEventListener("click", loadQuestions);
$("questionModuleFilter").addEventListener("change", applyFilters);
$("questionStatusFilter").addEventListener("change", applyFilters);
$("questionSearch").addEventListener("input", applyFilters);
$("optionRows").addEventListener("click", event => { if (event.target.closest(".remove-option")) { event.target.closest(".option-row").remove(); renumberOptions(); } });
$("archiveQuestionButton").addEventListener("click", async () => { const id = $("questionId").value; if (!id || !confirm("Archive this question?")) return; const { error } = await supabaseClient.from("questions").update({status:"archived"}).eq("id",id); if (error) return setStatus(error.message,"error"); dialog.close(); await loadQuestions(); });
$("duplicateQuestionButton").addEventListener("click", () => { const q = questions.find(x => x.id === $("questionId").value); if (q) fillForm(q, true); });

list.addEventListener("click", async event => {
  const card = event.target.closest(".question-admin-card"); if (!card) return;
  const q = questions.find(x => x.id === card.dataset.id); if (!q) return;
  if (event.target.closest(".edit-question")) return fillForm(q);
  if (event.target.closest(".duplicate-question-card")) return fillForm(q, true);
  const quick = event.target.closest(".quick-question-status");
  if (quick) { const { error } = await supabaseClient.from("questions").update({status:quick.dataset.status}).eq("id",q.id); if (error) return setStatus(error.message,"error"); await loadQuestions(); }
});

(async () => {
  adminProfile = await protectAndRender("login.html");
  if (!adminProfile) return;
  if (adminProfile.role !== "admin") { window.location.replace("modules.html"); return; }
  try { await loadModules(); await loadQuestions(); } catch (error) { console.error(error); setStatus(error.message, "error"); }
})();
