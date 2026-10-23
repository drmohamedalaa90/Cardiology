import { supabaseClient } from "./supabase-client.js";
const params=new URLSearchParams(location.search);
let saved="";try{saved=localStorage.getItem("aclSelectedEdition")||""}catch{}
const edition=String(params.get("edition")||saved||"").toLowerCase();
if(edition==="basic"){
  document.documentElement.classList.add("acl-basic-shell-mode");
  try{localStorage.setItem("aclSelectedEdition","basic");sessionStorage.setItem("aclSelectedEdition","basic")}catch{}
  const existing=document.getElementById("aclSharedShell");if(existing)existing.classList.add("basic-shell-hidden");
  document.body.classList.add("acl-basic-unified");
  document.body.classList.remove("acl-command-body","acl-shared-page","drawer-open","drawer-collapsed");
  const main=document.querySelector("body>main");main?.classList.remove("acl-command-main","acl-shared-main");
  const page=location.pathname.split("/").pop()||"";
  const isBasicLearningPage =
    page === "learning-expert.html" ||
    page === "learning.html";

  if (isBasicLearningPage) {
    document.body.classList.add("acl-basic-learning-quiz");
  }

  const active=(name)=>page===name?"is-active":"";
  const activeAny=(names)=>names.includes(page)?"is-active":"";
  const shell=document.createElement("div");
  shell.innerHTML=`<header class="basic-universal-topbar">
    <a class="basic-universal-brand" href="basic-home.html?edition=basic"><img src="assets/images/acl-header-mark.svg" alt=""><span class="basic-universal-brand-copy"><strong>Cardiology League</strong><small>Basic Edition</small></span></a>
    <div class="basic-universal-actions">
      <button class="basic-expert-lock" id="basicExpertLocked" type="button"><span class="basic-lock-dot">◆</span><span>Expert Edition</span><small>Locked</small></button>
      <div class="basic-universal-user"><span class="basic-universal-avatar" id="basicUniversalAvatar">ACL</span><strong id="basicUniversalName">Member</strong></div>
      <a class="basic-universal-contact" href="mailto:drmohamedalaa90@gmail.com">Contact us</a>
      <button class="basic-universal-logout" id="basicUniversalLogout" type="button">Log out</button>
    </div>
  </header>
  <nav class="basic-universal-bottom" aria-label="Basic Edition navigation">
    <a class="${active("basic-home.html")}" href="basic-home.html?edition=basic"><span>⌂</span><strong>Home</strong></a>
    <a class="${activeAny(["basic-profile.html","profile.html"])}" href="basic-profile.html?edition=basic"><span>♙</span><strong>Profile</strong></a>
    <a class="${activeAny(["basic-challenges.html","challenge.html"])}" href="basic-challenges.html?edition=basic"><span>⚔</span><strong>Challenges</strong></a>
    <a class="${activeAny(["basic-progress.html","progress.html"])}" href="basic-progress.html?edition=basic"><span>▤</span><strong>Progress</strong></a>
  </nav>
  <div class="basic-level-modal" id="basicLevelModal" hidden><section class="basic-level-dialog" role="dialog" aria-modal="true" aria-labelledby="basicLevelTitle"><div class="basic-level-icon">◆</div><h2 id="basicLevelTitle">Expert Edition</h2><p>This edition is not available for your level.</p><button type="button" id="basicLevelClose">Continue Basic Edition</button></section></div>`;
  document.body.insertBefore(shell,document.body.firstChild);
  const modal=document.getElementById("basicLevelModal");
  const close=()=>{if(modal)modal.hidden=true};
  document.getElementById("basicExpertLocked")?.addEventListener("click",()=>{if(modal)modal.hidden=false});
  document.getElementById("basicLevelClose")?.addEventListener("click",close);
  modal?.addEventListener("click",e=>{if(e.target===modal)close()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
  document.getElementById("basicUniversalLogout")?.addEventListener("click",async()=>{try{await supabaseClient.auth.signOut()}catch{}location.replace("acl-access.html?build=20261023-clean")});
  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    const u=session?.user;
    if(u){
      let p=null;try{const r=await supabaseClient.from("profiles").select("display_name,full_name,name,avatar_url,photo_url,profile_photo_url").eq("id",u.id).maybeSingle();p=r.data}catch{}
      const name=p?.display_name||p?.full_name||p?.name||u.user_metadata?.display_name||u.user_metadata?.full_name||u.email?.split("@")[0]||"Member";
      const photo=p?.avatar_url||p?.photo_url||p?.profile_photo_url||u.user_metadata?.avatar_url||u.user_metadata?.picture||"";
      const nameEl=document.getElementById("basicUniversalName");if(nameEl)nameEl.textContent=name;
      const av=document.getElementById("basicUniversalAvatar");
      if(av){if(photo){const img=document.createElement("img");img.src=photo;img.alt="";av.replaceChildren(img)}else{av.textContent=String(name).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"ACL"}}
    }
  }catch{}
  document.querySelectorAll("a[href*='edition=expert']").forEach(a=>{
    try{
      const u=new URL(a.href,location.href);
      u.searchParams.set("edition","basic");
      a.href=u.origin===location.origin?`${u.pathname}${u.search}${u.hash}`:u.toString();
    }catch{}
  });
  const back=document.getElementById("learningBackToModule");if(back){const mid=new URLSearchParams(location.search).get("module");back.href=mid?`basic-module.html?edition=basic&module=${encodeURIComponent(mid)}`:"basic-home.html?edition=basic";}
  document.querySelectorAll(".learning-mode-label").forEach(el=>el.textContent="BASIC LEARNING MODE");
  const desc=document.getElementById("quizDescription");if(desc)desc.textContent="Focused foundation-level learning with immediate feedback and topic review.";
  if (isBasicLearningPage) {
    const title = document.getElementById("quizTitle");
    const main = document.querySelector(".learning-session-main");
    if (main) main.setAttribute("aria-hidden","true");
    if (title) title.setAttribute("aria-hidden","true");
  }
  const progressCopy=document.querySelector(".progress-hero .muted");if(progressCopy)progressCopy.textContent="Your Basic Edition performance, module progress and learning momentum.";
  const profileCopy=document.querySelector("main .card > .muted");if(profileCopy&&profileCopy.textContent.includes("Expert Edition"))profileCopy.textContent=profileCopy.textContent.replace("Expert Edition","Basic Edition");
}

/* acl-basic-module-route-guard */
if (edition === "basic") {
  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link) return;

    const raw = link.getAttribute("href") || "";

    if (
      raw === "modules.html" ||
      raw === "modules.html?edition=basic" ||
      raw === "module-hub.html?edition=basic"
    ) {
      event.preventDefault();

      const moduleId =
        new URLSearchParams(location.search).get("module");

      location.href =
        moduleId
          ? `basic-module.html?edition=basic&module=${encodeURIComponent(moduleId)}`
          : "basic-home.html?edition=basic";
    }
  });
}


/* ACL Basic membership presence + suspension enforcement */
async function aclBasicPresenceHeartbeat(){
  if(edition!=="basic") return;
  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(!session?.user) return;
    const {data,error}=await supabaseClient.rpc("acl_touch_basic_presence");
    if(error) return;
    if(data?.allowed===false){
      try{await supabaseClient.auth.signOut()}catch{}
      location.replace("acl-access.html?build=20261023-clean&held=1");
    }
  }catch{}
}
if(edition==="basic"){
  void aclBasicPresenceHeartbeat();
  const aclBasicPresenceTimer=setInterval(()=>void aclBasicPresenceHeartbeat(),120000);
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden) void aclBasicPresenceHeartbeat();
  });
  window.addEventListener("pagehide",()=>clearInterval(aclBasicPresenceTimer),{once:true});
}
