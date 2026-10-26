import { supabaseClient } from "./supabase-client.js";
const ACL_DESTINATIONS=[['basic-home.html?edition=basic','Home'],['basic-modules.html?edition=basic','Modules'],['basic-progress.html?edition=basic','My progress'],['basic-profile.html?edition=basic','Friends & profile'],['basic-challenges.html?edition=basic','Challenges'],['basic-challenges.html?edition=basic#officialCompetitionsTitle','Official ACL competitions'],['basic-starred.html?edition=basic','Starred questions'],['basic-notifications.html?edition=basic','Notifications']];
function aclDestinationLabel(value){try{const u=new URL(value,location.href);return u.searchParams.get('acl_link_label')||ACL_DESTINATIONS.find(([p])=>new URL(p,location.href).pathname===u.pathname)?.[1]||(u.pathname.endsWith('basic-official-competition.html')?'competition':u.pathname.endsWith('basic-module.html')?'module':'announcement');}catch{return 'announcement';}}

const PASS_MARK=70;const $=id=>document.getElementById(id);
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function basicNewsRichText(value,{singleLine=false}={}){
  let html=esc(value||"");
  const formats=[
    [/\[b\]([\s\S]*?)\[\/b\]/gi,"<strong>$1</strong>"],
    [/\[accent\]([\s\S]*?)\[\/accent\]/gi,'<span class="news-inline-accent">$1</span>'],
    [/\[red\]([\s\S]*?)\[\/red\]/gi,'<span class="news-inline-red">$1</span>'],
    [/\[mark\]([\s\S]*?)\[\/mark\]/gi,'<mark class="news-inline-mark">$1</mark>'],
    [/\[large\]([\s\S]*?)\[\/large\]/gi,'<span class="news-inline-large">$1</span>']
  ];
  for(let pass=0;pass<3;pass++)for(const [pattern,replacement] of formats)html=html.replace(pattern,replacement);
  if(singleLine)return html.replace(/\r?\n/g," ");
  return html.replace(/\r?\n/g,'<span class="news-line-break" aria-hidden="true"></span>');
}
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

function moduleResourceMarkup(m){
 const lecture=m._lectureAvailable,flash=m._flashcardsAvailable;
 return `<span class="basic-resource-status ${lecture?'is-ready':'is-pending'}" title="${lecture?'Lecture available inside':'Lecture not available yet'}"><span aria-hidden="true">▷</span> Lecture ${lecture?'✓':'soon'}</span><span class="basic-resource-status ${flash?'is-ready':'is-pending'}" title="${flash?'Flashcards available inside':'Flashcards not available yet'}"><span aria-hidden="true">▱</span> Cards ${flash?'✓':'soon'}</span>`;
}
async function loadModuleResources(modules){
 await Promise.all(modules.map(async m=>{
 m._lectureAvailable=false;m._flashcardsAvailable=false;
 const [v,q]=await Promise.all([supabaseClient.from('videos').select('youtube_url').eq('module_id',m.id).eq('is_active',true),supabaseClient.from('quizzes').select('id').eq('module_id',m.id).eq('edition','basic')]);
 m._lectureAvailable=!v.error&&(v.data||[]).some(row=>String(row.youtube_url||'').trim());
 if(m.id==='basic-valvular-heart-disease'||q.error||!q.data?.length)return;
 const r=await supabaseClient.from('questions').select('stem,question_text').in('quiz_id',q.data.map(row=>row.id)).order('order_index').limit(100);
 m._flashcardsAvailable=!r.error&&(r.data||[]).some(row=>row.stem||row.question_text);
 }));
}

function renderAvailable(modules,progress){
 const host=$("basicAvailableModules");
 if(!modules.length){host.innerHTML='<div class="basic-empty">No module is currently available.</div>';return;}
 host.innerHTML=modules.map((m,i)=>{
  const state=progress.get(String(m.id)),total=Math.max(0,Number(m.question_count)||0),attempted=Math.min(total,state?.attempted||0),correct=Math.min(attempted,state?.correct||0);
  const coverage=total?Math.round(attempted/total*100):0,accuracy=attempted?Math.round(correct/attempted*100):0;
  const waitingForLaunch=String(m.id)==="basic-valvular-heart-disease"&&!basicLaunchRemaining().done;
  const complete=total>0&&attempted>=total,label=m.basic_admin_released===false?"Admin hold":waitingForLaunch?"Opening soon":complete?"All attempted":attempted?"In progress":"Ready",action=state?.inProgress?"Continue":attempted?"Open":"Start";
  return `<article class="basic-module-card"><div class="basic-module-top"><span class="basic-module-number">${String(m.display_order??i+1).padStart(2,"0")}</span><span class="basic-module-state">${esc(label)}</span></div><h3>${esc(m.title||"Basic module")}</h3><div class="basic-module-resource-line"><span class="basic-resource-count">${total} questions</span>${moduleResourceMarkup(m)}</div>
  <div class="basic-module-metrics" title="Unique questions; correct count uses your latest answer.">
   <div class="basic-metric-label"><span>Attempted / total</span><strong>${attempted} / ${total} · ${coverage}%</strong></div>
   <div class="basic-progress coverage" role="progressbar" aria-label="Questions attempted" aria-valuemin="0" aria-valuemax="${Math.max(1,total)}" aria-valuenow="${attempted}"><span style="width:${coverage}%"></span></div>
   <div class="basic-metric-label accuracy-label"><span>Correct / attempted</span><strong>${correct} / ${attempted} · ${accuracy}%</strong></div>
   <div class="basic-progress accuracy" role="progressbar" aria-label="Correct answers among attempted questions" aria-valuemin="0" aria-valuemax="${Math.max(1,attempted)}" aria-valuenow="${correct}"><span style="width:${accuracy}%"></span></div>
  </div><div class="basic-module-footer"><div class="basic-score"><span>Questions remaining</span><strong>${total-attempted}</strong></div>${waitingForLaunch?'<div class="basic-module-launch-clock" data-module-launch-clock role="timer" aria-live="off" aria-label="Opens Monday 26 October at 10 PM Cairo time"><small>Launches in</small><div data-module-launch-units></div></div>':`<a class="basic-module-action" href="${esc(moduleHref(m))}">${action} →</a>`}</div></article>`;
 }).join("");
 updateBasicModuleCountdowns();
}
function renderLocked(rows){const host=$("basicLockedModules");if(!rows.length){host.innerHTML='<div class="basic-empty">All Basic Edition modules are unlocked. Excellent progress.</div>';return}host.innerHTML=rows.map(({module,previous,previousBest,adminHeld,reason},i)=>`<article class="basic-locked-card"><span class="basic-lock-icon" aria-hidden="true">🔒</span><div class="basic-locked-copy"><strong>${esc(module.title||"Basic module")}</strong><div class="basic-module-resource-line">${moduleResourceMarkup(module)}</div><small>${reason?esc(reason):adminHeld?"Locked by the ACL administrator. This module will be released when it is ready.":`Pass ${esc(previous?.title||"the previous module")} with more than ${PASS_MARK}%. ${previousBest===null?"No completed result yet.":`Current best: ${previousBest}%.`}`}</small></div></article>`).join("")}
async function boot(){try{localStorage.setItem("aclSelectedEdition","basic");sessionStorage.setItem("aclSelectedEdition","basic")}catch{}const {data:{session},error}=await supabaseClient.auth.getSession();if(error)throw error;if(!session?.user){location.replace("login.html");return}const user=session.user;const {data:presence}=await supabaseClient.rpc("acl_touch_basic_presence",{p_access_mode:(window.matchMedia?.("(display-mode: standalone)").matches||window.navigator.standalone===true)?"installed":"web"});if(presence?.allowed===false){try{await supabaseClient.auth.signOut()}catch{}location.replace("login.html?held=1");return}const adminLink=$("basicAdminMembers");if(adminLink)adminLink.hidden=String(user.email||"").toLowerCase()!=="drmohamedalaa90@gmail.com";const [pr,mr,ar]=await Promise.all([supabaseClient.from("profiles").select("*").eq("id",user.id).maybeSingle(),supabaseClient.from("modules").select("id,title,slug,display_order,status,launch_path,question_count,edition,basic_admin_released,opens_at,closes_at").eq("edition","basic").eq("is_special_course",false).eq("status","published").order("display_order",{ascending:true}).order("title",{ascending:true}),loadModuleAttemptHistory(user.id)]);if(mr.error)throw mr.error;if(ar.error)throw ar.error;const p=pr.error?null:pr.data,name=chooseName(p,user),photo=choosePhoto(p,user);$("basicUserName").textContent=name;const av=$("basicAvatar");if(photo){
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
  await Promise.all(modules.map(async(m)=>{
    const {data:allowed,error}=await supabaseClient.rpc("acl_can_access_learning_area",{p_edition:"basic",p_module_id:m.id});
    if(error)throw error;
    if(allowed===true){available.push(m);return;}
    const held=m.basic_admin_released!==true;
    const upcoming=m.opens_at&&new Date(m.opens_at)>new Date();
    const reason=held?"On hold by administrator":upcoming?"Opens "+new Date(m.opens_at).toLocaleString("en-GB",{timeZone:"Africa/Cairo",dateStyle:"medium",timeStyle:"short"})+" Cairo":"Complete the module access requirements";
    locked.push({module:m,reason,adminHeld:held});
  }));
  available.sort((a,b)=>Number(a.display_order)-Number(b.display_order));
  locked.sort((a,b)=>Number(a.module.display_order)-Number(b.module.display_order));
};await Promise.all(available.map(async m=>{try{const {data,error}=await supabaseClient.rpc("acl_get_basic_module_question_counts",{p_module_id:m.id});if(!error&&data&&Number.isFinite(Number(data.published)))m.question_count=Math.max(0,Number(data.published));}catch{}}));$("basicUnlockedCount").textContent=available.length;$("basicTotalCount").textContent=modules.length;$("basicAvailableSummary").textContent=`${available.length} ${available.length===1?"module":"modules"} available now`;await loadModuleResources(modules);renderAvailable(available,progress);renderLocked(locked)}
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
  const title=basicNewsRichText(item.title||"ACL update",{singleLine:true});
  const body=basicNewsRichText(item.body||"");
  const adminEdit=basicNewsAdmin
    ? `<button class="basic-news-edit" type="button" data-edit-news="${esc(item.id)}">Edit</button>`
    : "";

  host.innerHTML=`
    <article class="basic-news-card ${image?"has-news-loading":""} ${style} title-size-${titleSize} body-size-${bodySize} title-effect-${titleEffect} body-effect-${bodyEffect}" style="--news-title:${titleColor};--news-body:${bodyColor};--news-title-weight:${titleBold?900:500};--news-body-weight:${bodyBold?800:400}">
      ${image?`<div class="basic-news-image"><span class="basic-news-image-loader" aria-hidden="true"></span><img src="${esc(image)}" alt="" loading="eager" fetchpriority="high" decoding="async"></div>`:""}
      <div class="basic-news-card-body">
        <div class="basic-news-meta">
          <span class="basic-news-live"><i></i> Latest</span>
          <span>${esc(basicNewsKindLabel(item.kind))}</span>
          ${item.is_pinned?'<em>Pinned</em>':""}
          ${basicNewsAdmin&&item.is_active===false?'<em class="basic-news-hidden-badge">Hidden</em>':""}
          <small>${esc(basicNewsDate(item.published_at||item.created_at))}</small>
          ${adminEdit}
        </div>
        <h3>${title}</h3>
        <p>${body}</p>
        ${href?`<a href="${esc(href)}" target="_blank" rel="noopener">Go to ${esc(aclDestinationLabel(item.link_url))} →</a>`:""}
      </div>
    </article>
  `;

  if(image){
    const card=host.querySelector(".basic-news-card");
    const newsImage=host.querySelector(".basic-news-image img");
    let revealTimer=0;
    const revealNews=()=>{
      window.clearTimeout(revealTimer);
      if(!card||!card.isConnected)return;
      card.classList.remove("has-news-loading");
      card.classList.add("has-news-ready");
    };
    if(newsImage){
      if(newsImage.complete){
        if(newsImage.naturalWidth)newsImage.decode?.().catch(()=>{}).finally(revealNews);
        else revealNews();
      }else{
        newsImage.addEventListener("load",()=>{
          newsImage.decode?.().catch(()=>{}).finally(revealNews);
        },{once:true});
        newsImage.addEventListener("error",revealNews,{once:true});
        revealTimer=window.setTimeout(revealNews,5000);
      }
    }else revealNews();

    rows.forEach((row,index)=>{
      if(index===basicNewsIndex)return;
      const nextImage=basicNewsSafeHref(row.image_url);
      if(nextImage){const preload=new Image();preload.decoding="async";preload.src=nextImage;}
    });
  }

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
{const u=item.link_url?new URL(item.link_url,location.href):null;if(u)u.searchParams.delete('acl_link_label');const path=u?u.pathname.split('/').pop()+u.search+u.hash:'';const s=document.getElementById('basicNewsDestination');if(s){s.value=[...s.options].some(o=>o.value===path)?path:'custom';document.getElementById('basicNewsLinkLabel').value=item.link_url?aclDestinationLabel(item.link_url):'';}}
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

  await aclLoadDestinationOptions();
  renderBasicNews();startBasicNewsAutoplay();
  const editId=new URLSearchParams(location.search).get('edit_update');
  if(basicNewsAdmin&&editId){const edit=basicNewsItems.find(i=>String(i.id)===editId);if(edit)openBasicNewsEditor(edit);}
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

const basicNewsFormatTags={bold:["[b]","[/b]"],accent:["[accent]","[/accent]"],red:["[red]","[/red]"],mark:["[mark]","[/mark]"],large:["[large]","[/large]"]};
function applyBasicNewsInlineFormat(toolbar,format){
  const field=document.getElementById(toolbar?.dataset.newsEditorTarget||"");
  if(!field)return;
  const start=Number(field.selectionStart||0),end=Number(field.selectionEnd||0);
  if(format==="clear"){
    const strip=value=>String(value||"").replace(/\\[\\/?(?:b|accent|red|mark|large)\\]/gi,"");
    if(start!==end)field.setRangeText(strip(field.value.slice(start,end)),start,end,"select");
    else{field.value=strip(field.value);field.setSelectionRange(0,field.value.length);}
  }else{
    const [open,close]=basicNewsFormatTags[format]||[];
    if(!open)return;
    const selected=field.value.slice(start,end)||"selected words";
    field.setRangeText(open+selected+close,start,end,"select");
    field.setSelectionRange(start+open.length,start+open.length+selected.length);
  }
  field.focus();field.dispatchEvent(new Event("input",{bubbles:true}));
}
document.querySelectorAll(".basic-news-inline-tools [data-news-format]").forEach(button=>button.addEventListener("click",()=>applyBasicNewsInlineFormat(button.closest(".basic-news-inline-tools"),button.dataset.newsFormat)));

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
      link_url:aclSaveNewsDestination(),
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
  news_enabled:true,
  news_autoplay_seconds:5
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

  const newsEnabled=basicHomeSettings.news_enabled!==false;
  basicNewsAutoplaySeconds=[5,7,10].includes(Number(basicHomeSettings.news_autoplay_seconds))
    ? Number(basicHomeSettings.news_autoplay_seconds)
    : 5;

  const newsSection=document.getElementById("basicNewsSection");
  const disabledNotice=document.getElementById("basicNewsDisabledNotice");
  if(newsSection){
    newsSection.hidden=!newsEnabled&&!basicNewsAdmin;
    newsSection.classList.toggle("news-disabled",!newsEnabled&&basicNewsAdmin);
  }
  if(disabledNotice)disabledNotice.hidden=newsEnabled||!basicNewsAdmin;

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
  const quickAutoplay=document.getElementById("basicNewsQuickAutoplay");
  if(quickAutoplay)quickAutoplay.value=String(basicNewsAutoplaySeconds);
  const enabled=document.getElementById("basicNewsEnabled");
  if(enabled)enabled.checked=newsEnabled;
  const enabledLabel=document.getElementById("basicNewsEnabledLabel");
  if(enabledLabel)enabledLabel.textContent=newsEnabled?"On":"Off";

  if(newsEnabled)startBasicNewsAutoplay();
  else stopBasicNewsAutoplay();
}

async function loadBasicHomeSettings(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session?.user)return;

  const isAdminUser=
    String(session.user.email||"").trim().toLowerCase()===
    "drmohamedalaa90@gmail.com";

  const toggle=document.getElementById("basicHomeTextAdminToggle");
  if(toggle)toggle.hidden=!isAdminUser;
  basicNewsAdmin=isAdminUser;
  const displayControls=document.getElementById("basicNewsDisplayControls");
  if(displayControls)displayControls.hidden=!isAdminUser;

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
      news_enabled:document.getElementById("basicNewsEnabled").checked,
      news_autoplay_seconds:Number(document.getElementById("basicHomeNewsAutoplay").value||5),
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

async function saveBasicNewsDisplaySettings(){
  const controls=document.getElementById("basicNewsDisplayControls");
  const status=document.getElementById("basicNewsDisplayStatus");
  const enabled=document.getElementById("basicNewsEnabled")?.checked!==false;
  const seconds=Number(document.getElementById("basicNewsQuickAutoplay")?.value||5);
  if(!controls||!status)return;
  controls.classList.remove("has-error");
  controls.classList.add("is-saving");
  status.textContent="Saving…";
  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(!session?.user||String(session.user.email||"").trim().toLowerCase()!=="drmohamedalaa90@gmail.com")throw new Error("Admin access required.");
    const {data,error}=await supabaseClient.from("acl_basic_home_settings").update({news_enabled:enabled,news_autoplay_seconds:seconds,updated_by:session.user.id,updated_at:new Date().toISOString()}).eq("id","basic-home").select().single();
    if(error)throw error;
    applyBasicHomeSettings(data);
    status.textContent="Saved";
    window.setTimeout(()=>{controls.classList.remove("is-saving");status.textContent=""},900);
  }catch(error){
    console.error("SAVE NEWS DISPLAY SETTINGS:",error);
    controls.classList.remove("is-saving");
    controls.classList.add("has-error");
    status.textContent="Could not save";
    applyBasicHomeSettings(basicHomeSettings);
  }
}

document.getElementById("basicNewsEnabled")?.addEventListener("change",()=>void saveBasicNewsDisplaySettings());
document.getElementById("basicNewsQuickAutoplay")?.addEventListener("change",()=>void saveBasicNewsDisplaySettings());
document.getElementById("basicHomeNewsAutoplay")?.addEventListener("change",event=>{
  const quick=document.getElementById("basicNewsQuickAutoplay");
  if(quick)quick.value=event.currentTarget.value;
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
let basicNewsScrollLastY=null;

const basicNewsSwipeHost=document.getElementById("basicNewsGrid");

basicNewsSwipeHost?.addEventListener("touchstart",event=>{
  const touch=event.touches?.[0];
  if(!touch)return;
  basicNewsSwipeStartX=touch.clientX;
  basicNewsSwipeStartY=touch.clientY;
  basicNewsScrollLastY=touch.clientY;
  stopBasicNewsAutoplay();
},{passive:true});

basicNewsSwipeHost?.addEventListener("touchmove",event=>{
  const touch=event.touches?.[0];
  const scroller=event.target.closest?.(".basic-news-card-body");
  if(!touch||!scroller||basicNewsScrollLastY===null)return;
  const delta=basicNewsScrollLastY-touch.clientY;
  basicNewsScrollLastY=touch.clientY;
  const atTop=scroller.scrollTop<=1;
  const atBottom=scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-1;
  if((delta>0&&atBottom)||(delta<0&&atTop)){
    window.scrollBy(0,delta);
    event.preventDefault();
  }
},{passive:false});

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
  basicNewsScrollLastY=null;

  if(Math.abs(dx)>=45 && Math.abs(dx)>Math.abs(dy)*1.15){
    setBasicNewsIndex(basicNewsIndex+(dx<0?1:-1));
    return;
  }

  startBasicNewsAutoplay();
},{passive:true});


/* Display only: the launch countdown never changes module release permissions. */
function basicLaunchRemaining(now=Date.now()){
 const seconds=Math.max(0,Math.ceil((Date.parse("2026-10-26T22:00:00+03:00")-now)/1000));
 return {days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60,done:seconds===0};
}
if($("basicLaunchCountdown")){
 let launchInterval=null;
 const updateLaunch=()=>{
  if(window.aclOfficialBannerActive)return;
  const remaining=basicLaunchRemaining();
  for(const key of ["days","hours","minutes","seconds"]){const el=$("basicLaunch"+key[0].toUpperCase()+key.slice(1));if(el)el.textContent=String(remaining[key]).padStart(2,"0");}
  if(remaining.done){$("basicLaunchTitle").textContent="Experimental phase is live";$("basicLaunchUnits").hidden=true;if(launchInterval)clearInterval(launchInterval);}
 };
 updateLaunch();
 if(!basicLaunchRemaining().done)launchInterval=setInterval(updateLaunch,1000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)updateLaunch();});
}

let basicModuleLaunchInterval=null;
function updateBasicModuleCountdowns(){
 const clocks=[...document.querySelectorAll("[data-module-launch-clock]")];
 if(!clocks.length){if(basicModuleLaunchInterval){clearInterval(basicModuleLaunchInterval);basicModuleLaunchInterval=null;}return;}
 const remaining=basicLaunchRemaining();
 if(remaining.done){
  if(basicModuleLaunchInterval){clearInterval(basicModuleLaunchInterval);basicModuleLaunchInterval=null;}
  clocks.forEach(clock=>clock.innerHTML="<small>Checking availability…</small>");
  void boot().catch(error=>{console.error("Launch availability:",error);clocks.forEach(clock=>clock.innerHTML="<small>Refresh to check availability</small>");});
  return;
 }
 const markup=[["days","Days"],["hours","Hrs"],["minutes","Min"],["seconds","Sec"]].map(([key,label])=>`<span><strong>${String(remaining[key]).padStart(2,"0")}</strong><em>${label}</em></span>`).join("");
 clocks.forEach(clock=>{clock.querySelector("[data-module-launch-units]").innerHTML=markup;});
 if(!basicModuleLaunchInterval)basicModuleLaunchInterval=setInterval(updateBasicModuleCountdowns,1000);
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)updateBasicModuleCountdowns();});

async function aclLoadDestinationOptions(){
 const s=document.getElementById('basicNewsDestination');if(!s)return;let rows=[...ACL_DESTINATIONS];
 try{const {data}=await supabaseClient.from('modules').select('id,title').eq('edition','basic').order('display_order');rows.push(...(data||[]).map(m=>['basic-module.html?edition=basic&module='+encodeURIComponent(m.id),m.title]));const {data:o}=await supabaseClient.rpc('acl_official_api',{p_action:'list',p_args:{}});rows.push(...(o?.competitions||[]).map(c=>['basic-official-competition.html?edition=basic&id='+encodeURIComponent(c.id),c.title]));}catch{}
 s.innerHTML='<option value="">No destination button</option>'+rows.map(([u,n])=>`<option value="${esc(u)}">${esc(n)}</option>`).join('')+'<option value="custom">Custom link</option>';
 s.onchange=()=>{if(s.value!=='custom'){document.getElementById('basicNewsLink').value=s.value;document.getElementById('basicNewsLinkLabel').value=s.selectedOptions[0]?.textContent||'';}};
}
function aclSaveNewsDestination(){
 const choice=document.getElementById('basicNewsDestination').value;
 const raw=(choice==='custom'?document.getElementById('basicNewsLink').value:choice).trim();if(!raw)return null;
 const u=new URL(raw,location.href);if(!['https:','http:'].includes(u.protocol))throw new Error('Choose a valid destination.');
 const label=document.getElementById('basicNewsLinkLabel').value.trim().replace(/^Go to\s+/i,'');
 if(label)u.searchParams.set('acl_link_label',label);else u.searchParams.delete('acl_link_label');
 return u.origin===location.origin?u.pathname+u.search+u.hash:u.href;
}

async function loadBasicLeagueLeaders(){
 const podium=$("basicLeaguePodium"),list=$("basicLeagueTop10");if(!podium||!list)return;
 try{const {data,error}=await supabaseClient.rpc("acl_basic_league_top10");if(error)throw error;const leaders=Array.isArray(data?.leaders)?data.leaders:[];
  const avatar=row=>row.avatar_url?`<span class="basic-league-avatar"><img src="${esc(row.avatar_url)}" alt=""></span>`:`<span class="basic-league-avatar">${esc(initials(row.name))}</span>`;
  podium.innerHTML=leaders.slice(0,3).length?leaders.slice(0,3).map(row=>`<article class="basic-league-winner rank-${row.rank}"><span class="basic-league-rank">${row.rank===1?'★ CHAMPION':`#${row.rank}`}</span>${avatar(row)}<strong>${esc(row.name)}</strong><b>${Number(row.points||0)} pts</b><small>${Number(row.modules_passed||0)} passed · ${Number(row.avg_accuracy||0)}%</small></article>`).join(""):'<div class="basic-league-loading">The league begins when candidates complete their first module quiz.</div>';
  list.innerHTML=leaders.slice(3,10).map(row=>`<article class="basic-league-row"><span>#${row.rank}</span><strong>${esc(row.name)}</strong><b>${Number(row.points||0)} pts</b><small>${Number(row.modules_passed||0)} passed · ${Number(row.avg_accuracy||0)}%</small></article>`).join("");
  const next=Date.parse(data?.next_update_at||"");if(Number.isFinite(next)){const delay=Math.max(1000,next-Date.now()+1500);setTimeout(()=>void loadBasicLeagueLeaders(),Math.min(delay,2147483647));}
 }catch(error){podium.innerHTML='<div class="basic-league-loading">League standings are temporarily unavailable.</div>';list.innerHTML="";console.warn("ACL LEAGUE",error)}
}
void loadBasicLeagueLeaders();
