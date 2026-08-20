import { supabaseClient } from "./supabase-client.js";

const EDITION_KEY="aclSelectedEdition";
const VALID_EDITIONS=new Set(["basic","expert"]);
const nested=location.pathname.includes("/modules/");
const root=(p)=>nested?`../../${p}`:p;
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initials=(v="ACL")=>String(v).trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"ACL";

function activeEdition(){
  const q=String(new URLSearchParams(location.search).get("edition")||"").toLowerCase();
  if(VALID_EDITIONS.has(q)){localStorage.setItem(EDITION_KEY,q);return q;}
  const saved=String(localStorage.getItem(EDITION_KEY)||"expert").toLowerCase();
  return VALID_EDITIONS.has(saved)?saved:"expert";
}
function url(path,edition=activeEdition()){
  const u=new URL(root(path),location.href);u.searchParams.set("edition",edition);
  return u.origin===location.origin?`${u.pathname}${u.search}${u.hash}`:u.toString();
}
function ensureCss(){
  if(document.getElementById("aclFinalShellCss"))return;
  const l=document.createElement("link");l.id="aclFinalShellCss";l.rel="stylesheet";l.href=root("assets/css/acl-final-shell.css?v=1.0.0");document.head.appendChild(l);
}
function setEdition(edition){
  if(!VALID_EDITIONS.has(edition))return;
  localStorage.setItem(EDITION_KEY,edition);
  const page=location.pathname.split("/").pop();
  if(nested){location.assign(url("modules.html",edition));return;}
  const u=new URL(location.href);u.searchParams.set("edition",edition);location.assign(`${u.pathname}${u.search}${u.hash}`);
}

export async function requireSession(relativeLogin="login.html"){
  const {data,error}=await supabaseClient.auth.getSession();
  if(error||!data?.session){location.replace(root(relativeLogin));return null;}
  return data.session;
}
export async function loadProfile(){
  const {data:sessionData}=await supabaseClient.auth.getSession();
  const user=sessionData?.session?.user;if(!user)return null;
  const {data,error}=await supabaseClient.from("profiles").select("*").eq("id",user.id).maybeSingle();
  if(error)throw error;
  const md=user.user_metadata||{};
  const name=data?.display_name||data?.full_name||md.display_name||md.full_name||md.name||data?.username||user.email||"ACL User";
  return {...(data||{}),id:data?.id||user.id,email:user.email||data?.email||"",display_name:name,full_name:data?.full_name||name,avatar_url:data?.avatar_url||md.avatar_url||md.picture||""};
}
export function renderUserChip(profile){
  const chip=document.getElementById("userChip");if(!chip||!profile)return;
  chip.textContent=profile.display_name||profile.full_name||"ACL User";chip.href=url("profile.html");
}
export async function signOut(){await supabaseClient.auth.signOut();location.replace(root("login.html"));}
window.aclSignOut=signOut;

function family(title="",category=""){
  const t=`${title} ${category}`.toLowerCase();
  if(/ecg|rhythm|arrhythm|electrocard/.test(t))return"ecg";
  if(/echo|echocardi|imaging|cmr|ccta/.test(t))return"echo";
  if(/pci|intervention|tavi|structural|bifurcation|left main|cto/.test(t))return"interventions";
  return"basic";
}
async function moduleBuckets(){
  const buckets={basic:[],ecg:[],echo:[],interventions:[]};
  try{
    const {data,error}=await supabaseClient.from("modules").select("id,title,category,status,launch_path,edition,display_order").eq("edition",activeEdition()).order("display_order",{ascending:true});
    if(error)throw error;(data||[]).forEach(m=>buckets[family(m.title,m.category)].push(m));
  }catch(e){console.warn("ACL drawer modules",e)}
  return buckets;
}
function familyHtml(key,label,items,open=false){
  const rows=items.length?items.map(m=>`<a href="${m.launch_path?esc(url(m.launch_path)):"#"}">${esc(m.title)}</a>`).join(""):`<span class="acl-final-empty">No modules yet</span>`;
  return `<section class="acl-final-family"><button type="button" data-family="${key}" aria-expanded="${open}"><span>${label}</span><span>${open?"⌄":"›"}</span></button><div id="aclFamily-${key}" class="acl-final-family-list" ${open?"":"hidden"}>${rows}</div></section>`;
}
function headerHtml(profile){
  const name=profile?.display_name||profile?.full_name||"Member";
  return `<header class="acl-final-header"><div class="acl-final-header-left"><button id="aclFinalMenu" class="acl-final-menu" type="button" aria-label="Menu"><i></i><i></i><i></i></button><a class="acl-final-brand" href="${url("modules.html")}"><img src="${root("assets/images/acl-icon-192.png")}" alt=""><span class="acl-final-brand-copy"><strong>Alexandria Cardiology League</strong><span>${activeEdition()==="basic"?"BASIC EDITION":"EXPERT EDITION"}</span></span></a></div><div class="acl-final-header-right"><span class="acl-final-user">${esc(name)}</span><a class="acl-final-action" href="${url("notifications.html")}" title="Notifications">◌</a><a class="acl-final-action" href="${url("settings.html")}" title="Settings">⚙</a><button id="aclFinalLogoutTop" class="acl-final-action" type="button" title="Log out">↪</button></div></header>`;
}
async function shellHtml(profile){
  const b=await moduleBuckets();const name=profile?.display_name||profile?.full_name||"ACL User";
  const avatar=profile?.avatar_url?`<img src="${esc(profile.avatar_url)}" alt="">`:`<span>${initials(name)}</span>`;
  return `${headerHtml(profile)}<div id="aclFinalBackdrop" class="acl-final-backdrop" hidden></div><aside id="aclFinalDrawer" class="acl-final-drawer"><div class="acl-final-drawer-scroll"><section class="acl-final-profile"><div class="acl-final-avatar">${avatar}</div><div><strong>${esc(name)}</strong><a href="${url("profile.html")}">Edit profile</a></div></section><nav class="acl-final-nav"><a href="${url("progress.html")}"><span class="navico">▤</span><span>My Progress</span></a><section class="acl-final-group"><button type="button" data-group="editions"><span><span class="navico">⇄</span>Editions</span><span>⌄</span></button><div id="aclGroup-editions" class="acl-final-sub"><button type="button" data-edition="basic" class="${activeEdition()==="basic"?"is-selected":""}">Basic Edition</button><button type="button" data-edition="expert" class="${activeEdition()==="expert"?"is-selected":""}">Expert Edition</button></div></section><section class="acl-final-group"><button type="button" data-group="modules"><span><span class="navico">▦</span>Modules</span><span>⌄</span></button><div id="aclGroup-modules" class="acl-final-sub">${familyHtml("basic","BASIC CARDIOLOGY",b.basic,true)}${familyHtml("ecg","ECG",b.ecg)}${familyHtml("echo","ECHO",b.echo)}${familyHtml("interventions","INTERVENTIONS",b.interventions)}</div></section><a href="${url("learning.html")}"><span class="navico">◆</span><span>Mindmaps &amp; Flashcards</span></a><a href="${url("challenge.html")}"><span class="navico">⚔</span><span>Challenge Friends</span></a><a href="${url("competitions.html")}"><span class="navico">🏆</span><span>Formal ACL Competitions</span></a><a href="${url("notifications.html")}"><span class="navico">◌</span><span>Notifications</span></a><a href="${url("settings.html")}"><span class="navico">⚙</span><span>Settings</span></a></nav></div><button id="aclFinalLogout" class="acl-final-logout" type="button"><span>↪</span><span>Log out</span></button></aside>`;
}
function bindShell(){
  const body=document.body,drawer=document.getElementById("aclFinalDrawer"),backdrop=document.getElementById("aclFinalBackdrop");
  const mobile=()=>matchMedia("(max-width:900px)").matches;
  const setOpen=(open)=>{if(mobile()){body.classList.toggle("acl-drawer-open",open);backdrop.hidden=!open}else{body.classList.toggle("acl-drawer-closed",!open);backdrop.hidden=true}};
  document.getElementById("aclFinalMenu")?.addEventListener("click",()=>setOpen(mobile()?!body.classList.contains("acl-drawer-open"):body.classList.contains("acl-drawer-closed")));
  backdrop?.addEventListener("click",()=>setOpen(false));
  document.getElementById("aclFinalLogout")?.addEventListener("click",signOut);document.getElementById("aclFinalLogoutTop")?.addEventListener("click",signOut);
  document.querySelectorAll("[data-edition]").forEach(x=>x.addEventListener("click",()=>setEdition(x.dataset.edition)));
  document.querySelectorAll("[data-group]").forEach(btn=>btn.addEventListener("click",()=>{const el=document.getElementById(`aclGroup-${btn.dataset.group}`);if(el)el.hidden=!el.hidden}));
  document.querySelectorAll("[data-family]").forEach(btn=>btn.addEventListener("click",()=>{const el=document.getElementById(`aclFamily-${btn.dataset.family}`);if(!el)return;el.hidden=!el.hidden;btn.setAttribute("aria-expanded",String(!el.hidden));btn.lastElementChild.textContent=el.hidden?"›":"⌄"}));
  window.addEventListener("resize",()=>{if(!mobile()){body.classList.remove("acl-drawer-open");backdrop.hidden=true}});
}
async function installShell(profile){
  if(document.getElementById("aclFinalDrawer"))return;ensureCss();document.body.classList.add("acl-final-page");
  const old=document.querySelector(".topbar");if(old)old.classList.add("acl-shell-source");
  const holder=document.createElement("div");holder.innerHTML=await shellHtml(profile);while(holder.firstChild)document.body.insertBefore(holder.firstChild,document.body.firstChild);bindShell();
}
export async function protectAndRender(relativeLogin="login.html"){
  const session=await requireSession(relativeLogin);if(!session)return null;
  const profile=await loadProfile();if(!profile||profile.account_status==="suspended"){await supabaseClient.auth.signOut();alert("This account has been suspended. Contact the ACL administrator.");location.replace(root(relativeLogin));return null;}
  renderUserChip(profile);await installShell(profile);return profile;
}

ensureCss();
