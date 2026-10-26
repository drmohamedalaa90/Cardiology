import { supabaseClient } from "./supabase-client.js";
import { ACL_CONFIG } from "./config.js";

const $ = id => document.getElementById(id);
const esc = (value = "") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const courseId = new URLSearchParams(location.search).get("course");
let state = null;
let editingItem = null;
let editingSession = null;
let activeSessionId = null;
let hallState = { capacity: 200, occupied: 0, members: [] };
let selectedHallMember = null;
let arrivalShown = false;
const seenRoomCalls=new Map();let roomCallTimer=null;

async function api(action, args = {}) {
  const { data, error } = await supabaseClient.rpc("acl_special_course_content_api", { p_action: action, p_args: { module_id: courseId, ...args } });
  if (error) throw error;
  return data;
}

async function hallApi() {
  const { data, error } = await supabaseClient.rpc("acl_special_course_hall", { p_module_id: courseId });
  if (error) throw error;
  return data;
}

async function hallAction(action, args = {}) {
  const { data, error } = await supabaseClient.rpc("acl_special_course_hall_action", { p_action: action, p_module_id: courseId, p_args: args });
  if (error) throw error;
  return data;
}

async function refreshHall() {
  hallState = await hallApi();
  renderHall();
}
function urlKeyBytes(value){const padding="=".repeat((4-value.length%4)%4),raw=atob((value+padding).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function bufferBase64(buffer){let raw="";for(const byte of new Uint8Array(buffer))raw+=String.fromCharCode(byte);return btoa(raw)}
async function ensureAdminPush(){
  if(!state?.admin||!("serviceWorker"in navigator)||!("PushManager"in window)||Notification.permission!=="granted")return;
  try{
    const registration=await navigator.serviceWorker.register("service-worker.js?v=8.1.0",{scope:"/Cardiology/",updateViaCache:"none"});await registration.update();
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlKeyBytes(ACL_CONFIG.vapidPublicKey)});
    const key=subscription.getKey("p256dh"),auth=subscription.getKey("auth"),{data:{session}}=await supabaseClient.auth.getSession();if(!session||!key||!auth)return;
    await supabaseClient.from("push_subscriptions").upsert({user_id:session.user.id,endpoint:subscription.endpoint,p256dh:bufferBase64(key),auth:bufferBase64(auth),user_agent:navigator.userAgent,device_type:/Mobi|Android/i.test(navigator.userAgent)?"mobile":"desktop",edition:"basic",is_active:true,updated_at:new Date().toISOString()},{onConflict:"endpoint"});
  }catch(error){console.warn("Admin push registration failed",error)}
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
function roomState(sessionId) { return (hallState.rooms || []).find(room => room.id === sessionId) || {}; }
function attendanceFor(member, slot) { return (member?.attendance || []).find(entry => Number(entry.slot) === Number(slot)); }

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
    const room = roomState(session.id);
    return `<article class="scp-session-room ${session.is_active ? "" : "is-hidden"} ${room.is_locked ? "is-locked" : ""}" style="--room-delay:${index * 70}ms">
      <div class="scp-room-light"></div>
      <button class="scp-door-button" type="button" data-open-room="${session.id}" aria-label="Enter session ${session.session_number}: ${esc(session.title)}">
        <span class="scp-door-number">${String(session.session_number).padStart(2,"0")}</span><i class="scp-door-line"></i><b>${room.is_locked && !state.admin ? "LOCKED" : "ENTER ROOM"}</b>
      </button>
      <div class="scp-session-copy"><span>SESSION ${String(session.session_number).padStart(2,"0")}</span><h3>${esc(session.title)}</h3><small>${count ? `${count} course ${count === 1 ? "item" : "items"}` : "Room prepared · content coming soon"}</small></div>
      ${room.is_locked ? '<span class="scp-room-lock-badge">LOCKED</span>' : ""}
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
  renderHall();
  renderAttendanceReport();
  renderCertificate(state.certificate || {});
}

function renderHall() {
  const members = new Map((hallState.members || []).map(member => [Number(member.seat_number), member]));
  const capacity = Number(hallState.capacity || 200);
  $("scpHallOccupied").textContent = String(hallState.occupied || members.size);
  $("scpResetAsked").hidden = !hallState.admin;
  $("scpVisitorsHall").innerHTML = Array.from({ length: capacity }, (_, index) => {
    const seat = index + 1;
    const member = members.get(seat);
    const label = member ? `Seat ${seat}, occupied by ${member.name}` : `Seat ${seat}, available`;
    const attendance = new Map((member?.attendance || []).map(entry => [Number(entry.slot), entry.status]));
    return `<button class="scp-chair ${member ? "is-occupied" : ""} ${member?.is_you ? "is-you" : ""} ${member?.asked ? "is-asked" : ""} ${member?.gender === "female" ? "is-female" : "is-male"}" type="button" data-seat="${seat}" ${member ? "" : "disabled"} aria-label="${esc(label)}">
      ${member ? '<span class="scp-person"><i></i><b></b><em></em></span>' : ""}<span class="scp-chair-back"></span><span class="scp-chair-seat"></span><small>${String(seat).padStart(3,"0")}</small><span class="scp-attendance-dots">${[1,2,3,4].map(slot=>`<i class="${attendance.get(slot)||""}"></i>`).join("")}</span>
    </button>`;
  }).join("");
  $("scpVisitorsHall").querySelectorAll(".is-occupied").forEach(button => button.addEventListener("click", () => {
    const member = members.get(Number(button.dataset.seat));
    if (!member) return;
    selectedHallMember = member;
    $("scpSeatNumber").textContent = `SEAT ${String(member.seat_number).padStart(3,"0")}${member.is_you ? " · YOUR SEAT" : ""}`;
    $("scpSeatName").textContent = member.name;
    $("scpSeatStars").textContent = `${"★".repeat(Math.min(Number(member.stars||0),10))}${Number(member.stars||0)>10?` +${Number(member.stars)-10}`:""}  ${member.stars || 0} star${Number(member.stars)===1?"":"s"}`;
    $("scpSeatCard").classList.toggle("is-female", member.gender === "female");
    $("scpSeatAdminActions").hidden = !hallState.admin;
    $("scpCallMember").textContent = member.asked ? "Called already" : "Call this seat";
    $("scpSeatCard").hidden = false;
  }));
  showArrivalSeat();
}

function showArrivalSeat() {
  if (arrivalShown) return;
  const params = new URLSearchParams(location.search);
  const seat = Number(params.get("seat") || hallState.your_seat || 0);
  if (!seat || params.get("welcome") !== "1") return;
  arrivalShown = true;
  $("scpHallSection").open = true;
  const chair = $("scpVisitorsHall").querySelector(`[data-seat="${seat}"]`);
  if (!chair) return;
  chair.classList.add("is-arrival");
  chair.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => chair.classList.remove("is-arrival"), 5000);
  history.replaceState(null,"",location.pathname+`?edition=basic&course=${encodeURIComponent(courseId)}`);
}

function renderAttendanceReport(){
  const section=$("scpAttendanceReport"),body=$("scpAttendanceReportBody");if(!section||!body)return;section.hidden=!hallState.admin;if(!hallState.admin)return;
  const members=hallState.members||[],ready=members.filter(member=>[1,2,3,4].every(slot=>attendanceFor(member,slot)?.status==="green")).length;
  $("scpCertificateReadyCount").textContent=`${ready} certificate${ready===1?"":"s"} ready`;
  body.innerHTML=members.length?members.map(member=>`<article class="scp-report-row"><div><b>${String(member.seat_number).padStart(3,"0")}</b><strong>${esc(member.name)}</strong><small>${[1,2,3,4].every(slot=>attendanceFor(member,slot)?.status==="green")?"Certificate ready":"Needs review"}</small></div><div class="scp-report-statuses">${[1,2,3,4].map(slot=>{const status=attendanceFor(member,slot)?.status||"empty";return `<button class="${status}" data-report-seat="${member.seat_number}" data-report-slot="${slot}" title="Room ${slot}: ${status}"><span>${slot}</span><i></i></button>`}).join("")}</div></article>`).join(""):'<p class="scp-report-empty">No course members yet.</p>';
  body.querySelectorAll("[data-report-seat]").forEach(button=>button.addEventListener("click",async()=>{const current=["empty","green","orange","red"].findIndex(x=>button.classList.contains(x)),next=["green","orange","red"][Math.max(0,(current-1+1)%3)];button.disabled=true;await hallAction("set_attendance_status",{seat_number:Number(button.dataset.reportSeat),attendance_slot:Number(button.dataset.reportSlot),status:next});await refreshHall();renderAttendanceReport()}));
}

function renderAttendance(session) {
  const panel = $("scpAttendancePanel"), slot = Number(session.session_number), room = roomState(session.id);
  if (slot < 1 || slot > 4) { panel.hidden = true; panel.innerHTML = ""; return; }
  const attendees = (hallState.members || []).filter(member => attendanceFor(member, slot));
  const me = (hallState.members || []).find(member => member.is_you), mine = attendanceFor(me, slot);
  panel.hidden = false;
  if (state.admin) {
    const phase = room.ended_at ? "Lecture ended" : room.started_at ? "Lecture in progress" : "Not started", checkedCount=attendees.filter(member=>attendanceFor(member,slot)?.checked_in_at).length;
    panel.innerHTML = `<div class="scp-attendance-admin-head"><div><span>ROOM ${slot} ATTENDANCE</span><strong>${checkedCount} checked in · ${phase}</strong></div><div class="scp-lecture-actions"><button data-room-lock>${room.is_locked?"Unlock room":"Lock room"}</button><button data-reset-attendance>Reset attendance</button>${!room.started_at?'<button data-start-lecture>Start lecture</button>':!room.ended_at?'<button data-end-lecture>End lecture</button>':'<span class="scp-lecture-ended">Lecture ended</span>'}</div></div><div class="scp-seat-caller"><label>Call a checked-in seat</label><div><input data-call-seat type="number" min="1" max="200" placeholder="Seat number"><button data-call-manual>Call seat</button><button data-call-toss>Make a toss</button></div><p data-call-status></p></div><div class="scp-attendance-list">${attendees.length?attendees.map(member=>{const a=attendanceFor(member,slot);return `<span class="${a.status==='orange'?'warning':a.status==='red'?'missed':''}"><b>${String(member.seat_number).padStart(3,"0")}</b>${esc(member.name)} · ${!a.checked_in_at?'did not check in':a.checked_out_at?'checked out':'inside'}</span>`}).join(""):"<p>No members have checked in yet.</p>"}</div>`;
    panel.querySelector("[data-room-lock]")?.addEventListener("click",async()=>{await hallAction("set_room_lock",{session_id:session.id,locked:!room.is_locked});await refreshHall();render();openRoom(session.id)});
    panel.querySelector("[data-reset-attendance]")?.addEventListener("click",async()=>{if(!confirm(`Reset all Room ${slot} check-ins, checkouts and lecture timing?`))return;await hallAction("reset_room_attendance",{session_id:session.id});await refreshHall();render();openRoom(session.id)});
    panel.querySelector("[data-call-manual]")?.addEventListener("click",async()=>{const seat=Number(panel.querySelector("[data-call-seat]").value),status=panel.querySelector("[data-call-status]");try{const result=await hallAction("call_seat_manual",{session_id:session.id,seat_number:seat});await refreshHall();await runSeatCall(session.id,result.seat_number,"manual")}catch(error){status.textContent=error.message||"Could not call this seat"}});
    panel.querySelector("[data-call-toss]")?.addEventListener("click",async()=>{const status=panel.querySelector("[data-call-status]");try{const result=await hallAction("call_seat_toss",{session_id:session.id});await refreshHall();await runSeatCall(session.id,result.seat_number,"toss")}catch(error){status.textContent=error.message||"No checked-in seats available"}});
    panel.querySelector("[data-start-lecture]")?.addEventListener("click",async()=>{await hallAction("start_lecture",{session_id:session.id});await refreshHall();render();openRoom(session.id)});
    panel.querySelector("[data-end-lecture]")?.addEventListener("click",async()=>{await hallAction("end_lecture",{session_id:session.id});await refreshHall();render();openRoom(session.id)});
  } else if (me) {
    if (room.is_locked) panel.innerHTML='<div class="scp-attendance-warning">This room is currently locked by the Academic Director.</div>';
    else if (!mine) panel.innerHTML=`<button id="scpCheckIn" class="scp-checkin-button" type="button">Check in to Room ${slot}</button>`;
    else if (!mine.checked_out_at) panel.innerHTML=`<div class="scp-checkin-success">✓ Checked in${mine.status==='orange'?' · Late arrival':''}</div><button id="scpCheckOut" class="scp-checkout-button" type="button">Check out</button>${room.ended_at?'<small>The lecture has ended. Please check out now.</small>':'<small>Check out only when the Academic Director ends the lecture.</small>'}`;
    else panel.innerHTML=`<div class="${mine.status==='green'?'scp-checkin-success':'scp-attendance-warning'}">${mine.status==='green'?'✓ Attendance completed':mine.status==='red'?'● Did not check in':'● Attendance needs review'}</div>`;
    $("scpCheckIn")?.addEventListener("click",async e=>{e.currentTarget.disabled=true;try{await hallAction("check_in",{attendance_slot:slot,session_id:session.id});await refreshHall();renderAttendance(session)}catch(error){e.currentTarget.disabled=false;e.currentTarget.textContent=error.message||"Could not check in"}});
    $("scpCheckOut")?.addEventListener("click",async e=>{e.currentTarget.disabled=true;try{await hallAction("check_out",{session_id:session.id});await refreshHall();renderAttendance(session)}catch(error){e.currentTarget.disabled=false;e.currentTarget.textContent=error.message||"Could not check out"}});
  } else panel.innerHTML='<div class="scp-attendance-warning">Your theater seat is required before attendance can be recorded.</div>';
}
function openRoom(id) {
  const session = sessions().find(entry => entry.id === id);
  if (!session) return;
  if (roomState(id).is_locked && !state.admin) { alert("This room is currently locked by the Academic Director."); return; }
  activeSessionId = id;
  if(!seenRoomCalls.has(id))seenRoomCalls.set(id,Number(roomState(id).call_sequence||0));
  $("scpDoorNumber").textContent = String(session.session_number).padStart(2,"0");
  $("scpRoomEyebrow").textContent = `SESSION ${String(session.session_number).padStart(2,"0")}`;
  $("scpRoomTitle").textContent = session.title;
  renderAttendance(session);
  $("scpRoomHelp").hidden = !!state.admin;
  $("scpQuestionStatus").textContent = "";
  $("scpQuestionText").value = "";
  const items = sessionItems(id).filter(item => state.admin || item.is_active);
  const itemCard=(item,index)=>{const info=typeInfo[item.item_type]||["•","Course item","Open"],ready=item.url&&item.url!=="#";return `<article class="scp-content-box" style="--box-delay:${180+index*70}ms"><span class="scp-box-icon">${info[0]}</span><div><small>${info[1]}</small><h3>${esc(item.title)}</h3>${item.subtitle?`<p>${esc(item.subtitle)}</p>`:""}</div>${ready?`<a href="${esc(item.url)}" target="_blank" rel="noopener">${info[2]} →</a>`:'<span class="scp-coming">Coming soon</span>'}${state.admin?`<div class="scp-box-admin"><button type="button" data-edit-item="${item.id}">Edit</button><button type="button" data-delete-item="${item.id}">Delete</button></div>`:""}</article>`};
  const videos=items.filter(item=>item.item_type==="lecture"),others=items.filter(item=>item.item_type!=="lecture");
  $("scpRoomItems").innerHTML=items.length?`${videos.length?`<details class="scp-video-section"><summary><span>▶</span><strong>Watch the videos</strong><small>${videos.length} video${videos.length===1?"":"s"}</small></summary><div class="scp-video-list">${videos.map(itemCard).join("")}</div></details>`:""}${others.map(itemCard).join("")}`:`<div class="scp-room-empty"><span>✦</span><strong>This room is ready.</strong><p>Course content will be added here.</p>${state.admin?'<button id="scpRoomAddItem" type="button">+ Add the first content box</button>':""}</div>`;
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

async function runSeatCall(sessionId,seat,mode){
  const overlay=$("scpSeatCallOverlay"),number=$("scpSeatCallNumber"),label=$("scpSeatCallMode"),session=sessions().find(x=>x.id===sessionId);if(!overlay||!seat)return;
  seenRoomCalls.set(sessionId,Number(roomState(sessionId).call_sequence||seenRoomCalls.get(sessionId)||0));overlay.hidden=false;label.textContent=mode==="toss"?"RANDOM SEAT TOSS":"SEAT CALLED";
  const eligible=(hallState.members||[]).filter(member=>attendanceFor(member,Number(session?.session_number))?.checked_in_at).map(member=>Number(member.seat_number));
  if(mode==="toss"&&eligible.length){let ticks=0;clearInterval(roomCallTimer);await new Promise(resolve=>{roomCallTimer=setInterval(()=>{number.textContent=String(eligible[Math.floor(Math.random()*eligible.length)]).padStart(3,"0");if(++ticks>=24){clearInterval(roomCallTimer);resolve()}},75)})}
  number.textContent=String(seat).padStart(3,"0");await new Promise(resolve=>setTimeout(resolve,1200));overlay.hidden=true;renderHall();$("scpVisitorsHall").querySelector(`[data-seat="${seat}"]`)?.click();
}
async function pollRoomCalls(){if(!activeSessionId||$("scpRoomModal").hidden)return;try{hallState=await hallApi();const room=roomState(activeSessionId),seq=Number(room.call_sequence||0),seen=Number(seenRoomCalls.get(activeSessionId)||0);if(seq>seen&&room.called_seat){seenRoomCalls.set(activeSessionId,seq);await runSeatCall(activeSessionId,Number(room.called_seat),room.call_mode||"manual")}}catch{}}
setInterval(()=>void pollRoomCalls(),1500);

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
  $("scpSessionLocked").checked = !!roomState(session?.id).is_locked;
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
  const me=(hallState.members||[]).find(member=>member.is_you),eligible=!!me&&[1,2,3,4].every(slot=>attendanceFor(me,slot)?.status==="green");
  $("scpCertificateSection").hidden = !(state.admin || eligible);
  $("scpCertificatePending").hidden = state.admin || eligible;
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
    const savedId=editingSession?.id || null, savedNumber=Number($("scpSessionNumber").value), savedTitle=$("scpSessionTitle").value.trim(), lockWanted=$("scpSessionLocked").checked;
    await api("save_session", { id:savedId, session_number:savedNumber, title:savedTitle, display_order:Number($("scpSessionOrder").value), is_active:$("scpSessionActive").checked });
    await load();
    const targetId=savedId || sessions().find(x=>Number(x.session_number)===savedNumber&&x.title===savedTitle)?.id;
    if(targetId && !!roomState(targetId).is_locked!==lockWanted){await hallAction("set_room_lock",{session_id:targetId,locked:lockWanted});await refreshHall();render()}
    $("scpSessionForm").hidden = true;
    editingSession = null;
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
$("scpSeatClose")?.addEventListener("click", () => { $("scpSeatCard").hidden = true; });
$("scpSeatCard")?.addEventListener("click", event => { if (event.target === $("scpSeatCard")) $("scpSeatCard").hidden = true; });
document.addEventListener("keydown", event => { if (event.key === "Escape") $("scpSeatCard").hidden = true; });
$("scpCallMember")?.addEventListener("click", async () => { if (!selectedHallMember) return; await hallAction("call_member",{seat_number:selectedHallMember.seat_number}); $("scpSeatCard").hidden=true; await refreshHall(); });
$("scpAwardStar")?.addEventListener("click", async () => { if (!selectedHallMember) return; await hallAction("award_star",{seat_number:selectedHallMember.seat_number}); await refreshHall(); const updated=(hallState.members||[]).find(m=>m.seat_number===selectedHallMember.seat_number); if(updated){selectedHallMember=updated;$("scpSeatStars").textContent=`${"★".repeat(Math.min(Number(updated.stars||0),10))}${Number(updated.stars||0)>10?` +${Number(updated.stars)-10}`:""}  ${updated.stars||0} star${Number(updated.stars)===1?"":"s"}`;} });
$("scpRemoveStar")?.addEventListener("click", async () => { if (!selectedHallMember) return; await hallAction("remove_star",{seat_number:selectedHallMember.seat_number}); await refreshHall(); const updated=(hallState.members||[]).find(m=>m.seat_number===selectedHallMember.seat_number); if(updated){selectedHallMember=updated;$("scpSeatStars").textContent=`${"★".repeat(Math.min(Number(updated.stars||0),10))}  ${updated.stars||0} star${Number(updated.stars)===1?"":"s"}`;} });
$("scpResetAsked")?.addEventListener("click", async event => { event.preventDefault();event.stopPropagation();await hallAction("reset_asked");await refreshHall(); });
$("scpPrintCertificate")?.addEventListener("click", () => window.print());

async function load() {
  if (!courseId) throw new Error("Course link is incomplete.");
  [state, hallState] = await Promise.all([api("get"), hallApi()]);
  render();
  void ensureAdminPush();
}

load().catch(error => {
  if (/sign in required|permission denied/i.test(error.message || "")) {
    location.replace("acl-access.html");
    return;
  }
  $("scpTitle").textContent = "Course unavailable";
  $("scpContent").innerHTML = `<div class="scp-empty">${esc(error.message || "Could not load this course.")}</div>`;
});

$("scpRefresh")?.addEventListener("click",()=>location.reload());
async function sendHelpPush(requestId){if(!requestId)return;try{await supabaseClient.functions.invoke("send-course-help-push",{body:{request_id:requestId}})}catch(error){console.warn("Push delivery failed",error)}}
$("scpRepeatRequest")?.addEventListener("click",async event=>{if(!activeSessionId)return;const session=sessions().find(x=>x.id===activeSessionId),button=event.currentTarget;button.disabled=true;button.textContent="Sending…";try{const result=await hallAction("request_repeat",{session_id:activeSessionId,session_number:session?.session_number});void sendHelpPush(result?.request_id);button.textContent="✓ Request sent";$("scpQuestionStatus").textContent="The Doctor has been notified.";setTimeout(()=>{button.disabled=false;button.textContent="Please repeat — I don’t understand";$("scpQuestionStatus").textContent=""},3500)}catch(error){button.disabled=false;button.textContent="Please repeat — I don’t understand";$("scpQuestionStatus").textContent=error.message||"Could not send the request.";}});
$("scpQuestionForm")?.addEventListener("submit",async event=>{event.preventDefault();if(!activeSessionId)return;const text=$("scpQuestionText").value.trim(),session=sessions().find(x=>x.id===activeSessionId),button=event.currentTarget.querySelector("button");if(!text)return;button.disabled=true;button.textContent="Sending…";try{const result=await hallAction("submit_question",{session_id:activeSessionId,session_number:session?.session_number,question:text});void sendHelpPush(result?.request_id);$("scpQuestionText").value="";$("scpQuestionStatus").textContent="✓ Your question was sent to the Doctor.";button.textContent="Sent";}catch(error){button.disabled=false;button.textContent="Submit question";$("scpQuestionStatus").textContent=error.message||"Could not submit your question.";}});
