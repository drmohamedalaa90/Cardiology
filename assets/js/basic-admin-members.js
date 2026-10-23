import { supabaseClient } from "./supabase-client.js";

const $ = id => document.getElementById(id);
const ADMIN_EMAIL = "drmohamedalaa90@gmail.com";
let members = [];
let modules = [];

const esc = (value="") => String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initials = (name="ACL") => String(name).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "ACL";

function fmtDate(value){
  if(!value) return "Never";
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
}
function relativeTime(value){
  if(!value) return "Never active";
  const t=new Date(value).getTime();
  if(!Number.isFinite(t)) return "Unknown";
  const sec=Math.max(0,Math.floor((Date.now()-t)/1000));
  if(sec<60) return "Just now";
  const min=Math.floor(sec/60); if(min<60) return min+" min ago";
  const hr=Math.floor(min/60); if(hr<24) return hr+" h ago";
  const day=Math.floor(hr/24); if(day<30) return day+" d ago";
  return fmtDate(value);
}
function accuracyText(value){
  const n=Number(value);
  return Number.isFinite(n) ? Math.round(n)+"%" : "—";
}
function memberFilter(){
  const q=$("bamSearch").value.trim().toLowerCase();
  const status=$("bamStatusFilter").value;
  return members.filter(m=>{
    if(status!=="all" && m.account_status!==status) return false;
    if(q){
      const hay=[m.name,m.email,m.username,m.academic_year,m.institution].join(" ").toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}
function renderStats(){
  $("bamMemberCount").textContent=members.length;
  $("bamActiveCount").textContent=members.filter(m=>m.account_status==="active").length;
  $("bamHeldCount").textContent=members.filter(m=>m.account_status==="suspended").length;
  $("bamReleasedCount").textContent=modules.filter(m=>m.released).length;
}
function renderModules(){
  $("bamModuleAccess").innerHTML = modules.length ? modules.map(m=>{
    const fixed=Number(m.display_order)===1;
    return '<article class="bam-module-row">'+
      '<span class="bam-module-number">'+String(m.display_order).padStart(2,"0")+'</span>'+
      '<div class="bam-module-copy"><strong>'+esc(m.title)+'</strong><small>'+
      (fixed?"Always released":m.released?"Released by admin · prerequisite score still applies":"Admin Hold · unavailable to students regardless of score")+
      '</small></div>'+
      '<button type="button" class="bam-release-btn '+(fixed?"fixed":m.released?"hold":"release")+'" data-module="'+esc(m.id)+'" '+(fixed?"disabled":"")+'>'+
      (fixed?"Always released":m.released?"Put on hold":"Release module")+'</button></article>';
  }).join("") : '<div class="bam-empty">No Basic modules found.</div>';

  document.querySelectorAll("[data-module]").forEach(button=>{
    button.addEventListener("click",async()=>{
      const m=modules.find(x=>String(x.id)===String(button.dataset.module));
      if(!m || Number(m.display_order)===1) return;
      const next=!m.released;
      const action=next?"release":"put on hold";
      if(!confirm('Are you sure you want to '+action+' "'+m.title+'"?')) return;
      button.disabled=true;
      const {error}=await supabaseClient.rpc("acl_admin_set_basic_module_release",{p_module_id:m.id,p_released:next});
      if(error){alert(error.message||"Could not update module access.");button.disabled=false;return;}
      m.released=next; renderModules(); renderStats();
    });
  });
}
function moduleResultList(progress){
  const rows=Array.isArray(progress?.module_results)?progress.module_results:[];
  return rows.length ? rows.map(r=>
    '<div class="bam-list-item"><strong>'+esc(r.module_title)+'</strong><br>Best: '+accuracyText(r.best_accuracy)+' · '+Number(r.attempts||0)+' attempt(s)</div>'
  ).join("") : '<div class="bam-list-item">No completed module attempts yet.</div>';
}
function friendList(friends){
  const rows=Array.isArray(friends?.list)?friends.list:[];
  return rows.length ? rows.map(f=>
    '<div class="bam-list-item">'+esc(f.name)+(f.username?' · @'+esc(f.username):'')+'</div>'
  ).join("") : '<div class="bam-list-item">No connected friends.</div>';
}
function challengeList(challenges){
  const rows=Array.isArray(challenges?.history)?challenges.history:[];
  return rows.length ? rows.slice(0,12).map(h=>
    '<div class="bam-list-item"><strong>'+esc(h.module_title||h.title||"Challenge")+'</strong><br>'+
    (h.completed_at?"Completed":"Joined")+' · score '+(h.score??"—")+' · '+fmtDate(h.joined_at)+'</div>'
  ).join("") : '<div class="bam-list-item">No Basic challenges yet.</div>';
}
function memberDetails(m){
  const p=m.progress||{}, f=m.friends||{}, c=m.challenges||{};
  return '<div class="bam-detail-grid">'+
    '<section class="bam-detail-card"><h3>Progress</h3><p><strong>'+Number(p.modules_attempted||0)+'</strong> modules attempted · <strong>'+Number(p.completed_attempts||0)+'</strong> completed attempts</p><p><strong>'+Number(p.questions_answered||0)+'</strong> questions answered · overall accuracy <strong>'+accuracyText(p.overall_accuracy)+'</strong></p><div class="bam-list">'+moduleResultList(p)+'</div></section>'+
    '<section class="bam-detail-card"><h3>Friends</h3><p><strong>'+Number(f.accepted_count||0)+'</strong> accepted friend(s)</p><div class="bam-list">'+friendList(f)+'</div></section>'+
    '<section class="bam-detail-card"><h3>Challenges</h3><p><strong>'+Number(c.taken||0)+'</strong> joined · <strong>'+Number(c.completed||0)+'</strong> completed</p><div class="bam-list">'+challengeList(c)+'</div></section>'+
    '</div><div class="bam-member-actions"><button type="button" class="bam-hold-btn '+(m.account_status==="suspended"?"restore":"hold")+'" data-member-status="'+m.id+'">'+(m.account_status==="suspended"?"Restore membership":"Hold membership")+'</button></div>';
}
function renderMembers(){
  const rows=memberFilter();
  $("bamMembers").innerHTML = rows.length ? rows.map(m=>
    '<article class="bam-member" data-member-card="'+m.id+'">'+
      '<div class="bam-member-headrow" data-expand-member="'+m.id+'">'+
        '<span class="bam-avatar">'+(m.avatar_url?'<img src="'+esc(m.avatar_url)+'" alt="">':esc(initials(m.name)))+'</span>'+
        '<div class="bam-member-main"><strong>'+esc(m.name||"Member")+'</strong><small>'+esc(m.email||"")+(m.academic_year?' · '+esc(m.academic_year):'')+'</small></div>'+
        '<div class="bam-metric"><span>Last active</span><strong title="'+esc(fmtDate(m.last_seen_at||m.basic_last_opened_at))+'">'+esc(relativeTime(m.last_seen_at||m.basic_last_opened_at))+'</strong></div>'+
        '<div class="bam-metric"><span>Accuracy</span><strong>'+accuracyText(m.progress?.overall_accuracy)+'</strong></div>'+
        '<div class="bam-metric"><span>Friends</span><strong>'+Number(m.friends?.accepted_count||0)+'</strong></div>'+
        '<div class="bam-metric"><span>Challenges</span><strong>'+Number(m.challenges?.taken||0)+'</strong></div>'+
        '<span class="bam-status '+m.account_status+'">'+(m.account_status==="suspended"?"On hold":"Active")+'</span><span class="bam-chevron">⌄</span>'+
      '</div><div class="bam-member-details">'+memberDetails(m)+'</div></article>'
  ).join("") : '<div class="bam-empty">No members match the current filters.</div>';

  document.querySelectorAll("[data-expand-member]").forEach(row=>{
    row.addEventListener("click",e=>{
      if(e.target.closest("button,a")) return;
      const card=row.closest(".bam-member"); card?.classList.toggle("is-open");
      const ch=card?.querySelector(".bam-chevron"); if(ch) ch.textContent=card.classList.contains("is-open")?"⌃":"⌄";
    });
  });
  document.querySelectorAll("[data-member-status]").forEach(button=>{
    button.addEventListener("click",async e=>{
      e.stopPropagation();
      const m=members.find(x=>String(x.id)===String(button.dataset.memberStatus)); if(!m) return;
      const suspend=m.account_status!=="suspended";
      if(!confirm(suspend?'Hold membership for '+m.name+'? They will be blocked from signing in and active Basic sessions will be signed out.':'Restore membership for '+m.name+'?')) return;
      button.disabled=true;
      const {error}=await supabaseClient.rpc("acl_admin_set_basic_member_status",{p_user_id:m.id,p_suspended:suspend});
      if(error){alert(error.message||"Could not update membership.");button.disabled=false;return;}
      m.account_status=suspend?"suspended":"active"; renderMembers(); renderStats();
    });
  });
}
async function load(){
  const [{data:memberData,error:memberError},{data:moduleData,error:moduleError}]=await Promise.all([
    supabaseClient.rpc("acl_admin_get_basic_members"),
    supabaseClient.rpc("acl_admin_get_basic_module_access")
  ]);
  if(memberError) throw memberError;
  if(moduleError) throw moduleError;
  members=Array.isArray(memberData)?memberData:[];
  modules=Array.isArray(moduleData)?moduleData:[];
  renderStats(); renderModules(); renderMembers();
}
$("bamSearch")?.addEventListener("input",renderMembers);
$("bamStatusFilter")?.addEventListener("change",renderMembers);

const {data:{session}}=await supabaseClient.auth.getSession();
if(!session?.user){location.replace("login.html");}
else if(String(session.user.email||"").toLowerCase()!==ADMIN_EMAIL){location.replace("basic-home.html?edition=basic");}
else{load().catch(error=>{console.error("BASIC ADMIN MEMBERS:",error);$("bamMembers").innerHTML='<div class="bam-empty">Could not load Basic member data.</div>';});}
