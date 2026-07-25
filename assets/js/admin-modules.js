import { supabaseClient } from "./supabase-client.js";
import { protectAndRender } from "./session-ui.js?v=2.7.12";

const $ = id => document.getElementById(id);
const grid = $("adminModulesGrid");
const dialog = $("moduleDialog");
const form = $("moduleForm");
let allModules = [];
let adminProfile = null;

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
const titleCase = value => String(value || "").replaceAll("_", " ").replace(/\b\w/g, x => x.toUpperCase());
const toLocalInput = value => value ? new Date(value).toISOString().slice(0,16) : "";
const toIso = value => value ? new Date(value).toISOString() : null;

function setStatus(message, type = "") { const box = $("adminModulesStatus"); box.textContent = message; box.className = `status-box ${type}`.trim(); box.hidden = !message; }
function slugify(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }

function renderStats() {
  $("moduleTotal").textContent = allModules.length;
  $("modulePublished").textContent = allModules.filter(x => x.status === "published").length;
  $("moduleComing").textContent = allModules.filter(x => x.status === "coming_soon").length;
  $("moduleHidden").textContent = allModules.filter(x => ["draft","archived"].includes(x.status)).length;
}

function card(module) {
  return `<article class="admin-module-card" data-id="${escapeHtml(module.id)}">
    <div class="admin-module-top"><div><span class="status-pill ${escapeHtml(module.status)}">${escapeHtml(titleCase(module.status))}</span><h2>${escapeHtml(module.title)}</h2><code>${escapeHtml(module.slug || module.id)}</code></div><span class="order-badge">#${Number(module.display_order || 0)}</span></div>
    <p>${escapeHtml(module.short_description || module.description || "No description")}</p>
    <div class="module-admin-meta"><span>${escapeHtml(module.category)}</span><span>${escapeHtml(titleCase(module.difficulty))}</span><span>${escapeHtml(titleCase(module.access_type))}</span><span>${Number(module.question_count || 0)} Qs</span></div>
    <div class="admin-module-flags">${module.learning_mode_enabled ? '<span>Learning</span>' : ''}${module.competition_mode_enabled ? '<span>Competition</span>' : ''}${module.is_featured ? '<span>Featured</span>' : ''}</div>
    <div class="admin-module-actions"><button class="secondary-btn edit-module" type="button">Edit</button><button class="secondary-btn quick-status" type="button" data-status="${module.status === "published" ? "draft" : "published"}">${module.status === "published" ? "Unpublish" : "Publish"}</button></div>
  </article>`;
}

function applyFilters() {
  const q = $("moduleSearch").value.trim().toLowerCase();
  const status = $("moduleStatusFilter").value;
  const rows = allModules.filter(m => (status === "all" || m.status === status) && (!q || [m.title,m.slug,m.category,m.short_description,m.full_description].some(v => String(v || "").toLowerCase().includes(q))));
  grid.innerHTML = rows.length ? rows.map(card).join("") : '<div class="empty-state">No modules match these filters.</div>';
}

async function loadModules() {
  setStatus("Loading modules…");
  const { data, error } = await supabaseClient.from("modules").select("*").order("display_order").order("title");
  if (error) { console.error(error); setStatus(error.message, "error"); return; }
  allModules = data || [];
  renderStats(); applyFilters(); setStatus("");
}

function fillForm(module = null) {
  form.reset();
  $("moduleDialogTitle").textContent = module ? "Edit module" : "Create module";
  $("moduleOriginalId").value = module?.id || "";
  $("moduleTitle").value = module?.title || "";
  $("moduleSlug").value = module?.slug || module?.id || "";
  $("moduleShortDescription").value = module?.short_description || module?.description || "";
  $("moduleFullDescription").value = module?.full_description || "";
  $("moduleCategory").value = module?.category || "General Cardiology";
  $("moduleDifficulty").value = module?.difficulty || "foundation";
  $("moduleStatus").value = module?.status || "draft";
  $("moduleAccessType").value = module?.access_type || "open";
  $("moduleMinimumScore").value = module?.minimum_score ?? 0;
  $("moduleEstimatedMinutes").value = module?.estimated_minutes ?? 10;
  $("moduleQuestionCount").value = module?.question_count ?? 0;
  $("moduleDisplayOrder").value = module?.display_order ?? 100;
  $("moduleOpensAt").value = toLocalInput(module?.opens_at);
  $("moduleClosesAt").value = toLocalInput(module?.closes_at);
  $("moduleCoverUrl").value = module?.cover_image_url || "";
  $("moduleLaunchPath").value = module?.launch_path || "";
  $("moduleLearning").checked = module?.learning_mode_enabled ?? true;
  $("moduleCompetition").checked = module?.competition_mode_enabled ?? false;
  $("moduleFeatured").checked = module?.is_featured ?? false;
  $("deleteModuleButton").hidden = !module;
  $("moduleSlug").readOnly = Boolean(module);
  dialog.showModal();
}

function payload() {
  const slug = slugify($("moduleSlug").value || $("moduleTitle").value);
  return {
    id: $("moduleOriginalId").value || slug,
    slug,
    title: $("moduleTitle").value.trim(),
    description: $("moduleShortDescription").value.trim(),
    short_description: $("moduleShortDescription").value.trim(),
    full_description: $("moduleFullDescription").value.trim() || null,
    category: $("moduleCategory").value.trim() || "General Cardiology",
    difficulty: $("moduleDifficulty").value,
    status: $("moduleStatus").value,
    access_type: $("moduleAccessType").value,
    minimum_score: Number($("moduleMinimumScore").value || 0),
    estimated_minutes: Number($("moduleEstimatedMinutes").value || 10),
    question_count: Number($("moduleQuestionCount").value || 0),
    display_order: Number($("moduleDisplayOrder").value || 100),
    opens_at: toIso($("moduleOpensAt").value),
    closes_at: toIso($("moduleClosesAt").value),
    cover_image_url: $("moduleCoverUrl").value.trim() || null,
    launch_path: $("moduleLaunchPath").value.trim() || null,
    learning_mode_enabled: $("moduleLearning").checked,
    competition_mode_enabled: $("moduleCompetition").checked,
    is_featured: $("moduleFeatured").checked,
    created_by: adminProfile.id
  };
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const row = payload();
  if (!row.title || !row.slug) return setStatus("Title and slug are required.", "error");
  if (row.opens_at && row.closes_at && new Date(row.closes_at) <= new Date(row.opens_at)) return setStatus("Closing time must be after opening time.", "error");
  setStatus("Saving module…");
  const { error } = await supabaseClient.from("modules").upsert(row, { onConflict: "id" });
  if (error) { console.error(error); setStatus(error.message, "error"); return; }
  dialog.close(); setStatus("Module saved.", "success"); await loadModules();
});

$("newModuleButton").addEventListener("click", () => fillForm());
$("closeModuleDialog").addEventListener("click", () => dialog.close());
$("cancelModuleButton").addEventListener("click", () => dialog.close());
$("refreshModules").addEventListener("click", loadModules);
$("moduleSearch").addEventListener("input", applyFilters);
$("moduleStatusFilter").addEventListener("change", applyFilters);
$("moduleTitle").addEventListener("input", () => { if (!$("moduleOriginalId").value) $("moduleSlug").value = slugify($("moduleTitle").value); });

$("deleteModuleButton").addEventListener("click", async () => {
  const id = $("moduleOriginalId").value;
  if (!id || !confirm("Archive this module? Existing quiz attempts will be preserved.")) return;
  const { error } = await supabaseClient.from("modules").update({ status: "archived" }).eq("id", id);
  if (error) return setStatus(error.message, "error");
  dialog.close(); await loadModules();
});

grid.addEventListener("click", async event => {
  const cardEl = event.target.closest(".admin-module-card"); if (!cardEl) return;
  const module = allModules.find(x => x.id === cardEl.dataset.id); if (!module) return;
  if (event.target.closest(".edit-module")) return fillForm(module);
  const quick = event.target.closest(".quick-status");
  if (quick) {
    const { error } = await supabaseClient.from("modules").update({ status: quick.dataset.status }).eq("id", module.id);
    if (error) return setStatus(error.message, "error");
    await loadModules();
  }
});

(async () => {
  adminProfile = await protectAndRender("login.html");
  if (!adminProfile) return;
  if (adminProfile.role !== "admin") { window.location.replace("modules.html"); return; }
  await loadModules();
})();
