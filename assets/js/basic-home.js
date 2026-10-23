import { supabaseClient } from "./supabase-client.js";
const PASS_MARK=70;const $=id=>document.getElementById(id);
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function safeArray(v){if(Array.isArray(v))return v;if(typeof v==="string"&&v.trim()){try{const p=JSON.parse(v);return Array.isArray(p)?p:[]}catch{}}return[]}
function accuracyOf(a){if(!a||a.status!=="completed")return null;const answers=safeArray(a.answers);if(answers.length){const c=answers.filter(x=>x?.correct===true).length;return Math.round(c/answers.length*100)}const score=Number(a.score),total=Number(a.question_count);return Number.isFinite(score)&&Number.isFinite(total)&&total>0&&score>=0&&score<=total?Math.round(score/total*100):null}
function bestAttemptByModule(attempts){
 const map=new Map();
 for(const a of attempts){if(a.status==="invalidated"||a.status==="abandoned"||(a.status==="in_progress"&&!a.challenge_id&&!a.lifelines?.basicResume?.allowed))continue;
  const id=String(a.module_id||"");if(!id)continue;
  const cur=map.get(id)||{bestAccuracy:null,latest:null,inProgress:null,questionResults:new Map()};
  const acc=accuracyOf(a);if(acc!==null&&(cur.bestAccuracy===null||acc>cur.bestAccuracy))cur.bestAccuracy=acc;
  if(!cur.latest)cur.latest=a;
  if(!cur.inProgress&&a.status==="in_progress"&&!a.challenge_id&&a.lifelines?.basicResume?.allowed)cur.inProgress=a;
  for(const answer of safeArray(a.answers)){
   const qid=String(answer.questionId||answer.question_id||"");if(!qid)continue;
   const time=Date.parse(answer.answeredAt||a.updated_at||a.created_at)||0;
   const previous=cur.questionResults.get(qid);
   if(!previous||time>previous.time)cur.questionResults.set(qid,{correct:answer.correct===true,time});
  }
  map.set(id,cur);
 }
 for(const cur of map.values()){cur.attempted=cur.questionResults.size;cur.correct=[...cur.questionResults.values()].filter(a=>a.correct).length;}
 return map;
}
async function loadModuleAttemptHistory(userId){
 const rows=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await supabaseClient.from("quiz_attempts").select("id,module_id,status,score,question_count,answers,updated_at,created_at,challenge_id,lifelines").eq("user_id",userId).order("updated_at",{ascending:false}).order("id").range(offset,offset+499);
  if(error)return {data:rows,error};rows.push(...(data||[]));if((data||[]).length<500)return {data:rows,error:null};
 }
}
function moduleHref(m){if(!m?.id)return"#";return `basic-module.html?edition=basic&module=${encodeURIComponent(m.id)}`}
function chooseName(p,u){return p?.display_name||p?.full_name||p?.name||u?.user_metadata?.display_name||u?.user_metadata?.full_name||u?.email?.split("@")[0]||"Member"}
function choosePhoto(p,u){return p?.avatar_url||p?.photo_url||p?.profile_photo_url||u?.user_metadata?.avatar_url||u?.user_metadata?.picture||""}
function initials(n){return String(n||"ACL").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"ACL"}
function renderAvailable(modules,progress){
 const host=$("basicAvailableModules");
 if(!modules.length){host.innerHTML='<div class="basic-empty">No module is currently available.</div>';return;}
 host.innerHTML=modules.map((m,i)=>{
  const state=progress.get(String(m.id)),total=Math.max(0,Number(m.question_count)||0),attempted=Math.min(total,state?.attempted||0),correct=Math.min(attempted,state?.correct||0);
  const coverage=total?Math.round(attempted/total*100):0,accuracy=attempted?Math.round(correct/attempted*100):0;
  const complete=total>0&&attempted>=total,label=complete?"All attempted":attempted?"In progress":"Ready",action=state?.inProgress?"Continue":attempted?"Open":"Start";
  return `<article class="basic-module-card"><div class="basic-module-top"><span class="basic-module-number">${String(m.display_order??i+1).padStart(2,"0")}</span><span class="basic-module-state">${esc(label)}</span></div><h3>${esc(m.title||"Basic module")}</h3><p>${total} questions · Foundation level</p>
  <div class="basic-module-metrics" title="Unique questions; correct count uses your latest answer.">
   <div class="basic-metric-label"><span>Attempted / total</span><strong>${attempted} / ${total} · ${coverage}%</strong></div>
   <div class="basic-progress coverage" role="progressbar" aria-label="Questions attempted" aria-valuemin="0" aria-valuemax="${Math.max(1,total)}" aria-valuenow="${attempted}"><span style="width:${coverage}%"></span></div>
   <div class="basic-metric-label accuracy-label"><span>Correct / attempted</span><strong>${correct} / ${attempted} · ${accuracy}%</strong></div>
   <div class="basic-progress accuracy" role="progressbar" aria-label="Correct answers among attempted questions" aria-valuemin="0" aria-valuemax="${Math.max(1,attempted)}" aria-valuenow="${correct}"><span style="width:${accuracy}%"></span></div>
  </div><div class="basic-module-footer"><div class="basic-score"><span>Questions remaining</span><strong>${total-attempted}</strong></div><a class="basic-module-action" href="${esc(moduleHref(m))}">${action} →</a></div></article>`;
 }).join("");
}
function renderLocked(rows){const host=$("basicLockedModules");if(!rows.length){host.innerHTML='<div class="basic-empty">All Basic Edition modules are unlocked. Excellent progress.</div>';return}host.innerHTML=rows.map(({module,previous,previousBest,adminHeld},i)=>`<article class="basic-locked-card"><span class="basic-lock-icon" aria-hidden="true">🔒</span><div class="basic-locked-copy"><strong>${esc(module.title||"Basic module")}</strong><small>${adminHeld?"Locked by the ACL administrator. This module will be released when it is ready.":`Pass ${esc(previous?.title||"the previous module")} with more than ${PASS_MARK}%. ${previousBest===null?"No completed result yet.":`Current best: ${previousBest}%.`}`}</small></div></article>`).join("")}
async function boot(){try{localStorage.setItem("aclSelectedEdition","basic");sessionStorage.setItem("aclSelectedEdition","basic")}catch{}const {data:{session},error}=await supabaseClient.auth.getSession();if(error)throw error;if(!session?.user){location.replace("login.html");return}const user=session.user;const {data:presence}=await supabaseClient.rpc("acl_touch_basic_presence");if(presence?.allowed===false){try{await supabaseClient.auth.signOut()}catch{}location.replace("login.html?held=1");return}const adminLink=$("basicAdminMembers");if(adminLink)adminLink.hidden=String(user.email||"").toLowerCase()!=="drmohamedalaa90@gmail.com";const [pr,mr,ar]=await Promise.all([supabaseClient.from("profiles").select("*").eq("id",user.id).maybeSingle(),supabaseClient.from("modules").select("id,title,slug,display_order,status,launch_path,question_count,edition,basic_admin_released").eq("edition","basic").eq("status","published").order("display_order",{ascending:true}).order("title",{ascending:true}),loadModuleAttemptHistory(user.id)]);if(mr.error)throw mr.error;if(ar.error)throw ar.error;const p=pr.error?null:pr.data,name=chooseName(p,user),photo=choosePhoto(p,user);$("basicUserName").textContent=name;const av=$("basicAvatar");if(photo){
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
};await Promise.all(available.map(async m=>{try{const {data,error}=await supabaseClient.rpc("acl_get_basic_module_question_counts",{p_module_id:m.id});if(!error&&data&&Number.isFinite(Number(data.published)))m.question_count=Math.max(0,Number(data.published));}catch{}}));$("basicUnlockedCount").textContent=available.length;$("basicTotalCount").textContent=modules.length;$("basicAvailableSummary").textContent=`${available.length} ${available.length===1?"module":"modules"} available now`;renderAvailable(available,progress);renderLocked(locked)}
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


/* =========================================================
   BASIC HOME — UPDATES & NEWS
========================================================= */

let basicNewsItems = [];
let basicNewsAdmin = false;
let basicNewsCurrentImage = "";

function basicNewsSafeColor(value){
  return /^#[0-9a-f]{6}$/i.test(String(value||""))
    ? String(value)
    : "#173d56";
}

function basicNewsSafeSize(value){
  return ["small","normal","large","xlarge"].includes(String(value))
    ? String(value)
    : "normal";
}

function basicNewsSafeStyle(value){
  return ["standard","highlight","important"].includes(String(value))
    ? String(value)
    : "standard";
}

function basicNewsSafeEffect(value){
  return ["none","zoom","pulse","fade","slide","glow","bounce"].includes(String(value))
    ? String(value)
    : "none";
}

function basicNewsSafeHref(value){
  const raw=String(value||"").trim();
  if(!raw)return "";
  try{
    const url=new URL(raw,location.origin);
    if(!["http:","https:"].includes(url.protocol))return "";
    return url.origin===location.origin
      ? url.pathname+url.search+url.hash
      : url.toString();
  }catch{
    return "";
  }
}

function basicNewsKindLabel(kind){
  const map={
    announcement:"Announcement",
    module_update:"Module update",
    competition:"Official competition",
    admin_message:"Admin message",
    app_update:"App update"
  };
  return map[String(kind||"")]||"ACL update";
}

function basicNewsDate(value){
  if(!value)return "";
  try{
    return new Date(value).toLocaleDateString("en-GB",{
      day:"2-digit",
      month:"short",
      year:"numeric"
    });
  }catch{
    return "";
  }
}

let basicNewsIndex = 0;
let basicNewsAutoplaySeconds = 0;
let basicNewsAutoplayTimer = null;
let basicNewsManuallyNavigated = false;

function sortedBasicNews(){
  return [...basicNewsItems].sort((a,b)=>{
    const pin=Number(Boolean(b.is_pinned))-Number(Boolean(a.is_pinned));
    if(pin)return pin;

    const aOrder=Number.isFinite(Number(a.display_order))?Number(a.display_order):100;
    const bOrder=Number.isFinite(Number(b.display_order))?Number(b.display_order):100;
    if(aOrder!==bOrder)return aOrder-bOrder;

    return new Date(b.published_at||b.created_at||0)-new Date(a.published_at||a.created_at||0);
  });
}

function stopBasicNewsAutoplay(){
  if(basicNewsAutoplayTimer){
    clearInterval(basicNewsAutoplayTimer);
    basicNewsAutoplayTimer=null;
  }
}

function startBasicNewsAutoplay(){
  stopBasicNewsAutoplay();
  const rows=sortedBasicNews();
  if(
    !basicNewsManuallyNavigated &&
    basicNewsAutoplaySeconds>0 &&
    rows.length>1 &&
    !document.hidden
  ){
    basicNewsAutoplayTimer=setInterval(()=>{
      basicNewsIndex=(basicNewsIndex+1)%rows.length;
      renderBasicNews();
    },basicNewsAutoplaySeconds*1000);
  }
}

function setBasicNewsIndex(nextIndex){
  const rows=sortedBasicNews();
  if(!rows.length)return;
  basicNewsManuallyNavigated=true;
  stopBasicNewsAutoplay();
  basicNewsIndex=(Number(nextIndex)+rows.length)%rows.length;
  renderBasicNews();
}

function renderBasicNews(){
  const host=document.getElementById("basicNewsGrid");
  const dots=document.getElementById("basicNewsDots");
  const prev=document.getElementById("basicNewsPrev");
  const next=document.getElementById("basicNewsNext");
  if(!host)return;

  const rows=sortedBasicNews();

  if(!rows.length){
    host.innerHTML='<div class="basic-news-empty">No ACL updates have been published yet.</div>';
    if(dots)dots.innerHTML="";
    if(prev)prev.hidden=true;
    if(next)next.hidden=true;
    stopBasicNewsAutoplay();
    return;
  }

  if(basicNewsIndex>=rows.length)basicNewsIndex=0;
  const item=rows[basicNewsIndex];

  const titleColor=basicNewsSafeColor(item.title_color||item.text_color);
  const bodyColor=basicNewsSafeColor(item.body_color||item.text_color);
  const titleSize=basicNewsSafeSize(item.title_size||"normal");
  const bodySize=basicNewsSafeSize(item.body_size||item.text_size);
  const style=basicNewsSafeStyle(item.card_style);
  const titleEffect=basicNewsSafeEffect(item.title_effect||"none");
  const bodyEffect=basicNewsSafeEffect(item.body_effect||item.text_effect||"none");
  const titleBold=item.title_bold!==false;
  const bodyBold=item.body_bold===true;
  const href=basicNewsSafeHref(item.link_url);
  const image=basicNewsSafeHref(item.image_url);
  const body=esc(item.body||"").replace(/\n/g,"<br>");
  const adminEdit=basicNewsAdmin
    ? `<button class="basic-news-edit" type="button" data-edit-news="${esc(item.id)}">Edit</button>`
    : "";

  host.innerHTML=`
    <article class="basic-news-card ${style} title-size-${titleSize} body-size-${bodySize} title-effect-${titleEffect} body-effect-${bodyEffect}" style="--news-title:${titleColor};--news-body:${bodyColor};--news-title-weight:${titleBold?900:500};--news-body-weight:${bodyBold?800:400}">
      ${image?`<div class="basic-news-image"><img src="${esc(image)}" alt="" loading="lazy"></div>`:""}
      <div class="basic-news-card-body">
        <div class="basic-news-meta">
          <span>${esc(basicNewsKindLabel(item.kind))}</span>
          ${item.is_pinned?'<em>Pinned</em>':""}
          ${basicNewsAdmin&&item.is_active===false?'<em class="basic-news-hidden-badge">Hidden</em>':""}
          <small>${esc(basicNewsDate(item.published_at||item.created_at))}</small>
          ${adminEdit}
        </div>
        <h3>${esc(item.title||"ACL update")}</h3>
        <p>${body}</p>
        ${href?`<a href="${esc(href)}" target="_blank" rel="noopener">Learn more →</a>`:""}
      </div>
    </article>
  `;

  const many=rows.length>1;
  if(prev)prev.hidden=!many;
  if(next)next.hidden=!many;

  if(dots){
    dots.innerHTML=many
      ? rows.map((_,index)=>`<button type="button" class="${index===basicNewsIndex?"is-active":""}" data-news-dot="${index}" aria-label="Show update ${index+1}"></button>`).join("")
      : "";

    dots.querySelectorAll("[data-news-dot]").forEach(button=>{
      button.addEventListener("click",()=>{
        setBasicNewsIndex(Number(button.dataset.newsDot||0));
      });
    });
  }

  host.querySelectorAll("[data-edit-news]").forEach(button=>{
    button.addEventListener("click",()=>{
      const current=basicNewsItems.find(row=>String(row.id)===String(button.dataset.editNews));
      if(current)openBasicNewsEditor(current);
    });
  });
}

function resetBasicNewsEditor(){
  const form=document.getElementById("basicNewsForm");
  if(!form)return;
  form.reset();
  document.getElementById("basicNewsId").value="";
  document.getElementById("basicNewsTitleColor").value="#173d56";
  document.getElementById("basicNewsTitleSize").value="normal";
  document.getElementById("basicNewsTitleBold").checked=true;
  document.getElementById("basicNewsTitleEffect").value="none";
  document.getElementById("basicNewsBodyColor").value="#173d56";
  document.getElementById("basicNewsBodySize").value="normal";
  document.getElementById("basicNewsBodyBold").checked=false;
  document.getElementById("basicNewsBodyEffect").value="none";
  document.getElementById("basicNewsStyle").value="standard";
  document.getElementById("basicNewsOrder").value="100";
  document.getElementById("basicNewsActive").checked=true;
  document.getElementById("basicNewsPinned").checked=false;
  document.getElementById("basicNewsEditorTitle").textContent="Create a new update";
  document.getElementById("basicNewsSave").textContent="Publish update";
  document.getElementById("basicNewsCancelEdit").hidden=true;
  document.getElementById("basicNewsImageStatus").textContent="JPEG, PNG, WebP or GIF · max 8 MB";
  basicNewsCurrentImage="";
}

function openBasicNewsEditor(item=null){
  const panel=document.getElementById("basicNewsAdminPanel");
  if(!panel)return;
  panel.hidden=false;

  if(!item){
    resetBasicNewsEditor();
    panel.scrollIntoView({behavior:"smooth",block:"nearest"});
    return;
  }

  document.getElementById("basicNewsId").value=item.id||"";
  document.getElementById("basicNewsTitle").value=item.title||"";
  document.getElementById("basicNewsKind").value=item.kind||"announcement";
  document.getElementById("basicNewsBody").value=item.body||"";
  document.getElementById("basicNewsTitleColor").value=basicNewsSafeColor(item.title_color||item.text_color);
  document.getElementById("basicNewsTitleSize").value=basicNewsSafeSize(item.title_size||"normal");
  document.getElementById("basicNewsTitleBold").checked=item.title_bold!==false;
  document.getElementById("basicNewsTitleEffect").value=basicNewsSafeEffect(item.title_effect||"none");
  document.getElementById("basicNewsBodyColor").value=basicNewsSafeColor(item.body_color||item.text_color);
  document.getElementById("basicNewsBodySize").value=basicNewsSafeSize(item.body_size||item.text_size);
  document.getElementById("basicNewsBodyBold").checked=item.body_bold===true;
  document.getElementById("basicNewsBodyEffect").value=basicNewsSafeEffect(item.body_effect||item.text_effect||"none");
  document.getElementById("basicNewsStyle").value=basicNewsSafeStyle(item.card_style);
  document.getElementById("basicNewsOrder").value=String(Number.isFinite(Number(item.display_order))?Number(item.display_order):100);
  document.getElementById("basicNewsLink").value=item.link_url||"";
  document.getElementById("basicNewsPinned").checked=Boolean(item.is_pinned);
  document.getElementById("basicNewsActive").checked=item.is_active!==false;
  document.getElementById("basicNewsEditorTitle").textContent="Edit update";
  document.getElementById("basicNewsSave").textContent="Save changes";
  document.getElementById("basicNewsCancelEdit").hidden=false;
  basicNewsCurrentImage=item.image_url||"";
  document.getElementById("basicNewsImageStatus").textContent=basicNewsCurrentImage
    ? "Current image will remain unless you choose a new file."
    : "JPEG, PNG, WebP or GIF · max 8 MB";

  panel.scrollIntoView({behavior:"smooth",block:"nearest"});
}

async function loadBasicNews(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session?.user)return;

  basicNewsAdmin=String(session.user.email||"").trim().toLowerCase()==="drmohamedalaa90@gmail.com";

  const toggle=document.getElementById("basicNewsAdminToggle");
  if(toggle)toggle.hidden=!basicNewsAdmin;

  let query=supabaseClient
    .from("acl_announcements")
    .select("id,title,body,kind,edition,link_url,is_pinned,is_active,published_at,created_at,text_color,text_size,image_url,card_style,text_effect,title_color,title_size,title_bold,title_effect,body_color,body_size,body_bold,body_effect,display_order")
    .order("published_at",{ascending:false})
    .limit(20);

  if(!basicNewsAdmin){
    query=query.eq("is_active",true);
  }

  const {data,error}=await query;
  if(error){
    console.error("BASIC NEWS:",error);
    const host=document.getElementById("basicNewsGrid");
    if(host)host.innerHTML='<div class="basic-news-empty">Updates are temporarily unavailable.</div>';
    return;
  }

  basicNewsItems=(data||[]).filter(item=>{
    const edition=String(item.edition||"all").toLowerCase();
    return ["basic","all","both",""].includes(edition);
  });

  renderBasicNews();
  startBasicNewsAutoplay();
}

document.getElementById("basicNewsAdminToggle")?.addEventListener("click",()=>{
  const panel=document.getElementById("basicNewsAdminPanel");
  if(!panel)return;
  if(panel.hidden){
    openBasicNewsEditor();
  }else{
    panel.hidden=true;
  }
});

document.getElementById("basicNewsCancelEdit")?.addEventListener("click",()=>{
  resetBasicNewsEditor();
});

document.getElementById("basicNewsForm")?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!basicNewsAdmin)return;

  const save=document.getElementById("basicNewsSave");
  const status=document.getElementById("basicNewsStatus");
  save.disabled=true;
  status.textContent="Saving…";

  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(!session?.user)throw new Error("Authentication required.");

    let imageUrl=basicNewsCurrentImage;
    const file=document.getElementById("basicNewsImage").files?.[0];

    if(file){
      if(file.size>8*1024*1024)throw new Error("Image must be smaller than 8 MB.");
      const safeName=String(file.name||"news-image")
        .replace(/[^a-z0-9._-]+/gi,"-")
        .replace(/-+/g,"-");
      const path=`${session.user.id}/${Date.now()}-${safeName}`;

      const {error:uploadError}=await supabaseClient
        .storage
        .from("acl-news")
        .upload(path,file,{cacheControl:"3600",upsert:false});

      if(uploadError)throw uploadError;

      const {data:publicData}=supabaseClient
        .storage
        .from("acl-news")
        .getPublicUrl(path);

      imageUrl=publicData?.publicUrl||"";
    }

    const id=document.getElementById("basicNewsId").value.trim();
    const payload={
      title:document.getElementById("basicNewsTitle").value.trim(),
      body:document.getElementById("basicNewsBody").value.trim(),
      kind:document.getElementById("basicNewsKind").value,
      edition:"basic",
      link_url:document.getElementById("basicNewsLink").value.trim()||null,
      is_pinned:document.getElementById("basicNewsPinned").checked,
      is_active:document.getElementById("basicNewsActive").checked,
      display_order:Math.max(1,Number(document.getElementById("basicNewsOrder").value||100)),
      title_color:document.getElementById("basicNewsTitleColor").value,
      title_size:document.getElementById("basicNewsTitleSize").value,
      title_bold:document.getElementById("basicNewsTitleBold").checked,
      title_effect:document.getElementById("basicNewsTitleEffect").value,
      body_color:document.getElementById("basicNewsBodyColor").value,
      body_size:document.getElementById("basicNewsBodySize").value,
      body_bold:document.getElementById("basicNewsBodyBold").checked,
      body_effect:document.getElementById("basicNewsBodyEffect").value,
      text_color:document.getElementById("basicNewsBodyColor").value,
      text_size:document.getElementById("basicNewsBodySize").value,
      text_effect:document.getElementById("basicNewsBodyEffect").value,
      image_url:imageUrl||null,
      card_style:document.getElementById("basicNewsStyle").value,
      published_at:new Date().toISOString()
    };

    let result;
    if(id){
      result=await supabaseClient
        .from("acl_announcements")
        .update(payload)
        .eq("id",id);
    }else{
      result=await supabaseClient
        .from("acl_announcements")
        .insert({...payload,created_by:session.user.id});
    }

    if(result.error)throw result.error;

    status.textContent=id?"Update saved.":"Update published.";
    resetBasicNewsEditor();
    await loadBasicNews();
  }catch(error){
    console.error("SAVE BASIC NEWS:",error);
    status.textContent=error.message||"Could not save this update.";
  }finally{
    save.disabled=false;
  }
});


const BASIC_HOME_DEFAULTS={
  hero_eyebrow:"ACL • BASIC EDITION",
  hero_title:"Build your cardiology foundation, one module at a time.",
  hero_subtitle:"Complete each module with more than 70%. The next module also becomes available only after ACL admin release.",
  path_label:"YOUR PATH",
  path_suffix:"modules unlocked",
  news_kicker:"ACL UPDATES",
  news_title:"Updates & News",
  news_subtitle:"Official announcements, module updates and important ACL news.",
  news_autoplay_seconds:0
};

let basicHomeSettings={...BASIC_HOME_DEFAULTS};

function applyBasicHomeSettings(settings={}){
  basicHomeSettings={...BASIC_HOME_DEFAULTS,...settings};

  const setText=(id,value)=>{
    const el=document.getElementById(id);
    if(el)el.textContent=String(value??"");
  };

  setText("basicHeroEyebrow",basicHomeSettings.hero_eyebrow);
  setText("basicHeroTitle",basicHomeSettings.hero_title);
  setText("basicHeroSubtitle",basicHomeSettings.hero_subtitle);
  setText("basicPathLabel",basicHomeSettings.path_label);
  setText("basicPathSuffix",basicHomeSettings.path_suffix);
  setText("basicNewsKicker",basicHomeSettings.news_kicker);
  setText("basicNewsHeading",basicHomeSettings.news_title);
  setText("basicNewsSubtitle",basicHomeSettings.news_subtitle);

  basicNewsAutoplaySeconds=[3,5].includes(Number(basicHomeSettings.news_autoplay_seconds))
    ? Number(basicHomeSettings.news_autoplay_seconds)
    : 0;

  const fields={
    basicHomeHeroEyebrow:basicHomeSettings.hero_eyebrow,
    basicHomeHeroTitle:basicHomeSettings.hero_title,
    basicHomeHeroSubtitle:basicHomeSettings.hero_subtitle,
    basicHomePathLabel:basicHomeSettings.path_label,
    basicHomePathSuffix:basicHomeSettings.path_suffix,
    basicHomeNewsKicker:basicHomeSettings.news_kicker,
    basicHomeNewsTitle:basicHomeSettings.news_title,
    basicHomeNewsSubtitle:basicHomeSettings.news_subtitle
  };

  for(const [id,value] of Object.entries(fields)){
    const input=document.getElementById(id);
    if(input)input.value=String(value??"");
  }

  const autoplay=document.getElementById("basicHomeNewsAutoplay");
  if(autoplay)autoplay.value=String(basicNewsAutoplaySeconds);

  startBasicNewsAutoplay();
}

async function loadBasicHomeSettings(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session?.user)return;

  const isAdminUser=
    String(session.user.email||"").trim().toLowerCase()===
    "drmohamedalaa90@gmail.com";

  const toggle=document.getElementById("basicHomeTextAdminToggle");
  if(toggle)toggle.hidden=!isAdminUser;

  const {data,error}=await supabaseClient
    .from("acl_basic_home_settings")
    .select("*")
    .eq("id","basic-home")
    .maybeSingle();

  if(error){
    console.warn("BASIC HOME SETTINGS:",error);
    applyBasicHomeSettings(BASIC_HOME_DEFAULTS);
    return;
  }

  applyBasicHomeSettings(data||BASIC_HOME_DEFAULTS);
}

document.getElementById("basicHomeTextAdminToggle")?.addEventListener("click",()=>{
  const panel=document.getElementById("basicHomeTextAdminPanel");
  if(!panel)return;
  panel.hidden=!panel.hidden;
  if(!panel.hidden){
    panel.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
});

document.getElementById("basicHomeTextForm")?.addEventListener("submit",async event=>{
  event.preventDefault();

  const save=document.getElementById("basicHomeTextSave");
  const status=document.getElementById("basicHomeTextStatus");
  save.disabled=true;
  status.textContent="Saving…";

  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(
      !session?.user ||
      String(session.user.email||"").trim().toLowerCase()!=="drmohamedalaa90@gmail.com"
    ){
      throw new Error("Admin access required.");
    }

    const payload={
      id:"basic-home",
      hero_eyebrow:document.getElementById("basicHomeHeroEyebrow").value.trim()||BASIC_HOME_DEFAULTS.hero_eyebrow,
      hero_title:document.getElementById("basicHomeHeroTitle").value.trim()||BASIC_HOME_DEFAULTS.hero_title,
      hero_subtitle:document.getElementById("basicHomeHeroSubtitle").value.trim()||BASIC_HOME_DEFAULTS.hero_subtitle,
      path_label:document.getElementById("basicHomePathLabel").value.trim()||BASIC_HOME_DEFAULTS.path_label,
      path_suffix:document.getElementById("basicHomePathSuffix").value.trim()||BASIC_HOME_DEFAULTS.path_suffix,
      news_kicker:document.getElementById("basicHomeNewsKicker").value.trim()||BASIC_HOME_DEFAULTS.news_kicker,
      news_title:document.getElementById("basicHomeNewsTitle").value.trim()||BASIC_HOME_DEFAULTS.news_title,
      news_subtitle:document.getElementById("basicHomeNewsSubtitle").value.trim()||BASIC_HOME_DEFAULTS.news_subtitle,
      news_autoplay_seconds:Number(document.getElementById("basicHomeNewsAutoplay").value||0),
      updated_by:session.user.id,
      updated_at:new Date().toISOString()
    };

    const {data,error}=await supabaseClient
      .from("acl_basic_home_settings")
      .upsert(payload,{onConflict:"id"})
      .select()
      .single();

    if(error)throw error;

    applyBasicHomeSettings(data);
    status.textContent="Homepage updated.";
  }catch(error){
    console.error("SAVE BASIC HOME SETTINGS:",error);
    status.textContent=error.message||"Could not update homepage.";
  }finally{
    save.disabled=false;
  }
});

document.getElementById("basicNewsPrev")?.addEventListener("click",()=>{
  setBasicNewsIndex(basicNewsIndex-1);
});

document.getElementById("basicNewsNext")?.addEventListener("click",()=>{
  setBasicNewsIndex(basicNewsIndex+1);
});

document.addEventListener("visibilitychange",()=>{
  if(document.hidden)stopBasicNewsAutoplay();
  else startBasicNewsAutoplay();
});

void loadBasicHomeSettings();
void loadBasicNews();


document.getElementById("basicRefreshPage")?.addEventListener("click",()=>location.reload());


/* Mobile swipe navigation for Updates & News */
let basicNewsSwipeStartX=null;
let basicNewsSwipeStartY=null;

const basicNewsSwipeHost=document.getElementById("basicNewsGrid");

basicNewsSwipeHost?.addEventListener("touchstart",event=>{
  const touch=event.touches?.[0];
  if(!touch)return;
  basicNewsSwipeStartX=touch.clientX;
  basicNewsSwipeStartY=touch.clientY;
  stopBasicNewsAutoplay();
},{passive:true});

basicNewsSwipeHost?.addEventListener("touchend",event=>{
  const touch=event.changedTouches?.[0];
  if(!touch||basicNewsSwipeStartX===null||basicNewsSwipeStartY===null){
    startBasicNewsAutoplay();
    return;
  }

  const dx=touch.clientX-basicNewsSwipeStartX;
  const dy=touch.clientY-basicNewsSwipeStartY;
  basicNewsSwipeStartX=null;
  basicNewsSwipeStartY=null;

  if(Math.abs(dx)>=45 && Math.abs(dx)>Math.abs(dy)*1.15){
    setBasicNewsIndex(basicNewsIndex+(dx<0?1:-1));
    return;
  }

  startBasicNewsAutoplay();
},{passive:true});

