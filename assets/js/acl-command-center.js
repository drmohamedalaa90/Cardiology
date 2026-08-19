import { supabaseClient } from "./supabase-client.js";

const body = document.body;
const drawer = document.getElementById("aclCommandDrawer");
const drawerToggle = document.getElementById("aclDrawerToggle");
const backdrop = document.getElementById("aclDrawerBackdrop");

function currentEdition(){
  const p = new URLSearchParams(location.search).get("edition");
  const s = (()=>{ try{return localStorage.getItem("aclSelectedEdition")}catch{return null} })();
  return (p || s || "expert").toLowerCase() === "basic" ? "basic" : "expert";
}

const edition = currentEdition();
document.getElementById("aclHeaderEdition").textContent =
  edition === "basic" ? "THE BASIC EDITION" : "THE EXPERT EDITION";
document.getElementById("aclWelcomeEyebrow").textContent =
  edition === "basic" ? "ACL BASIC EDITION" : "ACL EXPERT EDITION";

document.querySelectorAll("[data-edition-link]").forEach(a=>{
  a.classList.toggle("is-selected", a.dataset.editionLink === edition);
});

function isMobile(){ return window.matchMedia("(max-width:820px)").matches; }

function openDrawer(){
  if(isMobile()){
    body.classList.add("drawer-open");
    backdrop.hidden = false;
  }else{
    body.classList.remove("drawer-collapsed");
  }
  drawerToggle?.setAttribute("aria-expanded","true");
}

function closeDrawer(){
  if(isMobile()){
    body.classList.remove("drawer-open");
    backdrop.hidden = true;
  }else{
    body.classList.add("drawer-collapsed");
  }
  drawerToggle?.setAttribute("aria-expanded","false");
}

drawerToggle?.addEventListener("click", ()=>{
  if(isMobile()){
    body.classList.contains("drawer-open") ? closeDrawer() : openDrawer();
  }else{
    body.classList.contains("drawer-collapsed") ? openDrawer() : closeDrawer();
  }
});
backdrop?.addEventListener("click", closeDrawer);
document.getElementById("aclMobileModulesButton")?.addEventListener("click", openDrawer);

window.addEventListener("resize", ()=>{
  if(!isMobile()){
    body.classList.remove("drawer-open");
    backdrop.hidden = true;
  }
});

document.querySelectorAll("[data-collapse-target]").forEach(button=>{
  button.addEventListener("click", ()=>{
    const target = document.getElementById(button.dataset.collapseTarget);
    if(!target) return;
    const willOpen = target.hidden;
    target.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
    const c = button.querySelector(".acl-chevron");
    if(c) c.textContent = willOpen ? "⌄" : "›";
  });
});

async function signOut(){
  try{ await supabaseClient.auth.signOut(); }catch(e){ console.warn("ACL sign out:",e); }
  location.replace("login.html");
}
document.getElementById("aclHeaderLogout")?.addEventListener("click", signOut);
document.getElementById("aclDrawerLogout")?.addEventListener("click", signOut);

function firstUsefulName(profile,user){
  return profile?.display_name ||
         profile?.full_name ||
         profile?.name ||
         user?.user_metadata?.display_name ||
         user?.user_metadata?.full_name ||
         user?.email?.split("@")[0] ||
         "Member";
}
function firstPhoto(profile,user){
  return profile?.avatar_url ||
         profile?.photo_url ||
         profile?.profile_photo_url ||
         user?.user_metadata?.avatar_url ||
         user?.user_metadata?.picture ||
         "";
}

async function hydrateProfile(){
  try{
    const {data:{session}} = await supabaseClient.auth.getSession();
    if(!session?.user) return;
    const user = session.user;
    const {data:profile} = await supabaseClient.from("profiles").select("*").eq("id",user.id).maybeSingle();
    const name = firstUsefulName(profile,user);
    const photo = firstPhoto(profile,user);

    document.getElementById("aclHeaderUserName").textContent = name;
    document.getElementById("aclDrawerName").textContent = name;
    document.getElementById("aclWelcomeName").textContent = name;

    const avatar = document.getElementById("aclDrawerAvatar");
    if(photo){
      avatar.innerHTML = "";
      const img = document.createElement("img");
      img.src = photo;
      img.alt = "";
      avatar.appendChild(img);
    }else{
      const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
      avatar.innerHTML = `<span>${initials || "ACL"}</span>`;
    }
  }catch(e){
    console.warn("ACL profile shell hydration:",e);
  }
}
hydrateProfile();

function moduleFamily(title, card){
  const t = String(title || "").toLowerCase();
  if(/ecg|rhythm|electrocard/.test(t) || card.classList.contains("module-ecg")) return "ecg";
  if(/echo|echocardiograph/.test(t) || card.classList.contains("module-imaging")) return "echo";
  if(/pci|tavi|mitral|tricuspid|left main|cto|circulatory|intervention/.test(t) || card.classList.contains("module-intervention")) return "interventions";
  return "basic";
}

function cardProgress(card){
  const line = card.querySelector(".module-progress-line");
  const status = (line?.querySelector("span")?.textContent || "").trim().toLowerCase();
  return {status, has:!!line};
}

function moduleIcon(card){
  if(card.classList.contains("module-intervention")) return "◈";
  if(card.classList.contains("module-ecg")) return "〽";
  if(card.classList.contains("module-imaging")) return "◉";
  return "♡";
}

function buildDrawerTree(cards){
  const buckets = {basic:[],ecg:[],echo:[],interventions:[]};

  cards.forEach(card=>{
    const title = card.querySelector("h2")?.textContent?.trim();
    if(!title) return;
    const action = card.querySelector(".module-action");
    const family = moduleFamily(title,card);
    buckets[family].push({
      title,
      href: action && !action.classList.contains("disabled") ? action.getAttribute("href") : "#",
      locked: card.classList.contains("locked") || card.classList.contains("coming") || action?.classList.contains("disabled")
    });
  });

  Object.entries(buckets).forEach(([family,items])=>{
    const host = document.querySelector(`[data-module-family="${family}"]`);
    if(!host) return;
    host.innerHTML = "";
    if(!items.length){
      host.innerHTML = `<span class="acl-tree-empty">No modules in this edition yet</span>`;
      return;
    }
    items.forEach(item=>{
      const a = document.createElement("a");
      a.textContent = item.title;
      a.href = item.locked ? "#" : item.href;
      if(item.locked){
        a.classList.add("is-locked");
        a.addEventListener("click",e=>e.preventDefault());
      }
      host.appendChild(a);
    });
  });
}

function buildContinueLearning(cards){
  const host = document.getElementById("aclContinueLearning");
  if(!host) return;
  const useful = cards.filter(c=>{
    const p = cardProgress(c);
    return p.status.includes("progress") || p.status.includes("completed");
  }).slice(0,3);

  host.innerHTML = "";
  const source = useful.length ? useful : cards.filter(c=>!c.classList.contains("locked")&&!c.classList.contains("coming")).slice(0,3);

  source.forEach(card=>{
    const title = card.querySelector("h2")?.textContent?.trim() || "ACL module";
    const action = card.querySelector(".module-action");
    const progress = cardProgress(card);
    const scoreText = card.querySelector(".module-progress-line strong")?.textContent?.trim() || "";
    const pctMatch = scoreText.match(/(\d+(?:\.\d+)?)\s*%/);
    const pct = pctMatch ? Math.max(0,Math.min(100,Number(pctMatch[1]))) :
      (progress.status.includes("completed") ? 100 : progress.status.includes("progress") ? 55 : 0);

    const article = document.createElement("article");
    article.className = "acl-continue-card";
    article.innerHTML = `
      <div class="acl-continue-card-top">
        <div class="acl-continue-icon">${moduleIcon(card)}</div>
        <div class="acl-continue-copy">
          <h3>${title}</h3>
          <small>${progress.status || "Ready to learn"}</small>
        </div>
        <strong>${pct ? pct+"%" : ""}</strong>
      </div>
      <div class="acl-continue-progress"><span style="width:${pct}%"></span></div>
      <a href="${action && !action.classList.contains("disabled") ? action.getAttribute("href") : "#"}">
        ${progress.status.includes("completed") ? "Review Again →" : "Continue Learning →"}
      </a>`;
    host.appendChild(article);
  });

  if(!source.length) host.innerHTML = `<div class="acl-tree-empty">No open modules yet.</div>`;
}

function updateStats(cards){
  let completed=0,inProgress=0;
  cards.forEach(card=>{
    const s=cardProgress(card).status;
    if(s.includes("completed")) completed++;
    else if(s.includes("progress")) inProgress++;
  });
  const eligible = cards.filter(c=>!c.classList.contains("coming")).length || cards.length || 1;
  const overall = Math.round((completed/eligible)*100);
  document.getElementById("aclStatCompleted").textContent = completed;
  document.getElementById("aclStatInProgress").textContent = inProgress;
  document.getElementById("aclStatOverall").textContent = overall+"%";
}

let lastSignature="";
function syncFromModuleRenderer(){
  const cards = [...document.querySelectorAll("#modules .module-card")];
  if(!cards.length) return;
  const signature = cards.map(c=>c.dataset.moduleId || c.querySelector("h2")?.textContent).join("|");
  if(signature===lastSignature) return;
  lastSignature=signature;
  buildDrawerTree(cards);
  buildContinueLearning(cards);
  updateStats(cards);
}

const modulesRoot = document.getElementById("modules");
if(modulesRoot){
  new MutationObserver(syncFromModuleRenderer).observe(modulesRoot,{childList:true,subtree:true});
  syncFromModuleRenderer();
}

document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && body.classList.contains("drawer-open")) closeDrawer();
});
