import { supabaseClient } from "./supabase-client.js";
import { protectAndRender } from "./session-ui.js";

const byId = (id) => document.getElementById(id);
let allProfiles = [];
let currentAdmin = null;

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function show(message, type = "success") {
  const box = byId("adminStatus");
  box.textContent = message;
  box.className = `status-box show ${type}`;
  window.setTimeout(() => { box.className = "status-box"; }, 4500);
}
function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function initials(name) {
  return String(name || "ACL").split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase();
}
function accountAvatar(profile, clickable = false) {
  const image = profile.avatar_url
    ? `<img class="admin-avatar" src="${esc(profile.avatar_url)}" alt="${esc(profile.full_name || "Student")} profile photo">`
    : `<span class="admin-avatar admin-avatar-fallback">${esc(initials(profile.full_name))}</span>`;
  return clickable
    ? `<button class="admin-avatar-button" type="button" data-action="photo" data-id="${esc(profile.id)}" aria-label="Open profile photo">${image}</button>`
    : image;
}
function updateStats() {
  byId("totalStudents").textContent = allProfiles.length;
  byId("activeStudents").textContent = allProfiles.filter(p => p.account_status === "active").length;
  byId("suspendedStudents").textContent = allProfiles.filter(p => p.account_status === "suspended").length;
  byId("adminCount").textContent = allProfiles.filter(p => p.role === "admin").length;
}
function filteredProfiles() {
  const q = byId("studentSearch").value.trim().toLowerCase();
  const status = byId("statusFilter").value;
  const role = byId("roleFilter").value;
  return allProfiles.filter((p) => {
    const haystack = [p.full_name,p.username,p.email,p.phone_e164,p.academic_year,p.institution].join(" ").toLowerCase();
    return (!q || haystack.includes(q)) && (status === "all" || p.account_status === status) && (role === "all" || p.role === role);
  });
}
function renderRows() {
  const profiles = filteredProfiles();
  const body = byId("studentsBody");
  if (!profiles.length) {
    body.innerHTML = `<tr><td colspan="7" class="table-empty">No accounts match the current filters.</td></tr>`;
    return;
  }
  body.innerHTML = profiles.map((p) => {
    const isSelf = p.id === currentAdmin?.id;
    const statusClass = p.account_status === "suspended" ? "status-suspended" : "status-active";
    const toggleLabel = p.account_status === "suspended" ? "Restore" : "Suspend";
    return `<tr>
      <td><div class="student-cell">${accountAvatar(p, true)}<div><strong>${esc(p.full_name || "Unnamed user")}</strong><small>@${esc(p.username || "not-set")}</small></div></div></td>
      <td><div>${esc(p.email || "—")}</div><small>${esc(p.phone_e164 || "—")}</small></td>
      <td><div>${esc(p.academic_year || "—")}</div><small>${esc(p.institution || "—")}</small></td>
      <td><span class="role-pill role-${esc(p.role || "student")}">${esc(p.role || "student")}</span></td>
      <td><span class="account-pill ${statusClass}">${esc(p.account_status || "active")}</span></td>
      <td>${fmtDate(p.created_at)}</td>
      <td><div class="admin-actions">
        <button class="table-btn" data-action="view" data-id="${p.id}">View</button>
        <button class="table-btn" data-action="reset" data-id="${p.id}" ${!p.email ? "disabled" : ""}>Reset password</button>
        <button class="table-btn ${p.account_status === "suspended" ? "restore-btn" : "danger-btn"}" data-action="toggle" data-id="${p.id}" ${isSelf ? "disabled title='You cannot suspend your own administrator account.'" : ""}>${toggleLabel}</button>
      </div></td>
    </tr>`;
  }).join("");
}
async function loadProfiles() {
  const { data, error } = await supabaseClient.from("profiles")
    .select("id,full_name,username,email,phone_e164,academic_year,institution,avatar_url,role,account_status,created_at,updated_at,last_seen_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  allProfiles = data || [];
  updateStats();
  renderRows();
}
async function toggleStatus(profile) {
  if (profile.id === currentAdmin.id) throw new Error("You cannot suspend your own administrator account.");
  const nextStatus = profile.account_status === "suspended" ? "active" : "suspended";
  const verb = nextStatus === "suspended" ? "suspend" : "restore";
  if (!window.confirm(`Are you sure you want to ${verb} ${profile.full_name || profile.username || "this account"}?`)) return;
  const { error } = await supabaseClient.from("profiles").update({ account_status: nextStatus, updated_at: new Date().toISOString() }).eq("id", profile.id);
  if (error) throw error;
  profile.account_status = nextStatus;
  updateStats(); renderRows();
  show(`Account ${nextStatus === "suspended" ? "suspended" : "restored"} successfully.`);
}
async function sendReset(profile) {
  if (!profile.email) throw new Error("This account has no email address in its profile.");
  if (!window.confirm(`Send a password-reset email to ${profile.email}?`)) return;
  const redirectTo = `${window.location.origin}/Cardiology/reset-password.html`;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(profile.email, { redirectTo });
  if (error) throw error;
  show(`Password-reset email sent to ${profile.email}.`);
}
function openDetails(profile) {
  byId("studentDialogContent").innerHTML = `<div class="dialog-profile">${accountAvatar(profile)}<div><h2>${esc(profile.full_name || "Unnamed user")}</h2><p class="muted">@${esc(profile.username || "not-set")}</p></div></div>
  <dl class="detail-grid">
    <div><dt>Email</dt><dd>${esc(profile.email || "—")}</dd></div><div><dt>WhatsApp</dt><dd>${esc(profile.phone_e164 || "—")}</dd></div>
    <div><dt>Position</dt><dd>${esc(profile.academic_year || "—")}</dd></div><div><dt>Institution</dt><dd>${esc(profile.institution || "—")}</dd></div>
    <div><dt>Role</dt><dd>${esc(profile.role || "student")}</dd></div><div><dt>Status</dt><dd>${esc(profile.account_status || "active")}</dd></div>
    <div><dt>Registered</dt><dd>${fmtDate(profile.created_at)}</dd></div><div><dt>Last activity</dt><dd>${fmtDate(profile.last_seen_at)}</dd></div>
    <div class="detail-full"><dt>User ID</dt><dd class="mono">${esc(profile.id)}</dd></div>
  </dl>`;
  byId("studentDialog").showModal();
}

function openPhoto(profile) {
  if (!profile.avatar_url) {
    show("This student has not uploaded a profile photo.", "error");
    return;
  }
  byId("photoDialogTitle").textContent = `${profile.full_name || profile.username || "Student"} — profile photo`;
  byId("photoDialogImage").src = profile.avatar_url;
  byId("photoDialogImage").alt = `${profile.full_name || "Student"} profile photo`;
  byId("photoDialog").showModal();
}

function exportCsv() {
  const rows = filteredProfiles();
  const fields = ["full_name","username","email","phone_e164","academic_year","institution","role","account_status","created_at","last_seen_at"];
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [fields.join(","), ...rows.map(row => fields.map(field => quote(row[field])).join(","))].join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `acl-registered-students-${new Date().toISOString().slice(0,10)}.csv`;
  link.click(); URL.revokeObjectURL(link.href);
}

byId("studentSearch").addEventListener("input", renderRows);
byId("statusFilter").addEventListener("change", renderRows);
byId("roleFilter").addEventListener("change", renderRows);
byId("refreshStudents").addEventListener("click", async () => { try { await loadProfiles(); show("Student list refreshed."); } catch (e) { show(e.message || "Could not refresh students.", "error"); } });
byId("exportCsv").addEventListener("click", exportCsv);
byId("studentsBody").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  const profile = allProfiles.find(p => p.id === button.dataset.id); if (!profile) return;
  button.disabled = true;
  try {
    if (button.dataset.action === "view") openDetails(profile);
    if (button.dataset.action === "photo") openPhoto(profile);
    if (button.dataset.action === "toggle") await toggleStatus(profile);
    if (button.dataset.action === "reset") await sendReset(profile);
  } catch (error) { show(error.message || "Admin action failed.", "error"); }
  finally { button.disabled = false; }
});

async function init() {
  try {
    currentAdmin = await protectAndRender("login.html");
    if (!currentAdmin) return;
    if (currentAdmin.role !== "admin") {
      window.location.replace("modules.html");
      return;
    }
    await loadProfiles();
  } catch (error) {
    show(error.message || "Could not load the admin dashboard.", "error");
    byId("studentsBody").innerHTML = `<tr><td colspan="7" class="table-empty">Admin data could not be loaded.</td></tr>`;
  }
}
init();
