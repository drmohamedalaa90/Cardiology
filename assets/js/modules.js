import {
  supabaseClient
} from "./supabase-client.js";

import {
  protectAndRender
} from "./session-ui.js?v=4.8.0";

console.log("ACL MODULES v3.7.0 LOADED");

const grid = document.getElementById("modules");
const stateBox = document.getElementById("modulesStatus");
const catalogueSummary = document.getElementById("catalogueSummary");
const moduleSearchInput = document.getElementById("moduleSearchInput") || document.getElementById("moduleSearchInputCompact");
const moduleCategoryFilter = document.getElementById("moduleCategoryFilter");
const moduleDifficultyFilter = document.getElementById("moduleDifficultyFilter");
const moduleAccessFilter = document.getElementById("moduleAccessFilter") || document.getElementById("moduleAvailabilityCompact");
const moduleSearchSummary = document.getElementById("moduleSearchSummary");
const clearModuleFiltersButton = document.getElementById("clearModuleFilters") || document.getElementById("clearModuleFiltersCompact");

const pageState = {
  profile: null,
  modules: [],
  assignedModuleIds: new Set(),
  totalScore: 0,
  progressMap: new Map(),
  selectedChallengeModule: null,
  previousFocusedElement: null,
  loading: false,
  creatingChallenge: false
};

const VALID_EDITIONS = new Set(["basic", "expert"]);
const EDITION_STORAGE_KEY = "aclSelectedEdition";

function normalizeEdition(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_EDITIONS.has(normalized) ? normalized : "";
}

function readSavedEdition() {
  try { return normalizeEdition(localStorage.getItem(EDITION_STORAGE_KEY)); }
  catch (error) { console.warn("ACL EDITION READ ERROR:", error); return ""; }
}

function saveEdition(edition) {
  try { localStorage.setItem(EDITION_STORAGE_KEY, edition); }
  catch (error) { console.warn("ACL EDITION SAVE ERROR:", error); }
}

const pageParameters = new URLSearchParams(window.location.search);
const requestedEdition = normalizeEdition(pageParameters.get("edition"));
const selectedEdition = requestedEdition || readSavedEdition();

if (!selectedEdition) {
  window.location.replace("pathways.html");
  throw new Error("No valid ACL edition was selected.");
}

saveEdition(selectedEdition);
document.body.classList.remove("acl-theme-basic", "acl-theme-expert");
document.body.classList.add(selectedEdition === "basic" ? "acl-theme-basic" : "acl-theme-expert");

if (!requestedEdition) {
  const updatedUrl = new URL(window.location.href);
  updatedUrl.searchParams.set("edition", selectedEdition);
  window.history.replaceState({}, "", updatedUrl);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
}

function titleCase(value = "") {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

function setStatus(message = "", kind = "") {
  if (!stateBox) return;
  stateBox.textContent = message;
  stateBox.className = `status-box ${kind}`.trim();
  stateBox.hidden = !message;
}

function validDateTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDateTime(value) {
  const timestamp = validDateTimestamp(value);
  return timestamp === null ? "" : new Date(timestamp).toLocaleString();
}

function getModuleTheme(module) {
  const text = [module?.title,module?.name,module?.category,module?.short_description,module?.description,module?.slug].filter(Boolean).join(" ").toLowerCase();
  const isECG = text.includes("ecg") || text.includes("electrocardiograph") || text.includes("rhythm") || text.includes("arrhythmia");
  const isImaging = ["imaging","echocardiograph","echocardiography","echo","cardiac ct","coronary ct","ct angiography","ccta","mri","cmr","nuclear imaging","nuclear cardiology","ivus","oct"].some(x => text.includes(x));
  const isIntervention = ["intervention","interventional","pci","angioplasty","stent","catheter","structural","tavi","tavr","mitraclip","teer","device closure","coronary intervention","bifurcation","left main","calcified lesion","rotablation","atherectomy","cto"].some(x => text.includes(x));
  if (isECG) return {className:"module-ecg",categoryLabel:"Electrocardiography"};
  if (isImaging) return {className:"module-imaging",categoryLabel:"Imaging"};
  if (isIntervention) return {className:"module-intervention",categoryLabel:"Interventional Cardiology"};
  return {className:"module-general",categoryLabel:"General Cardiology"};
}

function withinSchedule(module) {
  const now = Date.now();
  const opensAt = validDateTimestamp(module.opens_at);
  const closesAt = validDateTimestamp(module.closes_at);
  if (opensAt !== null && now < opensAt) return false;
  if (closesAt !== null && now > closesAt) return false;
  return true;
}

function accessDecision(module, assignedIds, totalScore) {
  const moduleStatus = String(module.status || "").trim().toLowerCase();
  const accessType = String(module.access_type || "").trim().toLowerCase();
  if (moduleStatus === "coming_soon") return {state:"coming",label:"Coming soon",reason:"This module is currently being prepared."};
  if (!withinSchedule(module)) {
    const opensAt = validDateTimestamp(module.opens_at);
    if (opensAt !== null && Date.now() < opensAt) return {state:"locked",label:"Scheduled",reason:`Opens ${formatDateTime(module.opens_at)}`};
    return {state:"locked",label:"Closed",reason:"The access window has closed."};
  }
  if (accessType === "subscription" && !assignedIds.has(module.id)) return {state:"locked",label:"Subscription required",reason:"This module requires an active subscription."};
  if (accessType === "admin_assigned" && !assignedIds.has(module.id)) return {state:"locked",label:"Assignment required",reason:"This module requires administrator assignment."};
  if (accessType === "minimum_score" && totalScore < Number(module.minimum_score || 0)) return {state:"locked",label:`Requires ${Number(module.minimum_score || 0)} points`,reason:`Your current accumulated score is ${totalScore} points.`};
  if (accessType === "passcode") return {state:"locked",label:"Passcode requested",reason:"This module requires an access passcode."};
  if (!module.launch_path) return {state:"coming",label:"Coming soon",reason:"Educational content will be available soon."};
  return {state:"open",label:"Open module",reason:""};
}

function launchPathWithEdition(launchPath) {
  if (!launchPath) return "";
  try {
    const url = new URL(launchPath, window.location.href);
    url.searchParams.set("edition", selectedEdition);
    if (url.origin === window.location.origin) return `${url.pathname}${url.search}${url.hash}`;
    return url.toString();
  } catch (error) { console.warn("INVALID MODULE LAUNCH PATH:", launchPath, error); return ""; }
}

function moduleCard(module, decision, progressMap) {
  const progress = progressMap.get(module.id);
  const completed = progress?.status === "completed";
  const inProgress = progress?.status === "in_progress";
  const actionLabel = inProgress ? "Continue module" : completed ? "Review / retry" : decision.label;
  const launchPath = decision.state === "open" ? launchPathWithEdition(module.launch_path) : "";
  const href = launchPath ? escapeHtml(launchPath) : "#";
  const theme = getModuleTheme(module);
  return `<article class="module-card ${theme.className} ${escapeHtml(decision.state)} ${module.is_featured ? "featured" : ""}" data-module-id="${escapeHtml(module.id)}">
    <div class="module-cover"><span class="module-category">${escapeHtml(theme.categoryLabel)}</span>${module.is_featured ? '<span class="featured-badge">Featured</span>' : ''}</div>
    <div class="module-card-body"><div class="module-card-heading"><h2>${escapeHtml(module.title || "Untitled module")}</h2>${module.difficulty ? `<span class="difficulty-pill ${escapeHtml(String(module.difficulty).trim().toLowerCase())}">${escapeHtml(titleCase(module.difficulty))}</span>` : ''}</div>
    <p>${escapeHtml(module.short_description || module.description || "ACL educational module")}</p>
    <div class="module-meta"><span>⏱ ${Number(module.estimated_minutes || 0)} min</span><span>❓ ${Number(module.question_count || 0)} questions</span></div>
    ${progress ? `<div class="module-progress-line"><span>${inProgress ? "In progress" : completed ? "Completed" : escapeHtml(titleCase(progress.status || "Attempted"))}</span><strong>${Number(progress.score || 0)} pts</strong></div>` : ''}
    ${decision.reason ? `<p class="module-lock-reason">${escapeHtml(decision.reason)}</p>` : ''}
    <div class="module-card-actions"><a class="module-action ${decision.state !== "open" || !launchPath ? "disabled" : ""}" href="${href}" ${decision.state !== "open" || !launchPath ? 'aria-disabled="true" tabindex="-1"' : ''}>${escapeHtml(actionLabel)}</a></div>
    </div></article>`;
}

function normalizedModuleText(module) {
  return [module?.title,module?.name,module?.category,module?.short_description,module?.description,module?.slug,module?.difficulty].filter(Boolean).join(" ").toLowerCase();
}

function renderFilteredModules() {
  if (!grid) return;
  const searchTerm = String(moduleSearchInput?.value || "").trim().toLowerCase();
  const access = moduleAccessFilter?.value || "all";
  const filteredModules = pageState.modules.filter(module => {
    const decision = accessDecision(module,pageState.assignedModuleIds,pageState.totalScore);
    const matchesSearch = !searchTerm || normalizedModuleText(module).includes(searchTerm);
    const matchesAccess = access === "all" || (access === "open" ? decision.state === "open" : access === "locked" ? decision.state !== "open" : decision.state === access);
    return matchesSearch && matchesAccess;
  });
  grid.innerHTML = filteredModules.length ? filteredModules.map(module => moduleCard(module,accessDecision(module,pageState.assignedModuleIds,pageState.totalScore),pageState.progressMap)).join("") : '<div class="module-filter-empty"><strong>No matching modules found</strong><p>Try changing the search term or filters.</p></div>';
  if (moduleSearchSummary) moduleSearchSummary.textContent = `${filteredModules.length} of ${pageState.modules.length} ${pageState.modules.length === 1 ? "module" : "modules"} shown`;
}

function clearModuleFilters() {
  if (moduleSearchInput) moduleSearchInput.value = "";
  if (moduleAccessFilter) moduleAccessFilter.value = "all";
  renderFilteredModules();
}

function updateEditionPageCopy() {
  const editionTitle = selectedEdition === "basic" ? "THE BASIC EDITION" : "THE EXPERT EDITION";
  document.title = `${editionTitle} Modules | ACL`;
}

async function loadCatalogue() {
  if (pageState.loading) return;
  pageState.loading = true;
  updateEditionPageCopy();
  setStatus("Loading your ACL catalogue…");
  try {
    const profile = await protectAndRender("login.html");
    if (!profile) return;
    pageState.profile = profile;
    const [moduleResult,assignmentResult,attemptResult] = await Promise.all([
      supabaseClient.from("modules").select("*").eq("edition",selectedEdition).order("display_order",{ascending:true}).order("title",{ascending:true}),
      supabaseClient.from("module_assignments").select("module_id, expires_at").eq("user_id",profile.id),
      supabaseClient.from("quiz_attempts").select("module_id, status, score, updated_at").eq("user_id",profile.id).order("updated_at",{ascending:false})
    ]);
    if (moduleResult.error) throw moduleResult.error;
    if (assignmentResult.error) throw assignmentResult.error;
    if (attemptResult.error) throw attemptResult.error;
    const modules = Array.isArray(moduleResult.data) ? moduleResult.data : [];
    const assignments = Array.isArray(assignmentResult.data) ? assignmentResult.data : [];
    const attempts = Array.isArray(attemptResult.data) ? attemptResult.data : [];
    const assignedModuleIds = new Set(assignments.filter(a => { const expiresAt = validDateTimestamp(a.expires_at); return expiresAt === null || expiresAt > Date.now(); }).map(a => a.module_id));
    const totalScore = attempts.filter(a => a.status === "completed").reduce((total,a) => total + Number(a.score || 0),0);
    const progressMap = new Map();
    for (const attempt of attempts) if (attempt.module_id && !progressMap.has(attempt.module_id)) progressMap.set(attempt.module_id,attempt);
    pageState.modules = modules;
    pageState.assignedModuleIds = assignedModuleIds;
    pageState.totalScore = totalScore;
    pageState.progressMap = progressMap;
    if (!modules.length) {
      if (grid) grid.innerHTML = '<div class="empty-state">No modules are currently available in this edition.</div>';
      if (catalogueSummary) catalogueSummary.textContent = "0 modules";
      if (moduleSearchSummary) moduleSearchSummary.textContent = "0 modules available";
      setStatus("");
      return;
    }
    renderFilteredModules();
    if (catalogueSummary) catalogueSummary.textContent = `${modules.length} ${modules.length === 1 ? "module" : "modules"} · ${totalScore} accumulated quiz points`;
    setStatus("");
  } catch (error) {
    console.error("ACL MODULE CATALOGUE ERROR:", error);
    if (grid) grid.innerHTML = '<div class="empty-state">The module catalogue could not be loaded.</div>';
    if (catalogueSummary) catalogueSummary.textContent = "Catalogue unavailable";
    if (moduleSearchSummary) moduleSearchSummary.textContent = "Modules could not be loaded";
    setStatus(error.message || "Could not load modules.","error");
  } finally { pageState.loading = false; }
}

moduleSearchInput?.addEventListener("input",renderFilteredModules);
moduleAccessFilter?.addEventListener("change",renderFilteredModules);
clearModuleFiltersButton?.addEventListener("click",clearModuleFilters);

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",loadCatalogue,{once:true});
else void loadCatalogue();
