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

async function extrasApi(action,args={}){const {data,error}=await supabaseClient.rpc("acl_course_room_extras",{p_action:action,p_module_id:courseId,p_args:args});if(error)throw error;return data}
function applyExtras(extras={}){const roomMap=new Map((extras.rooms||[]).map(x=>[x.id,x]));hallState.rooms=(hallState.rooms||[]).map(x=>({...x,...(roomMap.get(x.id)||{})}));const coverMap=new Map((extras.covers||[]).map(x=>[x.id,x.cover_image_url]));state.items=(state.items||[]).map(x=>({...x,cover_image_url:coverMap.get(x.id)||x.cover_image_url||""}))}

async function refreshHall() {
  const [hall,extras]=await Promise.all([hallApi(),extrasApi("get")]);hallState=hall;applyExtras(extras);
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

function preloadCourseImages(){for(const item of state?.items||[]){if(!item.cover_image_url)continue;const image=new Image();image.decoding="async";image.fetchPriority="high";image.src=item.cover_image_url}}

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
    const room = roomState(session.id),scheduled=room.scheduled_at?new Date(room.scheduled_at).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'';
    return `<article class="scp-session-room ${session.is_active ? "" : "is-hidden"} ${room.is_locked ? "is-locked" : ""}" style="--room-delay:${index * 70}ms">
      <div class="scp-room-light"></div>
      <button class="scp-door-button" type="button" data-open-room="${session.id}" aria-label="Enter session ${session.session_number}: ${esc(session.title)}">
        <span class="scp-door-number">${String(session.session_number).padStart(2,"0")}</span><i class="scp-door-line"></i><b>${room.is_locked && !state.admin ? "LOCKED" : "ENTER ROOM"}</b>
      </button>
      <div class="scp-session-copy"><span>SESSION ${String(session.session_number).padStart(2,"0")}</span><h3>${esc(session.title)}</h3><small>${scheduled?`📅 ${esc(scheduled)} · `:""}${count ? `${count} course ${count === 1 ? "item" : "items"}` : "Room prepared · content coming soon"}</small></div>
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
    return `<button class="scp-chair ${member ? "is-occupied" : ""} ${member?.is_you ? "is-you" : ""} ${member?.asked ? "is-asked" : ""} ${member?.suspended ? "is-suspended" : ""} ${member?.gender === "female" ? "is-female" : "is-male"}" type="button" data-seat="${seat}" ${member ? "" : "disabled"} aria-label="${esc(label)}">
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
    $("scpSeatAttendance").innerHTML=[1,2,3,4].map(slot=>{const status=attendanceFor(member,slot)?.status||"empty";return `<span title="Room ${slot}: ${arLabel(status)}"><i class="${status}"></i><b>${slot}</b></span>`}).join("");
    $("scpSeatCard").classList.toggle("is-female", member.gender === "female");
    $("scpSeatAdminActions").hidden = !hallState.admin;
    $("scpCallMember").textContent = member.asked ? "Called already" : "Call this seat";
    const suspendButton=$("scpSuspendMember");
    if(suspendButton){suspendButton.textContent=member.suspended?"Restore course access":"Suspend from course";suspendButton.classList.toggle("is-restore",!!member.suspended)}
    $("scpSuspendForm").hidden=true;$("scpSuspendStatus").textContent="";$("scpSuspendReason").value=member.suspension_reason||"";
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

function localDateTimeValue(value){if(!value)return"";const d=new Date(value),pad=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
async function browserLocation(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error("Location is not supported on this device."));navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),()=>reject(new Error("Allow location access to check in.")),{enableHighAccuracy:true,timeout:12000,maximumAge:30000})})}
function renderAttendance(session) {
  const panel=$("scpAttendancePanel"),slot=Number(session.session_number),room=roomState(session.id);if(slot<1||slot>4){panel.hidden=true;panel.innerHTML="";return}if(room.attendance_enabled===false){if(state.admin){panel.hidden=false;panel.innerHTML=`<div class="scp-attendance-off"><strong>Attendance is OFF</strong><p>Members can view the lectures, flashcards and forum, but cannot check in, check out, request help or change attendance.</p><button data-enable-attendance type="button">Turn attendance ON</button></div>`;panel.querySelector("[data-enable-attendance]").onclick=async()=>{await extrasApi("set_attendance",{session_id:session.id,enabled:true});await refreshHall();renderAttendance(session)}}else{panel.hidden=true;panel.innerHTML=""}return}
  const attendees=(hallState.members||[]).filter(member=>attendanceFor(member,slot)),me=(hallState.members||[]).find(member=>member.is_you),mine=attendanceFor(me,slot),schedule=room.scheduled_at?new Date(room.scheduled_at):null,scheduledText=schedule?schedule.toLocaleString([], {dateStyle:"medium",timeStyle:"short"}):"Not scheduled";
  panel.hidden=false;
  if(state.admin){const phase=room.ended_at?"Lecture ended":room.started_at?"Lecture in progress":"Not started",checkedCount=attendees.filter(member=>attendanceFor(member,slot)?.checked_in_at).length;
    panel.innerHTML=`${!room.started_at?`<button class="scp-start-lecture-main" data-start-lecture>▶ Start lecture now</button>`:!room.ended_at?`<button class="scp-end-lecture-main" data-end-lecture>End lecture & notify checkout</button>`:'<div class="scp-lecture-finished">Lecture ended</div>'}<div class="scp-attendance-admin-head"><div><span>ROOM ${slot} ATTENDANCE</span><strong>${checkedCount} checked in · ${phase}</strong></div><div class="scp-lecture-actions"><button class="attendance-off" data-disable-attendance>Turn attendance OFF</button><button data-room-lock>${room.is_locked?"Unlock room":"Lock room"}</button><button data-open-voting>Live voting</button><button data-attendance-review>Attendance review</button><button data-reset-attendance>Reset attendance</button></div></div><form class="scp-room-schedule" data-room-schedule><h3>Lecture schedule & check-in</h3><label>Date and time<input data-scheduled-at type="datetime-local" value="${localDateTimeValue(room.scheduled_at)}" required></label><label class="toggle"><input data-location-required type="checkbox" ${room.location_required?'checked':''}> Require faculty location for check-in</label><div class="coordinates"><label>Latitude<input data-latitude type="number" step="any" value="${room.latitude??''}"></label><label>Longitude<input data-longitude type="number" step="any" value="${room.longitude??''}"></label><label>Radius (metres)<input data-radius type="number" min="50" max="5000" value="${room.location_radius_m||300}"></label></div><div><button type="button" data-use-location>Use my current location</button><button type="submit">Save schedule</button><button type="button" class="notify" data-notify-checkin>Notify: check-in is open</button></div><small>Check-in opens 10 minutes before ${esc(scheduledText)}.</small></form><div class="scp-seat-caller"><label>Call a checked-in seat</label><div><input data-call-seat type="number" min="1" max="200" placeholder="Seat number"><button data-call-manual>Call seat</button><button data-call-toss>Make a toss</button></div><p data-call-status></p></div><details class="scp-attendance-names"><summary><span>Member attendance names</span><b>${attendees.length}</b></summary><div class="scp-attendance-list">${attendees.length?attendees.map(member=>{const a=attendanceFor(member,slot);return `<span class="${a.status==='orange'?'warning':a.status==='red'?'missed':''}"><b>${String(member.seat_number).padStart(3,"0")}</b>${esc(member.name)} · ${!a.checked_in_at?'did not check in':a.checked_out_at?'checked out':'inside'}</span>`}).join(""):"<p>No attendance records yet.</p>"}</div></details>`;
    panel.querySelector("[data-disable-attendance]")?.addEventListener("click",async()=>{if(!confirm("Turn attendance off for this room? Members will only see the medical content."))return;await extrasApi("set_attendance",{session_id:session.id,enabled:false});await refreshHall();renderAttendance(session)});panel.querySelector("[data-room-lock]")?.addEventListener("click",async()=>{await hallAction("set_room_lock",{session_id:session.id,locked:!room.is_locked});await refreshHall();render();openRoom(session.id)});panel.querySelector("[data-open-voting]")?.addEventListener("click",()=>openVoteManager(session.id));panel.querySelector("[data-attendance-review]")?.addEventListener("click",()=>openAttendanceReview(session.id));panel.querySelector("[data-reset-attendance]")?.addEventListener("click",async()=>{if(!confirm(`Reset all Room ${slot} attendance and timing?`))return;await hallAction("reset_room_attendance",{session_id:session.id});await refreshHall();render();openRoom(session.id)});
    panel.querySelector("[data-start-lecture]")?.addEventListener("click",async()=>{await hallAction("start_lecture",{session_id:session.id});void sendAttendanceLifecyclePush("started",session.id);await refreshHall();render();openRoom(session.id)});panel.querySelector("[data-end-lecture]")?.addEventListener("click",async()=>{await hallAction("end_lecture",{session_id:session.id});void sendAttendanceLifecyclePush("checkout",session.id);await refreshHall();render();openRoom(session.id)});
    panel.querySelector("[data-use-location]")?.addEventListener("click",async e=>{try{e.currentTarget.textContent="Locating…";const pos=await browserLocation();panel.querySelector("[data-latitude]").value=pos.latitude.toFixed(7);panel.querySelector("[data-longitude]").value=pos.longitude.toFixed(7);e.currentTarget.textContent="Location captured"}catch(err){alert(err.message);e.currentTarget.textContent="Use my current location"}});
    panel.querySelector("[data-room-schedule]")?.addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;await hallAction("save_attendance_config",{session_id:session.id,scheduled_at:new Date(f.querySelector("[data-scheduled-at]").value).toISOString(),location_required:f.querySelector("[data-location-required]").checked,latitude:f.querySelector("[data-latitude]").value,longitude:f.querySelector("[data-longitude]").value,location_radius_m:Number(f.querySelector("[data-radius]").value)});await refreshHall();render();openRoom(session.id)});
    panel.querySelector("[data-notify-checkin]")?.addEventListener("click",async e=>{e.currentTarget.disabled=true;await sendAttendanceLifecyclePush("checkin",session.id);e.currentTarget.textContent="✓ Notification sent"});
    panel.querySelector("[data-call-manual]")?.addEventListener("click",async()=>{const seat=Number(panel.querySelector("[data-call-seat]").value),status=panel.querySelector("[data-call-status]");try{const result=await hallAction("call_seat_manual",{session_id:session.id,seat_number:seat});await refreshHall();await runSeatCall(session.id,result.seat_number,"manual")}catch(error){status.textContent=error.message||"Could not call this seat"}});panel.querySelector("[data-call-toss]")?.addEventListener("click",async()=>{const status=panel.querySelector("[data-call-status]");try{let eligible=(hallState.members||[]).filter(m=>attendanceFor(m,slot)?.checked_in_at&&!m.asked);if(!eligible.length){const checked=(hallState.members||[]).filter(m=>attendanceFor(m,slot)?.checked_in_at);if(!checked.length)throw new Error("No checked-in seats available");await hallAction("reset_asked");await refreshHall();eligible=(hallState.members||[]).filter(m=>attendanceFor(m,slot)?.checked_in_at)}const chosen=eligible[Math.floor(Math.random()*eligible.length)];const result=await hallAction("call_seat_manual",{session_id:session.id,seat_number:chosen.seat_number});await refreshHall();await runSeatCall(session.id,result.seat_number,"toss")}catch(error){status.textContent=error.message||"No checked-in seats available"}});
  }else if(me){const opensAt=schedule?new Date(schedule.getTime()-10*60000):null,tooEarly=opensAt&&Date.now()<opensAt.getTime();if(room.is_locked)panel.innerHTML='<div class="scp-attendance-warning">This room is currently locked.</div>';else if(!mine&&tooEarly)panel.innerHTML=`<div class="scp-attendance-warning">Check-in opens 10 minutes before ${esc(scheduledText)}.</div>`;else if(!mine)panel.innerHTML=`<div class="scp-candidate-schedule">${esc(scheduledText)}${room.location_required?' · Faculty location required':' · Location not required'}</div><button id="scpCheckIn" class="scp-checkin-button" type="button">Check in to Room ${slot}</button>`;else if(!mine.checked_out_at)panel.innerHTML=`<div class="scp-checkin-success">✓ Checked in${mine.status==='orange'?' · Late arrival':''}</div><button id="scpCheckOut" class="scp-checkout-button" type="button" ${room.ended_at?'':'disabled'}>Check out</button><small>${room.ended_at?'The lecture has ended. You can safely check out now.':'Checkout opens after the Doctor ends the lecture.'}</small>`;else panel.innerHTML=`<div class="${mine.status==='green'?'scp-checkin-success':'scp-attendance-warning'}">${mine.status==='green'?'✓ Attendance completed':mine.status==='red'?'● Did not check in':'● Attendance needs review'}</div>`;
    panel.insertAdjacentHTML("beforeend",`<button class="scp-review-attendance-button" data-member-attendance-review type="button">Review my attendance status</button>`);panel.querySelector("[data-member-attendance-review]")?.addEventListener("click",()=>openAttendanceReview(session.id));$("scpCheckIn")?.addEventListener("click",async e=>{e.currentTarget.disabled=true;try{const pos=room.location_required?await browserLocation():{};await hallAction("check_in",{attendance_slot:slot,session_id:session.id,...pos});await refreshHall();renderAttendance(session)}catch(error){e.currentTarget.disabled=false;e.currentTarget.textContent=error.message||"Could not check in"}});$("scpCheckOut")?.addEventListener("click",async e=>{e.currentTarget.disabled=true;try{await hallAction("check_out",{session_id:session.id});await refreshHall();renderAttendance(session)}catch(error){e.currentTarget.disabled=false;e.currentTarget.textContent=error.message||"Could not check out"}})
  }else panel.innerHTML='<div class="scp-attendance-warning">Your theater seat is required before attendance can be recorded.</div>';
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
  $("scpRoomHelp").hidden = !!state.admin || !!roomState(id).ended_at || roomState(id).attendance_enabled===false;
  $("scpRepeatRequest").hidden = !!roomState(id).ended_at;
  $("scpQuestionStatus").textContent = "";
  $("scpQuestionText").value = "";
  const items = sessionItems(id).filter(item => state.admin || item.is_active);
  const itemCard=(item,index)=>{const info=typeInfo[item.item_type]||["•","Course item","Open"],ready=item.url&&item.url!=="#";if(item.item_type==="lecture"&&item.cover_image_url)return `<article class="scp-content-box has-cover" style="--box-delay:${180+index*70}ms;background-image:url(\'${esc(item.cover_image_url)}\')" aria-label="${esc(item.title)}">${ready?`<a class="scp-cover-play" href="${esc(item.url)}" target="_blank" rel="noopener" aria-label="Play ${esc(item.title)}"><span>▶</span></a>`:'<span class="scp-cover-coming">Coming soon</span>'}${state.admin?`<div class="scp-box-admin"><button type="button" data-edit-item="${item.id}">Edit</button><button type="button" data-delete-item="${item.id}">Delete</button></div>`:""}</article>`;return `<article class="scp-content-box" style="--box-delay:${180+index*70}ms"><span class="scp-box-icon">${info[0]}</span><div><small>${info[1]}</small><h3>${esc(item.title)}</h3>${item.subtitle?`<p>${esc(item.subtitle)}</p>`:""}</div>${ready?`<a href="${esc(item.url)}" target="_blank" rel="noopener">${info[2]} →</a>`:'<span class="scp-coming">Coming soon</span>'}${state.admin?`<div class="scp-box-admin"><button type="button" data-edit-item="${item.id}">Edit</button><button type="button" data-delete-item="${item.id}">Delete</button></div>`:""}</article>`};
  const videos=items.filter(item=>item.item_type==="lecture"),flashcards=items.filter(item=>item.item_type==="flashcards"),others=items.filter(item=>!["lecture","flashcards"].includes(item.item_type));
  const flashAlbum=`<details class="scp-flashcard-section"><summary><span>▣</span><strong>View flashcards</strong><small>${flashcards.length?`${flashcards.length} photo${flashcards.length===1?"":"s"}`:"Coming soon"}</small></summary>${flashcards.length?`<div class="scp-flashcard-album">${flashcards.map((item,index)=>`<button type="button" data-album-index="${index}"><img src="${esc(item.url||'assets/images/acl-header-mark.svg')}" alt="${esc(item.title)}" loading="lazy"><span>${esc(item.title||`Flashcard ${index+1}`)}</span>${state.admin?`<i data-edit-item="${item.id}">Edit</i>`:""}</button>`).join("")}</div>`:`<div class="scp-flashcard-empty">${state.admin?'<button id="scpAddFlashcards" type="button">+ Upload lecture flashcards</button>':'Lecture flashcards have not been uploaded yet.'}</div>`}</details>`;
  $("scpRoomItems").innerHTML=items.length?`${videos.length?`<details class="scp-video-section"><summary><span>▶</span><strong>Watch the videos</strong><small>${videos.length} video${videos.length===1?"":"s"}</small></summary><div class="scp-video-list">${videos.map(itemCard).join("")}</div></details>`:""}${flashAlbum}${others.map(itemCard).join("")}`:`<div class="scp-room-empty"><span>✦</span><strong>This room is ready.</strong><p>Course content will be added here.</p>${state.admin?'<button id="scpRoomAddItem" type="button">+ Add the first content box</button>':""}</div>`;
  bindFlashcardAlbum(flashcards);
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
  $("scpAddFlashcards")?.addEventListener("click",()=>{closeRoom();openItem(null,id);$("scpItemType").value="flashcards";updateItemPhotoFields();$("scpFlashcardPhotos").focus()});
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
  $("scpFlashcardPhotos").value = "";
  $("scpLectureCover").value = "";
  updateItemPhotoFields();
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

function updateItemPhotoFields(){const type=$("scpItemType")?.value,isFlash=type==="flashcards",isLecture=type==="lecture";$("scpFlashcardPhotosLabel").hidden=!isFlash;$("scpLectureCoverLabel").hidden=!isLecture;if(isFlash)$("scpItemUrl").placeholder="Upload photos below or paste an image link";else $("scpItemUrl").placeholder="https://..."}
$("scpItemType")?.addEventListener("change",updateItemPhotoFields);
let albumItems=[],albumIndex=0;function showAlbum(index){if(!albumItems.length)return;albumIndex=(index+albumItems.length)%albumItems.length;const item=albumItems[albumIndex];$("scpAlbumImage").src=item.url;$("scpAlbumImage").alt=item.title||`Flashcard ${albumIndex+1}`;$("scpAlbumTitle").textContent=item.title||`Flashcard ${albumIndex+1}`;$("scpAlbumCounter").textContent=`${albumIndex+1} / ${albumItems.length}`;$("scpAlbumModal").hidden=false}
function bindFlashcardAlbum(items){albumItems=items.filter(x=>x.url&&x.url!=="#");document.querySelectorAll("[data-album-index]").forEach(button=>button.addEventListener("click",event=>{if(event.target.closest("[data-edit-item]"))return;showAlbum(Number(button.dataset.albumIndex))}))}
$("scpAlbumClose")?.addEventListener("click",()=>$("scpAlbumModal").hidden=true);$("scpAlbumPrev")?.addEventListener("click",()=>showAlbum(albumIndex-1));$("scpAlbumNext")?.addEventListener("click",()=>showAlbum(albumIndex+1));$("scpAlbumModal")?.addEventListener("click",event=>{if(event.target===$("scpAlbumModal"))$("scpAlbumModal").hidden=true});

$("scpNewItem")?.addEventListener("click", () => openItem());
$("scpItemCancel")?.addEventListener("click", () => { $("scpItemForm").hidden = true; editingItem = null; });
$("scpItemForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const status = $("scpItemStatus");
  status.textContent = "Saving…";
  try {
    const files=[...($("scpFlashcardPhotos").files||[])],coverFile=$("scpLectureCover").files?.[0],baseOrder=Number($("scpItemOrder").value||1),itemTitle=$("scpItemTitle").value.trim(),common={session_id:$("scpItemSession").value,item_type:$("scpItemType").value,subtitle:$("scpItemSubtitle").value.trim(),is_active:$("scpItemActive").checked};
    if(files.length&&!editingItem){for(const [index,file] of files.entries()){status.textContent=`Uploading flashcard ${index+1} of ${files.length}…`;const url=await upload(file,"flashcard");await api("save_item",{...common,id:null,title:files.length>1?`${$("scpItemTitle").value.trim()||"Flashcard"} ${index+1}`:$("scpItemTitle").value.trim()||"Flashcard",url,display_order:baseOrder+index})}}else{let url=$("scpItemUrl").value.trim();if(files[0])url=await upload(files[0],"flashcard");await api("save_item",{...common,id:editingItem?.id||null,title:$("scpItemTitle").value.trim(),url,display_order:baseOrder})}
    if(coverFile&&common.item_type==="lecture"){status.textContent="Uploading lecture cover…";const cover_image_url=await upload(coverFile,"lecture-cover");await extrasApi("set_cover",{item_id:editingItem?.id||null,session_id:common.session_id,title:itemTitle,display_order:baseOrder,cover_image_url})}
    $("scpItemForm").hidden = true;
    editingItem = null;
    await load();
  } catch (error) { status.textContent = error.message || "Could not save the content box."; }
});

async function optimizeLectureCover(file){if(!file||!file.type.startsWith("image/"))return file;const bitmap=await createImageBitmap(file),maxWidth=1280,maxHeight=720,scale=Math.min(1,maxWidth/bitmap.width,maxHeight/bitmap.height),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext("2d",{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.82));return blob?new File([blob],"lecture-cover.webp",{type:"image/webp"}):file}

async function upload(file, kind) {
  if (!file) return null;
  if(kind==="lecture-cover")file=await optimizeLectureCover(file);
  const extension = (file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "");
  const path = `special-courses/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
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

$("scpRoomRefresh")?.addEventListener("click",async()=>{const roomId=activeSessionId;if(!roomId)return;const loaded=await Promise.all([api("get"),hallApi(),extrasApi("get")]);[state,hallState]=loaded;applyExtras(loaded[2]);preloadCourseImages();render();openRoom(roomId)});
$("scpRoomClose")?.addEventListener("click", closeRoom);
$("scpRoomModal")?.addEventListener("click", event => { if (event.target === $("scpRoomModal")) closeRoom(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("scpRoomModal").hidden) closeRoom(); });
$("scpSeatClose")?.addEventListener("click", () => { $("scpSeatCard").hidden = true; });
$("scpSeatCard")?.addEventListener("click", event => { if (event.target === $("scpSeatCard")) $("scpSeatCard").hidden = true; });
document.addEventListener("keydown", event => { if (event.key === "Escape") $("scpSeatCard").hidden = true; });
$("scpCallMember")?.addEventListener("click", async () => { if (!selectedHallMember) return; await hallAction("call_member",{seat_number:selectedHallMember.seat_number}); $("scpSeatCard").hidden=true; await refreshHall(); });
$("scpAwardStar")?.addEventListener("click", async () => { if (!selectedHallMember) return; await hallAction("award_star",{seat_number:selectedHallMember.seat_number}); await refreshHall(); const updated=(hallState.members||[]).find(m=>m.seat_number===selectedHallMember.seat_number); if(updated){selectedHallMember=updated;$("scpSeatStars").textContent=`${"★".repeat(Math.min(Number(updated.stars||0),10))}${Number(updated.stars||0)>10?` +${Number(updated.stars)-10}`:""}  ${updated.stars||0} star${Number(updated.stars)===1?"":"s"}`;} });
$("scpRemoveStar")?.addEventListener("click", async () => { if (!selectedHallMember) return; await hallAction("remove_star",{seat_number:selectedHallMember.seat_number}); await refreshHall(); const updated=(hallState.members||[]).find(m=>m.seat_number===selectedHallMember.seat_number); if(updated){selectedHallMember=updated;$("scpSeatStars").textContent=`${"★".repeat(Math.min(Number(updated.stars||0),10))}  ${updated.stars||0} star${Number(updated.stars)===1?"":"s"}`;} });
$("scpSuspendMember")?.addEventListener("click",async()=>{if(!selectedHallMember)return;if(selectedHallMember.suspended){if(!confirm(`Restore ${selectedHallMember.name}'s course access?`))return;await hallAction("restore_member",{seat_number:selectedHallMember.seat_number});$("scpSeatCard").hidden=true;await refreshHall();return;}$("scpSuspendForm").hidden=false;$("scpSuspendReason").focus();});
$("scpSuspendCancel")?.addEventListener("click",()=>{$("scpSuspendForm").hidden=true;$("scpSuspendStatus").textContent=""});
$("scpSuspendForm")?.addEventListener("submit",async event=>{event.preventDefault();if(!selectedHallMember)return;const reason=$("scpSuspendReason").value.trim(),status=$("scpSuspendStatus");if(!reason){status.textContent="Write the reason first.";return;}status.textContent="Suspending…";try{await hallAction("suspend_member",{seat_number:selectedHallMember.seat_number,reason});$("scpSeatCard").hidden=true;await refreshHall()}catch(error){status.textContent=error.message||"Could not suspend this member.";}});
$("scpResetAsked")?.addEventListener("click", async event => { event.preventDefault();event.stopPropagation();await hallAction("reset_asked");await refreshHall(); });
$("scpPrintCertificate")?.addEventListener("click", () => window.print());

async function renderCourseSuspension(suspension){
  const {data:review}=await supabaseClient.rpc("acl_course_suspension_review",{p_action:"my_state",p_module_id:courseId,p_args:{}});
  const overlay=document.createElement("div");overlay.className="scp-suspension-screen";
  overlay.innerHTML=`<article><span>!</span><h1>Course access suspended</h1><div class="reason">${esc(suspension?.reason||"Your course access is under review.")}</div>${review?.admin_reply?`<div class="scp-suspension-alert"><b>Review decision</b><p>${esc(review.admin_reply)}</p></div>`:""}<p>Request a review if you believe this decision should be reconsidered.</p>${review?.request_text&&!review?.admin_reply?`<div class="scp-suspension-waiting">Review requested · waiting for the administrator</div>`:`<form id="scpSuspensionReviewForm"><textarea rows="3" maxlength="1000" placeholder="Explain your request…" required></textarea><button type="submit">Request a review</button><small></small></form>`}<div class="scp-suspension-links"><a href="basic-modules.html?edition=basic">← Back to modules</a><a href="https://wa.me/201093938488" target="_blank" rel="noopener">Contact ACL on WhatsApp</a></div></article>`;
  document.body.appendChild(overlay);overlay.querySelector("form")?.addEventListener("submit",async e=>{e.preventDefault();const text=e.currentTarget.querySelector("textarea").value.trim(),status=e.currentTarget.querySelector("small");status.textContent="Sending…";const {error}=await supabaseClient.rpc("acl_course_suspension_review",{p_action:"request",p_module_id:courseId,p_args:{text}});if(error){status.textContent=error.message;return}location.reload()});
}

async function load() {
  if (!courseId) throw new Error("Course link is incomplete.");
  const loaded=await Promise.all([api("get"),hallApi(),extrasApi("get")]);[state,hallState]=loaded;applyExtras(loaded[2]);preloadCourseImages();
  if(hallState?.suspension){await renderCourseSuspension(hallState.suspension);return;}
  render();
  const requestedRoom=new URLSearchParams(location.search).get("room");
  if(requestedRoom&&sessions().some(room=>room.id===requestedRoom))setTimeout(()=>{openRoom(requestedRoom);const params=new URLSearchParams(location.search);if(params.get("attendance")==="1"&&roomState(requestedRoom).attendance_enabled!==false)setTimeout(()=>openAttendanceReview(requestedRoom),180);params.delete("attendance");params.delete("checker");params.delete("room");history.replaceState(null,"",location.pathname+"?"+params.toString())},120);
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
$("scpRepeatRequest")?.addEventListener("click",async event=>{if(!activeSessionId)return;const session=sessions().find(x=>x.id===activeSessionId),button=event.currentTarget;if(roomState(activeSessionId).ended_at){button.hidden=true;$("scpQuestionStatus").textContent="The lecture has ended.";return;}button.disabled=true;button.textContent="Sending…";try{const result=await hallAction("request_repeat",{session_id:activeSessionId,session_number:session?.session_number});void sendHelpPush(result?.request_id);button.textContent="✓ Request sent";$("scpQuestionStatus").textContent="The Doctor has been notified.";setTimeout(()=>{button.disabled=false;button.textContent="Please repeat — I don’t understand";$("scpQuestionStatus").textContent=""},3500)}catch(error){button.disabled=false;button.textContent="Please repeat — I don’t understand";$("scpQuestionStatus").textContent=error.message||"Could not send the request.";}});
$("scpQuestionForm")?.addEventListener("submit",async event=>{event.preventDefault();if(!activeSessionId)return;const text=$("scpQuestionText").value.trim(),session=sessions().find(x=>x.id===activeSessionId),button=event.currentTarget.querySelector("button");if(!text)return;button.disabled=true;button.textContent="Sending…";try{const result=await hallAction("submit_question",{session_id:activeSessionId,session_number:session?.session_number,question:text});void sendHelpPush(result?.request_id);$("scpQuestionText").value="";$("scpQuestionStatus").textContent="✓ Your question was sent to the Doctor.";button.textContent="Sent";}catch(error){button.disabled=false;button.textContent="Submit question";$("scpQuestionStatus").textContent=error.message||"Could not submit your question.";}});

/* Live voting inside special-course rooms */
let courseVoteState=null,courseVoteRoom=null,voteModalManual=false,lastVoteSignal="",lastVoteOpenKey="",votePollBusy=false;
const voteLetters="ABCDEFGHIJ";
async function voteApi(action,args={}){const {data,error}=await supabaseClient.rpc("acl_course_vote_action",{p_action:action,p_module_id:courseId,p_session_id:courseVoteRoom||activeSessionId,p_args:args});if(error)throw error;return data}
async function getVoteState(roomId=activeSessionId){if(!roomId)return null;const {data,error}=await supabaseClient.rpc("acl_course_vote_state",{p_module_id:courseId,p_session_id:roomId});if(error)throw error;return data}
function voteShell(open=true){const modal=$("scpVoteModal");if(!modal)return null;if(open){modal.hidden=false;document.body.classList.add("scp-modal-open")}return $("scpVoteContent")}
function voteOptionsPreset(name){if(name==="understand")return["I understand","I do not understand"];if(name==="yesno")return["Yes","No","I don’t know"];if(name==="abcde")return["A","B","C","D","E"];return["",""]}
function voteEditor(options=["",""]){return `<div id="scpVoteOptionEditors">${options.map((x,i)=>`<div class="scp-vote-option-editor"><b>${voteLetters[i]}</b><input type="text" value="${esc(x)}" maxlength="160" placeholder="Choice ${voteLetters[i]}" required><button type="button" data-remove-vote-option aria-label="Remove">×</button></div>`).join("")}</div>`}
function bindVoteEditor(){const box=$("scpVoteOptionEditors");if(!box)return;box.querySelectorAll("[data-remove-vote-option]").forEach(b=>b.onclick=()=>{if(box.children.length<=2)return;b.parentElement.remove();renumberVoteOptions()})}
function renumberVoteOptions(){document.querySelectorAll("#scpVoteOptionEditors .scp-vote-option-editor").forEach((row,i)=>row.querySelector("b").textContent=voteLetters[i])}
function renderVoteCreate(){const host=voteShell();host.innerHTML=`<span class="scp-vote-kicker">ACL LIVE VOTING</span><h2 id="scpVoteModalTitle">Start a new vote</h2><p>Choose a ready format or write your own choices. You can keep it as a questionnaire or mark one or more correct answers.</p><form id="scpVoteCreateForm" class="scp-vote-form"><label><span>Voting type</span><select id="scpVotePreset"><option value="custom">Custom choices</option><option value="understand">I understand / I do not understand</option><option value="yesno">Yes / No / I don’t know</option><option value="abcde">A / B / C / D / E</option></select></label><label><span>Question or statement</span><input id="scpVoteQuestion" type="text" maxlength="500" placeholder="Ask the room…" required></label><div><span class="scp-vote-options-label">Choices</span>${voteEditor()}</div><div class="scp-vote-form-actions"><button id="scpVoteAddChoice" class="secondary" type="button">+ Add choice</button></div><label class="scp-vote-check"><input id="scpVoteMultiple" type="checkbox"> Allow more than one choice</label><label><span>Correct answer · optional</span><select id="scpVoteCorrect"><option value="">Questionnaire — no correct answer</option></select></label><div class="scp-vote-form-actions"><button type="submit">Start voting & notify members</button>${courseVoteState?.vote?'<button id="scpVoteBackCurrent" class="secondary" type="button">Back to current vote</button>':''}</div><small id="scpVoteFormStatus" aria-live="polite"></small></form>`;bindVoteEditor();refreshCorrectOptions();
 $("scpVotePreset").onchange=e=>{$("scpVoteOptionEditors").outerHTML=voteEditor(voteOptionsPreset(e.target.value));bindVoteEditor();refreshCorrectOptions()};
 $("scpVoteAddChoice").onclick=()=>{const box=$("scpVoteOptionEditors");if(box.children.length>=10)return;box.insertAdjacentHTML("beforeend",voteEditor([""]).match(/<div id="scpVoteOptionEditors">([\s\S]*)<\/div>/)[1]);bindVoteEditor();renumberVoteOptions();refreshCorrectOptions()};
 $("scpVoteOptionEditors").addEventListener("input",refreshCorrectOptions);$("scpVoteBackCurrent")?.addEventListener("click",()=>renderVoteState(courseVoteState));
 $("scpVoteCreateForm").onsubmit=async e=>{e.preventDefault();const status=$("scpVoteFormStatus"),options=[...document.querySelectorAll("#scpVoteOptionEditors input")].map(x=>x.value.trim()).filter(Boolean),correct=$("scpVoteCorrect").value;status.textContent="Starting live vote…";try{const result=await voteApi("create",{question:$("scpVoteQuestion").value.trim(),options,allow_multiple:$("scpVoteMultiple").checked,correct_options:correct===""?[]:[Number(correct)]});void sendVotePush(result.vote_id);courseVoteState=await getVoteState(courseVoteRoom);renderVoteState(courseVoteState)}catch(error){status.textContent=error.message||"Could not start voting."}};
}
function refreshCorrectOptions(){const select=$("scpVoteCorrect");if(!select)return;const old=select.value,opts=[...document.querySelectorAll("#scpVoteOptionEditors input")].map((x,i)=>({i,label:x.value.trim()||`Choice ${voteLetters[i]}`}));select.innerHTML='<option value="">Questionnaire — no correct answer</option>'+opts.map(o=>`<option value="${o.i}">${voteLetters[o.i]} · ${esc(o.label)}</option>`).join("");select.value=old}
function voteBars(vote){return `<div class="scp-vote-total"><span>${Number(vote.total_responses||0)} responses</span><span>${vote.status==='open'?'<i class="scp-vote-live-dot"></i>Voting live':'Voting closed'}</span></div><div class="scp-vote-results">${(vote.counts||[]).map(row=>`<div class="scp-vote-result-row ${(vote.correct_options||[]).map(Number).includes(Number(row.index))?'correct':''}"><span>${voteLetters[row.index]} · ${esc(row.label)}</span><b>${row.count} · ${row.percent}%</b><div class="scp-vote-bar"><i data-vote-width="${Math.max(0,Math.min(100,Number(row.percent)||0))}"></i></div></div>`).join("")}</div>`}
function animateVoteBars(){requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelectorAll("[data-vote-width]").forEach(bar=>bar.style.width=bar.dataset.voteWidth+"%")))}
function renderVoteState(data){courseVoteState=data||{};const host=voteShell();const vote=data?.vote;if(!vote){if(data?.admin)renderVoteCreate();else{host.innerHTML='<span class="scp-vote-kicker">ACL LIVE VOTING</span><h2 id="scpVoteModalTitle">No vote is open</h2><p>The next live question will appear here automatically.</p>'}return}
 const options=vote.options||[],inputType=vote.allow_multiple?"checkbox":"radio";
 if(data.admin){const first=(vote.first_ten||[]).map((r,i)=>`<li><b>${i+1}. ${esc(r.name)}</b>${r.seat_number?` · Seat ${String(r.seat_number).padStart(3,"0")}`:""} · ${(r.selected||[]).map(x=>voteLetters[Number(x)]).join(", ")}</li>`).join("");const history=(data.history||[]).map(h=>`<article><strong>${esc(h.question)}</strong><small>${h.responses} responses · ${h.status}</small><button data-vote-history="${h.id}">View results</button></article>`).join("");host.innerHTML=`<span class="scp-vote-kicker">ADMIN · LIVE VOTING</span><h2 id="scpVoteModalTitle">${esc(vote.question)}</h2>${voteBars(vote)}<div class="scp-vote-admin-actions">${vote.status==='open'?`<button data-vote-act="${vote.results_visible?'hide_results':'show_results'}">${vote.results_visible?'Hide results from members':'Show live results to members'}</button><button class="danger" data-vote-act="stop_show">Stop & show final result</button><button class="secondary" data-vote-act="stop_save">Stop & save privately</button>`:`<button data-vote-act="${vote.results_visible?'hide_results':'show_results'}">${vote.results_visible?'Hide results':'Show results to members'}</button>`}<button id="scpVoteNew" class="secondary">+ New vote</button></div><section class="scp-vote-first"><h3>First 10 responses</h3>${first?`<ol>${first}</ol>`:'<p>No responses yet.</p>'}</section><section class="scp-vote-history"><h3>Saved voting history</h3>${history||'<p>No earlier votes in this room.</p>'}</section>`;
  host.querySelectorAll("[data-vote-act]").forEach(b=>b.onclick=async()=>{b.disabled=true;await voteApi(b.dataset.voteAct,{vote_id:vote.id});courseVoteState=await getVoteState(courseVoteRoom);renderVoteState(courseVoteState)});$("scpVoteNew").onclick=renderVoteCreate;host.querySelectorAll("[data-vote-history]").forEach(b=>b.onclick=async()=>{await voteApi("reopen",{vote_id:b.dataset.voteHistory});courseVoteState=await getVoteState(courseVoteRoom);renderVoteState(courseVoteState)});animateVoteBars();return}
 const canAnswer=vote.status==="open";host.innerHTML=`<span class="scp-vote-kicker">${canAnswer?'<i class="scp-vote-live-dot"></i>LIVE VOTE':'VOTING RESULT'}</span><h2 id="scpVoteModalTitle">${esc(vote.question)}</h2>${canAnswer?`<form id="scpVoteAnswerForm"><div class="scp-vote-choice-grid">${options.map((o,i)=>`<label class="scp-vote-choice"><input type="${inputType}" name="courseVoteChoice" value="${i}" ${(vote.my_selected||[]).map(Number).includes(i)?'checked':''}><b>${voteLetters[i]}</b><span>${esc(o)}</span></label>`).join("")}</div><button class="scp-vote-submit" type="submit">${vote.has_voted?'Update my vote':'Submit my vote'}</button><p id="scpVoteAnswerStatus"></p></form>`:'<div class="scp-vote-status">Voting has ended.</div>'}${vote.results_visible?voteBars(vote):vote.has_voted?'<div class="scp-vote-status">✓ Your vote was recorded. Results are currently hidden.</div>':''}`;
 $("scpVoteAnswerForm")?.addEventListener("submit",async e=>{e.preventDefault();const selected=[...e.currentTarget.querySelectorAll("input:checked")].map(x=>Number(x.value)),status=$("scpVoteAnswerStatus");if(!selected.length){status.textContent="Choose an answer first.";return}try{await voteApi("submit",{vote_id:vote.id,selected});courseVoteState=await getVoteState(courseVoteRoom);renderVoteState(courseVoteState)}catch(error){status.textContent=error.message||"Could not submit your vote."}});animateVoteBars();
}
async function openVoteManager(roomId){courseVoteRoom=roomId;voteModalManual=true;try{courseVoteState=await getVoteState(roomId);renderVoteState(courseVoteState)}catch(error){const host=voteShell();host.innerHTML=`<h2 id="scpVoteModalTitle">Voting unavailable</h2><p>${esc(error.message||"Could not load voting.")}</p>`}}
async function pollCourseVote(){if(votePollBusy||!activeSessionId||$("scpRoomModal").hidden)return;votePollBusy=true;try{const data=await getVoteState(activeSessionId),vote=data?.vote,signal=vote?`${vote.id}:${vote.status}:${vote.results_visible}:${vote.total_responses}`:"";courseVoteState=data;courseVoteRoom=activeSessionId;if(data.admin){if(!$("scpVoteModal").hidden&&voteModalManual&&signal!==lastVoteSignal)renderVoteState(data)}else if(vote){const mustOpen=(vote.status==="open"&&!vote.has_voted)||vote.results_visible,openKey=`${vote.id}:${vote.status}:${vote.results_visible}`;if(mustOpen&&!$("scpVoteModal").hidden&&signal!==lastVoteSignal){renderVoteState(data)}else if(mustOpen&&openKey!==lastVoteOpenKey){voteModalManual=false;lastVoteOpenKey=openKey;renderVoteState(data)}}lastVoteSignal=signal}catch{}finally{votePollBusy=false}}
setInterval(()=>void pollCourseVote(),1500);
$("scpVoteClose")?.addEventListener("click",()=>{$("scpVoteModal").hidden=true;voteModalManual=false;document.body.classList.remove("scp-modal-open")});
$("scpVoteModal")?.addEventListener("click",e=>{if(e.target===$("scpVoteModal"))$("scpVoteClose").click()});
async function sendVotePush(voteId){if(!voteId)return;try{await supabaseClient.functions.invoke("send-course-vote-push",{body:{vote_id:voteId}})}catch(error){console.warn("Vote notification failed",error)}}

/* Published attendance report, review requests and five-question checker */
let arRoomId=null,arState=null,arIntegrityActive=false,arIntegrityFailed=false;
async function arApi(action,args={}){const {data,error}=await supabaseClient.rpc("acl_attendance_review_action",{p_action:action,p_module_id:courseId,p_session_id:arRoomId||activeSessionId,p_args:args});if(error)throw error;return data}
async function arLoad(roomId=arRoomId||activeSessionId){const [{data,error},{data:decisions},{data:suspensionReviews}]=await Promise.all([supabaseClient.rpc("acl_attendance_review_state",{p_module_id:courseId,p_session_id:roomId}),supabaseClient.rpc("acl_checker_review_decisions",{p_module_id:courseId,p_session_id:roomId}),supabaseClient.rpc("acl_course_suspension_review",{p_action:"list",p_module_id:courseId,p_args:{}})]);if(error)throw error;if(data?.admin&&Array.isArray(data.attempts)){const byUser=new Map((decisions||[]).map(x=>[x.user_id,x]));data.attempts=data.attempts.map(x=>({...x,...(byUser.get(x.user_id)||{})}));data.suspension_reviews=suspensionReviews||[]}return data}
const arLabel=value=>({on_time:"On time",not_on_time:"Not on time",not_checked_in:"Not checked in",not_checked_out:"Not checked out",green:"Complete",orange:"Needs review",red:"Absent"}[value]||value||"—");
function arOpenShell(){const m=$("scpAttendanceReviewModal");m.hidden=false;document.body.classList.add("scp-modal-open");return $("scpArContent")}
async function openAttendanceReview(roomId){arRoomId=roomId;const host=arOpenShell();host.innerHTML='<h2 id="scpArTitle">Loading attendance report…</h2>';try{arState=await arLoad(roomId);renderAttendanceReview();if(!arState?.admin&&new URLSearchParams(location.search).get("checker")==="1"&&arState?.request?.checker_invited&&!arState?.attempt){setTimeout(()=>{$("scpArStartQuiz")?.scrollIntoView({behavior:"smooth",block:"center"});$("scpArStartQuiz")?.focus()},120)}}catch(e){host.innerHTML=`<h2 id="scpArTitle">Attendance review unavailable</h2><p>${esc(e.message||"Could not load attendance.")}</p>`}}
function arBadge(value){return `<span class="scp-ar-badge ${esc(value)}">${esc(arLabel(value))}</span>`}
function renderAttendanceReview(){if(arState?.admin)renderAdminAttendanceReview();else renderMemberAttendanceReview()}
function arAttemptCard(a){return `<article class="scp-ar-attempt-row"><div><b>Seat ${String(a.seat_number||0).padStart(3,"0")}</b><strong>${esc(a.name)}</strong><span class="scp-ar-attempt-score ${a.status||'waiting'}">${a.score==null?(a.status==='started'?'In progress':'Not taken'):`${a.score}/5`} ${a.status?`· ${esc(a.status)}`:''}</span>${a.fail_reason?`<small>${esc(a.fail_reason)}</small>`:''}</div><div class="scp-ar-manual-actions"><label>Attendance <select data-ar-status data-seat="${a.seat_number}"><option value="green" ${a.attendance_status==='green'?'selected':''}>Green</option><option value="orange" ${a.attendance_status==='orange'?'selected':''}>Orange</option><option value="red" ${a.attendance_status==='red'?'selected':''}>Red</option></select></label><button data-ar-save-status data-seat="${a.seat_number}">Apply status</button><button class="danger" data-ar-suspend data-seat="${a.seat_number}" data-suspended="${a.suspended?'1':'0'}">${a.suspended?'Restore course access':'Suspend from course'}</button></div></article>`}
function arResultSection(title,items,tone,open=false){return `<details class="scp-ar-result-group ${tone}" ${open?'open':''}><summary><span>${esc(title)}</span><b>${items.length}</b></summary><div>${items.length?items.map(arAttemptCard).join(''):'<p>No members in this section.</p>'}</div></details>`}
function renderAdminAttendanceReview(){const host=arOpenShell(),rows=arState.report||[],requests=arState.requests||[],attempts=arState.attempts||[],quiz=arState.quiz||{},attemptByUser=new Map(attempts.map(a=>[a.user_id,a])),actionableRequests=requests.filter(r=>!attemptByUser.has(r.user_id)),passed=attempts.filter(a=>a.status==='passed'),failed=attempts.filter(a=>a.status==='failed'&&!a.reviewed_status),afterReview=attempts.filter(a=>!!a.reviewed_status),notTaken=requests.filter(r=>r.checker_invited&&!attemptByUser.has(r.user_id)).map(r=>{const row=rows.find(x=>x.user_id===r.user_id)||{};return{...r,name:r.name,seat_number:r.seat_number,attendance_status:row.overall_status,status:null,suspended:false}}),started=attempts.filter(a=>a.status==='started');host.innerHTML=`<span class="scp-ar-kicker">ADMIN · ROOM ATTENDANCE</span><h2 id="scpArTitle">Attendance report</h2><div class="scp-ar-actions"><button id="scpArPublish">Send report to members</button><button id="scpArEditQuiz" class="secondary">Edit 5-question attendance checker</button><button id="scpArToggleQuiz" class="secondary">${quiz.is_open?'Close checker':'Open checker for reviewers'}</button></div><div class="scp-ar-report"><div class="scp-ar-row header"><span>SEAT</span><span>MEMBER</span><span>CHECK IN</span><span>CHECK OUT</span><span>STATUS</span></div>${rows.map(r=>`<div class="scp-ar-row"><b>${String(r.seat_number).padStart(3,"0")}</b><strong>${esc(r.name)}</strong>${arBadge(r.checkin_status)}${arBadge(r.checkout_status)}${arBadge(r.overall_status)}</div>`).join("")}</div><section class="scp-ar-requests"><h3>Attendance review requests</h3><form id="scpArGroup" class="scp-ar-group"><textarea rows="2" placeholder="Write one message to all members waiting for review…"></textarea><button>Send group reply</button></form>${actionableRequests.length?actionableRequests.map(r=>`<article class="scp-ar-request-row"><div><h4>Seat ${String(r.seat_number||0).padStart(3,"0")} · ${esc(r.name)}</h4><p>${esc(r.text)}</p><small>${r.status}${r.reply?` · Replied: ${esc(r.reply)}`:""}</small></div><form class="scp-ar-reply" data-request-id="${r.id}"><textarea rows="2" placeholder="Reply to this member…">${esc(r.reply||"")}</textarea><div><button>Send reply</button>${!attemptByUser.has(r.user_id)?`<button class="checker" type="button" data-ar-invite="${r.id}">Reply & invite to checker</button>`:''}</div></form></article>`).join(""):'<p>No review requests yet.</p>'}</section><section class="scp-ar-suspension-reviews"><h3>Suspension review requests</h3>${(arState.suspension_reviews||[]).length?(arState.suspension_reviews||[]).map(x=>`<article><div><strong>${esc(x.name)}</strong><p>${esc(x.request_text)}</p>${x.admin_reply?`<small>Sent: ${esc(x.admin_reply)}</small>`:""}</div><button data-suspension-reply="${x.user_id}">${x.admin_reply?"Update reply":"Send decision"}</button></article>`).join(""):"<p>No suspension review requests.</p>"}</section><section class="scp-ar-attempts"><h3>Attendance checker follow-up</h3><p class="scp-ar-help">Open a section only when you need it. Passed candidates need no reply.</p>${arResultSection('Passed — no reply needed',passed,'passed')}${arResultSection('Failed checker',failed,'failed',failed.length>0)}${arResultSection('After admin review',afterReview,'reviewed')}${arResultSection('Not taken yet',notTaken,'waiting',notTaken.length>0)}${started.length?arResultSection('Checker in progress',started,'progress'):''}</section><section id="scpArQuizEditor" class="scp-ar-quiz-editor" hidden></section><p id="scpArAdminStatus"></p>`;
 $("scpArPublish").onclick=async()=>{if(!confirm("Publish this attendance report and notify all members?"))return;const st=$("scpArAdminStatus");st.textContent="Publishing…";try{await arApi("publish_report");void sendAttendancePush("published");arState=await arLoad();renderAdminAttendanceReview()}catch(e){st.textContent=e.message||"Could not publish report."}};
 $("scpArToggleQuiz").onclick=async()=>{if(!quiz.questions||quiz.questions.length!==5){alert("Create and save the five questions first.");renderArQuizEditor();return}await arApi("set_quiz_open",{is_open:!quiz.is_open});if(!quiz.is_open)void sendAttendancePush("quiz_open");arState=await arLoad();renderAdminAttendanceReview()};
 $("scpArEditQuiz").onclick=renderArQuizEditor;
 $("scpArGroup").onsubmit=async e=>{e.preventDefault();const text=e.currentTarget.querySelector("textarea").value.trim();if(!text)return;await arApi("group_reply",{text});void sendAttendancePush("group_reply");arState=await arLoad();renderAdminAttendanceReview()};
 host.querySelectorAll(".scp-ar-reply").forEach(f=>f.onsubmit=async e=>{e.preventDefault();const text=f.querySelector("textarea").value.trim();if(!text)return;await arApi("reply",{request_id:f.dataset.requestId,text});void sendAttendancePush("reply",f.dataset.requestId);arState=await arLoad();renderAdminAttendanceReview()});
 host.querySelectorAll("[data-ar-invite]").forEach(b=>b.onclick=async()=>{if(!quiz.questions||quiz.questions.length!==5){alert("Create and save the five checker questions first.");renderArQuizEditor();return}b.disabled=true;try{if(!quiz.is_open)await arApi("set_quiz_open",{is_open:true});const text="Your attendance review has been accepted for checking. Select Start attendance checker to take the five-question quiz.";await arApi("invite_checker",{request_id:b.dataset.arInvite,text});void sendAttendancePush("reply",b.dataset.arInvite);arState=await arLoad();renderAdminAttendanceReview()}catch(e){alert(e.message||"Could not send the checker invitation.");b.disabled=false}});
 host.querySelectorAll("[data-suspension-reply]").forEach(b=>b.onclick=async()=>{const text=prompt("Write your review decision. The member will receive a yellow alert:","")?.trim();if(!text)return;b.disabled=true;await supabaseClient.rpc("acl_course_suspension_review",{p_action:"reply",p_module_id:courseId,p_args:{user_id:b.dataset.suspensionReply,text}});arState=await arLoad();renderAdminAttendanceReview()});
 host.querySelectorAll("[data-ar-save-status]").forEach(b=>b.onclick=async()=>{const seat=Number(b.dataset.seat),select=host.querySelector(`[data-ar-status][data-seat="${seat}"]`);b.disabled=true;try{await hallAction("set_attendance_status",{seat_number:seat,attendance_slot:Number(sessions().find(x=>x.id===arRoomId)?.session_number),status:select.value});await supabaseClient.rpc("acl_finalize_checker_review",{p_module_id:courseId,p_session_id:arRoomId,p_seat_number:seat,p_status:select.value});arState=await arLoad();await refreshHall();renderAdminAttendanceReview()}catch(e){alert(e.message||"Could not change attendance status.");b.disabled=false}});
 host.querySelectorAll("[data-ar-suspend]").forEach(b=>b.onclick=async()=>{const seat=Number(b.dataset.seat),restoring=b.dataset.suspended==="1";let reason="";if(!restoring){reason=prompt("Write the reason for suspending this member from the course:","")?.trim()||"";if(!reason)return}if(!confirm(restoring?"Restore this member's course access?":"Suspend this member from the course?"))return;b.disabled=true;try{await hallAction(restoring?"restore_member":"suspend_member",restoring?{seat_number:seat}:{seat_number:seat,reason});arState=await arLoad();await refreshHall();renderAdminAttendanceReview()}catch(e){alert(e.message||"Could not update course access.");b.disabled=false}});
}
function emptyArQuestion(i){return{type:i===4?"tf":"mcq",stem:"",image_url:"",choices:i===4?[{text:"True",image_url:""},{text:"False",image_url:""}]:Array.from({length:4},(_,j)=>({text:"",image_url:""})),correct_index:0}}
function renderArQuizEditor(){const box=$("scpArQuizEditor");if(!box)return;box.hidden=false;const existing=Array.isArray(arState.quiz?.questions)?arState.quiz.questions:[],questions=Array.from({length:5},(_,i)=>existing[i]||emptyArQuestion(i));box.innerHTML=`<h3>Attendance checker · exactly 5 questions</h3><p>Each question and each choice may include a photograph.</p><form id="scpArQuizForm">${questions.map((q,i)=>arQuestionEditor(q,i)).join("")}<div class="scp-ar-actions"><button>Save checker</button></div><p id="scpArQuizSaveStatus"></p></form>`;box.scrollIntoView({behavior:"smooth",block:"start"});box.querySelectorAll("[data-ar-type]").forEach(s=>s.onchange=()=>{const wrap=s.closest(".scp-ar-question-editor"),i=Number(wrap.dataset.q);if(s.value==="tf"){wrap.querySelector("[data-ar-choices]").innerHTML=arChoiceEditors([{text:"True",image_url:""},{text:"False",image_url:""}],i);refreshArCorrect(wrap)} });box.querySelectorAll("[data-ar-choice-text]").forEach(x=>x.oninput=()=>refreshArCorrect(x.closest(".scp-ar-question-editor")));$("scpArQuizForm").onsubmit=saveArQuiz}
function arQuestionEditor(q,i){return `<section class="scp-ar-question-editor" data-q="${i}"><header><b>Q${i+1}</b><select data-ar-type><option value="mcq" ${q.type==='mcq'?'selected':''}>MCQ</option><option value="tf" ${q.type==='tf'?'selected':''}>True / False</option></select></header><input data-ar-stem type="text" value="${esc(q.stem||"")}" placeholder="Question" required><input data-ar-stem-file type="file" accept="image/*">${q.image_url?`<img data-existing-stem="${esc(q.image_url)}" src="${esc(q.image_url)}" alt="">`:''}<div data-ar-choices>${arChoiceEditors(q.choices||[],i)}</div><label><span>Correct answer</span><select data-ar-correct>${(q.choices||[]).map((c,j)=>`<option value="${j}" ${Number(q.correct_index)===j?'selected':''}>${voteLetters[j]} · ${esc(c.text||`Choice ${j+1}`)}</option>`).join("")}</select></label></section>`}
function arChoiceEditors(choices,qi){return choices.map((c,j)=>`<div class="scp-ar-choice-edit"><span>${voteLetters[j]}</span><input data-ar-choice-text type="text" value="${esc(c.text||"")}" placeholder="Choice ${voteLetters[j]}" required><input data-ar-choice-file type="file" accept="image/*">${c.image_url?`<img data-existing-choice="${esc(c.image_url)}" src="${esc(c.image_url)}" alt="">`:''}</div>`).join("")}
function refreshArCorrect(wrap){const sel=wrap.querySelector("[data-ar-correct]"),old=sel.value,choices=[...wrap.querySelectorAll("[data-ar-choice-text]")];sel.innerHTML=choices.map((c,i)=>`<option value="${i}">${voteLetters[i]} · ${esc(c.value||`Choice ${i+1}`)}</option>`).join("");sel.value=old||"0"}
async function uploadArImage(file,label){if(!file)return"";const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"");const path=`special-courses/attendance-${Date.now()}-${crypto.randomUUID()}-${label}.${ext}`;const {error}=await supabaseClient.storage.from("acl-news").upload(path,file,{contentType:file.type||"image/jpeg"});if(error)throw error;return supabaseClient.storage.from("acl-news").getPublicUrl(path).data.publicUrl}
async function saveArQuiz(e){e.preventDefault();const status=$("scpArQuizSaveStatus");status.textContent="Uploading and saving…";try{const questions=[];for(const wrap of document.querySelectorAll(".scp-ar-question-editor")){const qi=Number(wrap.dataset.q),stemFile=wrap.querySelector("[data-ar-stem-file]").files?.[0],stemUrl=stemFile?await uploadArImage(stemFile,`q${qi+1}`):wrap.querySelector("[data-existing-stem]")?.dataset.existingStem||"",choices=[];for(const [j,row] of [...wrap.querySelectorAll(".scp-ar-choice-edit")].entries()){const file=row.querySelector("[data-ar-choice-file]").files?.[0],url=file?await uploadArImage(file,`q${qi+1}-${voteLetters[j]}`):row.querySelector("[data-existing-choice]")?.dataset.existingChoice||"";choices.push({text:row.querySelector("[data-ar-choice-text]").value.trim(),image_url:url})}questions.push({type:wrap.querySelector("[data-ar-type]").value,stem:wrap.querySelector("[data-ar-stem]").value.trim(),image_url:stemUrl,choices,correct_index:Number(wrap.querySelector("[data-ar-correct]").value)})}await arApi("save_quiz",{questions,is_open:!!arState.quiz?.is_open});arState=await arLoad();renderAdminAttendanceReview();status.textContent="Saved."}catch(e){status.textContent=e.message||"Could not save checker."}}
function renderMemberAttendanceReview(){const host=arOpenShell(),p=arState.publication,r=arState.request,a=arState.attempt,q=arState.quiz;if(!p){host.innerHTML='<span class="scp-ar-kicker">MY ATTENDANCE</span><h2 id="scpArTitle">Attendance report pending</h2><p>Your room attendance status has not been published yet.</p>';return}host.innerHTML=`<span class="scp-ar-kicker">MY ATTENDANCE · ROOM ${p.session_number}</span><h2 id="scpArTitle">Review my attendance status</h2><section class="scp-ar-card"><div class="scp-ar-status-grid"><div><span>Check in</span><strong>${arBadge(p.checkin_status)}</strong></div><div><span>Check out</span><strong>${arBadge(p.checkout_status)}</strong></div><div><span>Final status</span><strong>${arBadge(p.overall_status)}</strong></div></div>${r?`<div class="scp-ar-status"><b>Your review request</b><p>${esc(r.request_text)}</p>${r.admin_reply?`<div class="scp-ar-result pass"><small>Reply from the Academic Director</small><br>${esc(r.admin_reply)}</div>`:'<p>Waiting for review.</p>'}</div>`:`<form id="scpArRequestForm" class="scp-ar-request"><textarea rows="4" maxlength="1500" placeholder="Explain why you want your attendance status reviewed…" required></textarea><button>Ask for review</button><p id="scpArRequestStatus"></p></form>`}</section>${renderArMemberQuiz(q,a,r)}`;
 $("scpArRequestForm")?.addEventListener("submit",async e=>{e.preventDefault();const text=e.currentTarget.querySelector("textarea").value.trim(),st=$("scpArRequestStatus");try{await arApi("request_review",{text});void sendAttendancePush("review_request");arState=await arLoad();renderMemberAttendanceReview();setTimeout(()=>{$("scpArStartQuiz")?.scrollIntoView({behavior:"smooth",block:"center"});$("scpArStartQuiz")?.focus()},120)}catch(err){st.textContent=err.message||"Could not send request."}});$("scpArStartQuiz")?.addEventListener("click",startArQuiz);$("scpArQuizAnswers")?.addEventListener("submit",submitArQuiz)}
function renderArMemberQuiz(q,a,r){if(!r)return"";if(a?.status==='passed')return `<div class="scp-ar-result pass">✓ Attendance checker passed · ${a.score}/5<br>Your attendance status is now green.</div>`;if(a?.status==='failed')return `<div class="scp-ar-result fail">Attendance checker failed${a.score!=null?` · ${a.score}/5`:''}${a.fail_reason?`<br>${esc(a.fail_reason)}`:''}</div>`;if(!r?.checker_invited)return '<div class="scp-ar-card scp-ar-waiting"><h3>Request sent</h3><p>Your request was received. The attendance checker will open here immediately.</p></div>';if(!q?.is_open)return '<p>Your checker invitation is ready, but the checker is currently closed.</p>';if(a?.status!=='started')return '<div class="scp-ar-card scp-ar-invitation"><h3>You are invited to the attendance checker</h3><p>Five questions. You need 4/5 or 5/5. Changing the screen, switching apps or opening another tab will immediately fail the attempt.</p><button id="scpArStartQuiz" class="scp-ar-primary">Start attendance checker</button></div>';return `<form id="scpArQuizAnswers"><div class="scp-ar-integrity">Stay on this screen. Leaving it will fail the attendance checker.</div>${(q.questions||[]).map((x,i)=>`<section class="scp-ar-quiz-question"><h3>${i+1}. ${esc(x.stem)}</h3>${x.image_url?`<img src="${esc(x.image_url)}" alt="Question image">`:''}${(x.choices||[]).map((c,j)=>`<label class="scp-ar-quiz-choice"><input type="radio" name="arq${i}" value="${j}" required><b>${voteLetters[j]}</b><span>${esc(c.text)}</span>${c.image_url?`<img src="${esc(c.image_url)}" alt="Choice image">`:''}</label>`).join("")}</section>`).join("")}<button class="scp-ar-primary">Submit all answers</button><p id="scpArQuizStatus"></p></form>`}
async function startArQuiz(){try{await arApi("start_quiz");arState=await arLoad();arIntegrityActive=true;arIntegrityFailed=false;renderMemberAttendanceReview()}catch(e){alert(e.message||"Could not start checker.")}}
async function failArIntegrity(){if(!arIntegrityActive||arIntegrityFailed)return;arIntegrityFailed=true;arIntegrityActive=false;try{await arApi("fail_quiz",{text:"Screen changed during attendance checker"});arState=await arLoad();renderMemberAttendanceReview()}catch{}}
document.addEventListener("visibilitychange",()=>{if(document.hidden)void failArIntegrity()});window.addEventListener("pagehide",()=>void failArIntegrity());
async function submitArQuiz(e){e.preventDefault();const answers=Array.from({length:5},(_,i)=>Number(new FormData(e.currentTarget).get(`arq${i}`)));if(answers.some(x=>!Number.isInteger(x))){$("scpArQuizStatus").textContent="Answer all five questions.";return}arIntegrityActive=false;try{const result=await arApi("submit_quiz",{answers});arState=await arLoad();renderMemberAttendanceReview();if(result.passed){void sendAttendancePush("checker_passed");await refreshHall()}}catch(err){$("scpArQuizStatus").textContent=err.message||"Could not submit answers."}}
$("scpArRefresh")?.addEventListener("click",async()=>{if(arIntegrityActive)return;arState=await arLoad();renderAttendanceReview()});
$("scpArClose")?.addEventListener("click",()=>{if(arIntegrityActive){alert("You cannot close the checker. Leaving will fail the attempt.");return}$("scpAttendanceReviewModal").hidden=true;document.body.classList.remove("scp-modal-open")});
$("scpAttendanceReviewModal")?.addEventListener("click",e=>{if(e.target===$("scpAttendanceReviewModal"))$("scpArClose").click()});
async function sendAttendancePush(mode,requestId=""){try{await supabaseClient.functions.invoke("send-attendance-review-push",{body:{mode,module_id:courseId,session_id:arRoomId,request_id:requestId}})}catch(e){console.warn("Attendance notification failed",e)}}

async function sendAttendanceLifecyclePush(mode,sessionId){try{await supabaseClient.functions.invoke("send-course-attendance-lifecycle-push",{body:{mode,module_id:courseId,session_id:sessionId}})}catch(e){console.warn("Attendance lifecycle notification failed",e)}}
