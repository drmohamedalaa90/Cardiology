import { supabaseClient } from "./supabase-client.js";
const PASS_MARK=70;const $=id=>document.getElementById(id);
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function safeArray(v){if(Array.isArray(v))return v;if(typeof v==="string"&&v.trim()){try{const p=JSON.parse(v);return Array.isArray(p)?p:[]}catch{}}return[]}
function accuracyOf(a){if(!a||a.status!=="completed")return null;const answers=safeArray(a.answers);if(answers.length){const c=answers.filter(x=>x?.correct===true).length;return Math.round(c/answers.length*100)}const score=Number(a.score),total=Number(a.question_count);return Number.isFinite(score)&&Number.isFinite(total)&&total>0&&score>=0&&score<=total?Math.round(score/total*100):null}
function bestAttemptByModule(attempts){const map=new Map();for(const a of attempts){const id=String(a.module_id||"");if(!id)continue;const acc=accuracyOf(a);const cur=map.get(id)||{bestAccuracy:null,latest:null,inProgress:null};if(acc!==null&&(cur.bestAccuracy===null||acc>cur.bestAccuracy))cur.bestAccuracy=acc;if(!cur.latest)cur.latest=a;if(!cur.inProgress&&a.status==="in_progress")cur.inProgress=a;map.set(id,cur)}return map}
function moduleHref(m){if(!m?.id)return"#";return `basic-module.html?edition=basic&module=${encodeURIComponent(m.id)}`}
function chooseName(p,u){return p?.display_name||p?.full_name||p?.name||u?.user_metadata?.display_name||u?.user_metadata?.full_name||u?.email?.split("@")[0]||"Member"}
function choosePhoto(p,u){return p?.avatar_url||p?.photo_url||p?.profile_photo_url||u?.user_metadata?.avatar_url||u?.user_metadata?.picture||""}
function initials(n){return String(n||"ACL").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"ACL"}
function renderAvailable(modules,progress){const host=$("basicAvailableModules");if(!modules.length){host.innerHTML='<div class="basic-empty">No module is currently available.</div>';return}host.innerHTML=modules.map((m,i)=>{const state=progress.get(String(m.id)),best=state?.bestAccuracy,inProgress=Boolean(state?.inProgress),completed=best!==null&&best!==undefined,action=inProgress?"Continue":completed?"Review":"Start",label=inProgress?"In progress":completed?"Completed":"Ready",width=best==null?0:best;return `<article class="basic-module-card"><div class="basic-module-top"><span class="basic-module-number">${String(m.display_order??i+1).padStart(2,"0")}</span><span class="basic-module-state">${esc(label)}</span></div><h3>${esc(m.title||"Basic module")}</h3><p>${Number(m.question_count||0)} questions · Foundation level</p><div class="basic-progress" aria-hidden="true"><span style="width:${Math.max(0,Math.min(100,width))}%"></span></div><div class="basic-module-footer"><div class="basic-score"><span>Best result</span><strong>${best==null?"Not attempted":`${best}%`}</strong></div><a class="basic-module-action" href="${esc(moduleHref(m))}">${action} →</a></div></article>`}).join("")}
function renderLocked(rows){const host=$("basicLockedModules");if(!rows.length){host.innerHTML='<div class="basic-empty">All Basic Edition modules are unlocked. Excellent progress.</div>';return}host.innerHTML=rows.map(({module,previous,previousBest,adminHeld},i)=>`<article class="basic-locked-card"><span class="basic-lock-icon" aria-hidden="true">🔒</span><div class="basic-locked-copy"><strong>${esc(module.title||"Basic module")}</strong><small>${adminHeld?"Locked by the ACL administrator. This module will be released when it is ready.":`Pass ${esc(previous?.title||"the previous module")} with more than ${PASS_MARK}%. ${previousBest===null?"No completed result yet.":`Current best: ${previousBest}%.`}`}</small></div></article>`).join("")}
async function boot(){try{localStorage.setItem("aclSelectedEdition","basic");sessionStorage.setItem("aclSelectedEdition","basic")}catch{}const {data:{session},error}=await supabaseClient.auth.getSession();if(error)throw error;if(!session?.user){location.replace("login.html");return}const user=session.user;const {data:presence}=await supabaseClient.rpc("acl_touch_basic_presence");if(presence?.allowed===false){try{await supabaseClient.auth.signOut()}catch{}location.replace("login.html?held=1");return}const adminLink=$("basicAdminMembers");if(adminLink)adminLink.hidden=String(user.email||"").toLowerCase()!=="drmohamedalaa90@gmail.com";const [pr,mr,ar]=await Promise.all([supabaseClient.from("profiles").select("*").eq("id",user.id).maybeSingle(),supabaseClient.from("modules").select("id,title,slug,display_order,status,launch_path,question_count,edition,basic_admin_released").eq("edition","basic").eq("status","published").order("display_order",{ascending:true}).order("title",{ascending:true}),supabaseClient.from("quiz_attempts").select("module_id,status,score,question_count,answers,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false})]);if(mr.error)throw mr.error;if(ar.error)throw ar.error;const p=pr.error?null:pr.data,name=chooseName(p,user),photo=choosePhoto(p,user);$("basicUserName").textContent=name;const av=$("basicAvatar");if(photo){
  const img=document.createElement("img");
  img.alt="";
  img.decoding="async";
  img.referrerPolicy="no-referrer";
  img.onload=()=>av.classList.add("has-photo");
  img.onerror=()=>{av.textContent=initials(name)};
  img.src=photo+(photo.includes("?")?"&":"?")+"acl_avatar=1";
  av.replaceChildren(img);
}else av.textContent=initials(name);const modules=Array.isArray(mr.data)?mr.data:[],all=Array.isArray(ar.data)?ar.data:[],ids=new Set(modules.map(m=>String(m.id))),attempts=all.filter(a=>ids.has(String(a.module_id))),progress=bestAttemptByModule(attempts),available=[],locked=[],isAdmin=String(user.email||"").toLowerCase()==="drmohamedalaa90@gmail.com";if(isAdmin){
  modules.forEach(m=>available.push(m));
}else{
  modules.forEach((m,i)=>{
    if(i===0 || Number(m.display_order||0)===1){
      available.push(m);
      return;
    }
    const prev=modules[Math.max(0,i-1)];
    const best=prev ? (progress.get(String(prev.id))?.bestAccuracy??null) : null;
    locked.push({
      module:m,
      previous:prev,
      previousBest:best,
      adminHeld:true
    });
  });
};$("basicUnlockedCount").textContent=available.length;$("basicTotalCount").textContent=modules.length;$("basicAvailableSummary").textContent=`${available.length} ${available.length===1?"module":"modules"} available now`;renderAvailable(available,progress);renderLocked(locked)}
$("basicLogout")?.addEventListener("click",async()=>{try{await supabaseClient.auth.signOut()}catch{}location.replace("login.html")});
boot().catch(e=>{console.error("ACL BASIC HOME ERROR:",e);$("basicAvailableModules").innerHTML='<div class="basic-empty">The Basic Edition could not be loaded. Please refresh the page.</div>';$("basicLockedModules").innerHTML='<div class="basic-empty">Learning path unavailable.</div>'});

const basicLevelModalHome=document.getElementById("basicLevelModalHome");
const closeBasicLevelHome=()=>{if(basicLevelModalHome)basicLevelModalHome.hidden=true};
document.getElementById("basicExpertLockedHome")?.addEventListener("click",()=>{if(basicLevelModalHome)basicLevelModalHome.hidden=false});
document.getElementById("basicLevelCloseHome")?.addEventListener("click",closeBasicLevelHome);
basicLevelModalHome?.addEventListener("click",e=>{if(e.target===basicLevelModalHome)closeBasicLevelHome()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeBasicLevelHome()});

async function loadBasicHomeNotificationBadge(){
  try{
    const {data,error}=await supabaseClient.rpc("acl_basic_notifications");
    if(error)return;
    const badge=document.getElementById("basicHomeNotificationBadge");
    if(!badge)return;
    const count=Number(data?.unread_count||0);
    badge.textContent=String(count>99?"99+":count);
    badge.hidden=count<1;
  }catch{}
}
void loadBasicHomeNotificationBadge();
window.addEventListener("focus",()=>void loadBasicHomeNotificationBadge());
