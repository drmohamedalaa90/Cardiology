import { supabaseClient } from "./supabase-client.js";

const $ = id => document.getElementById(id);
const esc = (value = "") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const courseId = new URLSearchParams(location.search).get("course");
let state = null;
let editingItem = null;
let editingSession = null;
let activeSessionId = null;

async function api(action, args = {}) {
  const { data, error } = await supabaseClient.rpc("acl_special_course_content_api", { p_action: action, p_args: { module_id: courseId, ...args } });
  if (error) throw error;
  return data;
}

const typeInfo = {
  lecture: ["▶", "Lecture", "Open lecture"],
  flashcards: ["▣", "Flashcards", "Study flashcards"],
  quiz_during: ["◆", "Session quiz", "Start quiz"],
  quiz_final: ["★", "Final assessment", "Start assessment"],
  file: ["↓", "Handout", "Open file"],
  link: ["↗", "Resource", "Open resource"]
};

function sessions() {
  return [...(state?.sessions || [])].sort((a,b) => a.display_order-b.display_order || a.session_number-b.session_number);
}

function sessionItems(sessionId) {
  return (state?.items || []).filter(item => item.session_id === sessionId).sort((a,b) => a.display_order-b.display_order);
}

function render() {
  const course = state.course;
  $("scpTitle").textContent = course.title;
  $("scpDescription").textContent = course.description || "";
  $("scpCertificateCourse").textContent = course.title;
  $("scpCandidateName").textContent = state.candidate_name || "ACL Candidate";
  if (course.cover_image_url) $("scpCover").style.backgroundImage = `url("${course.cover_image_url}")`;
  if (course.logo_url) $("scpLogo").innerHTML = `<img src="${esc(course.logo_url)}" alt="${esc(course.title)} logo">`;
  $("scpAdmin").hidden = !state.admin;

  const list = sessions();
  $("scpContent").innerHTML = list.length ? list.map((session, index) => {
    const count = sessionItems(session.id).filter(item => state.admin || item.is_active).length;
    return `<article class="scp-session-room ${session.is_active ? "" : "is-hidden"}" style="--room-delay:${index * 70}ms">
      <div class="scp-room-light"></div>
      <button class="scp-door-button" type="button" data-open-room="${session.id}" aria-label="Enter session ${session.session_number}: ${esc(session.title)}">
        <span class="scp-door-number">${String(session.session_number).padStart(2,"0")}</span><i class="scp-door-line"></i><b>ENTER ROOM</b>
      </button>
      <div class="scp-session-copy"><span>SESSION ${String(session.session_number).padStart(2,"0")}</span><h3>${esc(session.title)}</h3><small>${count ? `${count} course ${count === 1 ? "item" : "items"}` : "Room prepared · content coming soon"}</small></div>
      ${state.admin ? `<div class="scp-session-admin"><button type="button" data-edit-session="${session.id}">Edit</button><button type="button" data-delete-session="${session.id}">Delete</button></div>` : ""}
    </article>`;
  }).join("") : '<div class="scp-empty">Course sessions will appear here when they are released.</div>';

  document.querySelectorAll("[data-open-room]").forEach(button => button.addEventListener("click", () => openRoom(button.dataset.openRoom)));
  document.querySelectorAll("[data-edit-session]").forEach(button => button.addEventListener("click", event => { event.stopPropagation(); openSession(sessions().find(s => s.id === button.dataset.editSession)); }));
  document.querySelectorAll("[data-delete-session]").forEach(button => button.addEventListener("click", async event => {
    event.stopPropagation();
    const session = sessions().find(s => s.id === button.dataset.deleteSession);
    if (!session || !confirm(`Delete Session ${session.session_number}: ${session.title}? Its content boxes will also be deleted.`)) return;
    await api("delete_session", { id: session.id });
    await load();
  }));

  populateSessionSelect();
  renderCertificate(state.certificate || {});
}

function openRoom(id) {
  const session = sessions().find(entry => entry.id === id);
  if (!session) return;
  activeSessionId = id;
  $("scpDoorNumber").textContent = String(session.session_number).padStart(2,"0");
  $("scpRoomEyebrow").textContent = `SESSION ${String(session.session_number).padStart(2,"0")}`;
  $("scpRoomTitle").textContent = session.title;
  const items = sessionItems(id).filter(item => state.admin || item.is_active);
  $("scpRoomItems").innerHTML = items.length ? items.map((item, index) => {
    const info = typeInfo[item.item_type] || ["•", "Course item", "Open"];
    const ready = item.url && item.url !== "#";
    return `<article class="scp-content-box" style="--box-delay:${180 + index * 70}ms">
      <span class="scp-box-icon">${info[0]}</span><div><small>${info[1]}</small><h3>${esc(item.title)}</h3>${item.subtitle ? `<p>${esc(item.subtitle)}</p>` : ""}</div>
      ${ready ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${info[2]} →</a>` : '<span class="scp-coming">Coming soon</span>'}
      ${state.admin ? `<div class="scp-box-admin"><button type="button" data-edit-item="${item.id}">Edit</button><button type="button" data-delete-item="${item.id}">Delete</button></div>` : ""}
    </article>`;
  }).join("") : `<div class="scp-room-empty"><span>✦</span><strong>This room is ready.</strong><p>Course content will be added here.</p>${state.admin ? '<button id="scpRoomAddItem" type="button">+ Add the first content box</button>' : ""}</div>`;
  $("scpRoomModal").hidden = false;
  document.body.classList.add("scp-modal-open");
  requestAnimationFrame(() => $("scpRoomModal").classList.add("is-open"));
  document.querySelectorAll("[data-edit-item]").forEach(button => button.onclick = () => { closeRoom(); openItem((state.items || []).find(item => item.id === button.dataset.editItem)); });
  document.querySelectorAll("[data-delete-item]").forEach(button => button.onclick = async () => {
    if (!confirm("Delete this content box?")) return;
    await api("delete_item", { id: button.dataset.deleteItem });
    await load();
    openRoom(id);
  });
  $("scpRoomAddItem")?.addEventListener("click", () => { closeRoom(); openItem(null, id); });
}

function closeRoom() {
  $("scpRoomModal").classList.remove("is-open");
  document.body.classList.remove("scp-modal-open");
  setTimeout(() => { $("scpRoomModal").hidden = true; }, 260);
}

function populateSessionSelect(selected = "") {
  const select = $("scpItemSession");
  if (!select) return;
  select.innerHTML = sessions().map(session => `<option value="${session.id}">Session ${session.session_number} · ${esc(session.title)}</option>`).join("");
  if (selected) select.value = selected;
}

function openSession(session = null) {
  editingSession = session;
  $("scpSessionForm").hidden = false;
  $("scpSessionId").value = session?.id || "";
  $("scpSessionNumber").value = session?.session_number || sessions().length + 1;
  $("scpSessionTitle").value = session?.title || "";
  $("scpSessionOrder").value = session?.display_order || sessions().length + 1;
  $("scpSessionActive").checked = session?.is_active !== false;
  $("scpSessionStatus").textContent = "";
  $("scpSessionTitle").focus();
}

function openItem(item = null, preferredSession = "") {
  if (!sessions().length) { openSession(); return; }
  editingItem = item;
  $("scpItemForm").hidden = false;
  $("scpItemId").value = item?.id || "";
  populateSessionSelect(item?.session_id || preferredSession || activeSessionId || sessions()[0].id);
  $("scpItemType").value = item?.item_type || "lecture";
  $("scpItemTitle").value = item?.title || "";
  $("scpItemSubtitle").value = item?.subtitle || "";
  $("scpItemUrl").value = item?.url === "#" ? "" : item?.url || "";
  $("scpItemOrder").value = item?.display_order || sessionItems($("scpItemSession").value).length + 1;
  $("scpItemActive").checked = item?.is_active !== false;
  $("scpItemStatus").textContent = "";
  $("scpItemTitle").focus();
}

function renderCertificate(cert) {
  $("scpCertificateSection").hidden = !(cert.enabled || state.admin);
  $("scpCertificateTitle").textContent = cert.certificate_title || "Certificate of Completion";
  $("scpCertificateSubtitle").textContent = cert.certificate_subtitle || "";
  $("scpCompletionText").textContent = cert.completion_text || "has successfully completed";
  $("scpSignatory").textContent = cert.signatory_name || "Dr. Mohamed Alaa";
  $("scpSignatoryRole").textContent = cert.signatory_role || "Founder, Alexandria Cardiology League";
  if (cert.logo_url) $("scpCertificateLogo").src = cert.logo_url; else $("scpCertificateLogo").removeAttribute("src");
  if (cert.background_url) $("scpCertificateBackground").src = cert.background_url; else $("scpCertificateBackground").removeAttribute("src");
  if (state.admin) {
    $("scpCertificateEnabled").checked = !!cert.enabled;
    $("scpCertTitle").value = cert.certificate_title || "";
    $("scpCertSubtitle").value = cert.certificate_subtitle || "";
    $("scpCertCompletion").value = cert.completion_text || "";
    $("scpCertSignatory").value = cert.signatory_name || "";
    $("scpCertRole").value = cert.signatory_role || "";
  }
}

$("scpNewSession")?.addEventListener("click", () => openSession());
$("scpSessionCancel")?.addEventListener("click", () => { $("scpSessionForm").hidden = true; editingSession = null; });
$("scpSessionForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const status = $("scpSessionStatus");
  status.textContent = "Saving…";
  try {
    await api("save_session", { id: editingSession?.id || null, session_number: Number($("scpSessionNumber").value), title: $("scpSessionTitle").value.trim(), display_order: Number($("scpSessionOrder").value), is_active: $("scpSessionActive").checked });
    $("scpSessionForm").hidden = true;
    editingSession = null;
    await load();
  } catch (error) { status.textContent = error.message || "Could not save the session."; }
});

$("scpNewItem")?.addEventListener("click", () => openItem());
$("scpItemCancel")?.addEventListener("click", () => { $("scpItemForm").hidden = true; editingItem = null; });
$("scpItemForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const status = $("scpItemStatus");
  status.textContent = "Saving…";
  try {
    await api("save_item", { id: editingItem?.id || null, session_id: $("scpItemSession").value, item_type: $("scpItemType").value, title: $("scpItemTitle").value.trim(), subtitle: $("scpItemSubtitle").value.trim(), url: $("scpItemUrl").value.trim(), display_order: Number($("scpItemOrder").value || 1), is_active: $("scpItemActive").checked });
    $("scpItemForm").hidden = true;
    editingItem = null;
    await load();
  } catch (error) { status.textContent = error.message || "Could not save the content box."; }
});

async function upload(file, kind) {
  if (!file) return null;
  const extension = (file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "");
  const path = `special-courses/certificate-${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabaseClient.storage.from("acl-news").upload(path, file, { contentType: file.type || "image/png" });
  if (error) throw error;
  return supabaseClient.storage.from("acl-news").getPublicUrl(path).data.publicUrl;
}

$("scpCertificateForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const status = $("scpCertificateStatus");
  status.textContent = "Saving…";
  try {
    const logo = await upload($("scpCertLogoFile").files?.[0], "logo");
    const background = await upload($("scpCertBackgroundFile").files?.[0], "background");
    const payload = { enabled: $("scpCertificateEnabled").checked, certificate_title: $("scpCertTitle").value, certificate_subtitle: $("scpCertSubtitle").value, completion_text: $("scpCertCompletion").value, signatory_name: $("scpCertSignatory").value, signatory_role: $("scpCertRole").value };
    if (logo) payload.logo_url = logo;
    if (background) payload.background_url = background;
    await api("save_certificate", payload);
    await load();
    status.textContent = "Certificate saved.";
  } catch (error) { status.textContent = error.message || "Could not save certificate."; }
});

$("scpRoomClose")?.addEventListener("click", closeRoom);
$("scpRoomModal")?.addEventListener("click", event => { if (event.target === $("scpRoomModal")) closeRoom(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("scpRoomModal").hidden) closeRoom(); });
$("scpPrintCertificate")?.addEventListener("click", () => window.print());

async function load() {
  if (!courseId) throw new Error("Course link is incomplete.");
  state = await api("get");
  render();
}

load().catch(error => {
  if (/sign in required|permission denied/i.test(error.message || "")) {
    location.replace("acl-access.html");
    return;
  }
  $("scpTitle").textContent = "Course unavailable";
  $("scpContent").innerHTML = `<div class="scp-empty">${esc(error.message || "Could not load this course.")}</div>`;
});
