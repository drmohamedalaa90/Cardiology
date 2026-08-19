import { supabaseClient } from "./supabase-client.js";

const body=document.body;
const backdrop=document.getElementById("aclDrawerBackdrop");
const toggle=document.getElementById("aclDrawerToggle");
const isMobile=()=>matchMedia("(max-width:820px)").matches;

function edition(){
  const q=new URLSearchParams(location.search).get("edition");
  let saved=null; try{saved=localStorage.getItem("aclSelectedEdition")}catch{}
  return (q||saved||"expert").toLowerCase()==="basic"?"basic":"expert";
}
const activeEdition=edition();
document.getElementById("aclHeaderEdition").textContent=activeEdition==="basic"?"THE BASIC EDITION":"THE EXPERT EDITION";
document.getElementById("aclWelcomeEyebrow").textContent=activeEdition==="basic"?"ACL BASIC EDITION":"ACL EXPERT EDITION";
document.querySelectorAll("[data-edition-link]").forEach(a=>a.classList.toggle("is-selected",a.dataset.editionLink===activeEdition));

function openDrawer(){
  if(isMobile()){body.classList.add("drawer-open");backdrop.hidden=false}
  else body.classList.remove("drawer-collapsed");
  toggle?.setAttribute("aria-expanded","true");
}
function closeDrawer(){
  if(isMobile()){body.classList.remove("drawer-open");backdrop.hidden=true}
  else body.classList.add("drawer-collapsed");
  toggle?.setAttribute("aria-expanded","false");
}
toggle?.addEventListener("click",()=>isMobile()?(body.classList.contains("drawer-open")?closeDrawer():openDrawer()):(body.classList.contains("drawer-collapsed")?openDrawer():closeDrawer()));
backdrop?.addEventListener("click",closeDrawer);
document.getElementById("aclMobileModulesButton")?.addEventListener("click",openDrawer);
window.addEventListener("resize",()=>{if(!isMobile()){body.classList.remove("drawer-open");backdrop.hidden=true}});

document.querySelectorAll("[data-collapse-target]").forEach(btn=>btn.addEventListener("click",()=>{
  const target=document.getElementById(btn.dataset.collapseTarget); if(!target)return;
  const open=target.hidden; target.hidden=!open; btn.setAttribute("aria-expanded",String(open));
  const ch=btn.querySelector(".acl-chevron"); if(ch)ch.textContent=open?"⌄":"›";
}));

async function signOut(){try{await supabaseClient.auth.signOut()}catch(e){console.warn(e)}location.replace("login.html")}
document.getElementById("aclHeaderLogout")?.addEventListener("click",signOut);
document.getElementById("aclDrawerLogout")?.addEventListener("click",signOut);

const chooseName=(p,u)=>p?.display_name||p?.full_name||p?.name||u?.user_metadata?.display_name||u?.user_metadata?.full_name||u?.email?.split("@")[0]||"Member";
const choosePhoto=(p,u)=>p?.avatar_url||p?.photo_url||p?.profile_photo_url||u?.user_metadata?.avatar_url||u?.user_metadata?.picture||"";

(async()=>{
  try{
    const {data:{session}}=await supabaseClient.auth.getSession(); if(!session?.user)return;
    const u=session.user; const {data:p}=await supabaseClient.from("profiles").select("*").eq("id",u.id).maybeSingle();
    const name=chooseName(p,u), photo=choosePhoto(p,u);
    ["aclHeaderUserName","aclDrawerName","aclWelcomeName"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=name});
    const av=document.getElementById("aclDrawerAvatar");
    if(av){
      if(photo){av.innerHTML=`<img src="${photo}" alt="">`}
      else av.textContent=name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"ACL";
    }
  }catch(e){console.warn("ACL shell profile",e)}
})();

function family(title,card){
  const t=String(title||"").toLowerCase();
  if(/ecg|rhythm|electrocard/.test(t)||card.classList.contains("module-ecg"))return"ecg";
  if(/echo|echocardiograph/.test(t)||card.classList.contains("module-imaging"))return"echo";
  if(/pci|tavi|mitral|tricuspid|left main|cto|circulatory|intervention/.test(t)||card.classList.contains("module-intervention"))return"interventions";
  return"basic";
}

function rawStatus(card){return(card.querySelector(".module-progress-line span")?.textContent||"").trim().toLowerCase()}
function rawScore(card){return(card.querySelector(".module-progress-line strong")?.textContent||"").trim()}
function titleOf(card){return card.querySelector("h2")?.textContent?.trim()||"ACL module"}
function actionOf(card){return card.querySelector(".module-action")}
function isLocked(card){const a=actionOf(card);return card.classList.contains("locked")||card.classList.contains("coming")||a?.classList.contains("disabled")}

function inferPercent(card){
  const txt=[rawScore(card),rawStatus(card),card.textContent].join(" ");
  const m=txt.match(/(\d+(?:\.\d+)?)\s*%/); if(m)return Math.max(0,Math.min(100,Number(m[1])));
  if(rawStatus(card).includes("completed"))return 100;
  if(rawStatus(card).includes("progress"))return 55;
  return 0;
}
function inferMeta(card){
  const txt=card.textContent.replace(/\s+/g," ");
  const frac=txt.match(/(\d+)\s*\/\s*(\d+)/);
  if(frac)return `${frac[1]} / ${frac[2]} lessons completed`;
  const st=rawStatus(card);
  return st.includes("completed")?"Completed":st.includes("progress")?"In progress":"Not started";
}
function visualClass(card){
  const f=family(titleOf(card),card);
  return f==="interventions"?"is-intervention":f==="echo"?"is-echo":"";
}
function iconFor(card){
  const f=family(titleOf(card),card);
  if(f==="interventions")return"♧";
  if(f==="echo")return"◉";
  if(f==="ecg")return"〽";
  return"♡";
}

function buildDrawer(cards){
  const buckets={basic:[],ecg:[],echo:[],interventions:[]};
  cards.forEach(c=>buckets[family(titleOf(c),c)].push(c));
  Object.entries(buckets).forEach(([key,list])=>{
    const host=document.querySelector(`[data-module-family="${key}"]`); if(!host)return;
    host.innerHTML="";
    if(!list.length){host.innerHTML='<span class="acl-tree-empty">No modules in this edition yet</span>';return}
    list.forEach(c=>{
      const a=document.createElement("a");a.textContent=titleOf(c);
      const act=actionOf(c);a.href=!isLocked(c)&&act?act.getAttribute("href"):"#";
      if(isLocked(c)){a.classList.add("is-locked");a.addEventListener("click",e=>e.preventDefault())}
      host.appendChild(a);
    });
  });
}

function buildContinue(cards){
  const host=document.getElementById("aclContinueLearning"); if(!host)return;
  const prioritized=cards.filter(c=>rawStatus(c).includes("progress")||rawStatus(c).includes("completed")).slice(0,3);
  const chosen=prioritized.length?prioritized:cards.filter(c=>!isLocked(c)).slice(0,3);
  host.innerHTML="";
  chosen.forEach(c=>{
    const pct=inferPercent(c), act=actionOf(c), locked=isLocked(c);
    const art=document.createElement("article"); art.className=`acl-continue-card ${visualClass(c)}`;
    art.innerHTML=`
      <div class="acl-continue-card-top">
        <div class="acl-continue-icon">${iconFor(c)}</div>
        <div class="acl-continue-copy"><h3>${titleOf(c)}</h3><small>${rawStatus(c)||"Not started"}</small></div>
        <strong class="acl-continue-percent">${pct}%</strong>
      </div>
      <div class="acl-continue-progress"><span style="width:${pct}%"></span></div>
      <div class="acl-continue-meta">${inferMeta(c)}</div>
      <a href="${!locked&&act?act.getAttribute("href"):"#"}" ${locked?'aria-disabled="true" tabindex="-1"':''}>›</a>`;
    host.appendChild(art);
  });
}

function stats(cards){
  let done=0,prog=0;cards.forEach(c=>{const s=rawStatus(c);if(s.includes("completed"))done++;else if(s.includes("progress"))prog++});
  const eligible=cards.filter(c=>!c.classList.contains("coming")).length||1;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set("aclStatCompleted",done);set("aclStatInProgress",prog);set("aclStatOverall",Math.round(done/eligible*100)+"%");
}

let sig="";
function sync(){
  const cards=[...document.querySelectorAll("#modules .module-card")]; if(!cards.length)return;
  const s=cards.map(c=>c.dataset.moduleId||titleOf(c)).join("|"); if(s===sig)return; sig=s;
  buildDrawer(cards);buildContinue(cards);stats(cards);
}
const root=document.getElementById("modules");
if(root){new MutationObserver(sync).observe(root,{childList:true,subtree:true});sync()}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&body.classList.contains("drawer-open"))closeDrawer()});
